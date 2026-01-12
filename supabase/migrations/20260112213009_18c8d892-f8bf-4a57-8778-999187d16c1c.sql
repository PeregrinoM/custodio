-- =====================================================
-- Sistema de Clasificación de Cambios
-- =====================================================

-- 1. Tabla de categorías de cambios
CREATE TABLE public.change_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  icon text,
  color text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tabla de clasificaciones de cambios
CREATE TABLE public.change_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paragraph_id uuid NOT NULL REFERENCES public.paragraphs(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.change_categories(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('bajo', 'medio', 'alto')),
  change_date timestamptz,
  notes text,
  classified_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(paragraph_id, category_id, change_date)
);

-- 3. Habilitar RLS
ALTER TABLE public.change_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_classifications ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para change_categories
CREATE POLICY "Todos pueden ver categorías activas"
  ON public.change_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins pueden gestionar categorías"
  ON public.change_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Políticas RLS para change_classifications
CREATE POLICY "Todos pueden ver clasificaciones"
  ON public.change_classifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins pueden crear clasificaciones"
  ON public.change_classifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins pueden actualizar clasificaciones"
  ON public.change_classifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins pueden eliminar clasificaciones"
  ON public.change_classifications FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Índices para rendimiento
CREATE INDEX idx_classifications_paragraph ON public.change_classifications(paragraph_id);
CREATE INDEX idx_classifications_category ON public.change_classifications(category_id);
CREATE INDEX idx_classifications_severity ON public.change_classifications(severity);
CREATE INDEX idx_categories_active ON public.change_categories(is_active);

-- 7. Trigger para updated_at
CREATE TRIGGER update_change_categories_updated_at
  BEFORE UPDATE ON public.change_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_change_classifications_updated_at
  BEFORE UPDATE ON public.change_classifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Insertar categorías iniciales
INSERT INTO public.change_categories (name, display_name, description, icon, color, sort_order) VALUES
  ('sinonimos', 'Sinónimos', 'Cambio de palabras por equivalentes semánticos', 'Replace', 'blue', 1),
  ('contexto', 'Contexto', 'Cambios que afectan el significado o interpretación', 'MessageSquare', 'amber', 2),
  ('puntuacion', 'Puntuación', 'Cambios en signos de puntuación (comas, puntos, etc.)', 'Type', 'green', 3),
  ('rotacion', 'Rotación', 'Cambios en el orden de palabras o frases', 'RefreshCw', 'purple', 4);