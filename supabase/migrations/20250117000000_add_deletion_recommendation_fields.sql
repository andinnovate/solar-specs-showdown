-- Migration: Add Deletion Recommendation Fields to User Flags
-- This migration adds fields to support deletion recommendations in the flagging system

-- Add new columns to user_flags table
ALTER TABLE user_flags 
ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(50),
ADD COLUMN IF NOT EXISTS deletion_other_reason TEXT;

-- Update flag_type constraint to include deletion_recommendation
ALTER TABLE user_flags 
DROP CONSTRAINT IF EXISTS user_flags_flag_type_check;

ALTER TABLE user_flags 
ADD CONSTRAINT user_flags_flag_type_check 
CHECK (flag_type IN ('user', 'system_missing_data', 'system_parse_failure', 'deletion_recommendation'));

-- Add comments for new fields
COMMENT ON COLUMN user_flags.deletion_reason IS 'Reason for deletion recommendation: not_solar_panel, wattage_too_low, other';
COMMENT ON COLUMN user_flags.deletion_other_reason IS 'Additional details when deletion_reason is "other"';

-- Update admin_flag_queue view to include new fields
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
  uf.deletion_reason,
  uf.deletion_other_reason,
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
