-- Enable authenticated users to insert and update books, chapters, and paragraphs

-- Update RLS policies for books table
CREATE POLICY "Authenticated users can insert books"
ON public.books FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update books"
ON public.books FOR UPDATE
TO authenticated
USING (true);

-- Update RLS policies for chapters table
CREATE POLICY "Authenticated users can insert chapters"
ON public.chapters FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update chapters"
ON public.chapters FOR UPDATE
TO authenticated
USING (true);

-- Update RLS policies for paragraphs table
CREATE POLICY "Authenticated users can insert paragraphs"
ON public.paragraphs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update paragraphs"
ON public.paragraphs FOR UPDATE
TO authenticated
USING (true);