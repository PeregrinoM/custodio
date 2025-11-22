import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { ManualImportState, ValidationError } from '@/types/manual-import';
import { validateCodeAssignments } from '@/lib/manual-import/validation';
import { supabase } from '@/integrations/supabase/client';

interface Phase4ReviewProps {
  state: ManualImportState;
  onNext: (updates: Partial<ManualImportState>) => void;
  onBack: () => void;
}

export function Phase4Review({ state, onNext, onBack }: Phase4ReviewProps) {
  const [validating, setValidating] = useState(true);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    performValidation();
  }, []);

  const performValidation = async () => {
    setValidating(true);
    try {
      // Get book ID and all existing codes
      const { data: book } = await supabase
        .from('books')
        .select('id')
        .eq('code', state.bookCode)
        .single();

      if (!book) throw new Error('Libro no encontrado');

      const { data: paragraphs } = await supabase
        .from('paragraphs')
        .select('refcode_short, chapter_id, chapters!inner(book_id)')
        .eq('chapters.book_id', book.id);

      const codes = new Set(
        paragraphs
          ?.filter(p => p.refcode_short)
          .map(p => p.refcode_short!) || []
      );
      
      setExistingCodes(codes);

      // Validate assignments
      const validationErrors = validateCodeAssignments(
        state.codeAssignments,
        state.bookCode,
        codes
      );

      setErrors(validationErrors);
    } catch (error) {
      console.error('Error in validation:', error);
    } finally {
      setValidating(false);
    }
  };

  const handleNext = () => {
    if (errors.length > 0) return;

    onNext({
      validationErrors: errors,
      currentPhase: 5
    });
  };

  if (validating) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Validando códigos asignados...</p>
        </CardContent>
      </Card>
    );
  }

  const stats = {
    total: state.codeAssignments.length,
    assigned: state.codeAssignments.filter(a => a.assignedCode && a.assignedCode !== 'FALTA').length,
    missing: state.codeAssignments.filter(a => a.assignedCode === 'FALTA').length,
    errors: errors.length
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fase 4: Revisión Final</CardTitle>
          <CardDescription>
            Verifique que todos los códigos sean válidos antes de importar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Párrafos totales</div>
            </div>
            <div className="border rounded-lg p-3 text-center bg-green-50 dark:bg-green-950">
              <div className="text-2xl font-bold text-green-600">{stats.assigned}</div>
              <div className="text-xs text-muted-foreground">Con código</div>
            </div>
            <div className="border rounded-lg p-3 text-center bg-orange-50 dark:bg-orange-950">
              <div className="text-2xl font-bold text-orange-600">{stats.missing}</div>
              <div className="text-xs text-muted-foreground">Marcados FALTA</div>
            </div>
            <div className={`border rounded-lg p-3 text-center ${errors.length > 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-green-50 dark:bg-green-950'}`}>
              <div className={`text-2xl font-bold ${errors.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.errors}
              </div>
              <div className="text-xs text-muted-foreground">Errores</div>
            </div>
          </div>

          {/* Validation Result */}
          {errors.length === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Validación exitosa:</strong> Todos los códigos son válidos y cumplen con las reglas de secuencia.
                Puede proceder con la importación.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Se encontraron {errors.length} errores de validación:</strong> Debe corregirlos antes de continuar.
                Vuelva a la fase anterior para editar los códigos.
              </AlertDescription>
            </Alert>
          )}

          {/* Error List */}
          {errors.length > 0 && (
            <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
              {errors.map((error, index) => (
                <div key={index} className="p-3 flex items-start gap-3">
                  <Badge variant="destructive" className="mt-0.5">
                    {error.type}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm">{error.message}</p>
                    {error.affectedIndex !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Párrafo #{error.affectedIndex + 1}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Import Preview */}
          {errors.length === 0 && (
            <div className="bg-muted/50 border rounded-lg p-4 space-y-2">
              <p className="font-medium text-sm">Resumen de importación:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Libro: <strong>{state.bookTitle}</strong> ({state.bookCode})</li>
                <li>• Tipo: <strong>{state.versionType === 'physical_baseline' ? 'Línea Base Física (LB F)' : 'Versión Regular'}</strong></li>
                {state.editionDate && <li>• Fecha de edición: <strong>{state.editionDate}</strong></li>}
                <li>• Párrafos a importar: <strong>{stats.assigned}</strong></li>
                <li>• Párrafos marcados como FALTA: <strong>{stats.missing}</strong></li>
                {state.versionType === 'physical_baseline' && (
                  <li className="text-orange-600 dark:text-orange-400">
                    ⚠️ Esta versión será marcada como nueva línea base de referencia
                  </li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver a Editar Códigos
        </Button>
        <Button onClick={handleNext} size="lg" disabled={errors.length > 0}>
          Proceder a Importación
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
