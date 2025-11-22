import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { extractParagraphsFromText } from '@/lib/manual-import/validation';
import { ManualImportState } from '@/types/manual-import';

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

    try {
      const content = await file.text();
      const paragraphs = extractParagraphsFromText(content);

      if (paragraphs.length === 0) {
        setError('El archivo no contiene párrafos válidos');
        return;
      }

      const bookTitle = availableBooks.find(b => b.code === bookCode)?.title || bookCode;

      onNext({
        bookCode,
        bookTitle,
        versionType,
        editionDate: editionDate || null,
        versionNotes,
        uploadedFile: file,
        rawParagraphs: paragraphs,
        currentPhase: 2
      });
    } catch (err) {
      setError('Error al leer el archivo');
      console.error(err);
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

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} size="lg">
          <Upload className="mr-2 h-4 w-4" />
          Continuar a Comparación Estructural
        </Button>
      </div>
    </div>
  );
}
