import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertCircle, Loader2, CheckCircle2, BookOpen, Search } from 'lucide-react';
import { extractParagraphsFromText } from '@/lib/manual-import/validation';
import { ManualImportState } from '@/types/manual-import';
import { detectTableOfContents, findChapterBoundariesFromTOC } from '@/lib/manual-import/toc-detection';
import { detectChaptersAdvanced, mapChaptersToDatabase } from '@/lib/manual-import/chapter-detection';
import { supabase } from '@/integrations/supabase/client';

interface Phase1ValidationProps {
  state: ManualImportState;
  availableBooks: Array<{ code: string; title: string }>;
  onNext: (updates: Partial<ManualImportState>) => void;
}

export function Phase1Validation({ state, availableBooks, onNext }: Phase1ValidationProps) {
  const [bookCode, setBookCode] = useState(state.bookCode);
  const [versionType, setVersionType] = useState<'regular' | 'physical_baseline'>(state.versionType);
  const [editionDate, setEditionDate] = useState(state.editionDate || '');
  const [versionNotes, setVersionNotes] = useState(state.versionNotes);
  const [file, setFile] = useState<File | null>(state.uploadedFile);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionPreview, setDetectionPreview] = useState<{
    chaptersDetected: number;
    tocFound: boolean;
    method: 'toc' | 'pattern';
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/plain') {
        setError('Solo se aceptan archivos .txt');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleNext = async () => {
    if (!bookCode) {
      setError('Debe seleccionar un libro');
      return;
    }
    if (!file) {
      setError('Debe cargar un archivo .txt');
      return;
    }

    setIsProcessing(true);
    setError('');
    
    try {
      const content = await file.text();
      const paragraphs = extractParagraphsFromText(content);

      if (paragraphs.length === 0) {
        setError('El archivo no contiene párrafos válidos');
        setIsProcessing(false);
        return;
      }

      console.log(`📄 Archivo cargado: ${paragraphs.length} párrafos`);

      // ====== DETECCIÓN AUTOMÁTICA DE CAPÍTULOS ======
      
      // Paso 1: Intentar detectar índice/tabla de contenidos
      const tocResult = detectTableOfContents(paragraphs);
      let chapters = [];
      let detectionMethod: 'toc' | 'pattern' = 'pattern';

      if (tocResult.found && tocResult.entries.length >= 3) {
        // Usar índice para encontrar capítulos
        console.log(`✓ Índice detectado con ${tocResult.entries.length} capítulos`);
        chapters = findChapterBoundariesFromTOC(paragraphs, tocResult.entries, tocResult.tocEndIndex);
        detectionMethod = 'toc';
      } else {
        // Usar detección por patrones avanzados
        console.log('⚠ No se encontró índice, usando detección por patrones avanzados');
        const startFrom = tocResult.tocEndIndex > 0 ? tocResult.tocEndIndex + 1 : 0;
        chapters = detectChaptersAdvanced(paragraphs, startFrom);
      }

      console.log(`📚 ${chapters.length} capítulos detectados mediante ${detectionMethod === 'toc' ? 'índice' : 'patrones'}`);

      // Mapear a BD (obtener book ID)
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('id, language')
        .eq('code', bookCode)
        .eq('language', 'es')
        .single();

      if (bookError || !book) {
        setError('No se pudo encontrar el libro en la base de datos');
        setIsProcessing(false);
        return;
      }

      // Mapear capítulos a BD
      const mappedChapters = await mapChaptersToDatabase(chapters, book.id, supabase);

      // Mostrar preview de detección
      setDetectionPreview({
        chaptersDetected: mappedChapters.length,
        tocFound: tocResult.found,
        method: detectionMethod
      });

      const bookTitle = availableBooks.find(b => b.code === bookCode)?.title || bookCode;

      // Avanzar directamente a Fase 2 (saltar Fase 1.5)
      setTimeout(() => {
        onNext({
          bookCode,
          bookTitle,
          versionType,
          editionDate: editionDate || null,
          versionNotes,
          uploadedFile: file,
          rawParagraphs: paragraphs,
          chapterStructure: mappedChapters,
          detectionMethod,
          currentPhase: 2  // ← Directamente a Fase 2
        });
      }, 1500);

    } catch (err) {
      setError('Error al procesar el archivo');
      console.error(err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fase 1: Validación y Carga</CardTitle>
          <CardDescription>
            Seleccione el libro y cargue el archivo .txt con los párrafos de la versión histórica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Book Selection */}
          <div className="space-y-2">
            <Label htmlFor="book-select">Libro</Label>
            <select
              id="book-select"
              value={bookCode}
              onChange={(e) => setBookCode(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccione un libro...</option>
              {availableBooks.map(book => (
                <option key={book.code} value={book.code}>
                  {book.code} - {book.title}
                </option>
              ))}
            </select>
          </div>

          {/* Version Type */}
          <div className="space-y-3">
            <Label>Tipo de versión</Label>
            <RadioGroup value={versionType} onValueChange={(v) => setVersionType(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="regular" id="regular" />
                <Label htmlFor="regular" className="font-normal cursor-pointer">
                  Versión Regular (importada de API/web actual)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="physical_baseline" id="baseline" />
                <Label htmlFor="baseline" className="font-normal cursor-pointer">
                  Línea Base Física (LB F) - Versión histórica de referencia
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Edition Date */}
          <div className="space-y-2">
            <Label htmlFor="edition-date">Fecha de edición (opcional)</Label>
            <Input
              id="edition-date"
              type="date"
              value={editionDate}
              onChange={(e) => setEditionDate(e.target.value)}
            />
          </div>

          {/* Version Notes */}
          <div className="space-y-2">
            <Label htmlFor="version-notes">Notas de versión</Label>
            <Textarea
              id="version-notes"
              placeholder="Ej: Edición física 1980, escaneo manual"
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Archivo de texto (.txt)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="file-upload"
                type="file"
                accept=".txt"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {file.name}
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Cada párrafo debe estar separado por una línea en blanco
            </p>
          </div>

          {isProcessing && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Analizando estructura del archivo...</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Buscando tabla de contenidos...</p>
                    <p>• Detectando límites de capítulos...</p>
                    <p>• Comparando con base de datos...</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {detectionPreview && !isProcessing && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <p className="font-medium mb-2">✓ Estructura detectada correctamente</p>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    {detectionPreview.method === 'toc' ? (
                      <><BookOpen className="h-3 w-3" /> Índice automático detectado</>
                    ) : (
                      <><Search className="h-3 w-3" /> Detección por patrones avanzados</>
                    )}
                  </li>
                  <li>📚 {detectionPreview.chaptersDetected} capítulos encontrados</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} size="lg" disabled={isProcessing}>
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Detectando capítulos...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Analizar y Continuar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
