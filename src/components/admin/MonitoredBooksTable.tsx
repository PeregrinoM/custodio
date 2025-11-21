import { useState, useMemo } from "react";
import { Book } from "@/types/database";
import { BookVersionSelector } from "@/components/BookVersionSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Trash2, 
  MoreVertical, 
  Loader2,
  Search,
  FileText
} from "lucide-react";

interface MonitoredBooksTableProps {
  books: Book[];
  onCompare: (book: Book) => void;
  onDelete: (bookCode: string, bookTitle: string) => void;
  comparing: string | null;
  deleting: string | null;
}

export function MonitoredBooksTable({
  books,
  onCompare,
  onDelete,
  comparing,
  deleting,
}: MonitoredBooksTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtrar libros por búsqueda
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) return books;
    
    const query = searchQuery.toLowerCase();
    return books.filter(
      (book) =>
        book.code.toLowerCase().includes(query) ||
        book.title.toLowerCase().includes(query)
    );
  }, [books, searchQuery]);

  // Calcular paginación
  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBooks = filteredBooks.slice(startIndex, endIndex);

  // Resetear página cuando cambia la búsqueda
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Formatear fecha de manera relativa
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Hoy";
    if (diffInDays === 1) return "Hace 1 día";
    if (diffInDays < 7) return `Hace ${diffInDays} días`;
    if (diffInDays < 30) return `Hace ${Math.floor(diffInDays / 7)} semanas`;
    if (diffInDays < 365) return `Hace ${Math.floor(diffInDays / 30)} meses`;
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (books.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No hay libros monitoreados aún.</p>
          <p className="text-sm mt-2">Usa la sección de Herramientas para importar uno.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o título..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredBooks.length} de {books.length} libros
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead className="w-[100px]">Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-[160px]">Última Revisión</TableHead>
              <TableHead className="w-[100px] text-center">Cambios</TableHead>
              <TableHead className="w-[120px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentBooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron libros con "{searchQuery}"
                </TableCell>
              </TableRow>
            ) : (
              currentBooks.map((book, index) => {
                const isComparing = comparing === book.id;
                const isDeleting = deleting === book.code;
                const globalIndex = startIndex + index + 1;

                return (
                  <TableRow key={book.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-muted-foreground">
                      {globalIndex}
                    </TableCell>
                    <TableCell>
                      <code className="font-mono font-semibold text-sm bg-muted px-2 py-1 rounded">
                        {book.code}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium">{book.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeDate(book.last_check_date)}
                    </TableCell>
                    <TableCell className="text-center">
                      {book.total_changes > 0 ? (
                        <Badge variant="destructive" className="font-semibold">
                          {book.total_changes}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="font-semibold">
                          0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <BookVersionSelector 
                          bookId={book.id} 
                          bookTitle={book.title}
                        />
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isComparing || isDeleting}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onCompare(book)}
                              disabled={isComparing || isDeleting}
                            >
                              {isComparing ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Comparando...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Revisar cambios
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDelete(book.code, book.title)}
                              disabled={isComparing || isDeleting}
                              className="text-destructive focus:text-destructive"
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Eliminando...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar libro
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
