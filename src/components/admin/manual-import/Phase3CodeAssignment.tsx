import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, ChevronRight, Wand2, Loader2, CheckCircle2, 
  AlertCircle, Lock, Save, ArrowLeft, ArrowRight 
} from 'lucide-react';
import { ManualImportState, CodeAssignment } from '@/types/manual-import';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReferencePanel } from './ReferencePanel';

interface Phase3CodeAssignmentProps {
  state: ManualImportState;
  onNext: (updates: Partial<ManualImportState>) => void;
  onBack: () => void;
}

export function Phase3CodeAssignment({ state, onNext, onBack }: Phase3CodeAssignmentProps) {
  const [assignments, setAssignments] = useState<CodeAssignment[]>([]);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [bookId, setBookId] = useState<string>('');
  const [selectedAssignmentIndex, setSelectedAssignmentIndex] = useState<number | null>(null);
  const [dbParagraphs, setDbParagraphs] = useState<Array<{
    id: string;
    refcode_short: string;
    paragraph_number: number;
    base_text: string;
  }>>([]);

  useEffect(() => {
    loadBookId();
  }, [state.bookCode]);

  useEffect(() => {
    initializeAssignments();
    loadChapterParagraphsFromDB();
  }, [state.currentChapter]);

  const loadBookId = async () => {
    if (!state.bookCode) return;
    
    const { data, error } = await supabase
      .from('books')
      .select('id')
      .eq('code', state.bookCode)
      .single();
    
    if (data && !error) {
      setBookId(data.id);
    }
  };

  const initializeAssignments = () => {
    if (state.codeAssignments.length > 0) {
      // Load existing assignments for current chapter
      const chapterAssignments = state.codeAssignments.filter(
        a => a.chapterNumber === state.currentChapter
      );
      setAssignments(chapterAssignments);
    } else {
      // Create new assignments for all chapters
      const allAssignments: CodeAssignment[] = [];
      
      state.chapterStructure.forEach(chapter => {
        for (let i = chapter.startIndex; i <= chapter.endIndex; i++) {
          allAssignments.push({
            index: i,
            text: state.rawParagraphs[i],
            assignedCode: '',
            status: 'pending',
            chapterNumber: chapter.chapterNumber
          });
        }
      });

      // Filter for current chapter
      const chapterAssignments = allAssignments.filter(
        a => a.chapterNumber === state.currentChapter
      );
      setAssignments(chapterAssignments);
      
      // Save all assignments to state (for other chapters)
      onNext({ codeAssignments: allAssignments });
    }
  };

  const getCurrentChapter = () => {
    return state.chapterStructure.find(ch => ch.chapterNumber === state.currentChapter);
  };

  const loadChapterParagraphsFromDB = async () => {
    const currentChapter = getCurrentChapter();
    if (!currentChapter?.dbChapterId) {
      setDbParagraphs([]);
      return;
    }

    const { data, error } = await supabase
      .from('paragraphs')
      .select('id, refcode_short, paragraph_number, base_text')
      .eq('chapter_id', currentChapter.dbChapterId)
      .order('paragraph_number');

    if (data && !error) {
      setDbParagraphs(data);
    } else {
      setDbParagraphs([]);
    }
  };

  const handleAutoAssignChapter = async () => {
    const currentChapter = getCurrentChapter();
    if (!currentChapter || !currentChapter.dbChapterId) {
      toast.error('No se encontró el capítulo en la base de datos');
      return;
    }

    setAutoAssigning(true);
    setProgress({ current: 0, total: assignments.length });

    try {
      // Get chapter paragraphs (excluding discarded ones)
      const chapterParagraphs = assignments.filter(a => !a.discarded).map(a => a.text);

      // Call edge function with chapter filter
      const { data, error } = await supabase.functions.invoke('find-paragraph-matches', {
        body: {
          bookCode: state.bookCode,
          chapterNumber: state.currentChapter,
          dbChapterId: currentChapter.dbChapterId,
          paragraphs: chapterParagraphs
        }
      });

      if (error) throw error;

      // Update assignments with results (only for non-discarded)
      let resultIndex = 0;
      const updatedAssignments = assignments.map((assignment) => {
        if (assignment.discarded) return assignment;
        
        const match = data.matches[resultIndex++];
        if (!match) return assignment;

        if (match.bestMatch && match.bestMatch.similarity >= 0.5) {
          return {
            ...assignment,
            assignedCode: match.bestMatch.code,
            status: 'auto' as const,
            confidence: match.bestMatch.similarity,
            suggestedCodes: match.suggestions
          };
        }

        return {
          ...assignment,
          suggestedCodes: match.suggestions,
          status: 'pending' as const
        };
      });

      setAssignments(updatedAssignments);

      // Update global state
      const allAssignments = state.codeAssignments.map(a => 
        a.chapterNumber === state.currentChapter
          ? updatedAssignments.find(ua => ua.index === a.index) || a
          : a
      );
      onNext({ codeAssignments: allAssignments });

      toast.success(`Asignación automática completada para capítulo ${state.currentChapter}`);
    } catch (error) {
      console.error('Error in auto-assign:', error);
      toast.error('Error al asignar códigos automáticamente');
    } finally {
      setAutoAssigning(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleManualEdit = (index: number, code: string) => {
    const updated = assignments.map(a => 
      a.index === index 
        ? { ...a, assignedCode: code, status: code ? 'manual' as const : 'pending' as const }
        : a
    );
    setAssignments(updated);

    // Update global state
    const allAssignments = state.codeAssignments.map(a => 
      a.index === index ? updated.find(ua => ua.index === index)! : a
    );
    onNext({ codeAssignments: allAssignments });
  };

  const handleUseSuggestion = (assignmentIndex: number, code: string) => {
    const updated = assignments.map((a, i) => 
      i === assignmentIndex 
        ? { ...a, assignedCode: code, status: 'manual' as const }
        : a
    );
    setAssignments(updated);

    // Update global state
    const assignment = assignments[assignmentIndex];
    const allAssignments = state.codeAssignments.map(a => 
      a.index === assignment.index ? updated[assignmentIndex] : a
    );
    onNext({ codeAssignments: allAssignments });
  };

  const handleToggleDiscard = (index: number) => {
    const updated = assignments.map(a => {
      if (a.index === index) {
        const willDiscard = !a.discarded;
        return {
          ...a, 
          discarded: willDiscard, 
          status: willDiscard ? ('discarded' as const) : ('pending' as const),
          assignedCode: willDiscard ? '' : a.assignedCode
        };
      }
      return a;
    });
    setAssignments(updated);

    // Update global state
    const allAssignments = state.codeAssignments.map(a => 
      a.index === index ? updated.find(ua => ua.index === index)! : a
    );
    onNext({ codeAssignments: allAssignments });
    
    const wasDiscarded = updated.find(u => u.index === index)?.discarded;
    toast.success(wasDiscarded 
      ? 'Párrafo descartado como no-contenido' 
      : 'Párrafo restaurado'
    );
  };

  const handleCompleteChapter = () => {
    const pending = assignments.filter(a => !a.assignedCode && !a.discarded);
    if (pending.length > 0) {
      toast.error(`Quedan ${pending.length} párrafos sin asignar en este capítulo`);
      return;
    }

    // Mark chapter as completed
    const newCompletedChapters = [...state.completedChapters, state.currentChapter];
    
    // Move to next chapter if available
    const nextChapter = state.currentChapter + 1;
    if (nextChapter <= state.chapterStructure.length) {
      onNext({ 
        completedChapters: newCompletedChapters,
        currentChapter: nextChapter
      });
      toast.success(`Capítulo ${state.currentChapter} completado. Avanzando al capítulo ${nextChapter}`);
    } else {
      // All chapters completed, go to review
      onNext({ 
        completedChapters: newCompletedChapters,
        currentPhase: 4
      });
      toast.success('Todos los capítulos completados. Procediendo a revisión final');
    }
  };

  const handlePreviousChapter = () => {
    if (state.currentChapter > 1) {
      onNext({ currentChapter: state.currentChapter - 1 });
    }
  };

  const handleNextChapter = () => {
    if (state.currentChapter < state.chapterStructure.length) {
      onNext({ currentChapter: state.currentChapter + 1 });
    }
  };

  const handleSaveProgress = () => {
    localStorage.setItem('manual-import-progress', JSON.stringify({
      bookCode: state.bookCode,
      versionType: state.versionType,
      currentChapter: state.currentChapter,
      completedChapters: state.completedChapters,
      timestamp: new Date().toISOString()
    }));
    toast.success('Progreso guardado');
  };

  const handleAssignCodeFromReference = (code: string) => {
    if (selectedAssignmentIndex === null) {
      toast.error('Selecciona primero un párrafo para asignar');
      return;
    }

    const assignment = assignments[selectedAssignmentIndex];
    if (!assignment) return;

    // Prevenir asignación a párrafos descartados
    if (assignment.discarded) {
      toast.error('No se puede asignar código a un párrafo descartado');
      return;
    }

    handleManualEdit(assignment.index, code);
    toast.success(`Código ${code} asignado al párrafo #${selectedAssignmentIndex + 1}`);
    setSelectedAssignmentIndex(null);
  };

  const currentChapter = getCurrentChapter();
  const stats = {
    total: assignments.length,
    auto: assignments.filter(a => a.status === 'auto').length,
    manual: assignments.filter(a => a.status === 'manual').length,
    missing: assignments.filter(a => a.assignedCode === 'FALTA').length,
    discarded: assignments.filter(a => a.discarded).length,
    pending: assignments.filter(a => !a.assignedCode && !a.discarded).length
  };

  const isChapterCompleted = state.completedChapters.includes(state.currentChapter);
  const canAccessChapter = state.currentChapter === 1 || 
    state.completedChapters.includes(state.currentChapter - 1) ||
    isChapterCompleted;

  if (!canAccessChapter) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            Complete el capítulo {state.currentChapter - 1} para desbloquear este capítulo
          </p>
          <Button onClick={() => onNext({ currentChapter: state.currentChapter - 1 })}>
            Volver al capítulo {state.currentChapter - 1}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chapter Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousChapter}
              disabled={state.currentChapter === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cap. {state.currentChapter - 1}
            </Button>

            <div className="text-center flex-1">
              <h2 className="text-2xl font-bold">
                Capítulo {state.currentChapter}: {currentChapter?.chapterTitle}
              </h2>
              {isChapterCompleted && (
                <Badge variant="default" className="mt-1 bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completado
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextChapter}
              disabled={state.currentChapter === state.chapterStructure.length}
            >
              Cap. {state.currentChapter + 1}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progreso del capítulo</span>
              <span>{stats.total - stats.pending}/{stats.total} asignados ({Math.round((stats.total - stats.pending) / stats.total * 100)}%)</span>
            </div>
            <Progress value={(stats.total - stats.pending) / stats.total * 100} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fase 3: Asignación de Códigos</CardTitle>
          <CardDescription>
            Asigne códigos de referencia a cada párrafo del capítulo {state.currentChapter}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-6 gap-2">
            <div className="border rounded-lg p-2 text-center">
              <div className="text-lg font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="border rounded-lg p-2 text-center bg-blue-50 dark:bg-blue-950">
              <div className="text-lg font-bold text-blue-600">{stats.auto}</div>
              <div className="text-xs text-muted-foreground">Auto</div>
            </div>
            <div className="border rounded-lg p-2 text-center bg-green-50 dark:bg-green-950">
              <div className="text-lg font-bold text-green-600">{stats.manual}</div>
              <div className="text-xs text-muted-foreground">Manual</div>
            </div>
            <div className="border rounded-lg p-2 text-center bg-orange-50 dark:bg-orange-950">
              <div className="text-lg font-bold text-orange-600">{stats.missing}</div>
              <div className="text-xs text-muted-foreground">FALTA</div>
            </div>
            <div className="border rounded-lg p-2 text-center bg-gray-50 dark:bg-gray-950">
              <div className="text-lg font-bold text-gray-600">{stats.discarded}</div>
              <div className="text-xs text-muted-foreground">Descartado</div>
            </div>
            <div className="border rounded-lg p-2 text-center bg-yellow-50 dark:bg-yellow-950">
              <div className="text-lg font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">Pendiente</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleAutoAssignChapter}
              disabled={autoAssigning}
              className="flex-1"
            >
              {autoAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Auto-asignar Capítulo {state.currentChapter}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleSaveProgress}>
              <Save className="mr-2 h-4 w-4" />
              Guardar Progreso
            </Button>
          </div>

          {/* Reference Panel */}
          <ReferencePanel 
            bookId={bookId}
            chapterNumber={state.currentChapter}
            onAssignCode={handleAssignCodeFromReference}
            selectedAssignmentIndex={selectedAssignmentIndex}
            assignedCodes={assignments
              .filter(a => a.assignedCode && !a.discarded)
              .map(a => a.assignedCode)
            }
          />

          {/* Progress Indicator */}
          {autoAssigning && progress.total > 0 && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Comparando párrafos del capítulo {state.currentChapter}... 
                Solo se comparan los {progress.total} párrafos de este capítulo contra 
                los {currentChapter?.dbParagraphCount} párrafos en BD.
              </AlertDescription>
            </Alert>
          )}

          {/* Assignments List */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto border rounded-lg p-4">
            {assignments.map((assignment, index) => (
              <div 
                key={assignment.index} 
                onClick={() => !assignment.discarded && setSelectedAssignmentIndex(index)}
                className={`border rounded-lg p-4 space-y-3 transition-all ${
                  assignment.discarded 
                    ? 'opacity-50 bg-muted/30 cursor-not-allowed' 
                    : 'cursor-pointer hover:bg-accent/20'
                } ${
                  selectedAssignmentIndex === index && !assignment.discarded ? 'ring-2 ring-primary bg-accent/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      {assignment.discarded && (
                        <Badge variant="secondary" className="bg-gray-600">Descartado</Badge>
                      )}
                      {!assignment.discarded && assignment.status === 'auto' && (
                        <Badge variant="default" className="bg-blue-600">Auto</Badge>
                      )}
                      {!assignment.discarded && assignment.status === 'manual' && (
                        <Badge variant="default" className="bg-green-600">Manual</Badge>
                      )}
                      {!assignment.discarded && assignment.assignedCode === 'FALTA' && (
                        <Badge variant="secondary">FALTA</Badge>
                      )}
                      {!assignment.discarded && assignment.confidence && (
                        <Badge variant="outline">
                          {Math.round(assignment.confidence * 100)}% similar
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {assignment.text}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-48">
                    <Button
                      variant={assignment.discarded ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleDiscard(assignment.index)}
                      className="w-full"
                    >
                      {assignment.discarded ? 'Restaurar' : 'Descartar'}
                    </Button>
                    {!assignment.discarded && (
                      <Input
                        value={assignment.assignedCode}
                        onChange={(e) => handleManualEdit(assignment.index, e.target.value)}
                        placeholder="Ej: CC 1.1 o FALTA"
                        className="font-mono text-sm"
                      />
                    )}
                  </div>
                </div>

                {/* Suggestions */}
                {!assignment.discarded && assignment.suggestedCodes && assignment.suggestedCodes.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Sugerencias:</div>
                    <div className="flex flex-wrap gap-1">
                      {assignment.suggestedCodes.slice(0, 5).map((suggestion, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          onClick={() => handleUseSuggestion(index, suggestion.code)}
                          className="text-xs h-7"
                        >
                          {suggestion.code} ({Math.round(suggestion.similarity * 100)}%)
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Button onClick={handleCompleteChapter} size="lg" disabled={stats.pending > 0}>
          {state.currentChapter < state.chapterStructure.length ? (
            <>
              Completar Capítulo {state.currentChapter}
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Finalizar y Revisar
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
