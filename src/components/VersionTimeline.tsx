import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight } from "lucide-react";

interface Version {
  id: string;
  book_id: string;
  version_number: number;
  source_type: string;
  import_date: string;
  is_baseline: boolean;
  edition_date: string | null;
  version_notes: string | null;
}

interface VersionTimelineProps {
  bookId: string;
}

export const VersionTimeline = ({ bookId }: VersionTimelineProps) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersionTimeline();
  }, [bookId]);

  const loadVersionTimeline = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('book_versions')
        .select('*')
        .eq('book_id', bookId)
        .order('version_number', { ascending: true });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error("Error loading version timeline:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (versions.length <= 1) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Línea de Tiempo de Versiones</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {versions.map((version, index) => (
              <div key={version.id} className="flex items-center gap-4">
                <div
                  className={`
                    flex flex-col items-center p-3 rounded-lg border-2 min-w-[140px] transition-all
                    ${version.is_baseline 
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-500 shadow-lg' 
                      : 'bg-background border-border hover:border-primary/50'
                    }
                  `}
                >
                  <div className="font-bold text-sm mb-1">
                    Versión #{version.version_number}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {format(new Date(version.import_date), 'dd MMM yy', { locale: es })}
                  </div>
                  {version.is_baseline && (
                    <Badge variant="default" className="bg-green-600 dark:bg-green-700 text-xs">
                      BASE ACTUAL
                    </Badge>
                  )}
                  {version.source_type === 'manual_pdf' && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      PDF Manual
                    </Badge>
                  )}
                </div>
                {index < versions.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
