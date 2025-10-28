-- Migration: Fix flag_type column length to accommodate deletion_recommendation
-- This migration increases the flag_type column length from VARCHAR(20) to VARCHAR(30)

-- Drop the view that depends on flag_type column
DROP VIEW IF EXISTS admin_flag_queue;

-- Drop RLS policies that depend on flag_type column
DROP POLICY IF EXISTS "System can create flags" ON user_flags;
DROP POLICY IF EXISTS "Users can view their own flags" ON user_flags;
DROP POLICY IF EXISTS "Users can create flags" ON user_flags;
DROP POLICY IF EXISTS "Users can update their own pending flags" ON user_flags;
DROP POLICY IF EXISTS "Admins can manage all flags" ON user_flags;

-- Drop the existing constraint
ALTER TABLE user_flags 
DROP CONSTRAINT IF EXISTS user_flags_flag_type_check;

-- Increase the length of flag_type column to accommodate longer values
ALTER TABLE user_flags 
ALTER COLUMN flag_type TYPE VARCHAR(30);

-- Re-add the constraint with the new length
ALTER TABLE user_flags 
ADD CONSTRAINT user_flags_flag_type_check 
CHECK (flag_type IN ('user', 'system_missing_data', 'system_parse_failure', 'deletion_recommendation'));

-- Recreate RLS policies
CREATE POLICY "Users can view their own flags" ON user_flags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create flags" ON user_flags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending flags" ON user_flags
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "System can create flags" ON user_flags
  FOR INSERT WITH CHECK (flag_type LIKE 'system_%');

CREATE POLICY "Admins can manage all flags" ON user_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = '***REMOVED***'
    )
  );

-- Recreate the admin_flag_queue view
CREATE VIEW admin_flag_queue AS
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
  resolver.email as resolved_by_email,
  uf.deletion_reason,
  uf.deletion_other_reason
FROM user_flags uf
JOIN solar_panels sp ON uf.panel_id = sp.id
LEFT JOIN auth.users au ON uf.user_id = au.id
LEFT JOIN auth.users resolver ON uf.resolved_by = resolver.id
WHERE uf.status = 'pending'
ORDER BY uf.created_at ASC;
