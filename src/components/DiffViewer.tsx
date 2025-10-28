import { Paragraph } from "@/types/database";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface DiffViewerProps {
  paragraph: Paragraph | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DiffViewer = ({ paragraph, open, onOpenChange }: DiffViewerProps) => {
  if (!paragraph) return null;

  // Simple diff highlighting - in production, use a proper diff library
  const highlightDiff = (oldText: string, newText: string) => {
    const oldWords = oldText.split(' ');
    const newWords = newText.split(' ');
    
    return { oldWords, newWords };
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
                  <Badge variant="outline" className="bg-change-bg-removed text-change-removed border-change-removed/30">
                    Texto original
                  </Badge>
                  <div className="p-3 rounded-lg bg-change-bg-removed">
                    <p className="text-sm leading-relaxed">{change.old_text}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-change-bg-added text-change-added border-change-added/30">
                    Texto actualizado
                  </Badge>
                  <div className="p-3 rounded-lg bg-change-bg-added">
                    <p className="text-sm leading-relaxed">{change.new_text}</p>
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
