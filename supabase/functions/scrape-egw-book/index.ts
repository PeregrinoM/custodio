import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Chapter {
  number: number;
  title: string;
  paragraphs: Paragraph[];
}

interface Paragraph {
  content: string;
  refcode: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bookId, testMode } = await req.json();
    
    if (!bookId) {
      throw new Error('bookId es requerido');
    }

    console.log(`[SCRAPING] Iniciando scraping del libro ID: ${bookId}`);

    // Modo de prueba para debugging
    if (testMode) {
      console.log('[TEST MODE] Probando solo obtención de TOC');
      const tocUrl = `https://m.egwwritings.org/es/book/${bookId}.2/toc`;
      const tocResponse = await fetch(tocUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      const tocHtml = await tocResponse.text();
      const chapters = parseTableOfContents(tocHtml, bookId);
      
      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          tocLength: tocHtml.length,
          chaptersFound: chapters.length,
          sampleChapters: chapters.slice(0, 3)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Paso 1: Obtener índice de capítulos
    const tocUrl = `https://m.egwwritings.org/es/book/${bookId}.2/toc`;
    console.log(`[SCRAPING] Obteniendo TOC desde: ${tocUrl}`);
    
    const tocResponse = await fetch(tocUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!tocResponse.ok) {
      throw new Error(`Error HTTP ${tocResponse.status} al obtener TOC`);
    }
    
    const tocHtml = await tocResponse.text();
    
    // Parsear TOC para obtener lista de capítulos
    const chapters = parseTableOfContents(tocHtml, bookId);
    
    console.log(`[SCRAPING] Se encontraron ${chapters.length} capítulos`);

    if (chapters.length === 0) {
      throw new Error('No se encontraron capítulos en el TOC');
    }

    // Paso 2: Obtener contenido de cada capítulo con delay
    const chaptersWithContent: Chapter[] = [];
    
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      console.log(`[SCRAPING] Procesando capítulo ${i + 1}/${chapters.length}: ${chapter.title}`);
      
      try {
        const chapterContent = await scrapeChapter(chapter.url);
        
        if (chapterContent.length === 0) {
          console.warn(`[SCRAPING] ⚠️ Capítulo "${chapter.title}" no tiene párrafos, omitiendo`);
          continue;
        }
        
        chaptersWithContent.push({
          number: i + 1,
          title: chapter.title,
          paragraphs: chapterContent
        });
        
        // Delay de 1 segundo entre capítulos para no saturar el servidor
        if (i < chapters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`[SCRAPING] ❌ Error en capítulo "${chapter.title}":`, error);
        // Continuar con el siguiente capítulo
      }
    }

    console.log(`[SCRAPING] ✅ Scraping completado: ${chaptersWithContent.length} capítulos procesados`);

    return new Response(
      JSON.stringify({
        success: true,
        bookId,
        totalChapters: chaptersWithContent.length,
        chapters: chaptersWithContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SCRAPING] ❌ Error crítico:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function parseTableOfContents(html: string, bookId: string): Array<{title: string, url: string}> {
  const chapters: Array<{title: string, url: string}> = [];
  
  // 🔍 DEBUG: Log HTML sample to understand structure
  console.log('[DEBUG] TOC HTML length:', html.length);
  console.log('[DEBUG] First 2000 chars of HTML:', html.substring(0, 2000));
  
  // Try multiple regex patterns to find chapters
  
  // Pattern 1: Original pattern - strict matching
  const pattern1 = /<a\s+href="\/es\/book\/(\d+\.\d+)#(\d+)"[^>]*>([^<]+)<\/a>/g;
  
  // Pattern 2: More permissive - any link with book ID
  const pattern2 = /<a[^>]*href="[^"]*\/book\/(\d+\.\d+)[^"]*"[^>]*>([^<]+)<\/a>/g;
  
  // Pattern 3: Look for any structure with chapter numbers
  const pattern3 = /(?:cap[ií]tulo|chapter)\s*\d+/gi;
  
  console.log('[DEBUG] Testing Pattern 1 (strict)...');
  let match;
  while ((match = pattern1.exec(html)) !== null) {
    console.log('[DEBUG] Pattern 1 match:', match);
    const paragraphId = match[1];
    const anchorId = match[2];
    const title = match[3].trim();
    
    if (title.length > 0) {
      chapters.push({
        title: title,
        url: `https://m.egwwritings.org/es/book/${paragraphId}#${anchorId}`
      });
    }
  }
  
  if (chapters.length === 0) {
    console.log('[DEBUG] Pattern 1 failed, trying Pattern 2 (permissive)...');
    while ((match = pattern2.exec(html)) !== null) {
      console.log('[DEBUG] Pattern 2 match:', match);
      const paragraphId = match[1];
      const title = match[2].trim();
      
      if (title.length > 0 && title.toLowerCase().includes('cap')) {
        chapters.push({
          title: title,
          url: `https://m.egwwritings.org/es/book/${paragraphId}`
        });
      }
    }
  }
  
  if (chapters.length === 0) {
    console.log('[DEBUG] Pattern 2 failed, checking if HTML contains chapter references...');
    const chapterMentions = html.match(pattern3);
    console.log('[DEBUG] Found chapter mentions:', chapterMentions ? chapterMentions.length : 0);
    if (chapterMentions) {
      console.log('[DEBUG] Sample mentions:', chapterMentions.slice(0, 5));
    }
    
    // Log a bigger HTML sample for manual inspection
    console.log('[DEBUG] HTML sample around first "capítulo" mention:');
    const capIndex = html.toLowerCase().indexOf('capítulo');
    if (capIndex > -1) {
      console.log('[DEBUG] Context:', html.substring(Math.max(0, capIndex - 200), capIndex + 500));
    }
  }
  
  console.log(`[PARSER] Total chapters found: ${chapters.length}`);
  if (chapters.length > 0) {
    console.log(`[PARSER] First 3 chapters:`, chapters.slice(0, 3));
  }
  
  return chapters;
}

async function scrapeChapter(url: string): Promise<Paragraph[]> {
  try {
    console.log(`[SCRAPER] Obteniendo contenido de: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} para ${url}`);
    }
    
    const html = await response.text();
    
    if (html.length < 100) {
      throw new Error(`Respuesta muy corta (${html.length} bytes), posible página de error`);
    }
    
    const paragraphs: Paragraph[] = [];
    
    // Regex para encontrar párrafos con su refcode
    // Formato: <span class="egw_content" data-refcode="174.221" data-refcode-old="DTG 46.1">contenido</span>
    const paragraphRegex = /<span[^>]*class="[^"]*egw_content[^"]*"[^>]*data-refcode-old="([^"]+)"[^>]*>([\s\S]*?)<\/span>/g;
    
    let match;
    while ((match = paragraphRegex.exec(html)) !== null) {
      const refcode = match[1].trim();
      let content = match[2].trim();
      
      // Limpiar HTML interno (tags, comentarios, etc.)
      content = content
        .replace(/<[^>]+>/g, '') // Eliminar tags HTML
        .replace(/&nbsp;/g, ' ') // Reemplazar nbsp
        .replace(/&quot;/g, '"') // Reemplazar comillas
        .replace(/&#8220;/g, '"') // Comilla izquierda
        .replace(/&#8221;/g, '"') // Comilla derecha
        .replace(/&#8211;/g, '—') // Em dash
        .replace(/&#8212;/g, '—') // Em dash largo
        .replace(/&amp;/g, '&') // Reemplazar ampersand
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ') // Normalizar espacios
        .trim();
      
      if (content.length > 0) {
        paragraphs.push({ content, refcode });
      }
    }
    
    console.log(`[SCRAPER] ✅ Párrafos extraídos: ${paragraphs.length}`);
    
    if (paragraphs.length === 0) {
      console.warn(`[SCRAPER] ⚠️ No se encontraron párrafos en ${url}`);
    }
    
    return paragraphs;
    
  } catch (error) {
    console.error(`[SCRAPER] ❌ Error al obtener ${url}:`, error);
    throw error;
  }
}
