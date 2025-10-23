-- Add table to track filtered/rejected ASINs
-- This helps monitor filtering effectiveness and audit trail

CREATE TABLE IF NOT EXISTS filtered_asins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asin VARCHAR(10) NOT NULL,
    filter_stage VARCHAR(20) NOT NULL CHECK (filter_stage IN ('search', 'ingest')),
    filter_reason VARCHAR(100) NOT NULL,
    product_name TEXT,
    product_url TEXT,
    wattage INTEGER,
    confidence FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(50) DEFAULT 'system'
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_filtered_asins_asin ON filtered_asins(asin);
CREATE INDEX IF NOT EXISTS idx_filtered_asins_stage ON filtered_asins(filter_stage);
CREATE INDEX IF NOT EXISTS idx_filtered_asins_reason ON filtered_asins(filter_reason);
CREATE INDEX IF NOT EXISTS idx_filtered_asins_created_at ON filtered_asins(created_at);

-- Add comments
COMMENT ON TABLE filtered_asins IS 'Tracks ASINs that were filtered out during search or ingest stages';
COMMENT ON COLUMN filtered_asins.filter_stage IS 'Stage where filtering occurred: search or ingest';
COMMENT ON COLUMN filtered_asins.filter_reason IS 'Reason for filtering: non_solar_panel, low_wattage, accessory, etc.';
COMMENT ON COLUMN filtered_asins.confidence IS 'Confidence level of filtering decision (0.0 to 1.0)';
COMMENT ON COLUMN filtered_asins.wattage IS 'Wattage extracted from product name (if available)';

-- Add RLS (Row Level Security) if needed
-- ALTER TABLE filtered_asins ENABLE ROW LEVEL SECURITY;
