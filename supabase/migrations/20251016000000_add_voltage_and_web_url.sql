-- Add voltage and web_url columns to solar_panels table
-- These fields are populated by the ScraperAPI

ALTER TABLE public.solar_panels 
ADD COLUMN IF NOT EXISTS voltage DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS web_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.solar_panels.voltage IS 'Panel voltage in volts (e.g., 12V, 24V)';
COMMENT ON COLUMN public.solar_panels.web_url IS 'URL to product page on Amazon or other retailer';

-- Add index on web_url for quick lookups
CREATE INDEX IF NOT EXISTS idx_solar_panels_web_url ON public.solar_panels(web_url);

