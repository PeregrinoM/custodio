import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Book, Chapter } from "@/types/database";
import Navbar from "@/components/Navbar";
import ChapterTable from "@/components/ChapterTable";
import { Loader2, ArrowLeft, Calendar, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const BookView = () => {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchBookAndChapters();
    }
  }, [id]);

  const fetchBookAndChapters = async () => {
    try {
      // Fetch book
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();

      if (bookError) throw bookError;
      setBook(bookData);

      // Fetch chapters
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', id)
        .order('number');

      if (chaptersError) throw chaptersError;
      setChapters(chaptersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Libro no encontrado</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Link to="/libros">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a libros
            </Button>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">{book.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">Código:</span>
                <span>{book.code}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>Español</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  Importado el:{" "}
                  {format(new Date(book.imported_at), "d 'de' MMMM 'de' yyyy", {
                    locale: es,
                  })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium">
                {chapters.length} capítulo{chapters.length !== 1 ? "s" : ""}
              </span>
              <span>•</span>
              <span className="font-medium">
                {book.total_changes} cambio{book.total_changes !== 1 ? "s" : ""} detectado
                {book.total_changes !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {chapters.length > 0 ? (
            <ChapterTable chapters={chapters} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No hay capítulos disponibles para este libro
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default BookView;
