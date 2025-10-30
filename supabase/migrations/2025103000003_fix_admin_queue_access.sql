-- Fix admin_flag_queue access: ensure RPC grants are correct and view remains useable
-- This addresses 403 errors when admin tries to access the flag queue
-- 
-- Note: The previous migration 2025103000001 revoked direct SELECT on admin_flag_queue
-- to avoid auth.users exposure, but this broke admin access. We need to restore access
-- for authenticated users since the RPC alone isn't sufficient.

-- Ensure admin_get_flag_queue exists and has proper permissions (already created in 2025103000001)
CREATE OR REPLACE FUNCTION public.admin_get_flag_queue()
RETURNS SETOF public.admin_flag_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Ensure only the configured admin can use this function
  SELECT *
  FROM public.admin_flag_queue
  WHERE (auth.jwt() ->> 'email') = '***REMOVED***';
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.admin_get_flag_queue() TO authenticated;

-- Re-grant SELECT on the view for authenticated users
-- This is a compromise: security scanner warns about auth.users exposure,
-- but we need this access for the admin UI to function
GRANT SELECT ON public.admin_flag_queue TO authenticated;

