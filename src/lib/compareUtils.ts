/**
 * Text comparison utilities for detecting changes in EGW writings
 */

import * as Diff from 'diff';
import { supabase } from '@/integrations/supabase/client';
import { EGWBook } from './egwApi';

export interface ComparisonResult {
  hasChanged: boolean;
  oldText: string;
  newText: string;
  diffParts?: Diff.Change[];
}

export interface BookComparisonResult {
  bookId: string;
  totalChanges: number;
  changedParagraphs: number;
  chapters: ChapterComparisonResult[];
}

export interface ChapterComparisonResult {
  chapterId: string;
  chapterNumber: number;
  changesInChapter: number;
}

/**
 * Compare two paragraph texts and return detailed diff information
 */
export function compareParagraphs(
  baseText: string,
  latestText: string
): ComparisonResult {
  const normalizedBase = baseText.trim();
  const normalizedLatest = latestText.trim();

  if (normalizedBase === normalizedLatest) {
    return {
      hasChanged: false,
      oldText: normalizedBase,
      newText: normalizedLatest,
    };
  }

  const diffParts = Diff.diffWords(normalizedBase, normalizedLatest);

  return {
    hasChanged: true,
    oldText: normalizedBase,
    newText: normalizedLatest,
    diffParts,
  };
}

/**
 * ⭐ NUEVA: Eliminar libro completo de la base de datos
 */
export async function deleteBook(bookCode: string): Promise<void> {
  try {
    console.log(`Eliminando libro ${bookCode}...`);

    // Buscar el libro por código
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title')
      .eq('code', bookCode)
      .single();

    if (bookError) {
      if (bookError.code === 'PGRST116') {
        throw new Error(`El libro ${bookCode} no existe en la base de datos`);
      }
      throw bookError;
    }

    // Eliminar el libro (cascade eliminará chapters y paragraphs automáticamente)
    const { error: deleteError } = await supabase
      .from('books')
      .delete()
      .eq('id', book.id);

    if (deleteError) throw deleteError;

    console.log(`✅ Libro ${bookCode} (${book.title}) eliminado correctamente`);
  } catch (error) {
    console.error('Error eliminando libro:', error);
    throw error;
  }
}

/**
 * ⭐ CORREGIDA: Compare a new book version with the stored version in the database
 * Updates the database with detected changes
 * AHORA COMPARA POR REFCODE en lugar de por paragraph_number
 */
