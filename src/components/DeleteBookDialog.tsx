import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  bookCode: string;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteBookDialog({
  open,
  onOpenChange,
  bookTitle,
  bookCode,
  onConfirm,
  isDeleting,
}: DeleteBookDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            ⚠️ Eliminar Libro Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <div className="font-medium text-foreground">
                ¿Estás seguro de eliminar "{bookTitle}" ({bookCode})?
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Esta acción eliminará PERMANENTEMENTE:</p>
                <ul className="space-y-1 text-sm list-disc list-inside pl-2">
                  <li>El libro completo</li>
                  <li>Todos sus capítulos</li>
                  <li>Todos sus párrafos</li>
                  <li>Todo el historial de cambios (book_comparisons)</li>
                  <li>Todos los comentarios asociados</li>
                </ul>
              </div>

              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-destructive font-semibold text-sm flex items-center gap-2">
                  ⛔ ESTA ACCIÓN NO SE PUEDE DESHACER
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Eliminando..." : "Sí, eliminar permanentemente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
