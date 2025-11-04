import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bookId } = await req.json();
    
    if (!bookId) {
      throw new Error('bookId is required');
    }

    const tocUrl = `https://m.egwwritings.org/es/book/${bookId}.2/toc`;
    console.log(`Fetching TOC from: ${tocUrl}`);
    
    // Fetch the TOC HTML
    const response = await fetch(tocUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    console.log(`HTML received: ${html.length} bytes`);
    
    // Return the raw HTML and metadata
    return new Response(
      JSON.stringify({
        success: true,
        bookId: bookId,
        url: tocUrl,
        htmlLength: html.length,
        contentType: response.headers.get('content-type'),
        statusCode: response.status,
        // Return first 5000 chars to inspect structure
        htmlSample: html.substring(0, 5000),
        // Also return sections around specific keywords
        chaptersSection: extractSection(html, 'capítulo', 1000),
        linksSection: extractSection(html, '<a href', 1000),
        // Full HTML (for complete inspection if needed)
        fullHtml: html
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});

// Helper function to extract HTML section around a keyword
function extractSection(html: string, keyword: string, contextLength: number): string {
  const index = html.toLowerCase().indexOf(keyword.toLowerCase());
  if (index === -1) return `Keyword "${keyword}" not found in HTML`;
  
  const start = Math.max(0, index - contextLength / 2);
  const end = Math.min(html.length, index + contextLength / 2);
  
  return html.substring(start, end);
}
