import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchBook } from "@/lib/egwApi";
import { compareBookVersion, importBook, deleteBook } from "@/lib/compareUtils";
import { Book } from "@/types/database";
import { useToast } from "@/hooks/use-toast";

interface CompareProgress {
  status: string;
  current: number;
  total: number;
  startTime: number;
  bookTitle: string;
}

interface ImportProgress {
  status: string;
  current: number;
  total: number;
  chapterName: string;
  startTime: number;
}

export function useBookOperations() {
  const [comparing, setComparing] = useState<string | null>(null);
  const [compareProgress, setCompareProgress] = useState<CompareProgress | null>(null);
  const [deletingBook, setDeletingBook] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const { toast } = useToast();

  const handleCompare = async (book: Book, onSuccess?: () => void) => {
    setComparing(book.id);
    
    try {
      toast({
        title: "Comparando...",
        description: `Obteniendo nueva versión de ${book.title}`,
      });

      setCompareProgress({
        status: 'Obteniendo nueva versión del libro...',
        current: 0,
        total: 0,
        startTime: Date.now(),
        bookTitle: book.title
      });

      const newBookData = await fetchBook(book.code);
      
      setCompareProgress(prev => prev ? {
        ...prev,
        status: 'Comparando capítulos...',
        total: newBookData.chapters.length
      } : null);

      const result = await compareBookVersion(book.id, newBookData);

      setCompareProgress(null);
      toast({
        title: "Comparación completada",
        description: `Se detectaron ${result.totalChanges} cambio(s) en ${result.changedParagraphs} párrafo(s)`,
      });

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error comparing book:", error);
      setCompareProgress(null);
      toast({
        title: "Error",
        description: "No se pudo completar la comparación",
        variant: "destructive",
      });
    } finally {
      setComparing(null);
    }
  };

  const handleDelete = async (bookCode: string, bookTitle: string, onSuccess?: () => void) => {
    console.log('🔴 [DELETE] Iniciando eliminación de:', bookCode);
    setDeletingBook(bookCode);

    try {
      console.log('🔴 [DELETE] Llamando deleteBook...');
      await deleteBook(bookCode);

      toast({
        title: "✅ Libro eliminado",
        description: `${bookTitle} (${bookCode}) fue eliminado correctamente`,
        duration: 5000,
      });

      console.log('🔴 [DELETE] Eliminación exitosa');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('🔴 [DELETE] Error en handleDelete:', error);
      toast({
        title: "❌ Error al eliminar",
        description: error instanceof Error ? error.message : "Error desconocido al eliminar el libro",
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setDeletingBook(null);
    }
  };

  const handleImport = async (bookCode: string, bookInfo: any, onSuccess?: () => void) => {
    setImporting(true);
    setImportProgress({
      status: 'Iniciando importación...',
      current: 0,
      total: 0,
      chapterName: '',
      startTime: Date.now()
    });

    try {
      setImportProgress(prev => prev ? {
        ...prev,
        status: `Extrayendo ${bookInfo?.title}...`,
      } : null);

      const bookData = await fetchBook(bookCode);
      
      setImportProgress(prev => prev ? {
        ...prev,
        status: 'Guardando en base de datos...',
        total: bookData.chapters.length,
        chapterName: bookData.chapters[0]?.title || ''
      } : null);

      await importBook(bookData);
      
      setImportProgress(null);
      toast({
        title: "✅ Libro importado exitosamente",
        description: `${bookData.title}: ${bookData.chapters.length} capítulos importados`,
      });

      if (onSuccess) onSuccess();
      return { success: true, bookData };
    } catch (error) {
      setImportProgress(null);
      console.error('❌ Detalles del error de importación:', {
        error,
        message: error instanceof Error ? error.message : 'Desconocido',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      let errorMessage = 'Error desconocido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes('Edge Function') || errorMessage.includes('FunctionsHttpError')) {
          errorMessage = 'Error en el scraper. Revisa los logs del backend para más detalles.';
        } else if (errorMessage.includes('violates') || errorMessage.includes('duplicate')) {
          errorMessage = 'El libro ya existe en la base de datos. Usa "Comparar" en su lugar.';
        } else if (errorMessage.includes('No se encontraron capítulos')) {
          errorMessage = 'No se pudieron extraer capítulos del sitio. Verifica el código del libro.';
        }
      }
      
      toast({
        title: '❌ Error al importar',
        description: errorMessage,
        variant: 'destructive',
        duration: 10000
      });

      return { success: false, error: errorMessage };
    } finally {
      setImporting(false);
    }
  };

  return {
    // States
    comparing,
    compareProgress,
    deletingBook,
    importing,
    importProgress,
    
    // Actions
    handleCompare,
    handleDelete,
    handleImport,
  };
}
