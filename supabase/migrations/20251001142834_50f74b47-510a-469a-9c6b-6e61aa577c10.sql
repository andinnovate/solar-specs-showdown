-- Add voltage column to solar_panels table
ALTER TABLE public.solar_panels 
ADD COLUMN voltage DECIMAL(5,2);

-- Update existing panels with realistic voltage values
UPDATE public.solar_panels 
SET voltage = CASE 
  WHEN name = 'Hyperion 400' THEN 40.5
  WHEN name = 'PowerMax 500' THEN 48.2
  WHEN name = 'EcoSolar 350' THEN 38.0
  WHEN name = 'UltraVolt 450' THEN 42.8
  WHEN name = 'Titan 550' THEN 51.0
  WHEN name = 'FlexiPanel 300' THEN 35.6
  ELSE 40.0
END;