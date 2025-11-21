import { useMemo } from "react";
import { Book } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BookOpen, CheckCircle, Clock, FileEdit } from "lucide-react";

interface MonitoringStatsCardProps {
  books: Book[];
  totalChapters?: number;
}

export function MonitoringStatsCard({ books, totalChapters }: MonitoringStatsCardProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Libros con cambios detectados
    const booksWithChanges = books.filter(b => b.total_changes > 0);

    // Libros sin revisar en 30+ días
    const booksNeedingReview = books.filter(b => {
      const lastCheck = new Date(b.last_check_date);
      return lastCheck < thirtyDaysAgo;
    });

    // Último libro revisado
    const lastReviewedBook = books.length > 0
      ? books.reduce((latest, book) => {
          const latestDate = new Date(latest.last_check_date);
          const bookDate = new Date(book.last_check_date);
          return bookDate > latestDate ? book : latest;
        })
      : null;

    // Total de cambios detectados
    const totalChanges = books.reduce((sum, book) => sum + (book.total_changes || 0), 0);

    return {
      booksWithChanges: booksWithChanges.length,
      booksNeedingReview: booksNeedingReview.length,
      lastReviewedBook,
      totalChanges,
    };
  }, [books]);

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Hoy";
    if (diffInDays === 1) return "Hace 1 día";
    if (diffInDays < 7) return `Hace ${diffInDays} días`;
    if (diffInDays < 30) return `Hace ${Math.floor(diffInDays / 7)} semanas`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (books.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Libros con cambios */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Cambios Detectados
          </CardTitle>
          <FileEdit className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.booksWithChanges} de {books.length}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.totalChanges} cambio{stats.totalChanges !== 1 ? 's' : ''} total{stats.totalChanges !== 1 ? 'es' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Última revisión */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Última Revisión
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold truncate" title={stats.lastReviewedBook?.code || ""}>
            {stats.lastReviewedBook?.code || "-"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.lastReviewedBook 
              ? formatRelativeDate(stats.lastReviewedBook.last_check_date)
              : "Sin revisiones"
            }
          </p>
        </CardContent>
      </Card>

      {/* Capítulos monitoreados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Capítulos Totales
          </CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {totalChapters !== undefined ? totalChapters.toLocaleString() : "-"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            En {books.length} libro{books.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Alerta de libros sin revisar */}
      <Card className={stats.booksNeedingReview > 0 ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Estado de Revisión
          </CardTitle>
          {stats.booksNeedingReview > 0 ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
        </CardHeader>
        <CardContent>
          {stats.booksNeedingReview > 0 ? (
            <>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {stats.booksNeedingReview}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Sin revisar +30 días
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                ✓ Al día
              </div>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                Todos actualizados
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
