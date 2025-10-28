import { Book } from "@/types/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface BookCardProps {
  book: Book;
}

const BookCard = ({ book }: BookCardProps) => {
  const lastCheck = new Date(book.last_check_date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary rounded-lg">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{book.title}</CardTitle>
              <CardDescription className="text-sm mt-1">
                Código: {book.code}
              </CardDescription>
            </div>
          </div>
          {book.total_changes > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-change-bg-removed rounded-full">
              <AlertCircle className="h-3 w-3 text-change-removed" />
              <span className="text-xs font-medium text-change-removed">
                {book.total_changes} cambios
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Última revisión: {lastCheck}
          </div>
          <Link to={`/libros/${book.id}`}>
            <Button className="w-full">
              Ver detalles
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookCard;
