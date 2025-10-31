-- Migration: Make Panel Specifications Optional
-- This migration makes specification columns nullable and adds support for tracking missing fields
-- and system-generated admin review flags

-- Make specification columns nullable
ALTER TABLE solar_panels 
  ALTER COLUMN length_cm DROP NOT NULL,
  ALTER COLUMN width_cm DROP NOT NULL,
  ALTER COLUMN weight_kg DROP NOT NULL,
  ALTER COLUMN wattage DROP NOT NULL,
  ALTER COLUMN price_usd DROP NOT NULL;

-- Add column to track which fields are missing
ALTER TABLE solar_panels 
  ADD COLUMN IF NOT EXISTS missing_fields JSONB DEFAULT '[]'::jsonb;

-- Add index for querying panels with missing data
CREATE INDEX IF NOT EXISTS idx_solar_panels_missing_fields 
  ON solar_panels USING gin(missing_fields);

-- Add comments
COMMENT ON COLUMN solar_panels.missing_fields IS 'Array of field names that failed to parse or are missing (e.g., ["wattage", "dimensions"])';

-- Add flag_type column to distinguish user vs system flags
ALTER TABLE user_flags 
  ADD COLUMN IF NOT EXISTS flag_type VARCHAR(20) DEFAULT 'user' 
  CHECK (flag_type IN ('user', 'system_missing_data', 'system_parse_failure'));

-- Make user_id nullable to allow system-generated flags
ALTER TABLE user_flags 
  ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to allow system to create flags
CREATE POLICY "System can create flags" ON user_flags
  FOR INSERT WITH CHECK (flag_type LIKE 'system_%');

-- Add comments for new flag types
COMMENT ON COLUMN user_flags.flag_type IS 'Type of flag: user (user-submitted), system_missing_data (auto-generated for missing specs), system_parse_failure (auto-generated for parse errors)';

-- Update admin_flag_queue view to include flag_type column
DROP VIEW IF EXISTS admin_flag_queue;
CREATE OR REPLACE VIEW admin_flag_queue AS
SELECT 
  uf.id,
  uf.panel_id,
  uf.user_id,
  uf.flag_type,
  uf.flagged_fields,
  uf.suggested_corrections,
  uf.user_comment,
  uf.status,
  uf.admin_note,
  uf.created_at,
  uf.updated_at,
  uf.resolved_at,
  uf.resolved_by,
  sp.name as panel_name,
  sp.manufacturer,
  sp.wattage,
  sp.price_usd,
  au.email as user_email,
  resolver.email as resolved_by_email
FROM user_flags uf
JOIN solar_panels sp ON uf.panel_id = sp.id
LEFT JOIN auth.users au ON uf.user_id = au.id
LEFT JOIN auth.users resolver ON uf.resolved_by = resolver.id
WHERE uf.status = 'pending'
ORDER BY uf.created_at ASC;
