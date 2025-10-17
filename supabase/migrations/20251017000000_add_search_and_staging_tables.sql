-- Add search discovery and ASIN staging infrastructure
-- This enables the search → stage → ingest workflow

-- =====================================================
-- 1. ADD ASIN COLUMN TO SOLAR_PANELS
-- =====================================================

-- Add ASIN column for efficient lookups and deduplication
ALTER TABLE public.solar_panels 
ADD COLUMN IF NOT EXISTS asin VARCHAR(20) UNIQUE;

-- Extract ASINs from existing web_url values
-- Pattern: https://www.amazon.com/dp/B0C99GS958
UPDATE public.solar_panels
SET asin = SUBSTRING(web_url FROM '/dp/([A-Z0-9]{10})')
WHERE web_url IS NOT NULL 
  AND web_url LIKE '%/dp/%'
  AND asin IS NULL;

-- Create index for fast ASIN lookups
CREATE INDEX IF NOT EXISTS idx_solar_panels_asin ON public.solar_panels(asin);

-- =====================================================
-- 2. SEARCH KEYWORDS TABLE
-- =====================================================

-- Tracks search queries and their results
CREATE TABLE IF NOT EXISTS public.search_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  search_type VARCHAR(50) DEFAULT 'amazon' CHECK (search_type IN ('amazon', 'google', 'manual', 'other')),
  results_count INTEGER,
  asins_found TEXT[], -- Array of ASINs discovered
  search_metadata JSONB, -- Full search response for analysis
  script_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for search_keywords
CREATE INDEX IF NOT EXISTS idx_search_keywords_keyword ON public.search_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_search_keywords_created_at ON public.search_keywords(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_keywords_type ON public.search_keywords(search_type);

-- Enable RLS
ALTER TABLE public.search_keywords ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only can manage, anyone can view for transparency)
CREATE POLICY "Anyone can view search keywords" ON public.search_keywords
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage search keywords" ON public.search_keywords
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = '***REMOVED***');

-- =====================================================
-- 3. ASIN STAGING TABLE
-- =====================================================

-- Staging queue for ASINs pending detail ingestion
CREATE TABLE IF NOT EXISTS public.asin_staging (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asin VARCHAR(20) NOT NULL UNIQUE,
  source VARCHAR(50) NOT NULL CHECK (source IN ('search', 'manual', 'competitor', 'csv', 'other')),
  source_keyword TEXT, -- What search keyword discovered this
  search_id UUID REFERENCES public.search_keywords(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 0, -- Higher priority = process sooner
  status VARCHAR(20) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped', 'duplicate')),
  panel_id UUID REFERENCES public.solar_panels(id) ON DELETE SET NULL, -- Set after successful ingestion
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  ingested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for asin_staging
CREATE INDEX IF NOT EXISTS idx_asin_staging_asin ON public.asin_staging(asin);
CREATE INDEX IF NOT EXISTS idx_asin_staging_status ON public.asin_staging(status);
CREATE INDEX IF NOT EXISTS idx_asin_staging_priority ON public.asin_staging(priority DESC);
CREATE INDEX IF NOT EXISTS idx_asin_staging_source ON public.asin_staging(source);
CREATE INDEX IF NOT EXISTS idx_asin_staging_search_id ON public.asin_staging(search_id);
CREATE INDEX IF NOT EXISTS idx_asin_staging_created_at ON public.asin_staging(created_at DESC);

-- Composite index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_asin_staging_queue 
  ON public.asin_staging(status, priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.asin_staging ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only can manage, anyone can view staging status)
CREATE POLICY "Anyone can view asin staging" ON public.asin_staging
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage asin staging" ON public.asin_staging
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = '***REMOVED***');

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

-- Trigger to update asin_staging.updated_at
CREATE TRIGGER update_asin_staging_updated_at
BEFORE UPDATE ON public.asin_staging
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to check if ASIN exists in solar_panels
CREATE OR REPLACE FUNCTION public.asin_exists(check_asin VARCHAR(20))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.solar_panels WHERE asin = check_asin
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to extract ASIN from Amazon URL
CREATE OR REPLACE FUNCTION public.extract_asin_from_url(url TEXT)
RETURNS VARCHAR(20) AS $$
DECLARE
  asin_match TEXT;
BEGIN
  -- Extract ASIN pattern from URL: /dp/B0C99GS958
  asin_match := SUBSTRING(url FROM '/dp/([A-Z0-9]{10})');
  RETURN asin_match;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get pending ASINs for ingestion (ordered by priority)
CREATE OR REPLACE FUNCTION public.get_pending_asins(batch_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  asin VARCHAR(20),
  source VARCHAR(50),
  source_keyword TEXT,
  priority INTEGER,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.asin,
    s.source,
    s.source_keyword,
    s.priority,
    s.attempts
  FROM public.asin_staging s
  WHERE s.status = 'pending'
    AND s.attempts < s.max_attempts
  ORDER BY s.priority DESC, s.created_at ASC
  LIMIT batch_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON TABLE public.search_keywords IS 'Tracks search queries performed for product discovery';
COMMENT ON TABLE public.asin_staging IS 'Staging queue for ASINs pending product detail ingestion';
COMMENT ON COLUMN public.solar_panels.asin IS 'Amazon Standard Identification Number for product lookups';

COMMENT ON COLUMN public.asin_staging.priority IS 'Higher values are processed first (0=normal, 100=high priority)';
COMMENT ON COLUMN public.asin_staging.status IS 'pending=queued, processing=in progress, completed=done, failed=error, skipped=ignored, duplicate=already exists';
COMMENT ON COLUMN public.asin_staging.attempts IS 'Number of times ingestion has been attempted';

COMMENT ON FUNCTION public.asin_exists IS 'Check if an ASIN already exists in solar_panels table';
COMMENT ON FUNCTION public.extract_asin_from_url IS 'Extract ASIN from Amazon product URL';
COMMENT ON FUNCTION public.get_pending_asins IS 'Get batch of pending ASINs for ingestion, ordered by priority';

-- =====================================================
-- 7. SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Example: Stage some ASINs for testing
-- INSERT INTO public.asin_staging (asin, source, source_keyword, priority) VALUES
--   ('B0C99GS958', 'manual', 'test solar panel', 10),
--   ('B0CB9X9XX1', 'manual', 'test solar panel', 5);

-- Example: Log a search
-- INSERT INTO public.search_keywords (keyword, results_count, asins_found) VALUES
--   ('solar panel 400w', 20, ARRAY['B0C99GS958', 'B0CB9X9XX1', 'B0D2RT4S3B']);

