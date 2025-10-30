-- Security hardening: enable RLS on filtered_asins and restrict admin_flag_queue access

-- 1) Enable RLS on filtered_asins and add minimal policies
DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'filtered_asins';
  IF FOUND THEN
    -- Enable RLS (idempotent-safe)
    ALTER TABLE public.filtered_asins ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "service_role full access" ON public.filtered_asins;
    DROP POLICY IF EXISTS "admins can read" ON public.filtered_asins;

    -- Allow service role to do anything (ingestion/automation)
    CREATE POLICY "service_role full access" ON public.filtered_asins
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');

    -- Allow admin to read for debugging/analytics in UI
    CREATE POLICY "admins can read" ON public.filtered_asins
      FOR SELECT
      USING ((auth.jwt() ->> 'email') = '***REMOVED***');
  END IF;
END $$;

-- 2) Restrict access to admin_flag_queue view and provide SAFE accessor
-- Revoke broad grants
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'admin_flag_queue'
  ) THEN
    REVOKE ALL ON public.admin_flag_queue FROM PUBLIC;
    REVOKE ALL ON public.admin_flag_queue FROM anon;
    REVOKE ALL ON public.admin_flag_queue FROM authenticated;
  END IF;
END $$;

-- Create a SECURITY DEFINER function that enforces admin check and returns the view rows
-- It avoids granting direct SELECT on the view that joins auth.users, reducing data exposure risk.
CREATE OR REPLACE FUNCTION public.admin_get_flag_queue()
RETURNS SETOF public.admin_flag_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Ensure only the configured admin can use this function
  SELECT *
  FROM public.admin_flag_queue
  WHERE (auth.jwt() ->> 'email') = '***REMOVED***';
$$;

-- Allow authenticated clients to call the function (the internal admin check applies)
GRANT EXECUTE ON FUNCTION public.admin_get_flag_queue() TO authenticated;

-- Note: Do NOT re-grant SELECT on the view itself.


