-- Add pending_flags field to solar_panels table
-- This will track only pending flags for UI display

ALTER TABLE solar_panels 
ADD COLUMN IF NOT EXISTS pending_flags INTEGER DEFAULT 0;

-- Create function to update pending_flags count
CREATE OR REPLACE FUNCTION update_panel_pending_flags()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only count pending flags
    IF NEW.status = 'pending' THEN
      UPDATE solar_panels 
      SET pending_flags = pending_flags + 1 
      WHERE id = NEW.panel_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Only decrement if it was pending
    IF OLD.status = 'pending' THEN
      UPDATE solar_panels 
      SET pending_flags = GREATEST(pending_flags - 1, 0) 
      WHERE id = OLD.panel_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle status changes that affect pending count
    IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
      UPDATE solar_panels 
      SET pending_flags = GREATEST(pending_flags - 1, 0) 
      WHERE id = NEW.panel_id;
    ELSIF OLD.status != 'pending' AND NEW.status = 'pending' THEN
      UPDATE solar_panels 
      SET pending_flags = pending_flags + 1 
      WHERE id = NEW.panel_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update pending_flags
CREATE TRIGGER trigger_update_panel_pending_flags
  AFTER INSERT OR UPDATE OR DELETE ON user_flags
  FOR EACH ROW EXECUTE FUNCTION update_panel_pending_flags();

-- Initialize pending_flags for existing data
UPDATE solar_panels 
SET pending_flags = (
  SELECT COUNT(*) 
  FROM user_flags 
  WHERE panel_id = solar_panels.id 
  AND status = 'pending'
);

-- Add comment for documentation
COMMENT ON COLUMN solar_panels.pending_flags IS 'Number of pending flags for this panel (for UI display)';
