import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchBook } from "@/lib/egwApi";
import { compareBookVersion, importBook } from "@/lib/compareUtils";
import { Book } from "@/types/database";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BookPlus, RefreshCw, LogOut, AlertTriangle } from "lucide-react";

const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState<string | null>(null);
  const [newBookCode, setNewBookCode] = useState("");
  const [importing, setImporting] = useState(false);
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

    // Validate only uppercase letters
    if (!/^[A-Z]+$/.test(trimmedCode)) {
      toast({
        title: "Error",
        description: "El código debe contener solo letras mayúsculas",
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
    try {
      toast({
        title: "Importando...",
        description: `Obteniendo datos del libro ${newBookCode}`,
      });

      const bookData = await fetchBook(newBookCode);
      await importBook(bookData);

      toast({
        title: "Libro importado",
        description: `${bookData.title} ha sido agregado exitosamente`,
      });

      setNewBookCode("");
      await loadBooks();
    } catch (error) {
      console.error("Error importing book:", error);
      toast({
        title: "Error",
        description: "No se pudo importar el libro. Verifica el código.",
        variant: "destructive",
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
              Ingresa el código de un libro de EGW Writings para comenzar a monitorearlo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Código del libro (ej: DA, CS, PP)"
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
