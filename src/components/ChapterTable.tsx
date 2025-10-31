import { Chapter } from "@/types/database";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";

interface ChapterTableProps {
  chapters: Chapter[];
}

const ChapterTable = ({ chapters }: ChapterTableProps) => {
  const navigate = useNavigate();

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">N°</TableHead>
            <TableHead>Capítulo</TableHead>
            <TableHead className="w-32 text-right">Cambios</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {chapters.map((chapter) => (
            <TableRow
              key={chapter.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/capitulos/${chapter.id}`)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {chapter.number}
                </div>
              </TableCell>
              <TableCell className="font-medium">{chapter.title}</TableCell>
              <TableCell className="text-right">
                {chapter.change_count > 0 ? (
                  <Badge variant="destructive">{chapter.change_count}</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    0
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ChapterTable;
