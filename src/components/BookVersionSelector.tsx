import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Calendar, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface BookVersion {
  id: string;
  version_number: number;
  source_type: string;
  import_date: string;
  is_baseline: boolean;
  edition_date: string | null;
  version_notes: string | null;
}

interface BookVersionSelectorProps {
  bookId: string;
  bookTitle: string;
}

/**
 * Changes which version is used as baseline for a book
 * IMPORTANT: Does NOT recalculate historical comparisons
 * Only affects future comparisons
 */
async function setBookBaseline(
  bookId: string,
  newBaselineVersionId: string
): Promise<void> {
  try {
    // 1. Unset current baseline
    const { error: unsetError } = await supabase
      .from('book_versions')
      .update({ is_baseline: false })
      .eq('book_id', bookId)
      .eq('is_baseline', true);

    if (unsetError) throw unsetError;

    // 2. Set new baseline
    const { error: setError } = await supabase
      .from('book_versions')
      .update({ is_baseline: true })
      .eq('id', newBaselineVersionId);

    if (setError) throw setError;

    // 3. Update paragraphs.base_text with the new baseline's snapshot
    const { data: snapshots, error: snapshotError } = await supabase
      .from('version_snapshots')
      .select('paragraph_id, paragraph_text')
      .eq('version_id', newBaselineVersionId);

    if (snapshotError) throw snapshotError;

    // 4. Update each paragraph's base_text
    if (snapshots && snapshots.length > 0) {
      for (const snapshot of snapshots) {
        await supabase
          .from('paragraphs')
          .update({ base_text: snapshot.paragraph_text })
          .eq('id', snapshot.paragraph_id);
      }
    }

    // 5. Create audit record in book_comparisons
    const { error: auditError } = await supabase
      .from('book_comparisons')
      .insert({
        book_id: bookId,
        comparison_date: new Date().toISOString(),
        comparison_type: 'baseline_change',
        total_changes: 0,
        changed_paragraphs: 0,
        chapters_affected: [],
        version_notes: `Línea base cambiada a versión ${newBaselineVersionId}`,
      });

    if (auditError) {
      console.error('Error creating audit record:', auditError);
    }

    console.log(`✅ Baseline changed for book ${bookId} to version ${newBaselineVersionId}`);
  } catch (error) {
    console.error('Error setting baseline:', error);
    throw error;
  }
}

export const BookVersionSelector = ({ bookId, bookTitle }: BookVersionSelectorProps) => {
  const [versions, setVersions] = useState<BookVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [changingBaseline, setChangingBaseline] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (dialogOpen) {
      loadVersions();
    }
  }, [dialogOpen, bookId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('book_versions')
        .select('*')
        .eq('book_id', bookId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error loading versions:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las versiones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetBaseline = async (versionId: string, versionNumber: number) => {
    setChangingBaseline(true);
    try {
      await setBookBaseline(bookId, versionId);
      
      toast({
        title: "✅ Versión base actualizada",
        description: `La versión #${versionNumber} es ahora la nueva base de referencia`,
      });

      await loadVersions();
      
      // Emit custom event to refresh BookVersionHistory
      window.dispatchEvent(new CustomEvent('baselineChanged', { detail: { bookId } }));
    } catch (error) {
      console.error('Error setting baseline:', error);
      toast({
        title: "Error",
        description: "No se pudo cambiar la versión base",
        variant: "destructive",
      });
    } finally {
      setChangingBaseline(false);
    }
  };

  const getSourceTypeBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'api_import':
        return <Badge variant="default">Importación API</Badge>;
      case 'api_check':
        return <Badge variant="secondary">Revisión API</Badge>;
      case 'manual_pdf':
        return <Badge variant="outline">Manual PDF</Badge>;
      default:
        return <Badge>{sourceType}</Badge>;
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        <FileText className="mr-2 h-4 w-4" />
        Ver Versiones
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Versiones de: {bookTitle}</DialogTitle>
            <DialogDescription>
              Gestiona las versiones de este libro. La versión marcada como "BASE" se usa como referencia para detectar cambios.
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Versión</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Fecha Importación</TableHead>
                  <TableHead>Fecha Edición</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-[150px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Cargando versiones...
                    </TableCell>
                  </TableRow>
                ) : versions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay versiones registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  versions.map((version) => (
                    <TableRow key={version.id}>
                      <TableCell className="font-semibold">
                        #{version.version_number}
                      </TableCell>
                      <TableCell>
                        {getSourceTypeBadge(version.source_type)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(version.import_date), 'dd MMM yyyy', { locale: es })}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {version.edition_date 
                          ? format(new Date(version.edition_date), 'dd MMM yyyy', { locale: es })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {version.is_baseline ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            BASE ACTUAL
                          </Badge>
                        ) : (
                          <Badge variant="outline">Histórica</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {version.version_notes || '-'}
                      </TableCell>
                      <TableCell>
                        {!version.is_baseline && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetBaseline(version.id, version.version_number)}
                            disabled={changingBaseline}
                          >
                            {changingBaseline ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Cambiando...
                              </>
                            ) : (
                              'Designar como Base'
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
