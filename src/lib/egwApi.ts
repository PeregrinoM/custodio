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

// Mapeo de códigos a IDs de libros en egwwritings.org
const BOOK_ID_MAP: Record<string, { id: number, title: string }> = {
  'DTG': { id: 174, title: 'El Deseado de Todas las Gentes' },
  'DA': { id: 174, title: 'El Deseado de Todas las Gentes' }, // Alias en inglés
  'PP': { id: 1704, title: 'Patriarcas y Profetas' },
  'CS': { id: 132, title: 'El Conflicto de los Siglos' },
  'GC': { id: 132, title: 'El Conflicto de los Siglos' }, // Alias en inglés
  'PR': { id: 88, title: 'Profetas y Reyes' },
  'PK': { id: 88, title: 'Profetas y Reyes' }, // Alias en inglés
  'HAp': { id: 127, title: 'Los Hechos de los Apóstoles' },
  'AA': { id: 127, title: 'Los Hechos de los Apóstoles' }, // Alias en inglés
  'MC': { id: 133, title: 'El Ministerio de Curación' },
  'MH': { id: 133, title: 'El Ministerio de Curación' }, // Alias en inglés
  'CC': { id: 130, title: 'El Camino a Cristo' },
  'SC': { id: 130, title: 'El Camino a Cristo' }, // Alias en inglés
  'Ed': { id: 129, title: 'La Educación' },
}

/**
 * Obtiene un libro mediante scraping usando la Edge Function de Supabase
 */
export async function fetchBook(code: string): Promise<EGWBook> {
  const bookInfo = BOOK_ID_MAP[code.toUpperCase()]
  
  if (!bookInfo) {
    throw new Error(
      `Código de libro desconocido: ${code}.\n` +
      `Códigos disponibles: ${Object.keys(BOOK_ID_MAP).join(', ')}`
    )
  }

  console.log(`Iniciando importación de ${bookInfo.title} (${code})...`)

  try {
    const { data, error } = await supabase.functions.invoke('scrape-egw-book', {
      body: { bookId: bookInfo.id }
    })

    if (error) throw error
    
    if (!data.success || !data.chapters) {
      throw new Error('La respuesta del scraper no contiene capítulos')
    }

    console.log(`Scraping completado: ${data.totalChapters} capítulos obtenidos`)

    // Normalizar al formato EGWBook
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
    }

  } catch (error) {
    console.error('Error en fetchBook:', error)
    throw new Error(
      `Error al importar ${bookInfo.title}: ${error instanceof Error ? error.message : 'Error desconocido'}`
    )
  }
}

/**
 * Lista de códigos de libros disponibles
 */
export function getAvailableBookCodes(): string[] {
  return Object.keys(BOOK_ID_MAP)
}

/**
 * Valida si un código de libro está disponible
 */
export function isValidBookCode(code: string): boolean {
  return code.toUpperCase() in BOOK_ID_MAP
}

/**
 * Obtiene información de un libro por código
 */
export function getBookInfo(code: string): { id: number, title: string } | null {
  return BOOK_ID_MAP[code.toUpperCase()] || null
}
