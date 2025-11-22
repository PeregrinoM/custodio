import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Levenshtein distance calculation
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

function similarityRatio(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookCode, paragraphs } = await req.json();

    if (!bookCode || !Array.isArray(paragraphs)) {
      return new Response(
        JSON.stringify({ error: 'Missing bookCode or paragraphs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get book and all its paragraphs
    const { data: book } = await supabase
      .from('books')
      .select('id')
      .eq('code', bookCode)
      .single();

    if (!book) {
      return new Response(
        JSON.stringify({ error: 'Book not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: dbParagraphs } = await supabase
      .from('paragraphs')
      .select('id, refcode_short, base_text, chapter_id, chapters!inner(number, title, book_id)')
      .eq('chapters.book_id', book.id)
      .not('refcode_short', 'is', null);

    if (!dbParagraphs || dbParagraphs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No paragraphs found for book' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate similarities for each uploaded paragraph
    const matches = paragraphs.map((uploadedText: string, index: number) => {
      const normalizedUploaded = normalizeText(uploadedText);
      
      const similarities = dbParagraphs.map(dbPara => ({
        code: dbPara.refcode_short!,
        similarity: similarityRatio(normalizedUploaded, normalizeText(dbPara.base_text)),
        text: dbPara.base_text
      }));

      // Sort by similarity descending
      similarities.sort((a, b) => b.similarity - a.similarity);

      const bestMatch = similarities[0].similarity > 0.7 ? similarities[0] : null;
      const suggestions = similarities.slice(0, 5); // Top 5 suggestions

      return {
        index,
        bestMatch,
        suggestions
      };
    });

    return new Response(
      JSON.stringify({ matches }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in find-paragraph-matches:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
