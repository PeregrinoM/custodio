import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🧪 [TEST SEED] Iniciando importación de libro de prueba PP...');

    // Fetch PP book from real API
    const ppBookId = 84; // PP = Patriarcas y Profetas
    
    // Call the existing scrape function to get the real book data
    const { data: bookData, error: scrapeError } = await supabase.functions.invoke('scrape-egw-book', {
      body: { bookId: ppBookId }
    });

    if (scrapeError || !bookData.success) {
      throw new Error(`Error obteniendo libro PP: ${scrapeError?.message || 'Unknown error'}`);
    }

    console.log(`📖 Libro PP obtenido: ${bookData.totalChapters} capítulos`);

    // Calculate total paragraphs
    let totalParagraphs = 0;
    for (const chapter of bookData.chapters) {
      totalParagraphs += chapter.paragraphs.length;
    }

    console.log(`📝 Total de párrafos: ${totalParagraphs}`);

    // Generate 100 error positions distributed across the book
    const errorPositions = generateErrorPositions(totalParagraphs, 100);
    console.log(`⚠️ Generando 100 errores distribuidos en ${errorPositions.size} párrafos`);

    // Apply errors to the book data
    const modifiedBook = applyErrorsToBook(bookData.chapters, errorPositions);

    // Import the book with is_test_seed flag using unique test code
    const testBookCode = 'PP_TEST';
    
    const { data: existingBook } = await supabase
      .from('books')
      .select('id')
      .eq('code', testBookCode)
      .single();

    let bookId: string;

    if (existingBook) {
      console.log('📚 Libro de prueba PP_TEST ya existe, actualizando...');
      
      // Delete existing chapters and paragraphs
      await supabase
        .from('chapters')
        .delete()
        .eq('book_id', existingBook.id);

      // Update book stats
      await supabase
        .from('books')
        .update({
          total_changes: 100,
          last_check_date: new Date().toISOString()
        })
        .eq('id', existingBook.id);

      bookId = existingBook.id;
    } else {
      console.log('📚 Creando nuevo libro de prueba PP_TEST...');
      
      const { data: newBook, error: bookError } = await supabase
        .from('books')
        .insert({
          code: testBookCode,
          title: 'Patriarcas y Profetas (TEST)',
          language: 'es',
          book_code_api: 'PP',
          is_test_seed: true,
          total_changes: 100,
          last_check_date: new Date().toISOString()
        })
        .select()
        .single();

      if (bookError) throw bookError;
      bookId = newBook.id;
    }

    // Insert chapters and paragraphs
    let insertedParagraphs = 0;

    for (const chapter of modifiedBook) {
      const { data: chapterData, error: chapterError } = await supabase
        .from('chapters')
        .insert({
          book_id: bookId,
          number: chapter.number,
          title: chapter.title,
          change_count: chapter.errorCount || 0
        })
        .select()
        .single();

      if (chapterError) throw chapterError;

      // Prepare paragraphs for batch insert
      const paragraphsToInsert = chapter.paragraphs.map((p: any, idx: number) => ({
        chapter_id: chapterData.id,
        paragraph_number: idx + 1,
        base_text: p.originalContent,
        latest_text: p.content,
        has_changed: p.hasError,
        refcode_short: p.refcode,
        change_history: p.hasError ? [{
          date: new Date().toISOString(),
          old_text: p.originalContent,
          new_text: p.content
        }] : []
      }));

      const { error: paragraphError } = await supabase
        .from('paragraphs')
        .insert(paragraphsToInsert);

      if (paragraphError) throw paragraphError;

      insertedParagraphs += paragraphsToInsert.length;
      console.log(`✅ Capítulo ${chapter.number}: ${paragraphsToInsert.length} párrafos insertados`);
    }

    // Register in book_comparisons as test_import
    const { error: comparisonError } = await supabase
      .from('book_comparisons')
      .insert({
        book_id: bookId,
        comparison_type: 'test_import',
        total_changes: 100,
        changed_paragraphs: errorPositions.size,
        chapters_affected: modifiedBook
          .filter((ch: any) => ch.errorCount > 0)
          .map((ch: any) => ({
            chapter: ch.number,
            changes: ch.errorCount
          })),
        version_notes: 'Libro de prueba con 100 errores introducidos intencionalmente para testing'
      });

    if (comparisonError) throw comparisonError;

    console.log('✅ [TEST SEED] Importación completada exitosamente');

    return new Response(
      JSON.stringify({
        success: true,
        bookId: bookId,
        code: 'PP_TEST',
        title: 'Patriarcas y Profetas (TEST)',
        totalChapters: modifiedBook.length,
        totalParagraphs: insertedParagraphs,
        totalErrors: 100,
        affectedParagraphs: errorPositions.size,
        message: 'Libro de prueba importado exitosamente con 100 errores distribuidos'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ [TEST SEED] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
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

/**
 * Generate random positions for errors, distributed across the book
 */
function generateErrorPositions(totalParagraphs: number, numErrors: number): Map<number, number[]> {
  const positions = new Map<number, number[]>(); // paragraphIndex -> [error positions within text]
  
  // Ensure we don't try to add more errors than paragraphs
  const maxErrors = Math.min(numErrors, totalParagraphs);
  
  // Generate random paragraph indices
  const selectedParagraphs = new Set<number>();
  while (selectedParagraphs.size < maxErrors) {
    const randomParagraph = Math.floor(Math.random() * totalParagraphs);
    selectedParagraphs.add(randomParagraph);
  }
  
  // For each selected paragraph, determine how many errors (1-3)
  const paragraphsArray = Array.from(selectedParagraphs);
  let remainingErrors = numErrors;
  
  for (let i = 0; i < paragraphsArray.length && remainingErrors > 0; i++) {
    const paraIndex = paragraphsArray[i];
    // Randomly assign 1-3 errors per paragraph, but don't exceed remaining
    const errorsForPara = Math.min(
      Math.floor(Math.random() * 3) + 1,
      remainingErrors,
      3 // Maximum 3 errors per paragraph
    );
    
    positions.set(paraIndex, Array(errorsForPara).fill(0).map(() => Math.random()));
    remainingErrors -= errorsForPara;
  }
  
  return positions;
}

/**
 * Apply errors to book chapters
 */
function applyErrorsToBook(chapters: any[], errorPositions: Map<number, number[]>): any[] {
  let globalParagraphIndex = 0;
  
  return chapters.map(chapter => {
    let chapterErrorCount = 0;
    
    const modifiedParagraphs = chapter.paragraphs.map((para: any) => {
      const currentIndex = globalParagraphIndex++;
      const originalContent = para.content;
      
      if (errorPositions.has(currentIndex)) {
        const numErrors = errorPositions.get(currentIndex)!.length;
        const modifiedContent = introduceErrors(originalContent, numErrors);
        chapterErrorCount += numErrors;
        
        return {
          ...para,
          originalContent: originalContent,
          content: modifiedContent,
          hasError: true
        };
      }
      
      return {
        ...para,
        originalContent: originalContent,
        hasError: false
      };
    });
    
    return {
      ...chapter,
      paragraphs: modifiedParagraphs,
      errorCount: chapterErrorCount
    };
  });
}

/**
 * Introduce spelling errors and word changes to text
 */
function introduceErrors(text: string, numErrors: number): string {
  const words = text.split(' ');
  if (words.length < 5) return text; // Skip very short paragraphs
  
  const errorTypes = [
    introduceSpellingError,
    introduceWordChange,
    introduceMissingLetter,
    introduceExtraLetter,
    introduceWordSwap
  ];
  
  const modifiedWords = [...words];
  const modifiedIndices = new Set<number>();
  
  for (let i = 0; i < numErrors; i++) {
    // Find a word that hasn't been modified yet
    let attempts = 0;
    let wordIndex: number;
    
    do {
      wordIndex = Math.floor(Math.random() * modifiedWords.length);
      attempts++;
    } while (modifiedIndices.has(wordIndex) && attempts < 50);
    
    if (attempts >= 50) break; // Couldn't find unmodified word
    
    const word = modifiedWords[wordIndex];
    if (word.length < 3) continue; // Skip very short words
    
    // Apply random error type
    const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    modifiedWords[wordIndex] = errorType(word);
    modifiedIndices.add(wordIndex);
  }
  
  return modifiedWords.join(' ');
}

/**
 * Introduce a spelling error (swap adjacent letters)
 */
function introduceSpellingError(word: string): string {
  if (word.length < 3) return word;
  const pos = Math.floor(Math.random() * (word.length - 1));
  const chars = word.split('');
  [chars[pos], chars[pos + 1]] = [chars[pos + 1], chars[pos]];
  return chars.join('');
}

/**
 * Change a word to a similar word
 */
function introduceWordChange(word: string): string {
  const commonChanges: Record<string, string[]> = {
    'el': ['al', 'él'],
    'la': ['las', 'lo'],
    'de': ['del', 'desde'],
    'en': ['un', 'sin'],
    'que': ['qué', 'quien'],
    'por': ['para', 'pro'],
    'con': ['como', 'sin'],
    'una': ['uno', 'unas'],
    'su': ['sus', 'tu'],
    'no': ['ni', 'na'],
    'los': ['las', 'los'],
    'se': ['si', 'sé'],
    'este': ['ese', 'esta'],
    'era': ['esa', 'será'],
    'pueblo': ['poblo', 'puevlo'],
    'tierra': ['tiera', 'teirra'],
    'señor': ['señór', 'senor'],
    'hombre': ['ombre', 'honbre'],
    'dios': ['díos', 'dlos']
  };
  
  const lowerWord = word.toLowerCase();
  if (commonChanges[lowerWord]) {
    const options = commonChanges[lowerWord];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  return word;
}

/**
 * Remove a letter from the word
 */
function introduceMissingLetter(word: string): string {
  if (word.length < 4) return word;
  const pos = Math.floor(Math.random() * word.length);
  return word.slice(0, pos) + word.slice(pos + 1);
}

/**
 * Add an extra letter to the word
 */
function introduceExtraLetter(word: string): string {
  const pos = Math.floor(Math.random() * word.length);
  const extraLetter = word[pos]; // Duplicate a letter
  return word.slice(0, pos) + extraLetter + word.slice(pos);
}

/**
 * Swap two adjacent words
 */
function introduceWordSwap(word: string): string {
  // This function receives a single word, but we can modify it slightly
  // by changing its case or adding punctuation errors
  if (Math.random() > 0.5) {
    // Capitalize incorrectly
    return word.toLowerCase();
  } else {
    // Add duplicate letter at end
    return word + word[word.length - 1];
  }
}
