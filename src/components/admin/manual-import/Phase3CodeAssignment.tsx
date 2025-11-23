import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Loader2, Zap, Edit3, CheckCircle } from 'lucide-react';
import { ManualImportState, CodeAssignment, ExistingParagraph } from '@/types/manual-import';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Phase3CodeAssignmentProps {
  state: ManualImportState;
  onNext: (updates: Partial<ManualImportState>) => void;
  onBack: () => void;
}

export function Phase3CodeAssignment({ state, onNext, onBack }: Phase3CodeAssignmentProps) {
  const [assignments, setAssignments] = useState<CodeAssignment[]>(state.codeAssignments);
  const [loading, setLoading] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (assignments.length === 0) {
      initializeAssignments();
    }
  }, []);

  const initializeAssignments = () => {
    const initial: CodeAssignment[] = state.rawParagraphs.map((text, index) => ({
      index,
      text,
      assignedCode: '',
      status: 'pending'
    }));
    setAssignments(initial);
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    setProgress({ current: 0, total: state.rawParagraphs.length });
    
    try {
      const BATCH_SIZE = 100;
      const batches = [];
      
      // Split paragraphs into batches
      for (let i = 0; i < state.rawParagraphs.length; i += BATCH_SIZE) {
        batches.push(state.rawParagraphs.slice(i, i + BATCH_SIZE));
      }

      console.log(`Processing ${batches.length} batches of ${BATCH_SIZE} paragraphs`);
      
      let allMatches: Array<{
        index: number;
        bestMatch: { code: string; similarity: number; text: string } | null;
        suggestions: Array<{ code: string; similarity: number; text: string }>;
      }> = [];

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        console.log(`Processing batch ${batchIndex + 1}/${batches.length}`);
        
        const response = await supabase.functions.invoke('find-paragraph-matches', {
          body: {
            bookCode: state.bookCode,
            paragraphs: batch
          }
        });

        if (response.error) throw response.error;

        const batchMatches = response.data.matches as Array<{
          index: number;
          bestMatch: { code: string; similarity: number; text: string } | null;
          suggestions: Array<{ code: string; similarity: number; text: string }>;
        }>;

        // Adjust indices to account for batch offset
        const adjustedMatches = batchMatches.map(match => ({
          ...match,
          index: match.index + (batchIndex * BATCH_SIZE)
        }));

        allMatches = allMatches.concat(adjustedMatches);
        
        // Update progress
        setProgress({ 
          current: (batchIndex + 1) * BATCH_SIZE, 
          total: state.rawParagraphs.length 
        });

        // Give UI time to update
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Apply all matches to assignments
      const updated = assignments.map((assignment, i) => {
        const match = allMatches.find(m => m.index === i);
        if (!match) return assignment;

        if (match.bestMatch && match.bestMatch.similarity > 0.7) {
          return {
            ...assignment,
            assignedCode: match.bestMatch.code,
            status: 'auto' as const,
            confidence: match.bestMatch.similarity,
            suggestedCodes: match.suggestions.map(s => ({
              code: s.code,
              similarity: s.similarity,
              dbText: s.text
            }))
          };
        }
        return {
          ...assignment,
          suggestedCodes: match.suggestions.map(s => ({
            code: s.code,
            similarity: s.similarity,
            dbText: s.text
          }))
        };
      });

      setAssignments(updated);
      toast.success(`Asignación automática completada: ${allMatches.length} párrafos procesados`);
    } catch (error) {
      console.error('Error in auto-assign:', error);
      toast.error('Error al realizar la asignación automática');
    } finally {
      setAutoAssigning(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleManualEdit = (index: number, code: string) => {
    const updated = [...assignments];
    updated[index] = {
      ...updated[index],
      assignedCode: code,
      status: code ? 'manual' : 'pending'
    };
    setAssignments(updated);
  };

  const handleUseSuggestion = (index: number, code: string) => {
    const updated = [...assignments];
    updated[index] = {
      ...updated[index],
      assignedCode: code,
      status: 'manual'
    };
    setAssignments(updated);
  };

  const handleNext = () => {
    const pending = assignments.filter(a => a.status === 'pending');
    if (pending.length > 0) {
      toast.error(`Quedan ${pending.length} párrafos sin asignar código`);
      return;
    }

    onNext({
      codeAssignments: assignments,
      currentPhase: 4
    });
  };

  const stats = {
    total: assignments.length,
    auto: assignments.filter(a => a.status === 'auto').length,
    manual: assignments.filter(a => a.status === 'manual').length,
    missing: assignments.filter(a => a.assignedCode === 'FALTA').length,
    pending: assignments.filter(a => a.status === 'pending').length
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fase 3: Asignación de Códigos</CardTitle>
              <CardDescription>
                Asigne códigos de referencia a cada párrafo o márquelos como "FALTA"
              </CardDescription>
            </div>
            <Button
              onClick={handleAutoAssign}
              disabled={autoAssigning}
              variant="outline"
            >
              {autoAssigning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Asignar Automáticamente
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-5 gap-3">
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="border rounded-lg p-3 text-center bg-green-50 dark:bg-green-950">
              <div className="text-2xl font-bold text-green-600">{stats.auto}</div>
              <div className="text-xs text-muted-foreground">Auto</div>
            </div>
            <div className="border rounded-lg p-3 text-center bg-blue-50 dark:bg-blue-950">
              <div className="text-2xl font-bold text-blue-600">{stats.manual}</div>
              <div className="text-xs text-muted-foreground">Manual</div>
            </div>
            <div className="border rounded-lg p-3 text-center bg-orange-50 dark:bg-orange-950">
              <div className="text-2xl font-bold text-orange-600">{stats.missing}</div>
              <div className="text-xs text-muted-foreground">FALTA</div>
            </div>
            <div className="border rounded-lg p-3 text-center bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">Pendiente</div>
            </div>
          </div>

          {/* Progress Indicator */}
          {autoAssigning && progress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Procesando...</span>
                <span className="font-medium">
                  {Math.min(progress.current, progress.total)} / {progress.total} párrafos
                </span>
              </div>
              <Progress 
                value={(progress.current / progress.total) * 100} 
                className="h-2"
              />
            </div>
          )}

          {/* Assignments List */}
          <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
            {assignments.map((assignment, index) => (
              <div key={index} className="p-4 hover:bg-muted/50">
                <div className="flex items-start gap-4">
                  <div className="font-mono text-sm text-muted-foreground min-w-[40px]">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm line-clamp-2">{assignment.text}</p>
                    
                    <div className="flex items-center gap-2">
                      <Input
                        value={assignment.assignedCode}
                        onChange={(e) => handleManualEdit(index, e.target.value)}
                        placeholder="DTG 1.1 o FALTA"
                        className="max-w-[200px]"
                      />
                      
                      {assignment.status === 'auto' && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Auto {Math.round((assignment.confidence || 0) * 100)}%
                        </Badge>
                      )}
                      
                      {assignment.status === 'manual' && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          <Edit3 className="mr-1 h-3 w-3" />
                          Manual
                        </Badge>
                      )}
                    </div>

                    {/* Suggestions */}
                    {assignment.suggestedCodes && assignment.suggestedCodes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground">Sugerencias:</span>
                        {assignment.suggestedCodes.slice(0, 3).map((suggestion, i) => (
                          <Button
                            key={i}
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => handleUseSuggestion(index, suggestion.code)}
                          >
                            {suggestion.code} ({Math.round(suggestion.similarity * 100)}%)
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
        <Button onClick={handleNext} size="lg" disabled={stats.pending > 0}>
          Continuar a Revisión Final
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
