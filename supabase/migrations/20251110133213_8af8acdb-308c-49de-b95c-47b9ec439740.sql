-- Add DELETE policy for books table to allow admins to delete books
CREATE POLICY "Only admins can delete books"
ON public.books 
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for book_comparisons table (cascade deletion support)
CREATE POLICY "Only admins can delete comparisons"
ON public.book_comparisons
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for chapters table (cascade deletion support)
CREATE POLICY "Only admins can delete chapters"
ON public.chapters
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for paragraphs table (cascade deletion support)
CREATE POLICY "Only admins can delete paragraphs"
ON public.paragraphs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for comments table (already has delete for own comments, now add for admins on any comment)
CREATE POLICY "Admins can delete any comment"
ON public.comments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));