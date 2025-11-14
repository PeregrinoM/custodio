-- ==========================================
-- TABLE: catalog_config
-- Purpose: Store system-wide configuration that can be edited from UI
-- Critical for resilience: If EGW changes folder IDs, admin can update here
-- ==========================================

CREATE TABLE IF NOT EXISTS catalog_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_catalog_config_key ON catalog_config(config_key);

-- Enable RLS
ALTER TABLE catalog_config ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read config
CREATE POLICY "Authenticated users can read config"
  ON catalog_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can insert config
CREATE POLICY "Only admins can insert config"
  ON catalog_config
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can update config
CREATE POLICY "Only admins can update config"
  ON catalog_config
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can delete config
CREATE POLICY "Only admins can delete config"
  ON catalog_config
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ==========================================
-- TRIGGER: Auto-update updated_at timestamp
-- Reusing existing function update_updated_at_column()
-- ==========================================

CREATE TRIGGER update_catalog_config_timestamp
    BEFORE UPDATE ON catalog_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SEED DATA: Initial configuration values
-- ==========================================

INSERT INTO catalog_config (config_key, config_value, description) VALUES
('library_base_url', 'https://m.egwwritings.org', 'Base URL of the EGW Writings website'),
('library_folder_id', '236', 'Folder ID containing the Spanish books catalog (e.g., /es/folders/236)'),
('library_language', 'es', 'Primary language to monitor (es = Spanish, en = English)'),
('library_folder_path', '/es/folders/', 'Path template for folder URLs')
ON CONFLICT (config_key) DO NOTHING;

COMMENT ON TABLE catalog_config IS 'System-wide configuration that can be edited from admin UI. Critical for resilience if EGW changes their site structure.';
COMMENT ON COLUMN catalog_config.config_key IS 'Unique identifier for this configuration setting';
COMMENT ON COLUMN catalog_config.config_value IS 'The actual value of the configuration';
COMMENT ON COLUMN catalog_config.updated_by IS 'User ID who last modified this config (for audit trail)';