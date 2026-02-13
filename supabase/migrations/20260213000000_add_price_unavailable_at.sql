-- Flag panels that returned $0 (product unavailable) so update_prices skips them for a period.
-- Cleared when a non-zero price is successfully applied.

ALTER TABLE public.solar_panels
ADD COLUMN IF NOT EXISTS price_unavailable_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.solar_panels.price_unavailable_at IS 'Set when price update got $0 (product unavailable); panel is skipped for --price-unavailable-skip-days until retried';

CREATE INDEX IF NOT EXISTS idx_solar_panels_price_unavailable_at
ON public.solar_panels(price_unavailable_at)
WHERE price_unavailable_at IS NOT NULL;
