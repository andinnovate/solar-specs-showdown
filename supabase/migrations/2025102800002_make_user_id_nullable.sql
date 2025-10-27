-- Make user_id nullable to allow system-generated flags
-- This allows the system to create admin review flags without a user_id

ALTER TABLE user_flags 
  ALTER COLUMN user_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN user_flags.user_id IS 'User ID for user-submitted flags; NULL for system-generated flags';

