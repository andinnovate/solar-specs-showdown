-- Add column to track which fields have been manually edited by admin
-- This prevents scrapers from overwriting admin changes
ALTER TABLE solar_panels 
ADD COLUMN IF NOT EXISTS manual_overrides jsonb DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN solar_panels.manual_overrides IS 
'Array of field names that have been manually edited by admin and should not be auto-updated by scrapers. Example: ["price_usd", "name", "wattage"]';

-- Create an index for faster queries on manual_overrides
CREATE INDEX IF NOT EXISTS idx_solar_panels_manual_overrides ON solar_panels USING gin(manual_overrides);

