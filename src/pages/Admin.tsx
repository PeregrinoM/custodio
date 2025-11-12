import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchBook, getAvailableBookCodes, isValidBookCode, getBookInfo } from "@/lib/egwApi";
import { compareBookVersion, importBook, deleteBook } from "@/lib/compareUtils";
import { Book } from "@/types/database";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import Navbar from "@/components/Navbar";
import BookVersionHistory from "@/components/BookVersionHistory";
import { DeleteBookDialog } from "@/components/DeleteBookDialog";
import { ProgressTracker } from "@/components/ProgressTracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BookPlus, RefreshCw, LogOut, AlertTriangle, Copy, Trash2 } from "lucide-react";

interface ImportProgress {
  status: string;
  current: number;
  total: number;
  chapterName: string;
  startTime: number;
}

interface CompareProgress {
  status: string;
  current: number;
  total: number;
  startTime: number;
  bookTitle: string;
}

const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState<string | null>(null);
  const [compareProgress, setCompareProgress] = useState<CompareProgress | null>(null);
  const [deletingBook, setDeletingBook] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<{ code: string; title: string } | null>(null);
  const [newBookCode, setNewBookCode] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [scrapingErrors, setScrapingErrors] = useState<string[]>([]);
  const [debugHtml, setDebugHtml] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugBookId, setDebugBookId] = useState<string>('174');
  const [debugBookCode, setDebugBookCode] = useState<string>('');
  const { isAdmin, loading: adminCheckLoading } = useAdminCheck();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadBooks();
  }, []);

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

  const handleCompareBook = async (book: Book) => {
    setComparing(book.id);
    
    try {
      toast({
        title: "Comparando...",
        description: `Obteniendo nueva versión de ${book.title}`,
      });

      // Initialize progress
      setCompareProgress({
        status: 'Obteniendo nueva versión del libro...',
        current: 0,
        total: 0,
        startTime: Date.now(),
        bookTitle: book.title
      });

      const newBookData = await fetchBook(book.code);
      
      // Update progress with total chapters
      setCompareProgress(prev => prev ? {
        ...prev,
        status: 'Comparando capítulos...',
        total: newBookData.chapters.length
      } : null);

      const result = await compareBookVersion(book.id, newBookData);

      setCompareProgress(null);
      toast({
        title: "Comparación completada",
        description: `Se detectaron ${result.totalChanges} cambio(s) en ${result.changedParagraphs} párrafo(s)`,
      });

      await loadBooks();
    } catch (error) {
      console.error("Error comparing book:", error);
      setCompareProgress(null);
      toast({
        title: "Error",
        description: "No se pudo completar la comparación",
        variant: "destructive",
      });
    } finally {
      setComparing(null);
    }
  };

  const handleDeleteBook = (bookCode: string, bookTitle: string) => {
    console.log('🔴 [DELETE] Abriendo diálogo para:', bookCode, bookTitle);
    setBookToDelete({ code: bookCode, title: bookTitle });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteBook = async () => {
    if (!bookToDelete) return;

    const { code, title } = bookToDelete;
    console.log('🔴 [DELETE] Usuario confirmó eliminación de:', code);

    setDeletingBook(code);

    try {
      console.log('🔴 [DELETE] Llamando deleteBook...');
      await deleteBook(code);

      toast({
        title: "✅ Libro eliminado",
        description: `${title} (${code}) fue eliminado correctamente`,
        duration: 5000,
      });

      console.log('🔴 [DELETE] Recargando lista de libros...');
      await loadBooks();
      
      setDeleteDialogOpen(false);
      setBookToDelete(null);
    } catch (error) {
      console.error('🔴 [DELETE] Error en handleDeleteBook:', error);
      toast({
        title: "❌ Error al eliminar",
        description: error instanceof Error ? error.message : "Error desconocido al eliminar el libro",
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setDeletingBook(null);
    }
  };

  const handleImportBook = async () => {
    const trimmedCode = newBookCode.trim();
    
    // Validation
    if (!trimmedCode) {
      toast({
        title: "Error",
        description: "Por favor ingresa un código de libro",
        variant: "destructive",
      });
      return;
    }

    // Validate with available book codes
    if (!isValidBookCode(trimmedCode)) {
      toast({
        title: "Código inválido",
        description: `Códigos válidos: ${getAvailableBookCodes().join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate
    if (books.some(b => b.code === trimmedCode)) {
      toast({
        title: "Error",
        description: "Este libro ya está siendo monitoreado",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportProgress({
      status: 'Iniciando importación...',
      current: 0,
      total: 0,
      chapterName: '',
      startTime: Date.now()
    });

    try {
      const bookInfo = getBookInfo(trimmedCode);
      
      setImportProgress(prev => prev ? {
        ...prev,
        status: `Extrayendo ${bookInfo?.title}...`,
      } : null);

      const bookData = await fetchBook(trimmedCode);
      
      setImportProgress(prev => prev ? {
        ...prev,
        status: 'Guardando en base de datos...',
        total: bookData.chapters.length,
        chapterName: bookData.chapters[0]?.title || ''
      } : null);

      await importBook(bookData);
      
      setImportProgress(null);
      toast({
        title: "✅ Libro importado exitosamente",
        description: `${bookData.title}: ${bookData.chapters.length} capítulos importados`,
      });

      setNewBookCode("");
      await loadBooks();
    } catch (error) {
      setImportProgress(null);
      console.error('❌ Detalles del error de importación:', {
        error,
        message: error instanceof Error ? error.message : 'Desconocido',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      let errorMessage = 'Error desconocido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Proporcionar mensajes de error más útiles
        if (errorMessage.includes('Edge Function') || errorMessage.includes('FunctionsHttpError')) {
          errorMessage = 'Error en el scraper. Revisa los logs del backend para más detalles.';
        } else if (errorMessage.includes('violates') || errorMessage.includes('duplicate')) {
          errorMessage = 'El libro ya existe en la base de datos. Usa "Comparar" en su lugar.';
        } else if (errorMessage.includes('No se encontraron capítulos')) {
          errorMessage = 'No se pudieron extraer capítulos del sitio. Verifica el código del libro.';
        }
      }
      
      setScrapingErrors(prev => [...prev, `${new Date().toLocaleString()}: ${errorMessage}`]);
      
      toast({
        title: '❌ Error al importar',
        description: errorMessage,
        variant: 'destructive',
        duration: 10000
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDebugToc = async () => {
    setIsDebugging(true);
    setDebugHtml(null);
    
    const bookIdToTest = parseInt(debugBookId);
    
    if (isNaN(bookIdToTest)) {
      toast({
        title: '❌ ID inválido',
        description: 'Por favor ingresa un ID numérico válido',
        variant: 'destructive'
      });
      setIsDebugging(false);
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('debug-toc', {
        body: { bookId: bookIdToTest }
      });

      if (error) throw error;
      
      setDebugHtml(data);
      
      toast({
        title: '✅ Debug completado',
        description: `HTML obtenido para ID ${bookIdToTest}: ${data.htmlLength} caracteres`
      });
      
    } catch (error) {
      console.error('Debug error:', error);
      toast({
        title: '❌ Error en debug',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive'
      });
    } finally {
      setIsDebugging(false);
    }
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
            <h1 className="font-display text-4xl font-bold text-foreground mb-2">
              Panel de Administración
            </h1>
            <p className="text-muted-foreground">
              Gestiona los libros monitoreados y realiza comparaciones
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>

        {/* Debug Section */}
        <Card className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-800">
          <h2 className="text-xl font-bold mb-4">🔧 Debug: Inspeccionar HTML del TOC</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Herramienta para validar que un libro se puede importar correctamente antes de intentarlo.
          </p>
          
          <div className="flex gap-3 mb-4">
            {/* Dropdown with available books */}
            <Select value={debugBookCode} onValueChange={(code) => {
              setDebugBookCode(code);
              const bookInfo = getBookInfo(code);
              if (bookInfo) {
                setDebugBookId(bookInfo.id.toString());
              }
            }}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Seleccionar libro..." />
              </SelectTrigger>
              <SelectContent>
                {getAvailableBookCodes().map(code => {
                  const info = getBookInfo(code);
                  return (
                    <SelectItem key={code} value={code}>
                      {code} - {info?.title}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            
            {/* Manual book ID input */}
            <Input
              type="number"
              placeholder="ID del libro (ej: 217)"
              value={debugBookId}
              onChange={(e) => setDebugBookId(e.target.value)}
              className="w-[180px]"
            />
            
            <Button 
              onClick={handleDebugToc} 
              disabled={isDebugging || !debugBookId}
              variant="outline"
            >
              {isDebugging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Probando...
                </>
              ) : (
                '🔍 Probar TOC'
              )}
            </Button>
          </div>
          
          {debugHtml && (
            <div className="mt-4 space-y-4">
              <div className="bg-background p-4 rounded border">
                <h3 className="font-bold mb-2">Información:</h3>
                <ul className="text-sm space-y-1">
                  <li>URL: {debugHtml.url}</li>
                  <li>Tamaño: {debugHtml.htmlLength} bytes</li>
                  <li>Content-Type: {debugHtml.contentType}</li>
                  <li>Status: {debugHtml.statusCode}</li>
                </ul>
              </div>
              
              <div className="bg-background p-4 rounded border">
                <h3 className="font-bold mb-2">Sección "capítulo":</h3>
                <pre className="text-xs overflow-auto max-h-64 bg-muted p-2 rounded">
                  {debugHtml.chaptersSection}
                </pre>
              </div>
              
              <div className="bg-background p-4 rounded border">
                <h3 className="font-bold mb-2">Sección links "&lt;a href":</h3>
                <pre className="text-xs overflow-auto max-h-64 bg-muted p-2 rounded">
                  {debugHtml.linksSection}
                </pre>
              </div>
              
              <div className="bg-background p-4 rounded border">
                <h3 className="font-bold mb-2">HTML completo (primeros 5000 chars):</h3>
                <pre className="text-xs overflow-auto max-h-96 bg-muted p-2 rounded">
                  {debugHtml.htmlSample}
                </pre>
              </div>
              
              <Button 
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(debugHtml.fullHtml);
                  toast({ title: 'HTML completo copiado al portapapeles' });
                }}
              >
                📋 Copiar HTML Completo
              </Button>
            </div>
          )}
        </Card>

        {/* Import New Book Section */}
        <Card className="mb-8 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookPlus className="h-5 w-5 text-primary" />
              Agregar nuevo libro
            </CardTitle>
            <CardDescription>
              Ingresa el código de un libro de EGW Writings para comenzar a monitorearlo.
              <br />
              <span className="text-amber-600 dark:text-amber-400 font-medium mt-2 inline-block">
                💡 Tip: Usa la herramienta de Debug arriba para validar que el libro se puede importar correctamente.
              </span>
              <br />
              Códigos disponibles: {getAvailableBookCodes().join(', ')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 mb-4">
              <Input
                placeholder="Código del libro (ej: DTG, CS, PP)"
                value={newBookCode}
                onChange={(e) => setNewBookCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                disabled={importing}
                className="max-w-xs"
                maxLength={10}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !importing) {
                    handleImportBook();
                  }
                }}
              />
              <Button onClick={handleImportBook} disabled={importing || !newBookCode.trim()}>
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar libro
              </Button>
            </div>

            {/* Import Progress Indicator */}
            {importProgress && (
              <ProgressTracker
                title="Importando libro"
                status={importProgress.status}
                current={importProgress.current}
                total={importProgress.total}
                startTime={importProgress.startTime}
                itemName="capítulo"
                itemLabel={importProgress.chapterName}
              />
            )}

            {/* Error Display */}
            {scrapingErrors.length > 0 && (
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const errors = scrapingErrors.join('\n\n');
                    navigator.clipboard.writeText(errors);
                    toast({ title: 'Errores copiados al portapapeles' });
                  }}
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  ⚠️ Ver errores ({scrapingErrors.length})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compare Progress Indicator */}
        {compareProgress && (
          <ProgressTracker
            title={`Revisando cambios: ${compareProgress.bookTitle}`}
            status={compareProgress.status}
            current={compareProgress.current}
            total={compareProgress.total}
            startTime={compareProgress.startTime}
            itemName="capítulo"
          />
        )}

        {/* Books List */}
        <div className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Libros monitoreados
          </h2>
          
          {books.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay libros monitoreados aún. Importa uno para comenzar.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {books.map((book) => (
                <Card key={book.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                          {book.title}
                        </h3>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>Código: <span className="font-mono font-semibold">{book.code}</span></p>
                          <p>Última revisión: {new Date(book.last_check_date).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</p>
                          <p>Cambios totales detectados: <span className="font-semibold text-change-removed">{book.total_changes}</span></p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCompareBook(book)}
                          disabled={comparing === book.id || deletingBook === book.code}
                          variant="outline"
                        >
                          {comparing === book.id ? (
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
                        </Button>
                        <Button
                          onClick={() => handleDeleteBook(book.code, book.title)}
                          disabled={deletingBook === book.code || comparing === book.id}
                          variant="destructive"
                          size="default"
                        >
                          {deletingBook === book.code ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Eliminando...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Version History Section */}
        <div className="mt-12">
          <BookVersionHistory books={books} />
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <DeleteBookDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        bookTitle={bookToDelete?.title || ""}
        bookCode={bookToDelete?.code || ""}
        onConfirm={confirmDeleteBook}
        isDeleting={!!deletingBook}
      />
    </div>
  );
};

export default Admin;
