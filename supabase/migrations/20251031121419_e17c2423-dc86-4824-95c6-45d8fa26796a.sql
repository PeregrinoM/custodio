-- Fix QA Issue #1: Add search_path to update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add metadata fields to books table for Phase 2
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'es',
ADD COLUMN IF NOT EXISTS book_code_api TEXT;

-- Create comments table for admin review interface
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  paragraph_id UUID REFERENCES public.paragraphs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on comments table
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Comments are viewable by everyone
CREATE POLICY "Comments are viewable by everyone"
ON public.comments
FOR SELECT
USING (true);

-- Only admins can insert comments
CREATE POLICY "Only admins can insert comments"
ON public.comments
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update their own comments
CREATE POLICY "Only admins can update their own comments"
ON public.comments
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  AND user_id = auth.uid()
);

-- Only admins can delete their own comments
CREATE POLICY "Only admins can delete their own comments"
ON public.comments
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  AND user_id = auth.uid()
);

-- Add trigger for automatic timestamp updates on comments
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update existing books to have imported_at set to their created_at if null
UPDATE public.books 
SET imported_at = created_at 
WHERE imported_at IS NULL;