import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { BookOpen, Shield, Eye, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center p-3 bg-gold-light/20 rounded-full mb-6">
            <Shield className="h-8 w-8 text-gold" />
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Fideicomisario Leal
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed max-w-3xl mx-auto">
            Sistema de monitoreo y comparación para preservar la integridad textual 
            de los escritos de Ellen G. White
          </p>
          
          <Link to="/libros">
            <Button size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-shadow">
              <BookOpen className="mr-2 h-5 w-5" />
              Ver libros monitoreados
            </Button>
          </Link>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-secondary/30 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center p-3 bg-card rounded-lg">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Transparencia</h3>
                <p className="text-sm text-muted-foreground">
                  Registramos y mostramos todos los cambios detectados en los textos
                </p>
              </div>
              
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center p-3 bg-card rounded-lg">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Preservación</h3>
                <p className="text-sm text-muted-foreground">
                  Mantenemos un registro histórico completo de las versiones originales
                </p>
              </div>
              
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center p-3 bg-card rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Vigilancia</h3>
                <p className="text-sm text-muted-foreground">
                  Monitoreo continuo para detectar cualquier modificación textual
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Purpose Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12 space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold">Nuestro Propósito</h2>
            
            <div className="space-y-4 text-[hsl(var(--text-body))] leading-relaxed">
              <p>
                La organización oficial de EGW Writings proporciona acceso digital a los escritos 
                de Ellen G. White a través de su API pública. Sin embargo, con el tiempo se realizan 
                actualizaciones textuales que pueden alterar el significado original de los mensajes.
              </p>
              
              <p>
                <strong>Fideicomisario Leal</strong> surge como una herramienta de vigilancia y 
                transparencia, comparando versiones mes a mes para detectar y documentar cada cambio, 
                preservando así la fidelidad del mensaje original.
              </p>
              
              <p className="text-sm text-muted-foreground italic border-l-4 border-gold pl-4">
                "Debemos ser como los bereanos, escudriñando las Escrituras y comparando 
                todo con la Palabra de Dios para asegurarnos de que no se pierda ni una jota 
                del mensaje original."
              </p>
            </div>
            
            <div className="pt-4">
              <Link to="/libros">
                <Button variant="outline" size="lg">
                  Explorar cambios detectados
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
