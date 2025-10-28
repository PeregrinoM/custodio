import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Chapter, Paragraph, ChangeHistoryEntry } from "@/types/database";
import Navbar from "@/components/Navbar";
import ParagraphItem from "@/components/ParagraphItem";
import DiffViewer from "@/components/DiffViewer";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const ChapterView = () => {
  const { id } = useParams<{ id: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [selectedParagraph, setSelectedParagraph] = useState<Paragraph | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchChapterAndParagraphs();
    }
  }, [id]);

  const fetchChapterAndParagraphs = async () => {
    try {
      // Fetch chapter
      const { data: chapterData, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
        .eq('id', id)
        .single();

      if (chapterError) throw chapterError;
      setChapter(chapterData);

      // Fetch paragraphs
      const { data: paragraphsData, error: paragraphsError } = await supabase
        .from('paragraphs')
        .select('*')
        .eq('chapter_id', id)
        .order('paragraph_number');

      if (paragraphsError) throw paragraphsError;
      
      // Type cast the change_history JSON to our type
      const typedParagraphs = (paragraphsData || []).map(p => ({
        ...p,
        change_history: p.change_history as any as ChangeHistoryEntry[]
      }));
      
      setParagraphs(typedParagraphs);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = (paragraph: Paragraph) => {
    setSelectedParagraph(paragraph);
    setDialogOpen(true);
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

  if (!chapter) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Capítulo no encontrado</p>
          </div>
        </div>
      </div>
    );
  }

  const changedCount = paragraphs.filter(p => p.has_changed).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" className="mb-6" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Capítulo {chapter.number}: {chapter.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{paragraphs.length} párrafo(s)</span>
              <span>•</span>
              <span>{changedCount} cambio(s) detectado(s)</span>
            </div>
          </div>

          <div className="space-y-4">
            {paragraphs.map((paragraph) => (
              <ParagraphItem
                key={paragraph.id}
                paragraph={paragraph}
                onViewHistory={handleViewHistory}
              />
            ))}
          </div>

          {paragraphs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No hay párrafos disponibles para este capítulo
            </div>
          )}
        </div>
      </main>

      <DiffViewer
        paragraph={selectedParagraph}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default ChapterView;
