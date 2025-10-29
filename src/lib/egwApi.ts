/**
 * EGW Writings API Integration
 * Fetches book data from the official EGW Writings GraphQL API
 */

const EGW_API_URL = 'https://org-api.egwwritings.org/graphql';

export interface EGWBook {
  title: string;
  code: string;
  chapters: EGWChapter[];
}

export interface EGWChapter {
  number: number;
  title: string;
  paragraphs: EGWParagraph[];
}

export interface EGWParagraph {
  number: number;
  text: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Fetch a complete book from EGW Writings API
 * @param bookCode - The book code (e.g., "DA" for El Deseado de Todas las Gentes)
 */
export async function fetchBook(bookCode: string): Promise<EGWBook> {
  const query = `
    query GetBook($pubCode: String!) {
      publication(pubCode: $pubCode, lang: "es") {
        title
        pubCode
        content {
          chapter
          chapterTitle
          refcode_short
          para_count
          paragraphs {
            content
            refcode_short
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(EGW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { pubCode: bookCode },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: GraphQLResponse<{ publication: any }> = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
    }

    if (!result.data?.publication) {
      throw new Error('No book data returned from API');
    }

    // Normalize the API response to our schema
    return normalizeBookData(result.data.publication, bookCode);
  } catch (error) {
    console.error('Error fetching book from EGW API:', error);
    throw new Error(`Failed to fetch book ${bookCode}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Normalize EGW API response to our database schema
 */
function normalizeBookData(apiData: any, bookCode: string): EGWBook {
  const chapters: EGWChapter[] = [];
  
  if (apiData.content && Array.isArray(apiData.content)) {
    // Group paragraphs by chapter
    const chapterMap = new Map<number, EGWChapter>();
    
    apiData.content.forEach((item: any) => {
      const chapterNum = item.chapter || 1;
      
      if (!chapterMap.has(chapterNum)) {
        chapterMap.set(chapterNum, {
          number: chapterNum,
          title: item.chapterTitle || `Capítulo ${chapterNum}`,
          paragraphs: [],
        });
      }
      
      const chapter = chapterMap.get(chapterNum)!;
      
      if (item.paragraphs && Array.isArray(item.paragraphs)) {
        item.paragraphs.forEach((para: any, index: number) => {
          if (para.content && para.content.trim()) {
            chapter.paragraphs.push({
              number: chapter.paragraphs.length + 1,
              text: para.content.trim(),
            });
          }
        });
      }
    });
    
    // Convert map to array and sort by chapter number
    chapters.push(...Array.from(chapterMap.values()).sort((a, b) => a.number - b.number));
  }

  return {
    title: apiData.title || 'Título desconocido',
    code: bookCode.toUpperCase(),
    chapters,
  };
}

/**
 * Validate if a book code exists in the EGW API
 */
export async function validateBookCode(bookCode: string): Promise<boolean> {
  try {
    await fetchBook(bookCode);
    return true;
  } catch {
    return false;
  }
}
