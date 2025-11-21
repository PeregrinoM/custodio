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
import { Book } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, AlertTriangle, RefreshCw } from "lucide-react";

interface ComparisonConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: Book | null;
  onConfirm: () => void;
  isComparing: boolean;
}

export function ComparisonConfirmDialog({
  open,
  onOpenChange,
  book,
  onConfirm,
  isComparing,
}: ComparisonConfirmDialogProps) {
  const [stats, setStats] = useState<{
    chapterCount: number;
    lastComparison: string | null;
    estimatedMinutes: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && book) {
      loadBookStats();
    }
  }, [open, book]);

  const loadBookStats = async () => {
    if (!book) return;
    
    setLoading(true);
    try {
      // Get chapter count
      const { count: chapterCount } = await supabase
        .from("chapters")
        .select("*", { count: "exact", head: true })
        .eq("book_id", book.id);

      // Get last comparison
      const { data: lastComparison } = await supabase
        .from("book_comparisons")
        .select("comparison_date")
        .eq("book_id", book.id)
        .order("comparison_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Estimate time: ~1-2 seconds per chapter
      const estimatedMinutes = Math.ceil((chapterCount || 0) * 1.5 / 60);

      setStats({
        chapterCount: chapterCount || 0,
        lastComparison: lastComparison?.comparison_date || null,
        estimatedMinutes: Math.max(1, estimatedMinutes),
      });
    } catch (error) {
      console.error("Error loading book stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Hoy";
    if (diffInDays === 1) return "Hace 1 día";
    if (diffInDays < 7) return `Hace ${diffInDays} días`;
    if (diffInDays < 30) return `Hace ${Math.floor(diffInDays / 7)} semanas`;
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (!book) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Confirmar Revisión de Cambios
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <div className="font-medium text-foreground text-base">
                {book.title}
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats ? (
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Código:</span>
                      <code className="font-mono font-semibold bg-background px-2 py-0.5 rounded">
                        {book.code}
                      </code>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Capítulos:</span>
                      <span className="font-semibold">{stats.chapterCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Última revisión:</span>
                      <span className="font-semibold">
                        {stats.lastComparison 
                          ? formatRelativeDate(stats.lastComparison)
                          : "Nunca"
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cambios detectados:</span>
                      <Badge variant={book.total_changes > 0 ? "destructive" : "secondary"}>
                        {book.total_changes}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm pt-2 border-t">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Tiempo estimado: ~{stats.estimatedMinutes} {stats.estimatedMinutes === 1 ? 'minuto' : 'minutos'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-md p-3">
                    <p className="text-amber-800 dark:text-amber-300 text-sm flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>
                        Se comparará la versión actual con la última versión disponible en EGW Writings. 
                        Esto creará un nuevo registro en el historial de versiones.
                      </span>
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isComparing}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isComparing || loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isComparing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Comparando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sí, revisar cambios
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
