import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Libros from "./pages/Libros";
import BookView from "./pages/BookView";
import ChapterView from "./pages/ChapterView";
import Admin from "./pages/Admin";
import AdminConfig from "./pages/AdminConfig";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/libros" element={<Libros />} />
          <Route path="/libros/:id" element={<BookView />} />
          <Route path="/capitulos/:id" element={<ChapterView />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/config" element={<AdminConfig />} />
          <Route path="/auth" element={<Auth />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
