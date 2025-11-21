import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";

interface DeleteBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  bookCode: string;
  bookId: string;
  onConfirm: () => void;
  isDeleting: boolean;
}

interface BookStats {
  chapterCount: number;
  paragraphCount: number;
  comparisonCount: number;
  lastCheckDate: string | null;
}

export function DeleteBookDialog({
  open,
  onOpenChange,
  bookTitle,
  bookCode,
  bookId,
  onConfirm,
  isDeleting,
}: DeleteBookDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [stats, setStats] = useState<BookStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const isConfirmationValid = confirmationText.toUpperCase() === bookCode.toUpperCase();

  useEffect(() => {
    if (open && bookId) {
      loadBookStats();
      setConfirmationText("");
    }
  }, [open, bookId]);

  const loadBookStats = async () => {
    setLoadingStats(true);
    try {
      // Get chapter count
      const { count: chapterCount } = await supabase
        .from("chapters")
        .select("*", { count: "exact", head: true })
        .eq("book_id", bookId);

      // Get chapters to then get paragraph count
      const { data: chapters } = await supabase
        .from("chapters")
        .select("id")
        .eq("book_id", bookId);
      
      let totalParagraphs = 0;
      if (chapters && chapters.length > 0) {
        const { count } = await supabase
          .from("paragraphs")
          .select("*", { count: "exact", head: true })
          .in("chapter_id", chapters.map(c => c.id));
        totalParagraphs = count || 0;
      }

      // Get comparison count
      const { count: comparisonCount } = await supabase
        .from("book_comparisons")
        .select("*", { count: "exact", head: true })
        .eq("book_id", bookId);

      // Get last check date
      const { data: bookData } = await supabase
        .from("books")
        .select("last_check_date")
        .eq("id", bookId)
        .maybeSingle();

      setStats({
        chapterCount: chapterCount || 0,
        paragraphCount: totalParagraphs,
        comparisonCount: comparisonCount || 0,
        lastCheckDate: bookData?.last_check_date || null,
      });
    } catch (error) {
      console.error("Error loading book stats:", error);
      setStats({
        chapterCount: 0,
        paragraphCount: 0,
        comparisonCount: 0,
        lastCheckDate: null,
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Eliminar Libro Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <div className="font-medium text-foreground text-base">
                ¿Estás seguro de eliminar "{bookTitle}" ({bookCode})?
              </div>
              
              {loadingStats ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats ? (
                <div className="bg-muted/50 rounded-md p-4 space-y-2">
                  <p className="text-sm font-semibold mb-3">Estadísticas del libro:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capítulos:</span>
                      <span className="font-semibold">{stats.chapterCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Párrafos:</span>
                      <span className="font-semibold">{stats.paragraphCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comparaciones:</span>
                      <span className="font-semibold">{stats.comparisonCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última revisión:</span>
                      <span className="font-semibold text-xs">{formatDate(stats.lastCheckDate)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Esta acción eliminará PERMANENTEMENTE:</p>
                <ul className="space-y-1 text-sm list-disc list-inside pl-2">
                  <li>El libro completo</li>
                  <li>Todos sus capítulos {stats && `(${stats.chapterCount})`}</li>
                  <li>Todos sus párrafos {stats && `(${stats.paragraphCount.toLocaleString()})`}</li>
                  <li>Todo el historial de versiones y comparaciones {stats && `(${stats.comparisonCount})`}</li>
                  <li>Todos los comentarios asociados</li>
                </ul>
              </div>

              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
                <p className="text-destructive font-semibold text-sm flex items-center gap-2">
                  ⛔ ESTA ACCIÓN NO SE PUEDE DESHACER
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="confirmation" className="text-sm font-medium">
                  Para confirmar, escribe el código del libro: <code className="font-mono font-bold">{bookCode}</code>
                </Label>
                <Input
                  id="confirmation"
                  type="text"
                  placeholder={`Escribe "${bookCode}" para confirmar`}
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  disabled={isDeleting}
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (isConfirmationValid) {
                onConfirm();
              }
            }}
            disabled={isDeleting || !isConfirmationValid || loadingStats}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              "Sí, eliminar permanentemente"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
