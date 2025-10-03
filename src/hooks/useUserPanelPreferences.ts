import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserPanelPreferences {
  hiddenPanels: Set<string>;
  favoritePanels: Set<string>;
  loading: boolean;
}

export const useUserPanelPreferences = (userId: string | null) => {
  const [preferences, setPreferences] = useState<UserPanelPreferences>({
    hiddenPanels: new Set(),
    favoritePanels: new Set(),
    loading: true,
  });

  // Load user preferences on mount and when userId changes
  useEffect(() => {
    if (!userId) {
      setPreferences({
        hiddenPanels: new Set(),
        favoritePanels: new Set(),
        loading: false,
      });
      return;
    }

    const loadPreferences = async () => {
      try {
        // Load hidden panels
        const { data: hiddenData, error: hiddenError } = await supabase
          .from('user_panel_preferences')
          .select('panel_id')
          .eq('user_id', userId)
          .eq('is_hidden', true);

        if (hiddenError) throw hiddenError;

        // Load favorite panels
        const { data: favoriteData, error: favoriteError } = await supabase
          .from('user_favorites')
          .select('panel_id')
          .eq('user_id', userId)
          .eq('is_favorite', true);

        if (favoriteError) throw favoriteError;

        setPreferences({
          hiddenPanels: new Set(hiddenData?.map(item => item.panel_id) || []),
          favoritePanels: new Set(favoriteData?.map(item => item.panel_id) || []),
          loading: false,
        });
      } catch (error) {
        console.error('Error loading user preferences:', error);
        toast.error('Failed to load user preferences');
        setPreferences(prev => ({ ...prev, loading: false }));
      }
    };

    loadPreferences();
  }, [userId]);

  const togglePanelHidden = async (panelId: string) => {
    if (!userId) {
      toast.error('Please sign in to manage panel preferences');
      return;
    }

    try {
      const isCurrentlyHidden = preferences.hiddenPanels.has(panelId);
      
      if (isCurrentlyHidden) {
        // Remove from hidden panels
        const { error } = await supabase
          .from('user_panel_preferences')
          .delete()
          .eq('user_id', userId)
          .eq('panel_id', panelId);

        if (error) throw error;

        setPreferences(prev => ({
          ...prev,
          hiddenPanels: new Set([...prev.hiddenPanels].filter(id => id !== panelId)),
        }));
      } else {
        // Add to hidden panels
        const { error } = await supabase
          .from('user_panel_preferences')
          .upsert({
            user_id: userId,
            panel_id: panelId,
            is_hidden: true,
          });

        if (error) throw error;

        setPreferences(prev => ({
          ...prev,
          hiddenPanels: new Set([...prev.hiddenPanels, panelId]),
        }));
      }
    } catch (error) {
      console.error('Error toggling panel hidden status:', error);
      toast.error('Failed to update panel preference');
    }
  };

  const togglePanelFavorite = async (panelId: string) => {
    if (!userId) {
      toast.error('Please sign in to manage favorites');
      return;
    }

    try {
      const isCurrentlyFavorite = preferences.favoritePanels.has(panelId);
      
      if (isCurrentlyFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('panel_id', panelId);

        if (error) throw error;

        setPreferences(prev => ({
          ...prev,
          favoritePanels: new Set([...prev.favoritePanels].filter(id => id !== panelId)),
        }));
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('user_favorites')
          .upsert({
            user_id: userId,
            panel_id: panelId,
            is_favorite: true,
          });

        if (error) throw error;

        setPreferences(prev => ({
          ...prev,
          favoritePanels: new Set([...prev.favoritePanels, panelId]),
        }));
      }
    } catch (error) {
      console.error('Error toggling panel favorite status:', error);
      toast.error('Failed to update favorite');
    }
  };

  const isPanelHidden = (panelId: string) => preferences.hiddenPanels.has(panelId);
  const isPanelFavorite = (panelId: string) => preferences.favoritePanels.has(panelId);

  return {
    ...preferences,
    togglePanelHidden,
    togglePanelFavorite,
    isPanelHidden,
    isPanelFavorite,
  };
};
