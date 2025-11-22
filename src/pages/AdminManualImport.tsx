import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, FileUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ManualImportState } from '@/types/manual-import';
import { Phase1Validation } from '@/components/admin/manual-import/Phase1Validation';
import { Phase2StructuralComparison } from '@/components/admin/manual-import/Phase2StructuralComparison';
import { Phase3CodeAssignment } from '@/components/admin/manual-import/Phase3CodeAssignment';
import { Phase4Review } from '@/components/admin/manual-import/Phase4Review';
import { Phase5Import } from '@/components/admin/manual-import/Phase5Import';

const AdminManualImport = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAdminCheck();
  const [loading, setLoading] = useState(true);
  const [availableBooks, setAvailableBooks] = useState<Array<{ code: string; title: string }>>([]);
  
  const [state, setState] = useState<ManualImportState>({
    currentPhase: 1,
    bookCode: '',
    bookTitle: '',
    versionType: 'regular',
    editionDate: null,
    versionNotes: '',
    uploadedFile: null,
    rawParagraphs: [],
    structuralComparison: null,
    codeAssignments: [],
    validationErrors: [],
    importResult: null
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/admin');
      return;
    }
    if (isAdmin) {
      loadAvailableBooks();
    }
  }, [isAdmin, authLoading, navigate]);

  const loadAvailableBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('code, title')
        .order('title');

      if (error) throw error;
      setAvailableBooks(data || []);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateState = (updates: Partial<ManualImportState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const goToPhase = (phase: 1 | 2 | 3 | 4 | 5) => {
    setState(prev => ({ ...prev, currentPhase: phase }));
  };

  const resetImport = () => {
    setState({
      currentPhase: 1,
      bookCode: '',
      bookTitle: '',
      versionType: 'regular',
      editionDate: null,
      versionNotes: '',
      uploadedFile: null,
      rawParagraphs: [],
      structuralComparison: null,
      codeAssignments: [],
      validationErrors: [],
      importResult: null
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Acceso denegado. Esta página es solo para administradores.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileUp className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Importación Manual de Versiones Históricas</h1>
          </div>
          <p className="text-muted-foreground">
            Importe versiones históricas desde archivos de texto con asignación asistida de códigos de referencia
          </p>
        </div>

        {/* Phase Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((phase, index) => (
              <div key={phase} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 
                  ${state.currentPhase >= phase ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 text-muted-foreground'}`}
                >
                  {phase}
                </div>
                {index < 4 && (
                  <div className={`flex-1 h-0.5 mx-2 ${state.currentPhase > phase ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Validación</span>
            <span>Comparación</span>
            <span>Asignación</span>
            <span>Revisión</span>
            <span>Importación</span>
          </div>
        </div>

        {/* Phase Content */}
        {state.currentPhase === 1 && (
          <Phase1Validation
            state={state}
            availableBooks={availableBooks}
            onNext={updateState}
          />
        )}

        {state.currentPhase === 2 && (
          <Phase2StructuralComparison
            state={state}
            onNext={updateState}
            onBack={() => goToPhase(1)}
          />
        )}

        {state.currentPhase === 3 && (
          <Phase3CodeAssignment
            state={state}
            onNext={updateState}
            onBack={() => goToPhase(2)}
          />
        )}

        {state.currentPhase === 4 && (
          <Phase4Review
            state={state}
            onNext={updateState}
            onBack={() => goToPhase(3)}
          />
        )}

        {state.currentPhase === 5 && (
          <Phase5Import
            state={state}
            onBack={() => goToPhase(4)}
            onReset={resetImport}
          />
        )}
      </div>
    </div>
  );
};

export default AdminManualImport;
