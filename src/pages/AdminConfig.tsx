import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings, CheckCircle, XCircle, AlertTriangle, Save } from "lucide-react";

interface ConfigItem {
  config_key: string;
  config_value: string;
  description: string | null;
  updated_at: string;
}

const AdminConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    message: string;
  } | null>(null);
  
  const [config, setConfig] = useState<Record<string, string>>({
    library_base_url: '',
    library_folder_id: '',
    library_folder_path: '',
    library_language: ''
  });

  const { isAdmin, loading: adminCheckLoading } = useAdminCheck();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!adminCheckLoading && !isAdmin) {
      navigate("/admin");
      return;
    }
    loadConfig();
  }, [adminCheckLoading, isAdmin]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("catalog_config" as any)
        .select("*");

      if (error) throw error;

      const configMap: Record<string, string> = {};
      (data as unknown as ConfigItem[])?.forEach((item) => {
        configMap[item.config_key] = item.config_value;
      });

      setConfig(configMap);
    } catch (error) {
      console.error("Error loading config:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la configuración",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestUrl = async () => {
    setTesting(true);
    setValidationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-config-url', {
        body: {
          baseUrl: config.library_base_url,
          folderId: config.library_folder_id,
          folderPath: config.library_folder_path
        }
      });

      if (error) throw error;

      setValidationResult({
        isValid: data.isValid,
        message: data.message
      });

      toast({
        title: data.isValid ? "✅ Validación Exitosa" : "❌ Validación Fallida",
        description: data.message,
        variant: data.isValid ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Error testing URL:", error);
      setValidationResult({
        isValid: false,
        message: "No se pudo validar la URL. Por favor verifica tu conexión a internet."
      });
      toast({
        title: "Error",
        description: "No se pudo probar la configuración",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    // Validate before saving
    if (!config.library_base_url || !config.library_folder_id) {
      toast({
        title: "Error de Validación",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Update each config value
      for (const [key, value] of Object.entries(config)) {
        const { error } = await supabase
          .from("catalog_config" as any)
          .update({
            config_value: value,
            updated_by: user?.id
          } as any)
          .eq("config_key", key);

        if (error) throw error;
      }

      toast({
        title: "✅ Configuración Guardada",
        description: "La configuración del sistema se actualizó exitosamente",
      });

      // Reload config to get updated timestamps
      await loadConfig();
    } catch (error) {
      console.error("Error saving config:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
    // Clear validation result when user changes values
    setValidationResult(null);
  };

  if (loading || adminCheckLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Configuración del Sistema
          </h1>
          <p className="text-muted-foreground">
            Administra los ajustes globales del sistema. Los cambios aquí afectan cómo la aplicación se conecta a EGW Writings.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>⚙️ Configuración de Conexión EGW</CardTitle>
            <CardDescription>
              Configura las URLs de origen y parámetros para obtener el catálogo de libros de EGW.
              Estos ajustes son críticos para la resiliencia del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Base URL */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                🔗 Base URL
              </label>
              <Input
                value={config.library_base_url}
                onChange={(e) => handleChange('library_base_url', e.target.value)}
                placeholder="https://m.egwwritings.org"
                disabled={saving}
              />
              <Alert>
                <AlertDescription className="text-xs text-muted-foreground">
                  La URL raíz del sitio web de EGW Writings. Normalmente no necesita cambios.
                </AlertDescription>
              </Alert>
            </div>

            {/* Folder Path */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                📂 Plantilla de Ruta de Carpeta
              </label>
              <Input
                value={config.library_folder_path}
                onChange={(e) => handleChange('library_folder_path', e.target.value)}
                placeholder="/es/folders/"
                disabled={saving}
              />
              <Alert>
                <AlertDescription className="text-xs text-muted-foreground">
                  Plantilla de ruta para URLs de carpetas. Cambia '/es/' a '/en/' para libros en inglés.
                </AlertDescription>
              </Alert>
            </div>

            {/* Folder ID - Most important! */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                📁 Folder ID <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                value={config.library_folder_id}
                onChange={(e) => handleChange('library_folder_id', e.target.value)}
                placeholder="236"
                disabled={saving}
              />
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Configuración Crítica:</strong> Si EGW cambia su estructura de carpetas 
                  (ej., de <code>/folders/236</code> a <code>/folders/237</code>), 
                  actualiza este valor aquí. Esto evita que todo el sistema falle.
                </AlertDescription>
              </Alert>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                🌍 Idioma Principal
              </label>
              <Input
                value={config.library_language}
                onChange={(e) => handleChange('library_language', e.target.value)}
                placeholder="es"
                maxLength={2}
                disabled={saving}
              />
              <Alert>
                <AlertDescription className="text-xs text-muted-foreground">
                  Código de idioma: 'es' para español, 'en' para inglés, 'fr' para francés, etc.
                </AlertDescription>
              </Alert>
            </div>

            {/* Validation Result */}
            {validationResult && (
              <Alert variant={validationResult.isValid ? "default" : "destructive"}>
                {validationResult.isValid ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {validationResult.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleTestUrl} 
                disabled={testing || saving}
                variant="outline"
                className="flex-1"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Probando...
                  </>
                ) : (
                  <>
                    🔍 Probar Configuración
                  </>
                )}
              </Button>

              <Button 
                onClick={handleSave} 
                disabled={saving || testing}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Configuración
                  </>
                )}
              </Button>
            </div>

            {/* Helper Text */}
            <Alert>
              <AlertDescription className="text-xs text-muted-foreground">
                💡 <strong>Consejo:</strong> Siempre prueba tu configuración antes de guardar. 
                Esto valida que la URL sea accesible y contenga datos de libros.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="mt-6">
          <Button variant="ghost" onClick={() => navigate("/admin")}>
            ← Volver al Panel de Admin
          </Button>
        </div>
      </main>
    </div>
  );
};

export default AdminConfig;
