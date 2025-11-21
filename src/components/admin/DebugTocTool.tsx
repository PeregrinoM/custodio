import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { getBookInfo } from "@/lib/egwApi";
import { Loader2 } from "lucide-react";

interface DebugTocToolProps {
  availableBookCodes: string[];
}

export function DebugTocTool({ availableBookCodes }: DebugTocToolProps) {
  const [debugHtml, setDebugHtml] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugBookId, setDebugBookId] = useState<string>('174');
  const [debugBookCode, setDebugBookCode] = useState<string>('');
  const { toast } = useToast();

  const handleDebugToc = async () => {
    setIsDebugging(true);
    setDebugHtml(null);
    
    const bookIdToTest = parseInt(debugBookId);
    
    if (isNaN(bookIdToTest)) {
      toast({
        title: '❌ ID inválido',
        description: 'Por favor ingresa un ID numérico válido',
        variant: 'destructive'
      });
      setIsDebugging(false);
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('debug-toc', {
        body: { bookId: bookIdToTest }
      });

      if (error) throw error;
      
      setDebugHtml(data);
      
      toast({
        title: '✅ Debug completado',
        description: `HTML obtenido para ID ${bookIdToTest}: ${data.htmlLength} caracteres`
      });
      
    } catch (error) {
      console.error('Debug error:', error);
      toast({
        title: '❌ Error en debug',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive'
      });
    } finally {
      setIsDebugging(false);
    }
  };

  return (
    <Card className="border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
          🔧 Validar Libro (Debug TOC)
        </CardTitle>
        <CardDescription>
          Herramienta para validar que un libro se puede importar correctamente antes de intentarlo.
          Verifica que el scraper puede extraer el índice de capítulos desde EGW Writings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          {/* Dropdown with available books */}
          <Select value={debugBookCode} onValueChange={async (code) => {
            setDebugBookCode(code);
            const bookInfo = await getBookInfo(code);
            if (bookInfo) {
              setDebugBookId(bookInfo.id.toString());
            }
          }}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Seleccionar libro..." />
            </SelectTrigger>
            <SelectContent>
              {availableBookCodes.map(code => {
                return (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          {/* Manual book ID input */}
          <Input
            type="number"
            placeholder="ID del libro (ej: 217)"
            value={debugBookId}
            onChange={(e) => setDebugBookId(e.target.value)}
            className="w-[180px]"
          />
          
          <Button 
            onClick={handleDebugToc} 
            disabled={isDebugging || !debugBookId}
            variant="outline"
          >
            {isDebugging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Probando...
              </>
            ) : (
              '🔍 Probar TOC'
            )}
          </Button>
        </div>
        
        {debugHtml && (
          <div className="space-y-4">
            <div className="bg-background p-4 rounded border border-green-500/30">
              <h3 className="font-bold mb-2 text-green-700 dark:text-green-400">✅ Validación exitosa</h3>
              <ul className="text-sm space-y-1">
                <li>URL: {debugHtml.url}</li>
                <li>Tamaño: {debugHtml.htmlLength} bytes</li>
                <li>Content-Type: {debugHtml.contentType}</li>
                <li>Status: {debugHtml.statusCode}</li>
              </ul>
            </div>
            
            <Accordion type="single" collapsible>
              <AccordionItem value="chapters">
                <AccordionTrigger>Sección "capítulo"</AccordionTrigger>
                <AccordionContent>
                  <pre className="text-xs overflow-auto max-h-64 bg-muted p-2 rounded">
                    {debugHtml.chaptersSection}
                  </pre>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="links">
                <AccordionTrigger>Sección links "&lt;a href"</AccordionTrigger>
                <AccordionContent>
                  <pre className="text-xs overflow-auto max-h-64 bg-muted p-2 rounded">
                    {debugHtml.linksSection}
                  </pre>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="fullhtml">
                <AccordionTrigger>HTML completo (muestra)</AccordionTrigger>
                <AccordionContent>
                  <pre className="text-xs overflow-auto max-h-96 bg-muted p-2 rounded">
                    {debugHtml.htmlSample}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            <Button 
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(debugHtml.fullHtml);
                toast({ title: 'HTML completo copiado al portapapeles' });
              }}
            >
              📋 Copiar HTML Completo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
