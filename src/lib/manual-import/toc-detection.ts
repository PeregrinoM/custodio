import { ChapterStructure } from '@/types/manual-import';

export interface TOCEntry {
  chapterNumber: number;
  title: string;
  pageNumber?: number;
}

export interface TOCDetectionResult {
  found: boolean;
  entries: TOCEntry[];
  tocStartIndex: number;
  tocEndIndex: number;
}

/**
 * Detects table of contents / index in the first paragraphs
 */
export function detectTableOfContents(paragraphs: string[]): TOCDetectionResult {
  const result: TOCDetectionResult = {
    found: false,
    entries: [],
    tocStartIndex: -1,
    tocEndIndex: -1
  };

  // Only check first 100 paragraphs for TOC
  const searchLimit = Math.min(100, paragraphs.length);

  // Step 1: Find TOC header
  const tocHeaders = [
    /^índice$/i,
    /^tabla de contenido[s]?$/i,
    /^contenido[s]?$/i,
    /^index$/i,
    /^table of contents$/i,
    /^capítulos$/i
  ];

  let tocHeaderIndex = -1;
  for (let i = 0; i < searchLimit; i++) {
    const para = paragraphs[i].trim();
    if (tocHeaders.some(pattern => pattern.test(para))) {
      tocHeaderIndex = i;
      result.tocStartIndex = i;
      break;
    }
  }

  if (tocHeaderIndex === -1) {
    return result;
  }

  // Step 2: Extract TOC entries following the header
  const tocLinePatterns = [
    /^cap[ií]tulo\s+(\d+)[:\.\-\s]+(.+?)\s*\.{3,}\s*(\d+)$/i,  // "Capítulo 1: Título......10"
    /^cap\.\s*(\d+)[:\.\-\s]+(.+?)\s*\.{3,}\s*(\d+)$/i,       // "Cap. 1: Título......10"
    /^(\d+)\.\s+(.+?)\s*\.{3,}\s*(\d+)$/i,                    // "1. Título......10"
    /^cap[ií]tulo\s+(\d+)[:\.\-\s]+(.+?)$/i,                  // "Capítulo 1: Título"
    /^cap\.\s*(\d+)[:\.\-\s]+(.+?)$/i,                        // "Cap. 1: Título"
    /^(\d+)\s*\-\s*(.+?)$/i,                                  // "1 - Título"
    /^(\d+)\.\s+(.+?)$/i                                      // "1. Título"
  ];

  const entries: TOCEntry[] = [];
  let consecutiveMatches = 0;
  let lastChapterNum = 0;

  for (let i = tocHeaderIndex + 1; i < Math.min(tocHeaderIndex + 100, paragraphs.length); i++) {
    const para = paragraphs[i].trim();
    
    if (para.length === 0) continue; // Skip empty lines

    let matched = false;
    for (const pattern of tocLinePatterns) {
      const match = para.match(pattern);
      if (match) {
        const chapterNum = parseInt(match[1], 10);
        const title = match[2].trim();
        const pageNum = match[3] ? parseInt(match[3], 10) : undefined;

        // Validate sequential chapter numbers
        if (chapterNum === lastChapterNum + 1 || entries.length === 0) {
          entries.push({ chapterNumber: chapterNum, title, pageNumber: pageNum });
          lastChapterNum = chapterNum;
          consecutiveMatches++;
          matched = true;
          result.tocEndIndex = i;
          break;
        }
      }
    }

    // If we haven't matched in 5 consecutive non-empty lines after having matches, assume TOC ended
    if (!matched && consecutiveMatches > 0) {
      const nonEmptyCount = paragraphs.slice(i, i + 5).filter(p => p.trim().length > 0).length;
      if (nonEmptyCount >= 3) {
        break;
      }
    }
  }

  // Validate: need at least 3 consecutive chapter entries to confirm it's a TOC
  if (entries.length >= 3 && consecutiveMatches >= 3) {
    result.found = true;
    result.entries = entries;
  }

  return result;
}

/**
 * Finds chapter boundaries in content using TOC entries as reference
 */
export function findChapterBoundariesFromTOC(
  paragraphs: string[],
  tocEntries: TOCEntry[],
  tocEndIndex: number
): ChapterStructure[] {
  const chapters: ChapterStructure[] = [];
  const searchStart = tocEndIndex + 1;

  for (let tocIndex = 0; tocIndex < tocEntries.length; tocIndex++) {
    const entry = tocEntries[tocIndex];
    const nextEntry = tocEntries[tocIndex + 1];

    // Search for this chapter in the content
    let chapterStartIndex = -1;

    // Build patterns to search for chapter start
    const searchPatterns = [
      new RegExp(`^cap[ií]tulo\\s+${entry.chapterNumber}\\b`, 'i'),
      new RegExp(`^cap\\.?\\s*${entry.chapterNumber}\\b`, 'i'),
      new RegExp(`^chapter\\s+${entry.chapterNumber}\\b`, 'i'),
      new RegExp(`^${entry.chapterNumber}\\.\\s+${escapeRegex(entry.title.substring(0, 20))}`, 'i')
    ];

    // Search for chapter start
    for (let i = searchStart; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim();
      
      for (const pattern of searchPatterns) {
        if (pattern.test(para)) {
          chapterStartIndex = i;
          break;
        }
      }

      if (chapterStartIndex !== -1) break;

      // Also try title similarity
      if (titleSimilarity(para, entry.title) > 0.8) {
        chapterStartIndex = i;
        break;
      }

      // Stop searching too far
      if (i > searchStart + 200) break;
    }

    // If we found this chapter, add it
    if (chapterStartIndex !== -1) {
      // Find end (start of next chapter or end of document)
      let chapterEndIndex = paragraphs.length - 1;
      
      if (nextEntry) {
        // Search for next chapter start
        for (let i = chapterStartIndex + 1; i < paragraphs.length; i++) {
          const para = paragraphs[i].trim();
          const nextPatterns = [
            new RegExp(`^cap[ií]tulo\\s+${nextEntry.chapterNumber}\\b`, 'i'),
            new RegExp(`^cap\\.?\\s*${nextEntry.chapterNumber}\\b`, 'i')
          ];

          if (nextPatterns.some(p => p.test(para))) {
            chapterEndIndex = i - 1;
            break;
          }

          if (titleSimilarity(para, nextEntry.title) > 0.8) {
            chapterEndIndex = i - 1;
            break;
          }
        }
      }

      chapters.push({
        chapterNumber: entry.chapterNumber,
        chapterTitle: entry.title,
        startIndex: chapterStartIndex,
        endIndex: chapterEndIndex,
        paragraphCount: chapterEndIndex - chapterStartIndex + 1,
        dbChapterId: null,
        dbParagraphCount: 0
      });
    }
  }

  return chapters;
}

/**
 * Calculates simple title similarity (0-1)
 */
function titleSimilarity(text1: string, text2: string): number {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  const norm1 = normalize(text1);
  const norm2 = normalize(text2);

  if (norm1.length === 0 || norm2.length === 0) return 0;

  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;

  // Simple word overlap
  const words1 = new Set(norm1.split(/\s+/));
  const words2 = new Set(norm2.split(/\s+/));
  const intersection = new Set([...words1].filter(w => words2.has(w)));

  return intersection.size / Math.max(words1.size, words2.size);
}

/**
 * Escapes regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
