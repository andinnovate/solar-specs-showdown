-- Fix voltage column to handle large system voltage values
-- Some products report "Maximum Voltage" as system voltage (e.g. 1000V) 
-- rather than panel operating voltage (e.g. 12V, 24V)

ALTER TABLE public.solar_panels 
ALTER COLUMN voltage TYPE DECIMAL(8,2);

-- Update comment to clarify this field may contain system voltage
COMMENT ON COLUMN public.solar_panels.voltage IS 'Panel voltage in volts - may be operating voltage (12V-48V) or maximum system voltage (up to 1000V+)';

