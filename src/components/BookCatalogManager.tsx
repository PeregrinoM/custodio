import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { refreshBookCatalog } from "@/lib/egwApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface CatalogBook {
  id: string;
  book_code: string;
  egw_book_id: number;
  title_es: string;
  is_active: boolean;
  validation_status: string;
  last_validated: string | null;
}

export const BookCatalogManager = () => {
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from("book_catalog" as any)
        .select("*")
        .order("book_code");

      if (error) throw error;
      setBooks((data as unknown as CatalogBook[]) || []);
    } catch (error) {
      console.error("Error loading catalog:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el catálogo de libros",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCatalog = async () => {
    setSyncing(true);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-library-catalog');

      if (error) throw error;

      // Refresh the egwApi cache so new books are immediately available
      refreshBookCatalog();

      toast({
        title: "✅ Catálogo Sincronizado",
        description: `Encontrados ${data.totalFound} libros. Insertados: ${data.inserted}, Actualizados: ${data.updated}`,
      });

      // Reload catalog
      await loadCatalog();
    } catch (error) {
      console.error("Error syncing catalog:", error);
      toast({
        title: "Error",
        description: "No se pudo sincronizar el catálogo desde EGW",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleActive = async (bookId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("book_catalog" as any)
        .update({ is_active: !currentStatus } as any)
        .eq("id", bookId);

      if (error) throw error;

      // Update local state
      setBooks(prev => prev.map(book => 
        book.id === bookId 
          ? { ...book, is_active: !currentStatus }
          : book
      ));

      // Refresh cache so changes take effect immediately
      refreshBookCatalog();

      toast({
        title: "Actualizado",
        description: `Monitoreo del libro ${!currentStatus ? 'activado' : 'desactivado'}`,
      });
    } catch (error) {
      console.error("Error toggling book:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del libro",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verificado
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Fallido
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pendiente
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="catalog">
        <AccordionTrigger className="text-lg font-semibold">
          📚 Gestión de Catálogo de Libros ({books.length} libros)
        </AccordionTrigger>
        <AccordionContent>
          <Card>
            <CardHeader>
              <CardTitle>Libros Disponibles en la Biblioteca EGW</CardTitle>
              <CardDescription>
                Activa o desactiva libros individuales para monitoreo. 
                Los libros activos aparecerán en el panel de administración principal para importar y comparar.
              </CardDescription>
              <div className="pt-4">
                <Button 
                  onClick={handleSyncCatalog} 
                  disabled={syncing}
                  variant="outline"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sincronizando desde EGW...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Actualizar Catálogo desde EGW
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Activo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>ID EGW</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay libros en el catálogo. Haz clic en "Actualizar Catálogo desde EGW" para sincronizar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      books.map((book) => (
                        <TableRow key={book.id}>
                          <TableCell>
                            <Checkbox
                              checked={book.is_active}
                              onCheckedChange={() => handleToggleActive(book.id, book.is_active)}
                            />
                          </TableCell>
                          <TableCell className="font-mono font-semibold">
                            {book.book_code}
                          </TableCell>
                          <TableCell>
                            {book.title_es}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {book.egw_book_id}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(book.validation_status)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
