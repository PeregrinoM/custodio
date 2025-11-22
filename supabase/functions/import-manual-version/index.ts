import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface CodeAssignment {
  index: number;
  text: string;
  assignedCode: string;
  status: 'auto' | 'manual' | 'missing' | 'pending';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookCode, versionType, editionDate, versionNotes, assignments } = await req.json();

    if (!bookCode || !versionType || !Array.isArray(assignments)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get book
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id')
      .eq('code', bookCode)
      .single();

    if (bookError || !book) {
      throw new Error('Book not found');
    }

    // Get latest version number
    const { data: versions } = await supabase
      .from('book_versions')
      .select('version_number')
      .eq('book_id', book.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersionNumber = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

    // Start transaction-like operations
    // 1. If this is a physical baseline, unset current baseline
    if (versionType === 'physical_baseline') {
      await supabase
        .from('book_versions')
        .update({ is_baseline: false })
        .eq('book_id', book.id)
        .eq('is_baseline', true);
    }

    // 2. Create book_version
    const { data: newVersion, error: versionError } = await supabase
      .from('book_versions')
      .insert({
        book_id: book.id,
        version_number: nextVersionNumber,
        source_type: 'manual_pdf',
        import_date: new Date().toISOString(),
        is_baseline: versionType === 'physical_baseline',
        edition_date: editionDate || null,
        version_notes: versionNotes || null
      })
      .select('id')
      .single();

    if (versionError || !newVersion) {
      throw new Error('Failed to create book version');
    }

    // 3. Get all paragraph IDs for codes
    const assignedCodes = assignments
      .filter((a: CodeAssignment) => a.assignedCode && a.assignedCode !== 'FALTA')
      .map((a: CodeAssignment) => a.assignedCode);

    const { data: paragraphs } = await supabase
      .from('paragraphs')
      .select('id, refcode_short')
      .in('refcode_short', assignedCodes);

    if (!paragraphs) {
      throw new Error('Failed to fetch paragraphs');
    }

    // Create map of code -> paragraph_id
    const codeToId = new Map(paragraphs.map(p => [p.refcode_short!, p.id]));

    // 4. Create version_snapshots
    const snapshots = assignments
      .filter((a: CodeAssignment) => a.assignedCode && a.assignedCode !== 'FALTA')
      .map((a: CodeAssignment) => ({
        version_id: newVersion.id,
        paragraph_id: codeToId.get(a.assignedCode)!,
        paragraph_text: a.text
      }))
      .filter(s => s.paragraph_id); // Only include valid paragraph IDs

    if (snapshots.length > 0) {
      const { error: snapshotsError } = await supabase
        .from('version_snapshots')
        .insert(snapshots);

      if (snapshotsError) {
        console.error('Error creating snapshots:', snapshotsError);
        throw new Error('Failed to create version snapshots');
      }
    }

    // 5. If this is the new baseline, update paragraph base_text
    if (versionType === 'physical_baseline') {
      for (const assignment of assignments) {
        if (assignment.assignedCode && assignment.assignedCode !== 'FALTA') {
          const paragraphId = codeToId.get(assignment.assignedCode);
          if (paragraphId) {
            await supabase
              .from('paragraphs')
              .update({ base_text: assignment.text })
              .eq('id', paragraphId);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        versionId: newVersion.id,
        versionNumber: nextVersionNumber,
        snapshotsCreated: snapshots.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in import-manual-version:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
