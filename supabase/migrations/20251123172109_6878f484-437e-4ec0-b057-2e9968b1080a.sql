-- Create book_toc table to store Table of Contents dynamically
CREATE TABLE IF NOT EXISTS public.book_toc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  egw_book_id INTEGER NOT NULL UNIQUE,
  book_code TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'es',
  toc_url TEXT NOT NULL,
  toc_html TEXT,
  toc_extracted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  chapters_count INTEGER DEFAULT 0,
  chapters_data JSONB DEFAULT '[]'::jsonb,
  validation_status TEXT DEFAULT 'pending',
  validation_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_book_catalog 
    FOREIGN KEY (egw_book_id) 
    REFERENCES public.book_catalog(egw_book_id) 
    ON DELETE CASCADE
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_book_toc_egw_book_id ON public.book_toc(egw_book_id);
CREATE INDEX IF NOT EXISTS idx_book_toc_book_code ON public.book_toc(book_code);
CREATE INDEX IF NOT EXISTS idx_book_toc_language ON public.book_toc(language);

-- Enable RLS
ALTER TABLE public.book_toc ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read book TOC"
  ON public.book_toc
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert book TOC"
  ON public.book_toc
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update book TOC"
  ON public.book_toc
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete book TOC"
  ON public.book_toc
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_book_toc_updated_at
  BEFORE UPDATE ON public.book_toc
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.book_toc IS 'Stores Table of Contents data scraped from EGW Writings for each book';