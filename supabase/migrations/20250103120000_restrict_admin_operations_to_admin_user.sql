-- Migration: Restrict admin operations to admin user only
-- This migration updates RLS policies to ensure only the designated admin user
-- can perform INSERT, UPDATE, and DELETE operations on solar_panels table

-- Drop existing policies that allow all authenticated users to modify solar_panels
DROP POLICY IF EXISTS "Authenticated users can insert solar panels" ON public.solar_panels;
DROP POLICY IF EXISTS "Authenticated users can update solar panels" ON public.solar_panels;
DROP POLICY IF EXISTS "Authenticated users can delete solar panels" ON public.solar_panels;

-- Create new policies that restrict admin operations to admin user only
CREATE POLICY "Only admin can insert solar panels" 
ON public.solar_panels 
FOR INSERT 
TO authenticated
WITH CHECK (auth.jwt() ->> 'email' = '***REMOVED***');

CREATE POLICY "Only admin can update solar panels" 
ON public.solar_panels 
FOR UPDATE 
TO authenticated
USING (auth.jwt() ->> 'email' = '***REMOVED***');

CREATE POLICY "Only admin can delete solar panels" 
ON public.solar_panels 
FOR DELETE 
TO authenticated
USING (auth.jwt() ->> 'email' = '***REMOVED***');

-- Keep the existing read policy for all users
-- (The "Anyone can view solar panels" policy should already exist)

-- Add comments for clarity
COMMENT ON POLICY "Only admin can insert solar panels" ON public.solar_panels IS 'Restricts solar panel creation to admin user only';
COMMENT ON POLICY "Only admin can update solar panels" ON public.solar_panels IS 'Restricts solar panel updates to admin user only';
COMMENT ON POLICY "Only admin can delete solar panels" ON public.solar_panels IS 'Restricts solar panel deletion to admin user only';
