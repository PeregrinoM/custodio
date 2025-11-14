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
    // Pattern: <a href=\"/es/book/174.0\">El Deseado de Todas las Gentes</a>
    const bookPattern = /<a href=\"\/[a-z]{2}\/book\/(\d+)\.\d+\"[^>]*>([^<]+)<\/a>/g;
    const books: Array<{
      egw_book_id: number;
      title: string;
      language: string;
    }> = [];

    let match;
    while ((match = bookPattern.exec(html)) !== null) {
      const egw_book_id = parseInt(match[1]);
      const title = match[2].trim();
      
      // Determine language from folder path
      const language = folderPath.includes('/es/') ? 'es' : 
                      folderPath.includes('/en/') ? 'en' : 'es';

      books.push({
        egw_book_id,
        title,
        language
      });
    }

    console.log(`[SCRAPE-CATALOG] Found ${books.length} books`);

    // Remove duplicates by egw_book_id (keep first occurrence)
    const uniqueBooks = books.filter((book, index, self) =>
      index === self.findIndex((b) => b.egw_book_id === book.egw_book_id)
    );

    console.log(`[SCRAPE-CATALOG] ${uniqueBooks.length} unique books after deduplication`);

    // Insert or update books in catalog
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const book of uniqueBooks) {
      try {
        // Check if book already exists
        const { data: existing } = await supabaseClient
          .from("book_catalog")
          .select("id, egw_book_id")
          .eq("egw_book_id", book.egw_book_id)
          .maybeSingle();

        if (existing) {
          // Update existing book
          const { error: updateError } = await supabaseClient
            .from("book_catalog")
            .update({
              title_es: book.title,
              language: book.language,
              folder_id: parseInt(folderId),
              updated_at: new Date().toISOString()
            })
            .eq("egw_book_id", book.egw_book_id);

          if (updateError) throw updateError;
          updatedCount++;
        } else {
          // Insert new book
          // Generate a book code (first 2-4 chars of title, uppercase)
          const bookCode = book.title
            .split(' ')
            .filter(word => word.length > 2)
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join('');

          const { error: insertError } = await supabaseClient
            .from("book_catalog")
            .insert({
              egw_book_id: book.egw_book_id,
              book_code: bookCode || `BK${book.egw_book_id}`,
              title_es: book.title,
              language: book.language,
              folder_id: parseInt(folderId),
              is_active: false, // New books are inactive by default
              validation_status: 'pending'
            });

          if (insertError) {
            // If unique constraint fails, try updating instead
            if (insertError.code === '23505') {
              const { error: retryError } = await supabaseClient
                .from("book_catalog")
                .update({
                  title_es: book.title,
                  updated_at: new Date().toISOString()
                })
                .eq("egw_book_id", book.egw_book_id);
              
              if (!retryError) updatedCount++;
            } else {
              throw insertError;
            }
          } else {
            insertedCount++;
          }
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
