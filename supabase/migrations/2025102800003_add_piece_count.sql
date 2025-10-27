-- Add piece_count column to solar_panels table
-- This column indicates how many pieces are included in the panel set
-- Default value is 1 for single panel products

ALTER TABLE public.solar_panels 
ADD COLUMN piece_count INTEGER NOT NULL DEFAULT 1;

-- Update existing panels to have piece_count = 1
UPDATE public.solar_panels 
SET piece_count = 1 
WHERE piece_count IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.solar_panels.piece_count IS 'Number of pieces in the panel set (default: 1 for single panel products)';

