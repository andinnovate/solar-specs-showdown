-- Option A hardening for admin flag queue access
-- 1) Remove direct view exposure
-- 2) Keep RPC access for authenticated users with strict internal admin authz
-- 3) Eliminate auth.users dependency from exposed admin queue surface

-- Public-safe user profile table used by admin queue (no direct auth.users joins)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_profiles IS 'Public-safe subset of auth.users fields for app joins';
COMMENT ON COLUMN public.user_profiles.id IS 'Auth user id';
COMMENT ON COLUMN public.user_profiles.email IS 'User email (safe field for admin queue display)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email
  ON public.user_profiles(email)
  WHERE email IS NOT NULL;

-- Keep table private by default
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated;

-- Keep profiles in sync with auth.users
CREATE OR REPLACE FUNCTION public.sync_user_profiles_from_auth_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_profiles
    WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.user_profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.created_at, NOW()), NOW())
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Backfill existing users
INSERT INTO public.user_profiles (id, email, created_at, updated_at)
SELECT id, email, COALESCE(created_at, NOW()), NOW()
FROM auth.users
ON CONFLICT (id)
DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();

-- Trigger for ongoing sync
DROP TRIGGER IF EXISTS sync_user_profiles_from_auth_users ON auth.users;
CREATE TRIGGER sync_user_profiles_from_auth_users
AFTER INSERT OR UPDATE OR DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_profiles_from_auth_users();

-- Rebuild admin queue view without auth.users dependency
-- admin_get_flag_queue() returns SETOF admin_flag_queue and therefore depends on
-- the view's composite row type. Drop it before replacing the view.
DROP FUNCTION IF EXISTS public.admin_get_flag_queue();

DROP VIEW IF EXISTS public.admin_flag_queue;

CREATE VIEW public.admin_flag_queue AS
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
  sp.name AS panel_name,
  sp.manufacturer,
  sp.wattage,
  sp.price_usd,
  up.email AS user_email,
  resolver.email AS resolved_by_email,
  uf.deletion_reason,
  uf.deletion_other_reason
FROM public.user_flags uf
JOIN public.solar_panels sp ON uf.panel_id = sp.id
LEFT JOIN public.user_profiles up ON uf.user_id = up.id
LEFT JOIN public.user_profiles resolver ON uf.resolved_by = resolver.id
WHERE uf.status = 'pending'
ORDER BY uf.created_at ASC;

-- Remove direct view access for API roles
REVOKE SELECT ON public.admin_flag_queue FROM PUBLIC, anon, authenticated;

-- Secure RPC accessor with explicit admin authz
CREATE OR REPLACE FUNCTION public.admin_get_flag_queue()
RETURNS SETOF public.admin_flag_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role or explicitly-admin users only
  IF auth.role() = 'service_role'
     OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
     OR (auth.jwt() ->> 'email') = '***REMOVED***' THEN
    RETURN QUERY
    SELECT *
    FROM public.admin_flag_queue;
  END IF;

  RAISE EXCEPTION 'forbidden'
    USING ERRCODE = '42501', MESSAGE = 'admin access required';
END;
$$;

-- Reset and re-grant function execution in a controlled way (Option A)
REVOKE EXECUTE ON FUNCTION public.admin_get_flag_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_flag_queue() TO authenticated;
