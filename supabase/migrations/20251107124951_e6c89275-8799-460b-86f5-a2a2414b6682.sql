-- Add UPDATE policy for book_comparisons table to allow admins to edit version notes
CREATE POLICY "Only admins can update comparisons"
ON book_comparisons
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));