import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Book } from "@/types/database";
import Navbar from "@/components/Navbar";
import { Loader2, BookOpen, AlertCircle, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const Libros = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('title');

      if (error) throw error;
      setBooks(data || []);
    } catch (error) {
      console.error('Error fetching books:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Libros Monitoreados</h1>
            <p className="text-muted-foreground">
              Lista de libros bajo monitoreo continuo para detectar cambios textuales
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay libros monitoreados en este momento
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="w-[120px]">Código</TableHead>
                    <TableHead className="w-[130px]">Cambios</TableHead>
                    <TableHead className="w-[180px]">Última revisión</TableHead>
                    <TableHead className="w-[120px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books.map((book) => {
                    const lastCheck = new Date(book.last_check_date).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });
                    
                    return (
                      <TableRow key={book.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-primary" />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{book.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{book.code}</Badge>
                        </TableCell>
                        <TableCell>
                          {book.total_changes > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              <span className="text-sm font-medium text-destructive">
                                {book.total_changes} {book.total_changes === 1 ? 'cambio' : 'cambios'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Sin cambios</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lastCheck}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={`/libros/${book.id}`}>
                            <Button variant="ghost" size="sm">
                              Ver detalles
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Libros;
