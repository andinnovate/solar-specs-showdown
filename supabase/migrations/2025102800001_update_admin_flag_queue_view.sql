-- Update admin_flag_queue view to include flag_type column
-- This migration adds the flag_type column to the view so it can be queried from the frontend

-- Drop and recreate the view to avoid column reordering issues
DROP VIEW IF EXISTS admin_flag_queue;

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
  resolver.email as resolved_by_email
FROM user_flags uf
JOIN solar_panels sp ON uf.panel_id = sp.id
LEFT JOIN auth.users au ON uf.user_id = au.id
LEFT JOIN auth.users resolver ON uf.resolved_by = resolver.id
WHERE uf.status = 'pending'
ORDER BY uf.created_at ASC;

-- Re-grant permissions
GRANT SELECT ON admin_flag_queue TO authenticated;

