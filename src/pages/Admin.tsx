import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchBook, getAvailableBookCodes, isValidBookCode, getBookInfo } from "@/lib/egwApi";
import { compareBookVersion, importBook } from "@/lib/compareUtils";
import { Book } from "@/types/database";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BookPlus, RefreshCw, LogOut, AlertTriangle, Copy } from "lucide-react";

interface ImportProgress {
  status: string;
  current: number;
  total: number;
  chapterName: string;
}

const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState<string | null>(null);
  const [newBookCode, setNewBookCode] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [scrapingErrors, setScrapingErrors] = useState<string[]>([]);
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

      const newBookData = await fetchBook(book.code);
      const result = await compareBookVersion(book.id, newBookData);

      toast({
        title: "Comparación completada",
        description: `Se detectaron ${result.totalChanges} cambio(s) en ${result.changedParagraphs} párrafo(s)`,
      });

      await loadBooks();
    } catch (error) {
      console.error("Error comparing book:", error);
      toast({
        title: "Error",
        description: "No se pudo completar la comparación",
        variant: "destructive",
      });
    } finally {
      setComparing(null);
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
      status: 'Iniciando scraping...',
      current: 0,
      total: 0,
      chapterName: ''
    });

    try {
      const bookInfo = getBookInfo(trimmedCode);
      
      setImportProgress({
        status: `Extrayendo ${bookInfo?.title}...`,
        current: 0,
        total: 0,
        chapterName: ''
      });

      const bookData = await fetchBook(trimmedCode);
      
      setImportProgress({
        status: 'Guardando en base de datos...',
        current: 0,
        total: bookData.chapters.length,
        chapterName: ''
      });

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

        {/* Import New Book Section */}
        <Card className="mb-8 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookPlus className="h-5 w-5 text-primary" />
              Agregar nuevo libro
            </CardTitle>
            <CardDescription>
              Ingresa el código de un libro de EGW Writings para comenzar a monitorearlo. Códigos disponibles: {getAvailableBookCodes().join(', ')}
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
              <Card className="p-4 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100">{importProgress.status}</p>
                    {importProgress.total > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                          />
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          {importProgress.current} / {importProgress.total} capítulos
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
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
                    <div className="flex items-start justify-between">
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
                      <Button
                        onClick={() => handleCompareBook(book)}
                        disabled={comparing === book.id}
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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Admin;
