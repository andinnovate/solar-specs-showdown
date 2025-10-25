-- Add table to store raw ScraperAPI JSON data for each ASIN
-- This enables future analysis and categorization improvements

CREATE TABLE IF NOT EXISTS public.raw_scraper_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asin VARCHAR(20) NOT NULL,
  panel_id UUID REFERENCES public.solar_panels(id) ON DELETE CASCADE,
  scraper_response JSONB NOT NULL, -- Raw JSON response from ScraperAPI
  scraper_version VARCHAR(20) DEFAULT 'v1', -- Track API version for future compatibility
  response_size_bytes INTEGER, -- Size of JSON response for monitoring
  processing_metadata JSONB, -- Additional metadata about the scraping process
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_scraper_data_asin ON public.raw_scraper_data(asin);
CREATE INDEX IF NOT EXISTS idx_raw_scraper_data_panel_id ON public.raw_scraper_data(panel_id);
CREATE INDEX IF NOT EXISTS idx_raw_scraper_data_created_at ON public.raw_scraper_data(created_at);

-- Add GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_raw_scraper_data_response_gin ON public.raw_scraper_data USING GIN (scraper_response);

-- Add unique constraint to prevent duplicate data for same ASIN
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_scraper_data_asin_unique ON public.raw_scraper_data(asin);

-- Add comments
COMMENT ON TABLE public.raw_scraper_data IS 'Stores raw ScraperAPI JSON responses for each ASIN to enable future analysis and categorization improvements';
COMMENT ON COLUMN public.raw_scraper_data.scraper_response IS 'Complete JSON response from ScraperAPI containing all product data';
COMMENT ON COLUMN public.raw_scraper_data.scraper_version IS 'Version of ScraperAPI used for future compatibility';
COMMENT ON COLUMN public.raw_scraper_data.response_size_bytes IS 'Size of JSON response for monitoring and optimization';
COMMENT ON COLUMN public.raw_scraper_data.processing_metadata IS 'Additional metadata about scraping process (timing, retries, etc.)';

-- Add trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_raw_scraper_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_raw_scraper_data_updated_at
BEFORE UPDATE ON public.raw_scraper_data
FOR EACH ROW
EXECUTE FUNCTION public.update_raw_scraper_data_updated_at();

-- Add RLS (Row Level Security) - same as solar_panels
ALTER TABLE public.raw_scraper_data ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view raw data)
CREATE POLICY "Anyone can view raw scraper data" 
ON public.raw_scraper_data 
FOR SELECT 
USING (true);

-- Only admin can insert/update/delete (same as solar_panels)
CREATE POLICY "Only admin can insert raw scraper data" 
ON public.raw_scraper_data 
FOR INSERT 
TO authenticated
WITH CHECK (auth.jwt() ->> 'email' = '***REMOVED***');

CREATE POLICY "Only admin can update raw scraper data" 
ON public.raw_scraper_data 
FOR UPDATE 
TO authenticated
USING (auth.jwt() ->> 'email' = '***REMOVED***');

CREATE POLICY "Only admin can delete raw scraper data" 
ON public.raw_scraper_data 
FOR DELETE 
TO authenticated
USING (auth.jwt() ->> 'email' = '***REMOVED***');
