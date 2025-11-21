import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressTracker } from "@/components/ProgressTracker";
import { useToast } from "@/hooks/use-toast";
import { isValidBookCode, getBookInfo } from "@/lib/egwApi";
import { Book } from "@/types/database";
import { Loader2, BookPlus, Copy } from "lucide-react";

interface BookImportFormProps {
  availableBookCodes: string[];
  existingBooks: Book[];
  onImport: (bookCode: string, bookInfo: any, onSuccess: () => void) => void;
  importing: boolean;
  importProgress: {
    status: string;
    current: number;
    total: number;
    chapterName: string;
    startTime: number;
  } | null;
}

export function BookImportForm({
  availableBookCodes,
  existingBooks,
  onImport,
  importing,
  importProgress,
}: BookImportFormProps) {
  const [newBookCode, setNewBookCode] = useState("");
  const [scrapingErrors, setScrapingErrors] = useState<string[]>([]);
  const { toast } = useToast();

  const handleImportClick = async () => {
    const trimmedCode = newBookCode.trim();
    
    // Validation
    if (!trimmedCode) {
      toast({
        title: "Error",
        description: "Por favor ingresa un código de libro",
        variant: "destructive",
      });
      return;
    }

    // Validate with available book codes
    const isValid = await isValidBookCode(trimmedCode);
    if (!isValid) {
      toast({
        title: "Código inválido",
        description: `Códigos válidos: ${availableBookCodes.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate
    if (existingBooks.some(b => b.code === trimmedCode)) {
      toast({
        title: "Error",
        description: "Este libro ya está siendo monitoreado",
        variant: "destructive",
      });
      return;
    }

    try {
      const bookInfo = await getBookInfo(trimmedCode);
      
      onImport(trimmedCode, bookInfo, () => {
        setNewBookCode("");
        setScrapingErrors([]);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setScrapingErrors(prev => [...prev, `${new Date().toLocaleString()}: ${errorMessage}`]);
    }
  };

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookPlus className="h-5 w-5 text-primary" />
          Importar Nuevo Libro
        </CardTitle>
        <CardDescription>
          Ingresa el código de un libro de EGW Writings para comenzar a monitorearlo.
          <br />
          <span className="text-amber-600 dark:text-amber-400 font-medium mt-2 inline-block">
            💡 Tip: Usa la herramienta de Debug arriba para validar que el libro se puede importar correctamente.
          </span>
          <br />
          Códigos disponibles: {availableBookCodes.join(', ')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-4">
          <Input
            placeholder="Código del libro (ej: DTG, CS, PP)"
            value={newBookCode}
            onChange={(e) => setNewBookCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            disabled={importing}
            className="max-w-xs"
            maxLength={10}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !importing) {
                handleImportClick();
              }
            }}
          />
          <Button onClick={handleImportClick} disabled={importing || !newBookCode.trim()}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar libro
          </Button>
        </div>

        {/* Import Progress Indicator */}
        {importProgress && (
          <ProgressTracker
            title="Importando libro"
            status={importProgress.status}
            current={importProgress.current}
            total={importProgress.total}
            startTime={importProgress.startTime}
            itemName="capítulo"
            itemLabel={importProgress.chapterName}
          />
        )}

        {/* Error Display */}
        {scrapingErrors.length > 0 && (
          <div className="mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const errors = scrapingErrors.join('\n\n');
                navigator.clipboard.writeText(errors);
                toast({ title: 'Errores copiados al portapapeles' });
              }}
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              <Copy className="mr-2 h-4 w-4" />
              ⚠️ Ver errores ({scrapingErrors.length})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
