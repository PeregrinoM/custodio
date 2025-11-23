import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ParagraphDetailModalProps {
  paragraph: {
    refcode_short: string;
    base_text: string;
    paragraph_number: number;
  };
  onClose: () => void;
}

export function ParagraphDetailModal({ paragraph, onClose }: ParagraphDetailModalProps) {
  const handleCopyCode = () => {
    navigator.clipboard.writeText(paragraph.refcode_short);
    toast.success(`Código ${paragraph.refcode_short} copiado al portapapeles`);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {paragraph.refcode_short}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Párrafo #{paragraph.paragraph_number}
            </span>
          </DialogTitle>
          <DialogDescription>
            Contenido completo del párrafo de la base de datos
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-sm">{paragraph.base_text}</p>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {paragraph.base_text.length} caracteres
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={handleCopyCode}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar código
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
