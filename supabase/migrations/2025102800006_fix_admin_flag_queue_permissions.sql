-- Migration: Fix user_flags table permissions for flag submission
-- This migration ensures users can submit flags without permission errors

-- Ensure user_flags table has proper permissions
GRANT ALL ON user_flags TO authenticated;
GRANT SELECT ON user_flags TO anon;

-- Make sure RLS is enabled on user_flags
ALTER TABLE user_flags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own flags" ON user_flags;
DROP POLICY IF EXISTS "Users can create flags" ON user_flags;
DROP POLICY IF EXISTS "Users can update their own pending flags" ON user_flags;
DROP POLICY IF EXISTS "System can create flags" ON user_flags;
DROP POLICY IF EXISTS "Admins can manage all flags" ON user_flags;

-- Create simple policies that don't require auth.users access
-- Users can create flags
CREATE POLICY "Users can create flags" ON user_flags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own flags
CREATE POLICY "Users can view their own flags" ON user_flags
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own pending flags
CREATE POLICY "Users can update their own pending flags" ON user_flags
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Grant permissions on the admin view (for authenticated users only)
GRANT SELECT ON admin_flag_queue TO authenticated;
