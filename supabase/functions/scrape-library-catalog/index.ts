import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    console.log("[SCRAPE-CATALOG] Starting catalog scrape...");

    // Get configuration from database
    const { data: configData, error: configError } = await supabaseClient
      .from("catalog_config")
      .select("config_key, config_value")
      .in("config_key", ["library_base_url", "library_folder_id", "library_folder_path"]);

    if (configError) throw configError;

    // Build config object
    const config: Record<string, string> = {};
    configData?.forEach(item => {
      config[item.config_key] = item.config_value;
    });

    const baseUrl = config.library_base_url || 'https://m.egwwritings.org';
    const folderId = config.library_folder_id || '236';
    const folderPath = config.library_folder_path || '/es/folders/';
    const fullUrl = `${baseUrl}${folderPath}${folderId}`;

    console.log(`[SCRAPE-CATALOG] Fetching from: ${fullUrl}`);

    // Fetch the catalog page
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'EGW-Monitor/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch catalog: ${response.status}`);
    }

    const html = await response.text();

    // Parse book entries from HTML
    // Pattern: <a href="/es/book/174.0">El Deseado de Todas las Gentes</a>
    const bookPattern = /<a href="\/es\/book\/(\d+)\.\d+"[^>]*>([^<]+)<\/a>/g;
    const books: Array<{
      egw_book_id: number;
      title: string;
    }> = [];

    let match;
    while ((match = bookPattern.exec(html)) !== null) {
      const egw_book_id = parseInt(match[1]);
      const title = match[2].trim();
      
      // Only Spanish books from /es/ URLs
      books.push({
        egw_book_id,
        title
      });
    }

    console.log(`[SCRAPE-CATALOG] Found ${books.length} Spanish books`);

    // Remove duplicates by egw_book_id (keep first occurrence)
    const uniqueBooks = books.filter((book, index, self) =>
      index === self.findIndex((b) => b.egw_book_id === book.egw_book_id)
    );

    console.log(`[SCRAPE-CATALOG] ${uniqueBooks.length} unique books after deduplication`);

    // Insert or update books in catalog
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let tocUpdatedCount = 0;
    let tocErrorCount = 0;

    for (const book of uniqueBooks) {
      try {
        // Fetch official book code from EGW info page
        let bookCode = '';
        try {
          const infoUrl = `${baseUrl}/es/book/${book.egw_book_id}/info`;
          console.log(`[SCRAPE-CATALOG] Fetching book code from ${infoUrl}`);
          
          const infoResponse = await fetch(infoUrl, {
            headers: { 'User-Agent': 'EGW-Monitor/1.0' }
          });

          if (infoResponse.ok) {
            const infoHtml = await infoResponse.text();
            
            // Extract Book Code from info page
            // Pattern: Book Code</dt><dd>CC</dd> or similar
            const codeMatch = infoHtml.match(/Book Code[^>]*<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i);
            if (codeMatch && codeMatch[1]) {
              bookCode = codeMatch[1].trim();
              console.log(`[SCRAPE-CATALOG] Found official book code: ${bookCode} for book ${book.egw_book_id}`);
            }
          }
        } catch (infoError) {
          console.warn(`[SCRAPE-CATALOG] Could not fetch book code for ${book.egw_book_id}:`, infoError);
        }

        // Fallback: generate code from title if official code not found
        if (!bookCode) {
          bookCode = book.title
            .split(' ')
            .filter(word => word.length > 2)
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join('') || `BK${book.egw_book_id}`;
          console.log(`[SCRAPE-CATALOG] Using generated code: ${bookCode} for book ${book.egw_book_id}`);
        }

        // Check if book already exists by book_code (primary match) or egw_book_id (secondary)
        const { data: existingByCode } = await supabaseClient
          .from("book_catalog")
          .select("id, egw_book_id, book_code")
          .eq("book_code", bookCode)
          .eq("language", "es")
          .maybeSingle();

        const { data: existingById } = await supabaseClient
          .from("book_catalog")
          .select("id, egw_book_id, book_code")
          .eq("egw_book_id", book.egw_book_id)
          .eq("language", "es")
          .maybeSingle();

        const existing = existingByCode || existingById;

        if (existing) {
          // Update existing book - important: update egw_book_id in case it changed in EGW
          const { error: updateError } = await supabaseClient
            .from("book_catalog")
            .update({
              egw_book_id: book.egw_book_id, // Update ID in case it changed
              book_code: bookCode, // Ensure book_code is consistent
              title_es: book.title,
              language: 'es',
              folder_id: parseInt(folderId),
              updated_at: new Date().toISOString()
            })
            .eq("id", existing.id);

          if (updateError) throw updateError;
          updatedCount++;
          
          console.log(`[SCRAPE-CATALOG] Updated book ${bookCode}: egw_book_id ${existing.egw_book_id} -> ${book.egw_book_id}`);
        } else {
          // Insert new book
          const { error: insertError } = await supabaseClient
            .from("book_catalog")
            .insert({
              egw_book_id: book.egw_book_id,
              book_code: bookCode,
              title_es: book.title,
              language: 'es',
              folder_id: parseInt(folderId),
              is_active: false, // New books are inactive by default
              validation_status: 'pending'
            });

          if (insertError) {
            throw insertError;
          } else {
            insertedCount++;
            console.log(`[SCRAPE-CATALOG] Inserted new book ${bookCode}: egw_book_id ${book.egw_book_id}`);
          }
        }

        // After catalog update, fetch and store TOC
        try {
          // Use the same bookCode calculated above
          const tocUrl = `${baseUrl}/es/book/${book.egw_book_id}.2/toc`;
          console.log(`[SCRAPE-CATALOG] Fetching TOC for ${book.egw_book_id} from ${tocUrl}`);
          
          const tocResponse = await fetch(tocUrl, {
            headers: { 'User-Agent': 'EGW-Monitor/1.0' }
          });

          if (tocResponse.ok) {
            const tocHtml = await tocResponse.text();
            
            // Parse chapters from TOC
            const chapterPattern = /<a[^>]*href="\/es\/book\/\d+\.(\d+)"[^>]*>([^<]+)<\/a>/g;
            const chapters: Array<{ number: number; title: string }> = [];
            let chapterMatch;
            
            while ((chapterMatch = chapterPattern.exec(tocHtml)) !== null) {
              const chapterNum = parseInt(chapterMatch[1]);
              const chapterTitle = chapterMatch[2].trim();
              
              // Skip TOC itself (usually chapter 2) and invalid entries
              if (chapterNum > 2 && chapterTitle.length > 2) {
                chapters.push({
                  number: chapterNum,
                  title: chapterTitle
                });
              }
            }

            // Upsert TOC data
            const { error: tocError } = await supabaseClient
              .from('book_toc')
              .upsert({
                egw_book_id: book.egw_book_id,
                book_code: bookCode,
                title: book.title,
                language: 'es',
                toc_url: tocUrl,
                toc_html: tocHtml.substring(0, 50000), // Store first 50KB
                toc_extracted_at: new Date().toISOString(),
                chapters_count: chapters.length,
                chapters_data: chapters,
                validation_status: chapters.length > 0 ? 'success' : 'warning',
                validation_error: chapters.length === 0 ? 'No chapters found in TOC' : null,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'egw_book_id'
              });

            if (tocError) {
              console.error(`[SCRAPE-CATALOG] Error storing TOC for ${book.egw_book_id}:`, tocError);
              tocErrorCount++;
            } else {
              console.log(`[SCRAPE-CATALOG] TOC stored for ${book.egw_book_id}: ${chapters.length} chapters`);
              tocUpdatedCount++;
            }
          } else {
            console.warn(`[SCRAPE-CATALOG] Failed to fetch TOC for ${book.egw_book_id}: ${tocResponse.status}`);
            tocErrorCount++;
          }

          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (tocError) {
          console.error(`[SCRAPE-CATALOG] Error fetching TOC for ${book.egw_book_id}:`, tocError);
          tocErrorCount++;
        }

      } catch (error) {
        console.error(`[SCRAPE-CATALOG] Error processing book ${book.egw_book_id}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      totalFound: books.length,
      uniqueBooks: uniqueBooks.length,
      inserted: insertedCount,
      updated: updatedCount,
      errors: errorCount,
      tocUpdated: tocUpdatedCount,
      tocErrors: tocErrorCount,
      sourceUrl: fullUrl
    };

    console.log("[SCRAPE-CATALOG] Complete:", result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("[SCRAPE-CATALOG] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
