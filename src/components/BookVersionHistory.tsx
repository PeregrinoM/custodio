import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Book } from "@/types/database";
import { syncHistoricalData } from "@/lib/compareUtils";
import { VersionTimeline } from "./VersionTimeline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, TrendingUp, Filter, Download, RefreshCw, AlertCircle, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface BookComparison {
  id: string;
  book_id: string;
  comparison_date: string;
  comparison_type: 'initial_import' | 'version_check';
  total_changes: number;
  changed_paragraphs: number;
  chapters_affected: any[];
  version_notes: string | null;
  created_at: string;
}

interface BookVersionHistoryProps {
  books: Book[];
}

const ITEMS_PER_PAGE = 10;

const BookVersionHistory = ({ books }: BookVersionHistoryProps) => {
  const [comparisons, setComparisons] = useState<BookComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBook, setSelectedBook] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedVersionType, setSelectedVersionType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchNotes, setSearchNotes] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [activeBaselines, setActiveBaselines] = useState<number>(0);
  const [currentBaselines, setCurrentBaselines] = useState<Map<string, { versionNumber: number, versionId: string }>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    loadComparisons();
    loadActiveBaselines();
    loadCurrentBaselines();
  }, [selectedBook, selectedType, dateFrom, dateTo]);

  useEffect(() => {
    checkIfNeedsSync();
  }, [comparisons, books]);

  // Listen for baseline changes to refresh data
  useEffect(() => {
    const handleBaselineChange = () => {
      console.log('📢 Baseline changed, refreshing history...');
      loadComparisons();
      loadActiveBaselines();
      loadCurrentBaselines();
    };

    window.addEventListener('baselineChanged', handleBaselineChange);
    return () => window.removeEventListener('baselineChanged', handleBaselineChange);
  }, []);

  const loadComparisons = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('book_comparisons')
        .select(`
          *,
          books (
            code,
            title
          )
        `)
        .order('comparison_date', { ascending: false });

      // Apply filters
      if (selectedBook !== "all") {
        query = query.eq('book_id', selectedBook);
      }

      if (selectedType !== "all") {
        query = query.eq('comparison_type', selectedType);
      }

      if (dateFrom) {
        query = query.gte('comparison_date', new Date(dateFrom).toISOString());
      }

      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('comparison_date', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Cast types to match our interface
      const typedData = (data || []).map(comp => ({
        ...comp,
        comparison_type: comp.comparison_type as 'initial_import' | 'version_check',
        chapters_affected: Array.isArray(comp.chapters_affected) ? comp.chapters_affected : []
      }));
      
      setComparisons(typedData);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error loading comparisons:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveBaselines = async () => {
    try {
      const { data, error } = await supabase
        .from('book_versions')
        .select('book_id', { count: 'exact' })
        .eq('is_baseline', true);

      if (error) throw error;
      setActiveBaselines(data?.length || 0);
    } catch (error) {
      console.error("Error loading active baselines:", error);
    }
  };

  const loadCurrentBaselines = async () => {
    try {
      const { data, error } = await supabase
        .from('book_versions')
        .select('book_id, version_number, id')
        .eq('is_baseline', true);

      if (error) throw error;
      
      const baselinesMap = new Map<string, { versionNumber: number, versionId: string }>();
      data?.forEach(version => {
        baselinesMap.set(version.book_id, {
          versionNumber: version.version_number,
          versionId: version.id
        });
      });
      
      setCurrentBaselines(baselinesMap);
    } catch (error) {
      console.error("Error loading current baselines:", error);
    }
  };

  const getBaselineVersionAtDate = async (bookId: string, comparisonDate: string) => {
    try {
      const { data, error } = await supabase
        .from('book_versions')
        .select('id, version_number, is_baseline, import_date')
        .eq('book_id', bookId)
        .lte('import_date', comparisonDate)
        .order('import_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching baseline version:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getBaselineVersionAtDate:', error);
      return null;
    }
  };

  const filteredComparisons = comparisons.filter(comp => {
    // Version type filter
    if (selectedVersionType !== "all") {
      if (selectedVersionType === "baseline" && comp.comparison_type !== 'initial_import') {
        return false;
      }
      if (selectedVersionType === "revisions" && comp.comparison_type === 'initial_import') {
        return false;
      }
      if (selectedVersionType === "baseline_changes" && !comp.version_notes?.includes('Baseline changed')) {
        return false;
      }
    }

    if (searchNotes && comp.version_notes) {
      return comp.version_notes.toLowerCase().includes(searchNotes.toLowerCase());
    }
    return true;
  });

  const totalPages = Math.ceil(filteredComparisons.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentComparisons = filteredComparisons.slice(startIndex, endIndex);

  const getBookInfo = (bookId: string) => {
    return books.find(b => b.id === bookId);
  };

  const checkIfNeedsSync = () => {
    // Verificar si hay libros sin registros de importación inicial
    const booksWithoutHistory = books.filter(book => {
      return !comparisons.some(comp => 
        comp.book_id === book.id && comp.comparison_type === 'initial_import'
      );
    });
    setNeedsSync(booksWithoutHistory.length > 0);
  };

  const getTotalChangesSum = () => {
    return filteredComparisons.reduce((sum, comp) => sum + comp.total_changes, 0);
  };

  const getTotalChangesFromBooks = () => {
    // Si hay libros con cambios pero sin comparisons, mostrar la suma desde books
    return books.reduce((sum, book) => sum + (book.total_changes || 0), 0);
  };

  const getBaselineComparison = (bookId: string) => {
    return comparisons.find(
      comp => comp.book_id === bookId && comp.comparison_type === 'initial_import'
    );
  };

  const exportToCSV = () => {
    const headers = ['Fecha', 'Libro', 'Tipo', 'Cambios Totales', 'Párrafos Afectados', 'Notas'];
    const rows = filteredComparisons.map(comp => {
      const book = getBookInfo(comp.book_id);
      return [
        format(new Date(comp.comparison_date), 'dd/MM/yyyy HH:mm', { locale: es }),
        `${book?.code} - ${book?.title}`,
        comp.comparison_type === 'initial_import' ? 'Importación Inicial' : 'Comparación de Versión',
        comp.total_changes,
        comp.changed_paragraphs,
        comp.version_notes || ''
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-versiones-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const clearFilters = () => {
    setSelectedBook("all");
    setSelectedType("all");
    setSelectedVersionType("all");
    setDateFrom("");
    setDateTo("");
    setSearchNotes("");
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncHistoricalData();
      
      if (result.errors.length > 0) {
        toast({
          title: "⚠️ Sincronización con errores",
          description: `${result.synced} libros sincronizados, ${result.errors.length} errores`,
          variant: "destructive",
        });
        console.error("Errores de sincronización:", result.errors);
      } else {
        toast({
          title: "✅ Sincronización completada",
          description: `${result.synced} libros sincronizados correctamente`,
        });
      }
      
      // Recargar comparisons
      await loadComparisons();
    } catch (error) {
      console.error("Error en sincronización:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo completar la sincronización",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleEditNote = (comparisonId: string, currentNote: string | null) => {
    setEditingNote(comparisonId);
    setEditNoteText(currentNote || "");
  };

  const handleSaveNote = async () => {
    if (!editingNote) return;
    
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('book_comparisons')
        .update({ version_notes: editNoteText })
        .eq('id', editingNote);

      if (error) throw error;

      toast({
        title: "✅ Nota actualizada",
        description: "La nota se guardó correctamente",
      });

      // Actualizar el estado local
      setComparisons(prevComparisons =>
        prevComparisons.map(comp =>
          comp.id === editingNote
            ? { ...comp, version_notes: editNoteText }
            : comp
        )
      );

      setEditingNote(null);
      setEditNoteText("");
    } catch (error) {
      console.error("Error guardando nota:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo guardar la nota",
        variant: "destructive",
      });
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <TooltipProvider>
      <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Historial de Versiones
            </CardTitle>
            <CardDescription>
              Registro completo de importaciones y comparaciones de libros
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {needsSync && (
              <Button variant="default" size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronizar Historial
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alert if sync needed */}
        {needsSync && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sincronización necesaria</AlertTitle>
            <AlertDescription>
              Se detectaron {books.filter(book => !comparisons.some(comp => comp.book_id === book.id && comp.comparison_type === 'initial_import')).length} libros sin historial de versiones. 
              Esto ocurre cuando los libros fueron importados antes de implementar el sistema de historial.
              Haz clic en "Sincronizar Historial" para crear los registros faltantes.
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{filteredComparisons.length}</div>
              <p className="text-sm text-muted-foreground">Registros de historial</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-destructive">
                {needsSync ? getTotalChangesFromBooks() : getTotalChangesSum()}
              </div>
              <p className="text-sm text-muted-foreground">
                {needsSync ? "Cambios detectados (sin sincronizar)" : "Cambios detectados"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeBaselines}</div>
              <p className="text-sm text-muted-foreground">Versiones base activas</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-accent">{books.length}</div>
              <p className="text-sm text-muted-foreground">Libros monitoreados</p>
            </CardContent>
          </Card>
        </div>

        {/* Version Timeline - Show when a specific book is selected */}
        {selectedBook !== "all" && (
          <VersionTimeline bookId={selectedBook} />
        )}

        {/* Filters */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Filtros</h3>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Libro</label>
              <Select value={selectedBook} onValueChange={setSelectedBook}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los libros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los libros</SelectItem>
                  {books.map(book => (
                    <SelectItem key={book.id} value={book.id}>
                      {book.code} - {book.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="initial_import">Importación Inicial</SelectItem>
                  <SelectItem value="version_check">Comparación de Versión</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Versión</label>
              <Select value={selectedVersionType} onValueChange={setSelectedVersionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las versiones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las versiones</SelectItem>
                  <SelectItem value="baseline">Solo Líneas Base</SelectItem>
                  <SelectItem value="revisions">Solo Revisiones</SelectItem>
                  <SelectItem value="baseline_changes">Cambios de Base</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Fecha desde</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Fecha hasta</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Buscar en notas</label>
            <Input
              placeholder="Buscar por notas o comentarios..."
              value={searchNotes}
              onChange={(e) => setSearchNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Fecha</TableHead>
                <TableHead>Libro</TableHead>
                <TableHead className="w-[160px]">Tipo</TableHead>
                <TableHead className="w-[100px] text-right">Cambios</TableHead>
                <TableHead className="w-[100px] text-right">Párrafos</TableHead>
                <TableHead className="w-[140px]">Versión Base</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Cargando historial...
                  </TableCell>
                </TableRow>
              ) : currentComparisons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron registros con los filtros aplicados
                  </TableCell>
                </TableRow>
              ) : (
                currentComparisons.map((comp) => {
                  const book = getBookInfo(comp.book_id);
                  const baseline = getBaselineComparison(comp.book_id);
                  const isBaseline = comp.comparison_type === 'initial_import';
                  
                  // Get the current baseline version for this book
                  const currentBaselineInfo = currentBaselines.get(comp.book_id);
                  
                  // Calculate version number for this comparison
                  const versionNumber = filteredComparisons.filter(
                    c => c.book_id === comp.book_id && 
                    new Date(c.comparison_date) <= new Date(comp.comparison_date)
                  ).length;
                  
                  // Check if this specific version is currently the baseline
                  const isCurrentBaseline = currentBaselineInfo?.versionNumber === versionNumber;

                  return (
                     <TableRow key={comp.id} className="group">
                       <TableCell className="font-mono text-sm">
                         <div className="flex items-center gap-2">
                           <Calendar className="h-4 w-4 text-muted-foreground" />
                           {format(new Date(comp.comparison_date), 'dd/MM/yy HH:mm', { locale: es })}
                         </div>
                       </TableCell>
                       <TableCell>
                         <Tooltip>
                           <TooltipTrigger asChild>
                             <div className="flex items-center gap-2 cursor-help">
                               <FileText className="h-4 w-4 text-muted-foreground" />
                               <span className="font-medium">{book?.code}</span>
                             </div>
                           </TooltipTrigger>
                           <TooltipContent side="right" className="max-w-xs">
                             <p className="text-sm">{book?.title}</p>
                           </TooltipContent>
                         </Tooltip>
                       </TableCell>
                      <TableCell>
                        {comp.version_notes?.includes('Línea base cambiada') ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/50">
                            🔄 Cambio de Base
                          </Badge>
                        ) : (
                          <Badge variant={isBaseline ? "default" : "secondary"}>
                            {isBaseline ? "Base Inicial" : "Revisión"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {comp.total_changes > 0 ? (
                          <Badge variant="destructive">{comp.total_changes}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {comp.changed_paragraphs > 0 ? (
                          <span className="font-medium">{comp.changed_paragraphs}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col gap-1 cursor-help">
                                {isCurrentBaseline ? (
                                  <>
                                    <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/50 w-fit">
                                      ✓ BASE ACTUAL
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">Versión #{versionNumber}</span>
                                  </>
                                ) : (
                                  <>
                                    <Badge variant="outline" className="bg-secondary/50 w-fit">
                                      Revisión #{versionNumber}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="text-sm">
                                {isCurrentBaseline 
                                  ? "Esta es la versión base de referencia actual para detectar cambios" 
                                  : "Versión de revisión comparada contra la base"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                       <TableCell className="max-w-xs">
                         <div className="flex items-center gap-2">
                           <p className="text-sm text-muted-foreground truncate flex-1">
                             {comp.version_notes || "-"}
                           </p>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                             onClick={() => handleEditNote(comp.id, comp.version_notes)}
                           >
                             <Pencil className="h-3.5 w-3.5" />
                           </Button>
                         </div>
                       </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {totalPages > 0 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </CardContent>

      {/* Edit Note Dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nota de Versión</DialogTitle>
            <DialogDescription>
              Modifica las notas o comentarios sobre esta comparación de versión.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editNoteText}
            onChange={(e) => setEditNoteText(e.target.value)}
            placeholder="Escribe notas sobre esta versión..."
            rows={4}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNote(null)} disabled={savingNote}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNote} disabled={savingNote}>
              {savingNote ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </TooltipProvider>
  );
};

export default BookVersionHistory;
