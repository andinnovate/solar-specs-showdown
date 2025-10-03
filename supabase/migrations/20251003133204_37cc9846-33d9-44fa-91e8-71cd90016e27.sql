-- Create user_panel_preferences table for hidden panels
CREATE TABLE IF NOT EXISTS user_panel_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  panel_id UUID NOT NULL REFERENCES solar_panels(id) ON DELETE CASCADE,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, panel_id)
);

-- Create user_favorites table for starred panels
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  panel_id UUID NOT NULL REFERENCES solar_panels(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, panel_id)
);

-- Enable RLS
ALTER TABLE user_panel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_panel_preferences
CREATE POLICY "Users can view their own panel preferences" ON user_panel_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own panel preferences" ON user_panel_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own panel preferences" ON user_panel_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own panel preferences" ON user_panel_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for user_favorites
CREATE POLICY "Users can view their own favorites" ON user_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites" ON user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorites" ON user_favorites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON user_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_panel_preferences_user_id ON user_panel_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_panel_preferences_panel_id ON user_panel_preferences(panel_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_panel_id ON user_favorites(panel_id);