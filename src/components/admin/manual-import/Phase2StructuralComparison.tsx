import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Loader2, BookOpen, Search } from 'lucide-react';
import { ManualImportState } from '@/types/manual-import';

interface Phase2StructuralComparisonProps {
  state: ManualImportState;
  onNext: (updates: Partial<ManualImportState>) => void;
  onBack: () => void;
}

export function Phase2StructuralComparison({ state, onNext, onBack }: Phase2StructuralComparisonProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate analysis delay
    setTimeout(() => setLoading(false), 500);
  }, []);

  const handleNext = () => {
    onNext({ currentPhase: 3 });
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

  const totalUploaded = state.chapterStructure.reduce((sum, ch) => sum + ch.paragraphCount, 0);
  const totalDb = state.chapterStructure.reduce((sum, ch) => sum + ch.dbParagraphCount, 0);
  const allMatch = state.chapterStructure.every(ch => ch.paragraphCount === ch.dbParagraphCount);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fase 2: Comparación Estructural por Capítulo</CardTitle>
          <CardDescription className="space-y-2">
            <p>Verificación del número de párrafos entre el archivo cargado y la base de datos por cada capítulo</p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-xs">
                {state.detectionMethod === 'toc' ? (
                  <>
                    <BookOpen className="h-3 w-3 mr-1" />
                    Detectado por índice automático
                  </>
                ) : (
                  <>
                    <Search className="h-3 w-3 mr-1" />
                    Detectado por patrones
                  </>
                )}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {state.chapterStructure.length} capítulos encontrados
              </span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Global Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Total párrafos cargados</div>
              <div className="text-3xl font-bold">{totalUploaded}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Total párrafos en BD</div>
              <div className="text-3xl font-bold">{totalDb}</div>
            </div>
          </div>

          {/* Overall Status */}
          {allMatch ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Coincidencia perfecta:</strong> Todos los capítulos tienen el mismo número de párrafos en el archivo y en la base de datos.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Diferencias detectadas:</strong> Algunos capítulos tienen diferencias en el número de párrafos. 
                En la siguiente fase podrá asignar códigos flexibles usando "FALTA" para resolver estas diferencias.
              </AlertDescription>
            </Alert>
          )}

          {/* Chapter-by-Chapter Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Capítulo</th>
                    <th className="text-left p-3 font-medium">Título</th>
                    <th className="text-center p-3 font-medium">Párrafos TXT</th>
                    <th className="text-center p-3 font-medium">Párrafos BD</th>
                    <th className="text-center p-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {state.chapterStructure.map((chapter, index) => {
                    const diff = chapter.paragraphCount - chapter.dbParagraphCount;
                    const isMatch = diff === 0;
                    
                    return (
                      <tr key={index} className={isMatch ? '' : 'bg-orange-50/50 dark:bg-orange-950/20'}>
                        <td className="p-3 font-medium">{chapter.chapterNumber}</td>
                        <td className="p-3 truncate max-w-[200px]">{chapter.chapterTitle || 'Sin título'}</td>
                        <td className="p-3 text-center">
                          <Badge variant="outline">{chapter.paragraphCount}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline">{chapter.dbParagraphCount}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          {isMatch ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Coincide
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {diff > 0 ? `+${diff}` : diff} párrafo{Math.abs(diff) !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-muted/50 border rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">¿Qué significan las diferencias?</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>Coincide:</strong> El capítulo tiene exactamente los mismos párrafos</li>
              <li>• <strong>+ párrafos:</strong> Su versión tiene contenido adicional no presente en la BD</li>
              <li>• <strong>- párrafos:</strong> Su versión omite contenido que existe en la BD</li>
              <li>• En la siguiente fase podrá asignar códigos automáticamente por capítulo</li>
              <li>• Los párrafos sin coincidencia pueden marcarse como "FALTA"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver a Fase 1
        </Button>
        <Button onClick={handleNext} size="lg">
          Continuar a Asignación de Códigos
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
