import { supabase } from '@/integrations/supabase/client'

export interface EGWParagraph {
  content: string
  refcode_short: string
}

export interface EGWChapter {
  number: number
  title: string
  paragraphs: EGWParagraph[]
}

export interface EGWBook {
  title: string
  code: string
  chapters: EGWChapter[]
}

// Cache for book catalog to avoid repeated DB queries
let bookCatalogCache: Map<string, { id: number, title: string }> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load book catalog from database
 * Uses caching to minimize DB calls
 * IMPORTANT: Only loads SPANISH books (is_active = true)
 */
async function loadBookCatalog(): Promise<Map<string, { id: number, title: string }>> {
  // Return cached data if fresh
  const now = Date.now();
  if (bookCatalogCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return bookCatalogCache;
  }

  console.log('📚 Cargando catálogo de libros desde la base de datos...');

  const { data, error } = await supabase
    .from('book_catalog' as any)
    .select('book_code, egw_book_id, title_es')
    .eq('is_active', true); // Only load active books

  if (error) {
    console.error('❌ Error cargando catálogo de libros:', error);
    // Return empty map on error, but keep old cache if available
    return bookCatalogCache || new Map();
  }

  const catalog = new Map<string, { id: number, title: string }>();
  
  (data as unknown as any[])?.forEach(book => {
    catalog.set(book.book_code.toUpperCase(), {
      id: book.egw_book_id,
      title: book.title_es
    });
  });

  // Update cache
  bookCatalogCache = catalog;
  cacheTimestamp = now;

  console.log(`✅ Catálogo de libros cargado: ${catalog.size} libros activos`);
  return catalog;
}

/**
 * Get book info by code
 */
export async function getBookInfo(code: string): Promise<{ id: number, title: string } | null> {
  const catalog = await loadBookCatalog();
  return catalog.get(code.toUpperCase()) || null;
}

/**
 * Check if book code is valid
 */
export async function isValidBookCode(code: string): Promise<boolean> {
  const catalog = await loadBookCatalog();
  return catalog.has(code.toUpperCase());
}

/**
 * Get list of available book codes
 */
export async function getAvailableBookCodes(): Promise<string[]> {
  const catalog = await loadBookCatalog();
  return Array.from(catalog.keys());
}

/**
 * Fetch book from EGW API using scraping
 * IMPORTANT: Only works with Spanish books
 */
export async function fetchBook(code: string): Promise<EGWBook> {
  const bookInfo = await getBookInfo(code.toUpperCase());
  
  if (!bookInfo) {
    const availableCodes = await getAvailableBookCodes();
    throw new Error(
      `Código de libro desconocido: ${code}.\n` +
      `Códigos disponibles: ${availableCodes.join(', ')}\n` +
      `Activa más libros en Admin > Gestión de Catálogo de Libros`
    );
  }

  console.log(`📖 Iniciando importación de ${bookInfo.title} (${code})...`);

  try {
    const { data, error } = await supabase.functions.invoke('scrape-egw-book', {
      body: { bookId: bookInfo.id }
    });

    if (error) throw error;
    
    if (!data.success || !data.chapters) {
      throw new Error('La respuesta del scraper no contiene capítulos');
    }

    console.log(`✅ Scraping completado: ${data.totalChapters} capítulos obtenidos`);

    // Normalize to EGWBook format
    return {
      title: bookInfo.title,
      code: code.toUpperCase(),
      chapters: data.chapters.map((ch: any) => ({
        number: ch.number,
        title: ch.title,
        paragraphs: ch.paragraphs.map((p: any) => ({
          content: p.content,
          refcode_short: p.refcode
        }))
      }))
    };

  } catch (error) {
    console.error('❌ Error en fetchBook:', error);
    throw new Error(
      `Error al importar ${bookInfo.title}: ${error instanceof Error ? error.message : 'Error desconocido'}`
    );
  }
}

/**
 * Force refresh of book catalog cache
 * Useful after syncing catalog from EGW
 */
export function refreshBookCatalog(): void {
  bookCatalogCache = null;
  cacheTimestamp = 0;
  console.log('🔄 Cache del catálogo de libros limpiado');
}
