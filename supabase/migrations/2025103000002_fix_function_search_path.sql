-- Ensure public functions use a fixed, safe search_path and invoker security
-- This mitigates "role mutable search_path" warnings and prevents hijacking via search_path

-- 1) Simple helper functions
ALTER FUNCTION public.asin_exists(VARCHAR)
  SET search_path = public;
ALTER FUNCTION public.extract_asin_from_url(TEXT)
  SET search_path = public;
ALTER FUNCTION public.get_pending_asins(INTEGER)
  SET search_path = public;

ALTER FUNCTION public.asin_exists(VARCHAR)
  SECURITY INVOKER;
ALTER FUNCTION public.extract_asin_from_url(TEXT)
  SECURITY INVOKER;
ALTER FUNCTION public.get_pending_asins(INTEGER)
  SECURITY INVOKER;

-- 2) Trigger functions
ALTER FUNCTION public.update_panel_flag_count()
  SET search_path = public;
ALTER FUNCTION public.update_user_verified_overrides()
  SET search_path = public;
ALTER FUNCTION public.update_panel_pending_flags()
  SET search_path = public;
ALTER FUNCTION public.update_raw_scraper_data_updated_at()
  SET search_path = public;

ALTER FUNCTION public.update_panel_flag_count()
  SECURITY INVOKER;
ALTER FUNCTION public.update_user_verified_overrides()
  SECURITY INVOKER;
ALTER FUNCTION public.update_panel_pending_flags()
  SECURITY INVOKER;
ALTER FUNCTION public.update_raw_scraper_data_updated_at()
  SECURITY INVOKER;


