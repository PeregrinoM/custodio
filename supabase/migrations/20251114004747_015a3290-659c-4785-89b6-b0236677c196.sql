-- ==========================================
-- TABLE: book_catalog
-- Purpose: Complete catalog of all available EGW books (SPANISH ONLY)
-- This replaces the hardcoded BOOK_ID_MAP
-- IMPORTANT: Each book has a unique egw_book_id. English versions have different IDs.
-- ==========================================

CREATE TABLE IF NOT EXISTS book_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_code text NOT NULL UNIQUE,
  egw_book_id integer NOT NULL UNIQUE,
  title_es text NOT NULL,
  is_active boolean DEFAULT false,
  language text DEFAULT 'es',
  folder_id integer DEFAULT 236,
  last_validated timestamp with time zone,
  validation_status text DEFAULT 'pending',
  validation_error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_book_catalog_code ON book_catalog(book_code);
CREATE INDEX idx_book_catalog_egw_id ON book_catalog(egw_book_id);
CREATE INDEX idx_book_catalog_active ON book_catalog(is_active);

-- Enable RLS
ALTER TABLE book_catalog ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read catalog (needed for public access)
CREATE POLICY "Anyone can read book catalog"
  ON book_catalog
  FOR SELECT
  USING (true);

-- Policy: Only admins can insert to catalog
CREATE POLICY "Only admins can insert to book catalog"
  ON book_catalog
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can update catalog
CREATE POLICY "Only admins can update book catalog"
  ON book_catalog
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can delete from catalog
CREATE POLICY "Only admins can delete from book catalog"
  ON book_catalog
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp trigger
CREATE TRIGGER update_book_catalog_timestamp
    BEFORE UPDATE ON book_catalog
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SEED DATA: Verified Spanish books from current system
-- IMPORTANT: Only Spanish books. Each has unique egw_book_id.
-- ==========================================

INSERT INTO book_catalog (book_code, egw_book_id, title_es, is_active, validation_status) VALUES
('DTG', 174, 'El Deseado de Todas las Gentes', true, 'verified'),
('PP', 1704, 'Patriarcas y Profetas', true, 'verified'),
('PR', 217, 'Profetas y Reyes', true, 'verified'),
('CS', 132, 'El Conflicto de los Siglos', false, 'pending'),
('HAp', 127, 'Los Hechos de los Apóstoles', false, 'pending'),
('MC', 133, 'El Ministerio de Curación', false, 'pending'),
('CC', 130, 'El Camino a Cristo', false, 'pending'),
('Ed', 129, 'La Educación', false, 'pending')
ON CONFLICT (book_code) DO NOTHING;

COMMENT ON TABLE book_catalog IS 'Complete catalog of EGW Spanish books. Replaces hardcoded BOOK_ID_MAP.';
COMMENT ON COLUMN book_catalog.is_active IS 'Whether this book is enabled for monitoring. Admin controls this via UI.';
COMMENT ON COLUMN book_catalog.validation_status IS 'Status of TOC validation: pending, verified, failed';
COMMENT ON COLUMN book_catalog.last_validated IS 'Last time we checked if this book TOC is accessible';
COMMENT ON COLUMN book_catalog.egw_book_id IS 'Unique book ID for scraping from EGW. Each Spanish book has its own unique ID.';
COMMENT ON COLUMN book_catalog.title_es IS 'Spanish title of the book';