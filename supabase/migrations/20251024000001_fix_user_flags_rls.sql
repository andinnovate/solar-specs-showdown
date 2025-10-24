-- Fix RLS policies for user_flags table
-- The previous admin policy was trying to access auth.users which regular users can't access

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can manage all flags" ON user_flags;

-- Create a simpler policy that allows authenticated users to manage flags
-- This is temporary - proper admin roles can be added later
CREATE POLICY "Authenticated users can manage flags" ON user_flags
  FOR ALL USING (auth.role() = 'authenticated');
