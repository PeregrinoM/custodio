-- Add field to identify test/seed books
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS is_test_seed boolean DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.books.is_test_seed IS 'Identifies books imported as test seeds with intentional errors for testing purposes';

-- Update book_comparisons to support test import type
ALTER TABLE public.book_comparisons
DROP CONSTRAINT IF EXISTS book_comparisons_comparison_type_check;

-- Add new constraint with test_import type
ALTER TABLE public.book_comparisons
ADD CONSTRAINT book_comparisons_comparison_type_check 
CHECK (comparison_type IN ('initial_import', 'version_check', 'test_import'));