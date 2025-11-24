import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import { ParagraphDetailModal } from './ParagraphDetailModal';
import { supabase } from '@/integrations/supabase/client';

interface DbParagraph {
  id: string;
  refcode_short: string;
  paragraph_number: number;
  base_text: string;
}

interface DbChapter {
  id: string;
  number: number;
  title: string;
}

interface ReferencePanelProps {
  bookId: string;
  chapterNumber: number;
}

export function ReferencePanel({ bookId, chapterNumber }: ReferencePanelProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [selectedParagraph, setSelectedParagraph] = useState<DbParagraph | null>(null);
  const [chapters, setChapters] = useState<DbChapter[]>([]);
  const [paragraphs, setParagraphs] = useState<DbParagraph[]>([]);
  const [loading, setLoading] = useState(false);

  // Load chapters from database
  useEffect(() => {
    loadChapters();
  }, [bookId]);

  // Load paragraphs when chapter changes
  useEffect(() => {
    if (selectedChapter) {
      loadParagraphs(selectedChapter);
    }
  }, [selectedChapter]);

  // Update selected chapter when chapterNumber prop changes
  useEffect(() => {
    const chapter = chapters.find(ch => ch.number === chapterNumber);
    if (chapter) {
      setSelectedChapter(chapter.id);
    }
  }, [chapterNumber, chapters]);

  const loadChapters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chapters')
      .select('id, number, title')
      .eq('book_id', bookId)
      .order('number');

    if (data && !error) {
      setChapters(data);
      // Set initial chapter
      const currentChapter = data.find(ch => ch.number === chapterNumber);
      if (currentChapter) {
        setSelectedChapter(currentChapter.id);
      }
    }
    setLoading(false);
  };

  const loadParagraphs = async (chapterId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('paragraphs')
      .select('id, refcode_short, paragraph_number, base_text')
      .eq('chapter_id', chapterId)
      .order('paragraph_number');

    if (data && !error) {
      setParagraphs(data);
    } else {
      setParagraphs([]);
    }
    setLoading(false);
  };

  const filteredParagraphs = paragraphs.filter(p => 
    searchFilter === '' || 
    p.refcode_short.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.base_text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const selectedChapterData = chapters.find(ch => ch.id === selectedChapter);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-2 border-b bg-muted/50">
        {/* Left column header */}
        <div className="p-3 border-r">
          <p className="text-sm font-medium">Contenido del párrafo de nuestra BD</p>
        </div>
        {/* Right column header */}
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Capítulo:</p>
            <Select value={selectedChapter} onValueChange={setSelectedChapter}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Cargando...
                    </span>
                  ) : selectedChapterData ? (
                    `${selectedChapterData.number}. ${selectedChapterData.title}`
                  ) : (
                    'Seleccionar capítulo'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {chapters.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.number}. {ch.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
