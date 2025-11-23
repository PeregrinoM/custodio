import { ChapterStructure } from '@/types/manual-import';

/**
 * Advanced chapter detection with improved patterns and context validation
 */
export function detectChaptersAdvanced(paragraphs: string[], startFrom: number = 0): ChapterStructure[] {
  const chapters: ChapterStructure[] = [];
  let currentChapter = 1;
  let chapterStartIndex = startFrom;

  const chapterPatterns = [
    /^cap[ií]tulo\s*\d+/i,           // "Capitulo 1", "Capítulo 10"
    /^cap\.\s*\d+/i,                 // "Cap. 1", "Cap.10"
    /^cap\d+/i,                      // "Cap1", "Cap10"
    /^chapter\s*\d+/i,               // "Chapter 1", "Chapter10"
    /^ch\.\s*\d+/i,                  // "Ch. 1"
    /^\d+\.\s*[A-ZÁÉÍÓÚÑ]/,          // "1. Título Con Mayúscula"
    /^\d+\s*\-\s*[A-ZÁÉÍÓÚÑ]/,       // "1 - Título"
    /^\d+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/, // "1 Título"
  ];

  const separatorPatterns = [
    /^={5,}$/,  // "======"
    /^\*{5,}$/, // "******"
    /^-{5,}$/   // "------"
  ];

  for (let i = startFrom; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    const nextPara = paragraphs[i + 1]?.trim() || '';
    const prevPara = paragraphs[i - 1]?.trim() || '';

    let isChapterMarker = false;
    let chapterTitle = '';

    // Check direct chapter patterns
    for (const pattern of chapterPatterns) {
      if (pattern.test(para)) {
        isChapterMarker = true;
        chapterTitle = extractChapterTitle(para);
        break;
      }
    }

    // Check all-caps titles (between 10-100 chars)
    if (!isChapterMarker && para.length >= 10 && para.length <= 100 && para === para.toUpperCase() && /^[A-ZÁÉÍÓÚÑ\s]+$/.test(para)) {
      isChapterMarker = true;
      chapterTitle = para;
    }

    // Check separator + title pattern
    if (!isChapterMarker) {
      for (const sepPattern of separatorPatterns) {
        if (sepPattern.test(para) && nextPara.length > 0 && nextPara.length < 150) {
          isChapterMarker = true;
          chapterTitle = nextPara;
          i++; // Skip next paragraph (it's the title)
          break;
        }
      }
    }

    // Validate with context: next paragraphs should look like content
    if (isChapterMarker && i > chapterStartIndex) {
      const nextContent = paragraphs.slice(i + 1, i + 4);
      const looksLikeContent = nextContent.some(p => p.trim().length > 150); // At least one paragraph is substantial

      if (looksLikeContent) {
        // Save previous chapter
        chapters.push({
          chapterNumber: currentChapter,
          chapterTitle: chapters.length > 0 ? chapters[currentChapter - 2]?.chapterTitle || extractChapterTitle(paragraphs[chapterStartIndex]) : extractChapterTitle(paragraphs[chapterStartIndex]),
          startIndex: chapterStartIndex,
          endIndex: i - 1,
          paragraphCount: i - chapterStartIndex,
          dbChapterId: null,
          dbParagraphCount: 0
        });

        currentChapter++;
        chapterStartIndex = i;
      }
    }
  }

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
 * Legacy detection function (kept for compatibility)
 */
export function detectChapters(paragraphs: string[]): ChapterStructure[] {
  return detectChaptersAdvanced(paragraphs, 0);
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
