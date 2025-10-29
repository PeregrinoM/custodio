import { Paragraph } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import * as Diff from "diff";

interface DiffViewerProps {
  paragraph: Paragraph | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DiffViewer = ({ paragraph, open, onOpenChange }: DiffViewerProps) => {
  if (!paragraph) return null;

  const renderDiffText = (oldText: string, newText: string) => {
    const diff = Diff.diffWords(oldText, newText);
    
    return (
      <div className="text-sm leading-relaxed">
        {diff.map((part, index) => {
          if (part.added) {
            return (
              <span key={index} className="bg-change-bg-added text-change-added font-medium">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={index} className="bg-change-bg-removed text-change-removed line-through font-medium">
                {part.value}
              </span>
            );
          }
          return <span key={index}>{part.value}</span>;
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de cambios - Párrafo {paragraph.paragraph_number}</DialogTitle>
          <DialogDescription>
            Se han detectado {paragraph.change_history.length} cambio(s) en este párrafo
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {paragraph.change_history.map((change, index) => (
            <div key={index} className="space-y-3 pb-6 border-b last:border-b-0">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {new Date(change.date).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Badge variant="secondary">
                    Comparación con resaltado
                  </Badge>
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                    {renderDiffText(change.old_text, change.new_text)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <div className="space-y-2 pt-4">
            <Badge variant="secondary">Versión actual</Badge>
            <div className="p-4 rounded-lg bg-secondary">
              <p className="text-sm leading-relaxed">{paragraph.latest_text}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiffViewer;
