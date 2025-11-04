import { Paragraph } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle } from "lucide-react";

interface ParagraphItemProps {
  paragraph: Paragraph;
  onViewHistory: (paragraph: Paragraph) => void;
}

const ParagraphItem = ({ paragraph, onViewHistory }: ParagraphItemProps) => {
  return (
    <Card className={`${paragraph.has_changed ? 'border-change-removed/30' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Párrafo {paragraph.paragraph_number}
            {paragraph.has_changed ? (
              <AlertCircle className="h-4 w-4 text-change-removed" />
            ) : (
              <CheckCircle className="h-4 w-4 text-change-added" />
            )}
          </CardTitle>
          {paragraph.has_changed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewHistory(paragraph)}
              className="text-xs"
            >
              Ver historial
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">
          {paragraph.latest_text}
          {paragraph.refcode_short && (
            <span className="ml-2 text-xs font-mono text-primary/70">
              {`{${paragraph.refcode_short}}`}
            </span>
          )}
        </p>
        {paragraph.has_changed && paragraph.change_history.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            {paragraph.change_history.length} cambio(s) detectado(s)
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ParagraphItem;
