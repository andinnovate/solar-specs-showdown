-- Add web_url column to solar_panels table
ALTER TABLE public.solar_panels 
ADD COLUMN web_url TEXT;

-- Update existing panels with sample Amazon URLs
UPDATE public.solar_panels 
SET web_url = CASE 
  WHEN name = 'Hyperion 400' THEN 'https://www.amazon.com/dp/example1'
  WHEN name = 'PowerMax 500' THEN 'https://www.amazon.com/dp/example2'
  WHEN name = 'EcoSolar 350' THEN 'https://www.amazon.com/dp/example3'
  WHEN name = 'UltraVolt 450' THEN 'https://www.amazon.com/dp/example4'
  WHEN name = 'Titan 550' THEN 'https://www.amazon.com/dp/example5'
  WHEN name = 'FlexiPanel 300' THEN 'https://www.amazon.com/dp/example6'
END;