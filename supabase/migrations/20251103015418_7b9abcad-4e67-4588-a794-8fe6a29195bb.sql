-- Add refcode_short column to paragraphs table
ALTER TABLE paragraphs 
ADD COLUMN IF NOT EXISTS refcode_short TEXT;

-- Create index for searches by refcode
CREATE INDEX IF NOT EXISTS idx_paragraphs_refcode ON paragraphs(refcode_short);

COMMENT ON COLUMN paragraphs.refcode_short IS 'Código de referencia usado por usuarios para citar (ej: DTG 46.1)';