import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Edit2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { ManualImportState, ChapterStructure } from '@/types/manual-import';
import { detectChapters, mapChaptersToDatabase, validateChapterStructure } from '@/lib/manual-import/chapter-detection';
import { supabase } from '@/integrations/supabase/client';

interface Phase1_5ChapterDetectionProps {
  state: ManualImportState;
  onNext: (updates: Partial<ManualImportState>) => void;
  onBack: () => void;
}

export function Phase1_5ChapterDetection({ state, onNext, onBack }: Phase1_5ChapterDetectionProps) {
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<ChapterStructure[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    detectAndMapChapters();
  }, []);

  const detectAndMapChapters = async () => {
    setLoading(true);
    try {
      // Detect chapters from text
      const detected = detectChapters(state.rawParagraphs);

      // Get book ID
      const { data: book } = await supabase
        .from('books')
        .select('id')
        .eq('code', state.bookCode)
        .single();

      if (!book) throw new Error('Libro no encontrado');

      // Map to DB chapters
      const mapped = await mapChaptersToDatabase(detected, book.id, supabase);
      setChapters(mapped);

      // Validate
      const validationErrors = validateChapterStructure(mapped);
      setErrors(validationErrors);
    } catch (error) {
      console.error('Error detecting chapters:', error);
      setErrors(['Error al detectar capítulos']);
    } finally {
      setLoading(false);
    }
  };

  const handleTitleEdit = (index: number, newTitle: string) => {
    setChapters(prev => prev.map((ch, i) => 
      i === index ? { ...ch, chapterTitle: newTitle } : ch
    ));
  };

  const handleNext = () => {
    if (errors.length > 0) return;

    onNext({
      chapterStructure: chapters,
      currentChapter: 1,
      completedChapters: [],
      currentPhase: 2
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Detectando estructura de capítulos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fase 1.5: Detección de Capítulos</CardTitle>
          <CardDescription>
            Revise la estructura de capítulos detectada automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{chapters.length}</div>
              <div className="text-xs text-muted-foreground">Capítulos detectados</div>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{state.rawParagraphs.length}</div>
              <div className="text-xs text-muted-foreground">Párrafos totales</div>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">
                {Math.round(state.rawParagraphs.length / chapters.length)}
              </div>
              <div className="text-xs text-muted-foreground">Promedio por capítulo</div>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Errores de validación:</strong>
                <ul className="list-disc list-inside mt-2">
                  {errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Chapter List */}
          <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
            <div className="grid grid-cols-12 gap-3 p-3 bg-muted/50 font-medium text-sm sticky top-0">
              <div className="col-span-1">Cap.</div>
              <div className="col-span-5">Título</div>
              <div className="col-span-2 text-center">Párrafos TXT</div>
              <div className="col-span-2 text-center">Párrafos BD</div>
              <div className="col-span-2 text-center">Estado</div>
            </div>
            {chapters.map((chapter, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 p-3 items-center text-sm">
                <div className="col-span-1 font-medium">
                  {chapter.chapterNumber}
                </div>
                <div className="col-span-5">
                  {editingIndex === index ? (
                    <Input
                      value={chapter.chapterTitle}
                      onChange={(e) => handleTitleEdit(index, e.target.value)}
                      onBlur={() => setEditingIndex(null)}
                      autoFocus
                      className="h-8"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="truncate">{chapter.chapterTitle || 'Sin título'}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingIndex(index)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-center">
                  <Badge variant="outline">{chapter.paragraphCount}</Badge>
                </div>
                <div className="col-span-2 text-center">
                  <Badge variant="outline">{chapter.dbParagraphCount}</Badge>
                </div>
                <div className="col-span-2 text-center">
                  {chapter.paragraphCount === chapter.dbParagraphCount ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Coincide
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {chapter.paragraphCount > chapter.dbParagraphCount ? '+' : '-'}
                      {Math.abs(chapter.paragraphCount - chapter.dbParagraphCount)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="bg-muted/50 border rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Información:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Los capítulos se detectaron automáticamente buscando patrones comunes</li>
              <li>• Puede editar los títulos haciendo clic en el icono de lápiz</li>
              <li>• La columna "Estado" compara con los capítulos existentes en la BD</li>
              <li>• Las diferencias se resolverán en las siguientes fases</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Button onClick={handleNext} size="lg" disabled={errors.length > 0}>
          Continuar a Comparación Estructural
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