export async function compareBookVersion(
  bookId: string,
  newBookData: EGWBook
): Promise<BookComparisonResult> {
  const result: BookComparisonResult = {
    bookId,
    totalChanges: 0,
    changedParagraphs: 0,
    chapters: [],
  };

  const comparisonDate = new Date().toISOString();

  try {
    // Fetch all chapters for this book
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, number, title')
      .eq('book_id', bookId)
      .order('number');

    if (chaptersError) throw chaptersError;

    // Process each chapter
    for (const newChapter of newBookData.chapters) {
      const existingChapter = chapters?.find(c => c.number === newChapter.number);
      
      if (!existingChapter) {
        console.warn(`⚠️ Capítulo ${newChapter.number} no existe en BD, omitiendo comparación`);
        continue;
      }

      let changesInChapter = 0;

      // Fetch paragraphs for this chapter
      const { data: paragraphs, error: parasError } = await supabase
        .from('paragraphs')
        .select('id, paragraph_number, refcode_short, base_text, latest_text, change_history')
        .eq('chapter_id', existingChapter.id)
        .order('paragraph_number');

      if (parasError) throw parasError;

      // ⭐ CAMBIO CRÍTICO: Comparar por refcode_short en lugar de paragraph_number
      for (const newParagraph of newChapter.paragraphs) {
        if (!newParagraph.refcode_short) {
          console.warn(`⚠️ Párrafo sin refcode en capítulo ${newChapter.number}, omitiendo`);
          continue;
        }

        const existingParagraph = paragraphs?.find(
          p => p.refcode_short === newParagraph.refcode_short
        );

        // Handle newly added paragraphs (refcode nuevo)
        if (!existingParagraph) {
          console.log(`📝 Nuevo párrafo detectado: ${newParagraph.refcode_short}`);
          
          const { error: insertError } = await supabase
            .from('paragraphs')
            .insert({
              chapter_id: existingChapter.id,
              paragraph_number: newChapter.paragraphs.indexOf(newParagraph) + 1,
              base_text: newParagraph.content,
              latest_text: newParagraph.content,
              refcode_short: newParagraph.refcode_short,
              has_changed: false,
              change_history: [],
            });

          if (insertError) {
            console.error('Error inserting new paragraph:', insertError);
          }
          continue;
        }

        const comparison = compareParagraphs(
          existingParagraph.latest_text,
          newParagraph.content
        );

        if (comparison.hasChanged) {
          changesInChapter++;
          result.totalChanges++;
          result.changedParagraphs++;

          console.log(`🔄 Cambio detectado en ${newParagraph.refcode_short}`);

          // Update the paragraph with new change history
          const changeHistory = Array.isArray(existingParagraph.change_history)
            ? existingParagraph.change_history
            : [];

          changeHistory.push({
            date: new Date().toISOString(),
            old_text: comparison.oldText,
            new_text: comparison.newText,
          });

          const { error: updateError } = await supabase
            .from('paragraphs')
            .update({
              latest_text: newParagraph.content,
              has_changed: true,
              change_history: changeHistory,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingParagraph.id);

          if (updateError) {
            console.error('Error updating paragraph:', updateError);
          }
        }
      }

      // Update chapter change count (accumulate, don't replace)
      if (changesInChapter > 0) {
        // Fetch current chapter data to get existing count
        const { data: currentChapter } = await supabase
          .from('chapters')
          .select('change_count')
          .eq('id', existingChapter.id)
          .single();

        const { error: chapterUpdateError } = await supabase
          .from('chapters')
          .update({
            change_count: (currentChapter?.change_count || 0) + changesInChapter,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingChapter.id);

        if (chapterUpdateError) {
          console.error('Error updating chapter:', chapterUpdateError);
        }

        result.chapters.push({
          chapterId: existingChapter.id,
          chapterNumber: existingChapter.number,
          changesInChapter,
        });
      }
    }

    // Update book total changes and last check date (accumulate, don't replace)
    const { data: currentBook } = await supabase
      .from('books')
      .select('total_changes')
      .eq('id', bookId)
      .single();

    const { error: bookUpdateError } = await supabase
      .from('books')
      .update({
        total_changes: (currentBook?.total_changes || 0) + result.totalChanges,
        last_check_date: comparisonDate,
        updated_at: comparisonDate,
      })
      .eq('id', bookId);

    if (bookUpdateError) {
      console.error('Error updating book:', bookUpdateError);
    }

    // Register this comparison in history
    const chaptersAffected = result.chapters.map(ch => ({
      chapterId: ch.chapterId,
      chapterNumber: ch.chapterNumber,
      changesInChapter: ch.changesInChapter
    }));

    const { error: comparisonError } = await supabase
      .from('book_comparisons')
      .insert({
        book_id: bookId,
        comparison_date: comparisonDate,
        comparison_type: 'version_check',
        total_changes: result.totalChanges,
        changed_paragraphs: result.changedParagraphs,
        chapters_affected: chaptersAffected,
      });

    if (comparisonError) {
      console.error('Error registering comparison:', comparisonError);
    }

    return result;
  } catch (error) {
    console.error('Error comparing book version:', error);
    throw error;
  }
}

/**
 * ⭐ NUEVA: Sincronizar datos históricos para libros sin registros en book_comparisons
 * Crea registros retroactivos basados en los datos actuales de la tabla books
 */
export async function syncHistoricalData(): Promise<{
  synced: number;
  errors: string[];
}> {
  const result = {
    synced: 0,
    errors: [] as string[],
  };

  try {
    console.log('🔄 Iniciando sincronización de datos históricos...');

    // Obtener todos los libros
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, code, title, total_changes, imported_at, created_at');

    if (booksError) throw booksError;

    if (!books || books.length === 0) {
      console.log('⚠️ No hay libros para sincronizar');
      return result;
    }

    // Para cada libro, verificar si tiene registro initial_import
    for (const book of books) {
      try {
        // Verificar si ya existe un registro de importación inicial
        const { data: existingComparison, error: checkError } = await supabase
          .from('book_comparisons')
          .select('id')
          .eq('book_id', book.id)
          .eq('comparison_type', 'initial_import')
          .maybeSingle();

        if (checkError) throw checkError;

        // Si no existe, crear el registro de importación inicial
        if (!existingComparison) {
          const importDate = book.imported_at || book.created_at || new Date().toISOString();

          const { error: insertError } = await supabase
            .from('book_comparisons')
            .insert({
              book_id: book.id,
              comparison_date: importDate,
              comparison_type: 'initial_import',
              total_changes: 0,
              changed_paragraphs: 0,
              chapters_affected: [],
              version_notes: `Registro retroactivo de importación inicial - ${book.title}`,
            });

          if (insertError) throw insertError;

          console.log(`✅ Registro de importación creado para: ${book.code}`);

          // Si el libro tiene cambios acumulados, crear un registro version_check
          if (book.total_changes && book.total_changes > 0) {
            const { error: versionError } = await supabase
              .from('book_comparisons')
              .insert({
                book_id: book.id,
                comparison_date: new Date().toISOString(),
                comparison_type: 'version_check',
                total_changes: book.total_changes,
                changed_paragraphs: 0, // No tenemos este dato histórico
                chapters_affected: [],
                version_notes: `Cambios acumulados sincronizados desde tabla books (${book.total_changes} cambios)`,
              });

            if (versionError) throw versionError;

            console.log(`✅ Registro de cambios acumulados creado para: ${book.code} (${book.total_changes} cambios)`);
          }

          result.synced++;
        } else {
          console.log(`ℹ️ ${book.code} ya tiene registro de importación`);
        }
      } catch (error) {
        const errorMsg = `Error sincronizando ${book.code}: ${error instanceof Error ? error.message : 'Desconocido'}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    console.log(`✅ Sincronización completada: ${result.synced} libros sincronizados`);
    return result;
  } catch (error) {
    console.error('Error en sincronización:', error);
    result.errors.push(`Error general: ${error instanceof Error ? error.message : 'Desconocido'}`);
    return result;
  }
}

/**
 * Import a new book from EGW API into the database
 */
export async function importBook(bookData: EGWBook): Promise<string> {
  try {
    // Insert book with metadata
    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert({
        title: bookData.title,
        code: bookData.code,
        book_code_api: bookData.code,
        total_changes: 0,
        last_check_date: new Date().toISOString(),
        imported_at: new Date().toISOString(),
        language: 'es',
      })
      .select()
      .single();

    if (bookError) throw bookError;

    // Insert chapters and paragraphs
    for (const chapterData of bookData.chapters) {
      const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .insert({
          book_id: book.id,
          number: chapterData.number,
          title: chapterData.title,
          change_count: 0,
        })
        .select()
        .single();

      if (chapterError) throw chapterError;

      // Insert paragraphs in batches
      const paragraphsToInsert = chapterData.paragraphs.map((para, pIndex) => ({
        chapter_id: chapter.id,
        paragraph_number: pIndex + 1,
        base_text: para.content,
        latest_text: para.content,
        refcode_short: para.refcode_short || '',
        has_changed: false,
        change_history: [],
      }));

      const { error: parasError } = await supabase
        .from('paragraphs')
        .insert(paragraphsToInsert);

      if (parasError) throw parasError;
    }

    // Register initial import in history
    const { error: comparisonError } = await supabase
      .from('book_comparisons')
      .insert({
        book_id: book.id,
        comparison_date: book.imported_at,
        comparison_type: 'initial_import',
        total_changes: 0,
        changed_paragraphs: 0,
        chapters_affected: [],
        version_notes: `Importación inicial: ${bookData.chapters.length} capítulos`,
      });

    if (comparisonError) {
      console.error('Error registering initial import:', comparisonError);
    }

    return book.id;
  } catch (error) {
    console.error('Error importing book:', error);
    throw error;
  }
}
