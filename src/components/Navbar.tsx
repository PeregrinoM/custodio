import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold text-primary">Fideicomisario Leal</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Inicio
            </Link>
            <Link to="/libros" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Libros
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
