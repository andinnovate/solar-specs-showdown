-- Create solar_panels table
CREATE TABLE public.solar_panels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  length_cm DECIMAL(6,2) NOT NULL,
  width_cm DECIMAL(6,2) NOT NULL,
  weight_kg DECIMAL(6,2) NOT NULL,
  wattage INTEGER NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.solar_panels ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view solar panels)
CREATE POLICY "Anyone can view solar panels" 
ON public.solar_panels 
FOR SELECT 
USING (true);

-- Only authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can insert solar panels" 
ON public.solar_panels 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update solar panels" 
ON public.solar_panels 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete solar panels" 
ON public.solar_panels 
FOR DELETE 
TO authenticated
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_solar_panels_updated_at
BEFORE UPDATE ON public.solar_panels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.solar_panels (name, manufacturer, length_cm, width_cm, weight_kg, wattage, price_usd, description) VALUES
('Hyperion 400', 'SolarTech', 172.0, 113.0, 21.5, 400, 280.00, 'High-efficiency monocrystalline panel with exceptional low-light performance'),
('PowerMax 500', 'SunPower Pro', 200.0, 113.0, 28.0, 500, 375.00, 'Premium bifacial panel with industry-leading efficiency'),
('EcoSolar 350', 'GreenWatt', 165.0, 99.0, 18.5, 350, 210.00, 'Budget-friendly panel with reliable performance'),
('UltraVolt 450', 'VoltEdge', 180.0, 113.0, 23.0, 450, 315.00, 'Advanced PERC technology with superior temperature coefficient'),
('Titan 550', 'MegaSolar', 220.0, 113.0, 32.0, 550, 440.00, 'Maximum power output for commercial applications'),
('FlexiPanel 300', 'FlexWatt', 160.0, 100.0, 16.0, 300, 195.00, 'Lightweight and portable design for mobile applications');
