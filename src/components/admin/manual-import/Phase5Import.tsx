import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, ChevronLeft, Home } from 'lucide-react';
import { ManualImportState } from '@/types/manual-import';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Phase5ImportProps {
  state: ManualImportState;
  onBack: () => void;
  onReset: () => void;
}

export function Phase5Import({ state, onBack, onReset }: Phase5ImportProps) {
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; message: string; versionId?: string; versionNumber?: number } | null>(null);

  const handleImport = async () => {
    setImporting(true);
    setProgress(10);

    try {
      setProgress(30);

      // Call edge function for transactional import
      const response = await supabase.functions.invoke('import-manual-version', {
        body: {
          bookCode: state.bookCode,
          versionType: state.versionType,
          editionDate: state.editionDate,
          versionNotes: state.versionNotes,
          assignments: state.codeAssignments
        }
      });

      setProgress(90);

      if (response.error) throw response.error;

      const data = response.data;
      
      setProgress(100);
      setResult({
        success: true,
        message: `Versión ${data.versionNumber} importada exitosamente`,
        versionId: data.versionId,
        versionNumber: data.versionNumber
      });

      toast.success('Importación completada');
    } catch (error: any) {
      console.error('Error importing version:', error);
      setResult({
        success: false,
        message: error.message || 'Error al importar la versión'
      });
      toast.error('Error en la importación');
    } finally {
      setImporting(false);
    }
  };

  const handleViewBook = () => {
    // Navigate to book view
    navigate(`/admin`);
  };

  const handleNewImport = () => {
    onReset();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fase 5: Importación Transaccional</CardTitle>
          <CardDescription>
            Importación atómica de la versión histórica a la base de datos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!result && !importing && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Importante:</strong> La importación creará una nueva versión en la base de datos
                  con todos los snapshots de párrafos. Este proceso es atómico y no puede revertirse fácilmente.
                </AlertDescription>
              </Alert>

              <div className="bg-muted/50 border rounded-lg p-4 space-y-2">
                <p className="font-medium text-sm">Se realizarán las siguientes operaciones:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>1. Crear registro de book_version</li>
                  <li>2. Crear {state.codeAssignments.filter(a => a.assignedCode !== 'FALTA').length} snapshots de párrafos</li>
                  {state.versionType === 'physical_baseline' && (
                    <li className="text-orange-600 dark:text-orange-400">
                      3. Establecer como nueva línea base (baseline)
                    </li>
                  )}
                  <li>4. Actualizar metadatos del libro</li>
                </ul>
              </div>

              <Button onClick={handleImport} size="lg" className="w-full">
                Iniciar Importación
              </Button>
            </div>
          )}

          {importing && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progreso de importación</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Importando versión... No cierre esta página.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {result.success ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Éxito:</strong> {result.message}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error:</strong> {result.message}
                  </AlertDescription>
                </Alert>
              )}

              {result.success && (
                <div className="bg-muted/50 border rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Detalles de la versión importada:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Número de versión: <strong>{result.versionNumber}</strong></li>
                    <li>• ID de versión: <code className="text-xs">{result.versionId}</code></li>
                    <li>• Libro: <strong>{state.bookTitle}</strong></li>
                    <li>• Tipo: <strong>{state.versionType === 'physical_baseline' ? 'Línea Base Física' : 'Versión Regular'}</strong></li>
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleViewBook} className="flex-1">
                  <Home className="mr-2 h-4 w-4" />
                  Ver en Admin
                </Button>
                <Button onClick={handleNewImport} variant="outline" className="flex-1">
                  Nueva Importación
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!result && !importing && (
        <div className="flex justify-start">
          <Button onClick={onBack} variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver a Revisión
          </Button>
        </div>
      )}
    </div>
  );
}
