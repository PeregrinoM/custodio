import { Chapter } from "@/types/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface ChapterCardProps {
  chapter: Chapter;
  bookId: string;
}

const ChapterCard = ({ chapter, bookId }: ChapterCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary rounded-lg">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Capítulo {chapter.number}</CardTitle>
              <CardDescription className="text-sm mt-1">
                {chapter.title}
              </CardDescription>
            </div>
          </div>
          {chapter.change_count > 0 ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-change-bg-removed rounded-full">
              <AlertCircle className="h-3 w-3 text-change-removed" />
              <span className="text-xs font-medium text-change-removed">
                {chapter.change_count}
              </span>
            </div>
          ) : (
            <CheckCircle className="h-4 w-4 text-change-added" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Link to={`/capitulos/${chapter.id}`}>
          <Button variant="outline" className="w-full" size="sm">
            Ver párrafos
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};

export default ChapterCard;
