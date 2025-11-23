import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { ParagraphDetailModal } from './ParagraphDetailModal';

interface DbParagraph {
  id: string;
  refcode_short: string;
  paragraph_number: number;
  base_text: string;
}

interface ReferencePanelProps {
  paragraphs: DbParagraph[];
  chapterNumber: number;
}

export function ReferencePanel({ paragraphs, chapterNumber }: ReferencePanelProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedParagraph, setSelectedParagraph] = useState<DbParagraph | null>(null);

  const filteredParagraphs = paragraphs.filter(p => 
    p.refcode_short.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.base_text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-2 border-b bg-muted/50">
        {/* Left column header */}
        <div className="p-3 border-r">
          <p className="text-sm font-medium">Contenido del párrafo de nuestra BD</p>
        </div>
        {/* Right column header */}
        <div className="p-3 space-y-2">
          <p className="text-sm font-medium">
            Capítulo {chapterNumber} 
            <span className="text-xs text-muted-foreground ml-1">
              (cambiable si fuese necesario pero por defecto debe cambiar según el capítulo en revisión)
            </span>
          </p>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar códigos..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x h-[300px]">
        {/* Left: Paragraph preview */}
        <ScrollArea className="h-[300px]">
          <div className="p-3 space-y-2">
            {filteredParagraphs.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedParagraph(p)}
                className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors text-sm text-muted-foreground line-clamp-2"
              >
                {p.base_text.substring(0, 150)}...
              </button>
            ))}
            {filteredParagraphs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No se encontraron párrafos
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Right: Codes list */}
        <ScrollArea className="h-[300px]">
          <div className="p-3">
            <p className="text-xs text-muted-foreground mb-2">
              Códigos a seleccionar que están relacionados al capítulo en revisión
            </p>
            <div className="flex flex-wrap gap-2">
              {filteredParagraphs.map((p) => (
                <Badge
                  key={p.id}
                  variant="outline"
                  className="font-mono cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => setSelectedParagraph(p)}
                >
                  {p.refcode_short}
                </Badge>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {selectedParagraph && (
        <ParagraphDetailModal
          paragraph={selectedParagraph}
          onClose={() => setSelectedParagraph(null)}
        />
      )}
    </div>
  );
}
