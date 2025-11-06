-- Create table for tracking book comparison history
CREATE TABLE public.book_comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  comparison_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  comparison_type TEXT NOT NULL CHECK (comparison_type IN ('initial_import', 'version_check')),
  total_changes INTEGER NOT NULL DEFAULT 0,
  changed_paragraphs INTEGER NOT NULL DEFAULT 0,
  chapters_affected JSONB DEFAULT '[]'::jsonb,
  version_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.book_comparisons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Comparisons are viewable by everyone"
ON public.book_comparisons
FOR SELECT
USING (true);

CREATE POLICY "Only admins can insert comparisons"
ON public.book_comparisons
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for better query performance
CREATE INDEX idx_book_comparisons_book_id ON public.book_comparisons(book_id);
CREATE INDEX idx_book_comparisons_date ON public.book_comparisons(comparison_date DESC);

-- Add comment
COMMENT ON TABLE public.book_comparisons IS 'Tracks history of book version comparisons and imports';