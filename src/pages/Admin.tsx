import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAvailableBookCodes } from "@/lib/egwApi";
import { Book } from "@/types/database";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useBookOperations } from "@/hooks/useBookOperations";
import Navbar from "@/components/Navbar";
import BookVersionHistory from "@/components/BookVersionHistory";
import { DeleteBookDialog } from "@/components/DeleteBookDialog";
import { ComparisonConfirmDialog } from "@/components/admin/ComparisonConfirmDialog";
import { ProgressTracker } from "@/components/ProgressTracker";
import { BookCatalogManager } from "@/components/BookCatalogManager";
import { MonitoredBooksTable } from "@/components/admin/MonitoredBooksTable";
import { BookImportForm } from "@/components/admin/BookImportForm";
import { DebugTocTool } from "@/components/admin/DebugTocTool";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, AlertTriangle, Settings, Library, History, Wrench } from "lucide-react";

const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<{ id: string; code: string; title: string } | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [bookToCompare, setBookToCompare] = useState<Book | null>(null);
  const [availableBookCodes, setAvailableBookCodes] = useState<string[]>([]);
  
  const { isAdmin, loading: adminCheckLoading } = useAdminCheck();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Use custom hook for book operations
  const {
    comparing,
    compareProgress,
    deletingBook,
    importing,
    importProgress,
    handleCompare,
    handleDelete,
    handleImport,
  } = useBookOperations();

  useEffect(() => {
    checkAuth();
    loadBooks();
    loadAvailableBookCodes();
  }, []);

  const loadAvailableBookCodes = async () => {
    try {
      const codes = await getAvailableBookCodes();
      setAvailableBookCodes(codes);
    } catch (error) {
      console.error("Error loading book codes:", error);
    }
  };

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
  };

  const loadBooks = async () => {
    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBooks(data || []);
    } catch (error) {
      console.error("Error loading books:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los libros",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompareBook = (book: Book) => {
    setBookToCompare(book);
    setCompareDialogOpen(true);
  };

  const confirmCompareBook = async () => {
    if (!bookToCompare) return;
    setCompareDialogOpen(false);
    await handleCompare(bookToCompare, loadBooks);
    setBookToCompare(null);
  };

  const handleDeleteBook = (bookId: string, bookCode: string, bookTitle: string) => {
    console.log('🔴 [DELETE] Abriendo diálogo para:', bookCode, bookTitle);
    setBookToDelete({ id: bookId, code: bookCode, title: bookTitle });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteBook = async () => {
    if (!bookToDelete) return;
    await handleDelete(bookToDelete.code, bookToDelete.title, async () => {
      await loadBooks();
      setDeleteDialogOpen(false);
      setBookToDelete(null);
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || adminCheckLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if user is not an admin
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Acceso No Autorizado
              </CardTitle>
              <CardDescription>
                No tienes permisos de administrador para acceder a esta página.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  El panel de administración está restringido a usuarios con rol de administrador.
                  Si crees que deberías tener acceso, contacta al administrador del sistema.
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => navigate("/")} variant="outline">
                    Volver al inicio
                  </Button>
                  <Button onClick={handleLogout} variant="destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Panel de Administración
            </h1>
            <p className="text-muted-foreground">
              Monitoreo textual y gestión de versiones de libros EGW
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate("/admin/config")} variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>

        {/* Compare Progress Indicator (Global) */}
        {compareProgress && (
          <div className="mb-6">
            <ProgressTracker
              title={`Revisando cambios: ${compareProgress.bookTitle}`}
              status={compareProgress.status}
              current={compareProgress.current}
              total={compareProgress.total}
              startTime={compareProgress.startTime}
              itemName="capítulo"
            />
          </div>
        )}

        {/* Tabs Navigation */}
        <Tabs defaultValue="books" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto">
            <TabsTrigger value="books" className="gap-2">
              <Library className="h-4 w-4" />
              Gestión de Libros
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Historial de Versiones
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2">
              <Wrench className="h-4 w-4" />
              Herramientas
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Gestión de Libros */}
          <TabsContent value="books" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Libros Monitoreados
                </h2>
                <div className="text-sm text-muted-foreground">
                  Total: {books.length} {books.length === 1 ? 'libro' : 'libros'}
                </div>
              </div>

              <MonitoredBooksTable
                books={books}
                onCompare={handleCompareBook}
                onDelete={handleDeleteBook}
                comparing={comparing}
                deleting={deletingBook}
              />
            </div>
          </TabsContent>

          {/* Tab 2: Historial de Versiones */}
          <TabsContent value="history" className="space-y-6">
            <BookVersionHistory books={books} />
          </TabsContent>

          {/* Tab 3: Herramientas */}
          <TabsContent value="tools" className="space-y-6">
            {/* Debug TOC Tool */}
            <DebugTocTool availableBookCodes={availableBookCodes} />

            {/* Import New Book Form */}
            <BookImportForm
              availableBookCodes={availableBookCodes}
              existingBooks={books}
              onImport={(code, info, onSuccess) => handleImport(code, info, async () => {
                await loadBooks();
                onSuccess();
              })}
              importing={importing}
              importProgress={importProgress}
            />

            {/* Book Catalog Management */}
            <Accordion type="single" collapsible>
              <AccordionItem value="catalog">
                <AccordionTrigger className="text-lg font-semibold">
                  📚 Gestión de Catálogo ({availableBookCodes.length} libros disponibles)
                </AccordionTrigger>
                <AccordionContent>
                  <BookCatalogManager />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>
      </main>

      {/* Comparison Confirmation Dialog */}
      <ComparisonConfirmDialog
        open={compareDialogOpen}
        onOpenChange={setCompareDialogOpen}
        book={bookToCompare}
        onConfirm={confirmCompareBook}
        isComparing={!!comparing}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteBookDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        bookTitle={bookToDelete?.title || ""}
        bookCode={bookToDelete?.code || ""}
        bookId={bookToDelete?.id || ""}
        onConfirm={confirmDeleteBook}
        isDeleting={!!deletingBook}
      />
    </div>
  );
};

export default Admin;
