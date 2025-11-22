import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { ManualImportState, StructuralComparison } from '@/types/manual-import';
import { supabase } from '@/integrations/supabase/client';

interface Phase2StructuralComparisonProps {
  state: ManualImportState;
  onNext: (updates: Partial<ManualImportState>) => void;
  onBack: () => void;
}

export function Phase2StructuralComparison({ state, onNext, onBack }: Phase2StructuralComparisonProps) {
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<StructuralComparison | null>(null);

  useEffect(() => {
    performComparison();
  }, []);

  const performComparison = async () => {
    setLoading(true);
    try {
      // Get book ID
      const { data: book } = await supabase
        .from('books')
        .select('id')
        .eq('code', state.bookCode)
        .single();

      if (!book) {
        throw new Error('Libro no encontrado');
      }

      // Count paragraphs in DB
      const { count: dbCount } = await supabase
        .from('paragraphs')
        .select('id', { count: 'exact', head: true })
        .eq('chapter_id', book.id);

      const uploadedCount = state.rawParagraphs.length;
      
      let match: 'exact' | 'extra' | 'missing' = 'exact';
      let extraCount: number | undefined;
      let missingCount: number | undefined;

      if (uploadedCount > (dbCount || 0)) {
        match = 'extra';
        extraCount = uploadedCount - (dbCount || 0);
      } else if (uploadedCount < (dbCount || 0)) {
        match = 'missing';
        missingCount = (dbCount || 0) - uploadedCount;
      }

      const result: StructuralComparison = {
        uploadedCount,
        dbCount: dbCount || 0,
        match,
        extraCount,
        missingCount
      };

      setComparison(result);
    } catch (error) {
      console.error('Error in structural comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!comparison) return;
    
    onNext({
      structuralComparison: comparison,
      currentPhase: 3
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!comparison) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Error al realizar la comparación estructural</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fase 2: Comparación Estructural</CardTitle>
          <CardDescription>
            Verificación del número de párrafos entre el archivo cargado y la base de datos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Párrafos cargados</div>
              <div className="text-3xl font-bold">{comparison.uploadedCount}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Párrafos en BD</div>
              <div className="text-3xl font-bold">{comparison.dbCount}</div>
            </div>
          </div>

          {comparison.match === 'exact' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Coincidencia exacta:</strong> El número de párrafos coincide perfectamente.
                Puede continuar con la asignación de códigos.
              </AlertDescription>
            </Alert>
          )}

          {comparison.match === 'extra' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Párrafos extra detectados:</strong> El archivo tiene{' '}
                <Badge variant="outline">{comparison.extraCount}</Badge> párrafos más que la base de datos.
                En la siguiente fase, podrá marcar los párrafos faltantes con "FALTA".
              </AlertDescription>
            </Alert>
          )}

          {comparison.match === 'missing' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Párrafos faltantes detectados:</strong> El archivo tiene{' '}
                <Badge variant="outline">{comparison.missingCount}</Badge> párrafos menos que la base de datos.
                Los párrafos faltantes se marcarán como "FALTA" automáticamente.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-muted/50 border rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">¿Qué significa esto?</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>Coincidencia exacta:</strong> Todo está alineado</li>
              <li>• <strong>Párrafos extra:</strong> Su versión tiene contenido adicional no presente en la BD</li>
              <li>• <strong>Párrafos faltantes:</strong> Su versión omite contenido que existe en la BD</li>
              <li>• En ambos casos, el sistema permite asignar códigos flexibles usando "FALTA"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Button onClick={handleNext} size="lg">
          Continuar a Asignación de Códigos
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
