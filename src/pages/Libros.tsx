import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Book } from "@/types/database";
import Navbar from "@/components/Navbar";
import BookCard from "@/components/BookCard";
import { Loader2 } from "lucide-react";

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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}

          {!loading && books.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No hay libros monitoreados en este momento
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Libros;
