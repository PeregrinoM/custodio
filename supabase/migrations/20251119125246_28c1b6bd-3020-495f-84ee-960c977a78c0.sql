-- Migration: Create book_versions table for multi-version support

CREATE TABLE IF NOT EXISTS public.book_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('api_import', 'manual_pdf', 'api_check')),
  import_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_baseline BOOLEAN DEFAULT false,
  edition_date DATE,
  version_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  UNIQUE(book_id, version_number)
);

-- Create function to enforce one baseline per book
CREATE OR REPLACE FUNCTION public.check_single_baseline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_baseline = true THEN
    -- Check if another baseline exists for this book
    IF EXISTS (
      SELECT 1 FROM public.book_versions 
      WHERE book_id = NEW.book_id 
      AND is_baseline = true 
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Only one baseline version allowed per book. Unset current baseline first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to enforce baseline uniqueness
CREATE TRIGGER enforce_single_baseline
  BEFORE INSERT OR UPDATE ON public.book_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_single_baseline();

-- Index for fast baseline lookups
CREATE INDEX idx_book_versions_baseline ON public.book_versions(book_id, is_baseline) WHERE is_baseline = true;
CREATE INDEX idx_book_versions_book ON public.book_versions(book_id);

-- Enable RLS
ALTER TABLE public.book_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view book versions"
ON public.book_versions FOR SELECT
USING (true);

CREATE POLICY "Only admins can insert book versions"
ON public.book_versions FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update book versions"
ON public.book_versions FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete book versions"
ON public.book_versions FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp
CREATE TRIGGER update_book_versions_timestamp
  BEFORE UPDATE ON public.book_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.book_versions IS 'Stores multiple versions of each book for flexible baseline management';
COMMENT ON COLUMN public.book_versions.is_baseline IS 'Marks which version is currently used as reference for comparisons. Only ONE version per book can be baseline.';
COMMENT ON COLUMN public.book_versions.edition_date IS 'Physical book edition date (important for deciding which version should be baseline)';
COMMENT ON COLUMN public.book_versions.source_type IS 'How this version was imported: api_import (first), manual_pdf (uploaded), api_check (revision)';

-- Create version_snapshots table to store paragraph text for each version
CREATE TABLE IF NOT EXISTS public.version_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.book_versions(id) ON DELETE CASCADE,
  paragraph_id UUID NOT NULL REFERENCES public.paragraphs(id) ON DELETE CASCADE,
  paragraph_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(version_id, paragraph_id)
);

-- Indexes
CREATE INDEX idx_version_snapshots_version ON public.version_snapshots(version_id);
CREATE INDEX idx_version_snapshots_paragraph ON public.version_snapshots(paragraph_id);

-- Enable RLS
ALTER TABLE public.version_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view version snapshots"
ON public.version_snapshots FOR SELECT
USING (true);

CREATE POLICY "Only admins can insert version snapshots"
ON public.version_snapshots FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete version snapshots"
ON public.version_snapshots FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.version_snapshots IS 'Stores paragraph text for each book version, enabling comparison between any two versions';

-- Populate book_versions with existing imports
INSERT INTO public.book_versions (book_id, version_number, source_type, import_date, is_baseline, version_notes)
SELECT 
  id as book_id,
  1 as version_number,
  'api_import' as source_type,
  COALESCE(imported_at, now()) as import_date,
  true as is_baseline,
  'Initial import - migrated from legacy system' as version_notes
FROM public.books
ON CONFLICT (book_id, version_number) DO NOTHING;

-- Create version snapshots from current base_text
INSERT INTO public.version_snapshots (version_id, paragraph_id, paragraph_text)
SELECT 
  bv.id as version_id,
  p.id as paragraph_id,
  p.base_text as paragraph_text
FROM public.paragraphs p
JOIN public.chapters c ON p.chapter_id = c.id
JOIN public.books b ON c.book_id = b.id
JOIN public.book_versions bv ON bv.book_id = b.id AND bv.version_number = 1
ON CONFLICT (version_id, paragraph_id) DO NOTHING;