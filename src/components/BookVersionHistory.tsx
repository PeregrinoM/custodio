import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Book } from "@/types/database";
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
import { Calendar, FileText, TrendingUp, Filter, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchNotes, setSearchNotes] = useState("");

  useEffect(() => {
    loadComparisons();
  }, [selectedBook, selectedType, dateFrom, dateTo]);

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

  const filteredComparisons = comparisons.filter(comp => {
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

  const getTotalChangesSum = () => {
    return filteredComparisons.reduce((sum, comp) => sum + comp.total_changes, 0);
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
    setDateFrom("");
    setDateTo("");
    setSearchNotes("");
  };

  return (
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
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{filteredComparisons.length}</div>
              <p className="text-sm text-muted-foreground">Registros totales</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-destructive">{getTotalChangesSum()}</div>
              <p className="text-sm text-muted-foreground">Cambios detectados</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-accent">{books.length}</div>
              <p className="text-sm text-muted-foreground">Libros monitoreados</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Filtros</h3>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <TableHead className="w-[120px]">Base/Versión</TableHead>
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

                  return (
                    <TableRow key={comp.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(comp.comparison_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{book?.code}</div>
                            <div className="text-sm text-muted-foreground">{book?.title}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isBaseline ? "default" : "secondary"}>
                          {isBaseline ? "Base" : "Revisión"}
                        </Badge>
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
                        {isBaseline ? (
                          <Badge variant="outline" className="bg-primary/5">
                            Línea Base
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-secondary/50">
                            Versión #{filteredComparisons.filter(
                              c => c.book_id === comp.book_id && 
                              new Date(c.comparison_date) <= new Date(comp.comparison_date)
                            ).length}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-muted-foreground truncate">
                          {comp.version_notes || "-"}
                        </p>
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
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
    </Card>
  );
};

export default BookVersionHistory;
