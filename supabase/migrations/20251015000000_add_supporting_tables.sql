-- Add supporting tables for Python script operations

-- Price history tracking
CREATE TABLE IF NOT EXISTS price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_id UUID NOT NULL REFERENCES solar_panels(id) ON DELETE CASCADE,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'scraperapi',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simple flagged panels for review
CREATE TABLE IF NOT EXISTS flagged_panels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_id UUID NOT NULL REFERENCES solar_panels(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL,
  details TEXT,
  status VARCHAR(20) DEFAULT 'needs_review' CHECK (status IN ('needs_review', 'resolved', 'dismissed')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Script execution logs
CREATE TABLE IF NOT EXISTS script_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  script_name VARCHAR(100) NOT NULL,
  execution_id UUID NOT NULL,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data quality checks
CREATE TABLE IF NOT EXISTS data_quality_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_id UUID REFERENCES solar_panels(id) ON DELETE CASCADE,
  check_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ScraperAPI usage tracking
CREATE TABLE IF NOT EXISTS scraper_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  script_name VARCHAR(100) NOT NULL,
  asin VARCHAR(20),
  url TEXT,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for price_history (admin only)
CREATE POLICY "Admin can manage price history" ON price_history
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = '***REMOVED***');

-- RLS Policies for flagged_panels (admin only)
CREATE POLICY "Admin can manage flagged panels" ON flagged_panels
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = '***REMOVED***');

-- RLS Policies for script_logs (admin only)
CREATE POLICY "Admin can manage script logs" ON script_logs
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = '***REMOVED***');

-- RLS Policies for data_quality_checks (admin only)
CREATE POLICY "Admin can manage data quality checks" ON data_quality_checks
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = '***REMOVED***');

-- RLS Policies for scraper_usage (admin only)
CREATE POLICY "Admin can manage scraper usage" ON scraper_usage
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = '***REMOVED***');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_history_panel_id ON price_history(panel_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON price_history(created_at);
CREATE INDEX IF NOT EXISTS idx_flagged_panels_status ON flagged_panels(status);
CREATE INDEX IF NOT EXISTS idx_flagged_panels_panel_id ON flagged_panels(panel_id);
CREATE INDEX IF NOT EXISTS idx_script_logs_execution_id ON script_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_script_logs_script_name ON script_logs(script_name);
CREATE INDEX IF NOT EXISTS idx_data_quality_checks_panel_id ON data_quality_checks(panel_id);
CREATE INDEX IF NOT EXISTS idx_scraper_usage_script_name ON scraper_usage(script_name);
CREATE INDEX IF NOT EXISTS idx_scraper_usage_created_at ON scraper_usage(created_at);
