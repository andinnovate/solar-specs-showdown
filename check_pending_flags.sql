-- Check if pending_flags field exists and initialize it
-- Run this in your Supabase SQL editor

-- Check if the field exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'solar_panels' 
AND column_name = 'pending_flags';

-- If the field doesn't exist, add it
ALTER TABLE solar_panels 
ADD COLUMN IF NOT EXISTS pending_flags INTEGER DEFAULT 0;

-- Initialize pending_flags for existing data
UPDATE solar_panels 
SET pending_flags = (
  SELECT COUNT(*) 
  FROM user_flags 
  WHERE panel_id = solar_panels.id 
  AND status = 'pending'
);

-- Check the results
SELECT id, name, pending_flags, flag_count 
FROM solar_panels 
WHERE pending_flags > 0;
