import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Star, Trash2, AlertCircle } from "lucide-react";
import { UnitSystem, formatDimensions, formatWeight, formatArea } from "@/lib/unitConversions";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SolarPanel {
  id: string;
  name: string;
  manufacturer: string;
  length_cm: number;
  width_cm: number;
  weight_kg: number;
  wattage: number;
  voltage: number;
  price_usd: number;
  description?: string;
  image_url?: string;
  web_url?: string | null;
}

interface UserManagementProps {
  userId: string;
  unitSystem?: UnitSystem;
}

export const UserManagement = ({ userId, unitSystem = 'metric' }: UserManagementProps) => {
  const [hiddenPanels, setHiddenPanels] = useState<SolarPanel[]>([]);
  const [favoritePanels, setFavoritePanels] = useState<SolarPanel[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async () => {
    try {
      setLoading(true);

      // Load hidden panels with panel details
      const { data: hiddenData, error: hiddenError } = await supabase
        .from('user_panel_preferences')
        .select(`
          panel_id,
          solar_panels (
            id, name, manufacturer, length_cm, width_cm, weight_kg, 
            wattage, voltage, price_usd, description, image_url, web_url
          )
        `)
        .eq('user_id', userId)
        .eq('is_hidden', true);

      if (hiddenError) throw hiddenError;

      // Load favorite panels with panel details
      const { data: favoriteData, error: favoriteError } = await supabase
        .from('user_favorites')
        .select(`
          panel_id,
          solar_panels (
            id, name, manufacturer, length_cm, width_cm, weight_kg, 
            wattage, voltage, price_usd, description, image_url, web_url
          )
        `)
        .eq('user_id', userId)
        .eq('is_favorite', true);

      if (favoriteError) throw favoriteError;

      setHiddenPanels(hiddenData?.map(item => item.solar_panels).filter(Boolean) || []);
      setFavoritePanels(favoriteData?.map(item => item.solar_panels).filter(Boolean) || []);
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const removeFromHidden = async (panelId: string) => {
    try {
      const { error } = await supabase
        .from('user_panel_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('panel_id', panelId);

      if (error) throw error;

      setHiddenPanels(prev => prev.filter(panel => panel.id !== panelId));
      toast.success('Panel restored');
    } catch (error) {
      console.error('Error removing from hidden:', error);
      toast.error('Failed to restore panel');
    }
  };

  const removeFromFavorites = async (panelId: string) => {
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('panel_id', panelId);

      if (error) throw error;

      setFavoritePanels(prev => prev.filter(panel => panel.id !== panelId));
      toast.success('Removed from favorites');
    } catch (error) {
      console.error('Error removing from favorites:', error);
      toast.error('Failed to remove from favorites');
    }
  };

  const clearAllHidden = async () => {
    try {
      const { error } = await supabase
        .from('user_panel_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('is_hidden', true);

      if (error) throw error;

      setHiddenPanels([]);
      toast.success('All hidden panels restored');
    } catch (error) {
      console.error('Error clearing hidden panels:', error);
      toast.error('Failed to clear hidden panels');
    }
  };

  const clearAllFavorites = async () => {
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('is_favorite', true);

      if (error) throw error;

      setFavoritePanels([]);
      toast.success('All favorites removed');
    } catch (error) {
      console.error('Error clearing favorites:', error);
      toast.error('Failed to clear favorites');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Your Panel Preferences</h2>
        <p className="text-muted-foreground">
          Manage your hidden panels and favorite solar panels.
        </p>
      </div>

      <Tabs defaultValue="favorites" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="favorites" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Favorites ({favoritePanels.length})
          </TabsTrigger>
          <TabsTrigger value="hidden" className="flex items-center gap-2">
            <EyeOff className="w-4 h-4" />
            Hidden ({hiddenPanels.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="favorites" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Favorite Panels</h3>
            {favoritePanels.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFavorites}
                className="text-destructive hover:text-destructive"
              >
                Clear All
              </Button>
            )}
          </div>

          {favoritePanels.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You haven't starred any panels yet. Star panels you like to see them here.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {favoritePanels.map(panel => (
                <Card key={panel.id} className="overflow-hidden">
                  {panel.image_url && (
                    <div className="h-32 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 flex items-center justify-center overflow-hidden">
                      <img 
                        src={panel.image_url} 
                        alt={`${panel.name} by ${panel.manufacturer}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{panel.name}</CardTitle>
                        <CardDescription>{panel.manufacturer}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        {panel.wattage}W
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-semibold">${panel.price_usd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">$/W:</span>
                      <span className="font-semibold">${(panel.price_usd / panel.wattage).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Size:</span>
                      <span className="font-semibold">
                        {formatArea(panel.length_cm, panel.width_cm, unitSystem)}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFromFavorites(panel.id)}
                      className="w-full text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove from Favorites
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="hidden" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Hidden Panels</h3>
            {hiddenPanels.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllHidden}
                className="text-destructive hover:text-destructive"
              >
                Restore All
              </Button>
            )}
          </div>

          {hiddenPanels.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You haven't hidden any panels yet. Hide panels you don't want to see in your search results.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {hiddenPanels.map(panel => (
                <Card key={panel.id} className="overflow-hidden opacity-75">
                  {panel.image_url && (
                    <div className="h-32 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 flex items-center justify-center overflow-hidden">
                      <img 
                        src={panel.image_url} 
                        alt={`${panel.name} by ${panel.manufacturer}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{panel.name}</CardTitle>
                        <CardDescription>{panel.manufacturer}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        {panel.wattage}W
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-semibold">${panel.price_usd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">$/W:</span>
                      <span className="font-semibold">${(panel.price_usd / panel.wattage).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Size:</span>
                      <span className="font-semibold">
                        {formatArea(panel.length_cm, panel.width_cm, unitSystem)}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFromHidden(panel.id)}
                      className="w-full"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Restore Panel
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
