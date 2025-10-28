-- Create books table
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  last_check_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_changes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chapters table
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  change_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(book_id, number)
);

-- Create paragraphs table
CREATE TABLE public.paragraphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  paragraph_number INTEGER NOT NULL,
  base_text TEXT NOT NULL,
  latest_text TEXT NOT NULL,
  has_changed BOOLEAN DEFAULT false,
  change_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(chapter_id, paragraph_number)
);

-- Enable Row Level Security
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paragraphs ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (this is a public monitoring system)
CREATE POLICY "Books are viewable by everyone" 
ON public.books FOR SELECT 
USING (true);

CREATE POLICY "Chapters are viewable by everyone" 
ON public.chapters FOR SELECT 
USING (true);

CREATE POLICY "Paragraphs are viewable by everyone" 
ON public.paragraphs FOR SELECT 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_chapters_book_id ON public.chapters(book_id);
CREATE INDEX idx_paragraphs_chapter_id ON public.paragraphs(chapter_id);
CREATE INDEX idx_paragraphs_has_changed ON public.paragraphs(has_changed);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_books_updated_at
BEFORE UPDATE ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
BEFORE UPDATE ON public.chapters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paragraphs_updated_at
BEFORE UPDATE ON public.paragraphs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert mock data for El Deseado de Todas las Gentes
INSERT INTO public.books (title, code, total_changes) 
VALUES ('El Deseado de Todas las Gentes', 'DA', 8);

-- Insert chapter 1
INSERT INTO public.chapters (book_id, number, title, change_count)
SELECT id, 1, 'Dios con nosotros', 5
FROM public.books WHERE code = 'DA';

-- Insert chapter 2
INSERT INTO public.chapters (book_id, number, title, change_count)
SELECT id, 2, 'El pueblo escogido', 3
FROM public.books WHERE code = 'DA';

-- Insert mock paragraphs for chapter 1
WITH chapter AS (
  SELECT c.id FROM public.chapters c
  JOIN public.books b ON c.book_id = b.id
  WHERE b.code = 'DA' AND c.number = 1
)
INSERT INTO public.paragraphs (chapter_id, paragraph_number, base_text, latest_text, has_changed, change_history)
SELECT 
  chapter.id,
  1,
  'Desde los días de la eternidad, el Señor Jesucristo era uno con el Padre; era "la imagen de Dios", la imagen de su grandeza y majestad, "el resplandor de su gloria".',
  'Desde los días de la eternidad, el Señor Jesucristo era uno con el Padre; era "la imagen de Dios", la imagen de su grandeza y majestad, "el resplandor de su gloria".',
  false,
  '[]'::jsonb
FROM chapter
UNION ALL
SELECT 
  chapter.id,
  2,
  'Vino para manifestar este amor. Fue a buscar "la oveja que se había perdido", a manifestar la vida eterna que estaba "con el Padre", para que pudiéramos verla y conocerla.',
  'Vino para revelar este amor. Fue a buscar "la oveja que se había perdido", a manifestar la vida eterna que estaba "con el Padre", para que pudiéramos contemplarla y conocerla.',
  true,
  '[{"date": "2025-01-15", "old_text": "Vino para manifestar este amor. Fue a buscar \"la oveja que se había perdido\", a manifestar la vida eterna que estaba \"con el Padre\", para que pudiéramos verla y conocerla.", "new_text": "Vino para revelar este amor. Fue a buscar \"la oveja que se había perdido\", a manifestar la vida eterna que estaba \"con el Padre\", para que pudiéramos contemplarla y conocerla."}]'::jsonb
FROM chapter
UNION ALL
SELECT 
  chapter.id,
  3,
  'Cristo fue tratado como nosotros merecemos, a fin de que nosotros pudiésemos ser tratados como él merece. Fue condenado por nuestros pecados, en los que no había participado.',
  'Cristo fue tratado como nosotros merecemos, a fin de que nosotros pudiésemos ser tratados como él merece. Fue condenado por nuestros pecados, en los cuales no había participado.',
  true,
  '[{"date": "2025-02-01", "old_text": "Cristo fue tratado como nosotros merecemos, a fin de que nosotros pudiésemos ser tratados como él merece. Fue condenado por nuestros pecados, en los que no había participado.", "new_text": "Cristo fue tratado como nosotros merecemos, a fin de que nosotros pudiésemos ser tratados como él merece. Fue condenado por nuestros pecados, en los cuales no había participado."}]'::jsonb
FROM chapter;