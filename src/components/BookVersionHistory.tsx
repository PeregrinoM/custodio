import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Eye, Calendar as CalendarIcon, RefreshCw, TrendingUp, CheckCircle, 
  ArrowRight, FlaskConical, FileSearch, Search, X, ArrowDown, ArrowUp, 
  FileText, AlertTriangle, Loader2 
} from "lucide-react";
import { BookVersionSelector } from "./BookVersionSelector";
import { VersionTimeline } from "./VersionTimeline";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface BookComparison {
  id: string;
  book_id: string;
  comparison_date: string;
  comparison_type: string;
  total_changes: number;
  changed_paragraphs: number;
  chapters_affected: any;
  version_notes: string | null;
  created_at: string;
}

interface Book {
  id: string;
  code: string;
  title: string;
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
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchGlobal, setSearchGlobal] = useState("");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedBookForVersions, setSelectedBookForVersions] = useState<string | null>(null);
  const [currentBaselines, setCurrentBaselines] = useState<Map<string, { versionNumber: number, versionId: string }>>(new Map());

  useEffect(() => {
    loadComparisons();
    loadCurrentBaselines();
  }, []);

  // Listen for baseline changes to refresh data
  useEffect(() => {
    const handleBaselineChange = () => {
      console.log('📢 Baseline changed, refreshing history...');
      loadComparisons();
      loadCurrentBaselines();
    };

    window.addEventListener('baselineChanged', handleBaselineChange);
    return () => window.removeEventListener('baselineChanged', handleBaselineChange);
  }, []);

  const loadComparisons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('book_comparisons')
        .select('*')
        .order('comparison_date', { ascending: false });

      if (error) throw error;
      setComparisons(data || []);
    } catch (error) {
      console.error('Error loading comparisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentBaselines = async () => {
    try {
      const { data: versions, error } = await supabase
        .from('book_versions')
        .select('book_id, version_number, id, is_baseline')
        .eq('is_baseline', true);

      if (error) throw error;

      const baselineMap = new Map<string, { versionNumber: number, versionId: string }>();
      versions?.forEach(v => {
        baselineMap.set(v.book_id, { versionNumber: v.version_number, versionId: v.id });
      });
      
      setCurrentBaselines(baselineMap);
    } catch (error) {
      console.error('Error loading current baselines:', error);
    }
  };

  const clearFilters = () => {
    setSelectedBook("all");
    setSelectedType("all");
    setSelectedVersionType("all");
    setDateFrom("");
    setDateTo("");
    setSearchGlobal("");
  };

  const getBookInfo = (bookId: string) => {
    return books.find(b => b.id === bookId);
  };

  const getComparisonTypeBadge = (comp: BookComparison) => {
    if (comp.comparison_type === 'test_import') {
      return (
        <Badge className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-700 dark:text-purple-300 border-purple-500/50 font-medium">
          <FlaskConical className="h-3 w-3 mr-1" />
          Prueba
        </Badge>
      );
    }
    
    if (comp.version_notes?.includes('Línea base cambiada')) {
      return (
        <Badge className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 font-medium animate-pulse">
          <RefreshCw className="h-3 w-3 mr-1" />
          Cambio de Base
        </Badge>
      );
    }
    
    if (comp.comparison_type === 'initial_import') {
      return (
        <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-700 dark:text-green-300 border-green-500/50 font-medium">
          <CheckCircle className="h-3 w-3 mr-1" />
          Base Inicial
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-700 dark:text-blue-300 border-blue-500/50 font-medium">
        <FileSearch className="h-3 w-3 mr-1" />
        Revisión
      </Badge>
    );
  };

  const getTotalChangesSum = () => {
    return filteredComparisons.reduce((sum, comp) => sum + (comp.total_changes || 0), 0);
  };

  const filteredComparisons = comparisons
    .filter((comp) => {
      // Global search
      if (searchGlobal) {
        const searchLower = searchGlobal.toLowerCase();
        const book = getBookInfo(comp.book_id);
        const matchesBook = book?.code.toLowerCase().includes(searchLower) || 
                            book?.title.toLowerCase().includes(searchLower);
        const matchesNotes = comp.version_notes?.toLowerCase().includes(searchLower);
        const matchesType = comp.comparison_type.toLowerCase().includes(searchLower);
        
        if (!matchesBook && !matchesNotes && !matchesType) return false;
      }

      if (selectedBook !== "all" && comp.book_id !== selectedBook) return false;
      
      if (selectedType !== "all") {
        if (selectedType === "baseline_change" && !comp.version_notes?.includes('Línea base cambiada')) return false;
        if (selectedType !== "baseline_change" && comp.comparison_type !== selectedType) return false;
      }

      if (selectedVersionType !== "all") {
        if (selectedVersionType === "baseline" && comp.comparison_type !== "initial_import") return false;
        if (selectedVersionType === "revision" && comp.comparison_type === "initial_import") return false;
      }

      if (dateFrom && new Date(comp.comparison_date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(comp.comparison_date) > new Date(dateTo)) return false;

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.comparison_date).getTime();
      const dateB = new Date(b.comparison_date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const totalPages = Math.ceil(filteredComparisons.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedComparisons = filteredComparisons.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Versiones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enhanced Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-primary">
                      {filteredComparisons.length}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Registros totales
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-primary/40" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-destructive">
                      {getTotalChangesSum()}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Cambios detectados
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-destructive/40" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {books.filter(b => 
                        comparisons.some(c => c.book_id === b.id && c.comparison_type === 'initial_import')
                      ).length}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Versiones base
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500/40" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {comparisons.filter(c => c.version_notes?.includes('Línea base cambiada')).length}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Cambios de base
                    </p>
                  </div>
                  <RefreshCw className="h-8 w-8 text-amber-500/40" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Filters Section */}
          <div className="space-y-4">
            {/* Global Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en todo el historial (libro, notas, tipo)..."
                value={searchGlobal}
                onChange={(e) => setSearchGlobal(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchGlobal && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchGlobal("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Active Filter Pills */}
            {(selectedBook !== "all" || selectedType !== "all" || selectedVersionType !== "all" || dateFrom || dateTo || searchGlobal) && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Filtros activos:</span>
                
                {selectedBook !== "all" && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    Libro: {books.find(b => b.id === selectedBook)?.code}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => setSelectedBook("all")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                
                {selectedType !== "all" && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    Tipo: {selectedType === 'initial_import' ? 'Base Inicial' : selectedType === 'api_check' ? 'Revisión' : 'Cambio Base'}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => setSelectedType("all")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}

                {selectedVersionType !== "all" && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    Versión: {selectedVersionType === 'baseline' ? 'Solo Líneas Base' : 'Solo Revisiones'}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => setSelectedVersionType("all")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}

                {searchGlobal && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    Búsqueda: "{searchGlobal}"
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => setSearchGlobal("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7"
                >
                  Limpiar todos
                </Button>
              </div>
            )}

            {/* Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Libro</label>
                <Select value={selectedBook} onValueChange={setSelectedBook}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los libros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los libros</SelectItem>
                    {books.map((book) => (
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
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="initial_import">Base Inicial</SelectItem>
                    <SelectItem value="api_check">Revisión</SelectItem>
                    <SelectItem value="baseline_change">Cambio de Base</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Versiones</label>
                <Select value={selectedVersionType} onValueChange={setSelectedVersionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="baseline">Solo Líneas Base</SelectItem>
                    <SelectItem value="revision">Solo Revisiones</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Desde</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Hasta</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="text-sm font-medium mb-2 block">Ordenar</label>
                <Select value={sortOrder} onValueChange={(v: 'asc' | 'desc') => setSortOrder(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="h-4 w-4" />
                        Más reciente primero
                      </div>
                    </SelectItem>
                    <SelectItem value="asc">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="h-4 w-4" />
                        Más antiguo primero
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Libro</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Versión Base</TableHead>
                  <TableHead className="text-right">Cambios</TableHead>
                  <TableHead className="text-right">Párrafos</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground animate-pulse">
                          Cargando historial de versiones...
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredComparisons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No se encontraron registros con los filtros aplicados
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedComparisons.map((comp, index) => {
                    const absoluteIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
                    const bookInfo = getBookInfo(comp.book_id);
                    const currentBaselineInfo = currentBaselines.get(comp.book_id);
                    const isCurrentBaseline = comp.comparison_type === 'initial_import' && 
                                             currentBaselineInfo?.versionNumber === 1;

                    return (
                      <TableRow key={comp.id} className="group hover:bg-muted/50 transition-colors duration-200">
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          #{absoluteIndex + 1}
                        </TableCell>
                        <TableCell className="font-medium group-hover:text-foreground transition-colors">{bookInfo?.code}</TableCell>
                        <TableCell className="group-hover:text-foreground transition-colors">
                          {format(new Date(comp.comparison_date), "dd/MM/yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          {getComparisonTypeBadge(comp)}
                        </TableCell>
                        <TableCell>
                          {isCurrentBaseline ? (
                            <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-700 dark:text-green-300 border-green-500/50 font-medium">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              BASE ACTUAL #{currentBaselineInfo?.versionNumber}
                            </Badge>
                          ) : currentBaselineInfo ? (
                            <span className="text-sm text-muted-foreground">
                              V{currentBaselineInfo.versionNumber}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {comp.total_changes > 0 ? (
                            <span className="text-destructive">{comp.total_changes}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{comp.changed_paragraphs}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {comp.version_notes || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedBookForVersions(comp.book_id)}
                            className="gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            Ver versiones
                          </Button>
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
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      {/* Version Timeline for Selected Book */}
      {selectedBookForVersions && (
        <VersionTimeline bookId={selectedBookForVersions} />
      )}

      {/* Version Selector Dialog */}
      {selectedBookForVersions && (
        <BookVersionSelector
          bookId={selectedBookForVersions}
          bookTitle={books.find(b => b.id === selectedBookForVersions)?.title || ""}
        />
      )}
    </div>
  );
};

export default BookVersionHistory;
