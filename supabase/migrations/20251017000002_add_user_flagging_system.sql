-- User Flagging System Migration
-- Allows users to flag incorrect panel information and suggest corrections

-- Create user_flags table
CREATE TABLE IF NOT EXISTS user_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID NOT NULL REFERENCES solar_panels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flagged_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_corrections JSONB DEFAULT '{}'::jsonb,
  user_comment TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Add user_verified_overrides to solar_panels table
ALTER TABLE solar_panels 
ADD COLUMN IF NOT EXISTS user_verified_overrides JSONB DEFAULT '[]'::jsonb;

-- Add flag count for quick UI display
ALTER TABLE solar_panels 
ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_flags_panel_id ON user_flags(panel_id);
CREATE INDEX IF NOT EXISTS idx_user_flags_user_id ON user_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_flags_status ON user_flags(status);
CREATE INDEX IF NOT EXISTS idx_user_flags_created_at ON user_flags(created_at DESC);

-- Create GIN index for JSONB fields
CREATE INDEX IF NOT EXISTS idx_user_flags_flagged_fields ON user_flags USING gin(flagged_fields);
CREATE INDEX IF NOT EXISTS idx_user_flags_suggested_corrections ON user_flags USING gin(suggested_corrections);
CREATE INDEX IF NOT EXISTS idx_solar_panels_user_verified_overrides ON solar_panels USING gin(user_verified_overrides);

-- Add comments for documentation
COMMENT ON TABLE user_flags IS 'User-submitted flags for incorrect panel information';
COMMENT ON COLUMN user_flags.flagged_fields IS 'Array of field names that were flagged as incorrect (e.g., ["name", "price_usd", "wattage"])';
COMMENT ON COLUMN user_flags.suggested_corrections IS 'Object with suggested corrections for flagged fields (e.g., {"name": "Correct Name", "price_usd": 79.99})';
COMMENT ON COLUMN user_flags.status IS 'Flag status: pending, approved, rejected, resolved';
COMMENT ON COLUMN solar_panels.user_verified_overrides IS 'Array of field names verified by users and protected from scraper updates';
COMMENT ON COLUMN solar_panels.flag_count IS 'Number of active flags for this panel (for quick UI display)';

-- Create function to update flag_count when flags are added/removed
CREATE OR REPLACE FUNCTION update_panel_flag_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE solar_panels 
    SET flag_count = flag_count + 1 
    WHERE id = NEW.panel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE solar_panels 
    SET flag_count = GREATEST(flag_count - 1, 0) 
    WHERE id = OLD.panel_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle status changes that affect flag count
    IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
      UPDATE solar_panels 
      SET flag_count = GREATEST(flag_count - 1, 0) 
      WHERE id = NEW.panel_id;
    ELSIF OLD.status != 'pending' AND NEW.status = 'pending' THEN
      UPDATE solar_panels 
      SET flag_count = flag_count + 1 
      WHERE id = NEW.panel_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update flag_count
CREATE TRIGGER trigger_update_panel_flag_count
  AFTER INSERT OR UPDATE OR DELETE ON user_flags
  FOR EACH ROW EXECUTE FUNCTION update_panel_flag_count();

-- Create function to update user_verified_overrides when flags are approved
CREATE OR REPLACE FUNCTION update_user_verified_overrides()
RETURNS TRIGGER AS $$
DECLARE
  current_overrides JSONB;
  new_overrides JSONB;
BEGIN
  -- Only process when status changes to 'approved'
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    -- Get current user_verified_overrides
    SELECT user_verified_overrides INTO current_overrides 
    FROM solar_panels 
    WHERE id = NEW.panel_id;
    
    -- Merge with new flagged fields (excluding price_usd which should remain fluid)
    new_overrides := current_overrides || (
      SELECT jsonb_agg(value) 
      FROM jsonb_array_elements(NEW.flagged_fields) 
      WHERE value != '"price_usd"'::jsonb
    );
    
    -- Update the panel
    UPDATE solar_panels 
    SET 
      user_verified_overrides = new_overrides,
      updated_at = NOW()
    WHERE id = NEW.panel_id;
    
    -- Apply suggested corrections if provided
    IF NEW.suggested_corrections IS NOT NULL AND jsonb_typeof(NEW.suggested_corrections) = 'object' THEN
      UPDATE solar_panels 
      SET 
        name = COALESCE((NEW.suggested_corrections->>'name')::text, name),
        manufacturer = COALESCE((NEW.suggested_corrections->>'manufacturer')::text, manufacturer),
        wattage = COALESCE((NEW.suggested_corrections->>'wattage')::integer, wattage),
        voltage = COALESCE((NEW.suggested_corrections->>'voltage')::numeric, voltage),
        length_cm = COALESCE((NEW.suggested_corrections->>'length_cm')::numeric, length_cm),
        width_cm = COALESCE((NEW.suggested_corrections->>'width_cm')::numeric, width_cm),
        weight_kg = COALESCE((NEW.suggested_corrections->>'weight_kg')::numeric, weight_kg),
        web_url = COALESCE((NEW.suggested_corrections->>'web_url')::text, web_url),
        image_url = COALESCE((NEW.suggested_corrections->>'image_url')::text, image_url),
        description = COALESCE((NEW.suggested_corrections->>'description')::text, description),
        updated_at = NOW()
      WHERE id = NEW.panel_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update user_verified_overrides when flags are approved
CREATE TRIGGER trigger_update_user_verified_overrides
  AFTER UPDATE ON user_flags
  FOR EACH ROW EXECUTE FUNCTION update_user_verified_overrides();

-- Create view for admin flag queue
CREATE OR REPLACE VIEW admin_flag_queue AS
SELECT 
  uf.id,
  uf.panel_id,
  uf.user_id,
  uf.flagged_fields,
  uf.suggested_corrections,
  uf.user_comment,
  uf.status,
  uf.admin_note,
  uf.created_at,
  uf.updated_at,
  uf.resolved_at,
  uf.resolved_by,
  sp.name as panel_name,
  sp.manufacturer,
  sp.wattage,
  sp.price_usd,
  au.email as user_email,
  resolver.email as resolved_by_email
FROM user_flags uf
JOIN solar_panels sp ON uf.panel_id = sp.id
LEFT JOIN auth.users au ON uf.user_id = au.id
LEFT JOIN auth.users resolver ON uf.resolved_by = resolver.id
WHERE uf.status = 'pending'
ORDER BY uf.created_at ASC;

-- Grant permissions
GRANT SELECT ON admin_flag_queue TO authenticated;
GRANT ALL ON user_flags TO authenticated;
GRANT SELECT ON user_flags TO anon;

-- Add RLS policies
ALTER TABLE user_flags ENABLE ROW LEVEL SECURITY;

-- Users can only see their own flags
CREATE POLICY "Users can view their own flags" ON user_flags
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own flags
CREATE POLICY "Users can create flags" ON user_flags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending flags
CREATE POLICY "Users can update their own pending flags" ON user_flags
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Admins can do everything
CREATE POLICY "Admins can manage all flags" ON user_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = '***REMOVED***'
    )
  );
