import { ChapterStructure } from '@/types/manual-import';

/**
 * Detects chapter boundaries in text content
 */
export function detectChapters(paragraphs: string[]): ChapterStructure[] {
  const chapters: ChapterStructure[] = [];
  let currentChapter = 1;
  let chapterStartIndex = 0;

  paragraphs.forEach((para, index) => {
    const trimmed = para.trim();
    
    // Check for chapter patterns
    const isChapterMarker = 
      /^cap[ií]tulo\s+\d+/i.test(trimmed) ||
      /^chapter\s+\d+/i.test(trimmed) ||
      /^cap\.\s*\d+/i.test(trimmed) ||
      /^\d+\.\s*[A-ZÁÉÍÓÚ]/i.test(trimmed) || // "1. Título"
      (trimmed.length < 100 && trimmed === trimmed.toUpperCase() && trimmed.length > 10); // ALL CAPS TITLES

    if (isChapterMarker && index > chapterStartIndex) {
      // Save previous chapter
      chapters.push({
        chapterNumber: currentChapter,
        chapterTitle: extractChapterTitle(paragraphs[chapterStartIndex]),
        startIndex: chapterStartIndex,
        endIndex: index - 1,
        paragraphCount: index - chapterStartIndex,
        dbChapterId: null,
        dbParagraphCount: 0
      });

      currentChapter++;
      chapterStartIndex = index;
    }
  });

  // Add last chapter
  if (chapterStartIndex < paragraphs.length) {
    chapters.push({
      chapterNumber: currentChapter,
      chapterTitle: extractChapterTitle(paragraphs[chapterStartIndex]),
      startIndex: chapterStartIndex,
      endIndex: paragraphs.length - 1,
      paragraphCount: paragraphs.length - chapterStartIndex,
      dbChapterId: null,
      dbParagraphCount: 0
    });
  }

  return chapters;
}

/**
 * Extracts a clean chapter title from a paragraph
 */
function extractChapterTitle(text: string): string {
  const trimmed = text.trim();
  
  // Remove chapter number prefix
  const cleaned = trimmed
    .replace(/^cap[ií]tulo\s+\d+[:\-\s]*/i, '')
    .replace(/^chapter\s+\d+[:\-\s]*/i, '')
    .replace(/^cap\.\s*\d+[:\-\s]*/i, '')
    .replace(/^\d+\.\s*/, '')
    .trim();

  // Limit length
  return cleaned.substring(0, 100);
}

/**
 * Maps detected chapters to database chapters
 */
export async function mapChaptersToDatabase(
  chapters: ChapterStructure[],
  bookId: string,
  supabase: any
): Promise<ChapterStructure[]> {
  // Fetch DB chapters
  const { data: dbChapters, error } = await supabase
    .from('chapters')
    .select('id, number, title')
    .eq('book_id', bookId)
    .order('number');

  if (error || !dbChapters) {
    console.error('Error fetching chapters:', error);
    return chapters;
  }

  // Count paragraphs per chapter
  const chapterParagraphCounts = new Map<string, number>();
  for (const chapter of dbChapters) {
    const { count } = await supabase
      .from('paragraphs')
      .select('id', { count: 'exact', head: true })
      .eq('chapter_id', chapter.id);
    
    chapterParagraphCounts.set(chapter.id, count || 0);
  }

  // Map chapters
  return chapters.map((chapter, index) => {
    const dbChapter = dbChapters[index]; // Assume same order
    return {
      ...chapter,
      dbChapterId: dbChapter?.id || null,
      dbParagraphCount: dbChapter ? (chapterParagraphCounts.get(dbChapter.id) || 0) : 0
    };
  });
}

/**
 * Validates chapter structure
 */
export function validateChapterStructure(chapters: ChapterStructure[]): string[] {
  const errors: string[] = [];

  if (chapters.length === 0) {
    errors.push('No se detectaron capítulos en el archivo');
    return errors;
  }

  // Check for gaps
  for (let i = 0; i < chapters.length - 1; i++) {
    if (chapters[i].endIndex + 1 !== chapters[i + 1].startIndex) {
      errors.push(`Hay un salto entre el capítulo ${chapters[i].chapterNumber} y ${chapters[i + 1].chapterNumber}`);
    }
  }

  // Check for empty chapters
  chapters.forEach(chapter => {
    if (chapter.paragraphCount === 0) {
      errors.push(`El capítulo ${chapter.chapterNumber} está vacío`);
    }
  });

  return errors;
}
