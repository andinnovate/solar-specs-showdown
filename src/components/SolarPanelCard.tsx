import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calculator, Zap, Weight, Ruler, ExternalLink, Eye, EyeOff, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { UnitSystem, formatDimensions, formatWeight, formatArea } from "@/lib/unitConversions";
import { useState, useEffect } from "react";

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

interface SolarPanelCardProps {
  panel: SolarPanel;
  onToggleSelection?: (id: string) => void;
  isSelected?: boolean;
  isHidden?: boolean;
  isFavorite?: boolean;
  isFadingOut?: boolean;
  onToggleHidden?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  showUserActions?: boolean;
  unitSystem?: UnitSystem;
}

export const SolarPanelCard = ({ 
  panel, 
  onToggleSelection, 
  isSelected = false, 
  isHidden = false, 
  isFavorite = false, 
  isFadingOut = false,
  onToggleHidden, 
  onToggleFavorite, 
  showUserActions = false,
  unitSystem = 'metric'
}: SolarPanelCardProps) => {
  const pricePerWatt = (panel.price_usd / panel.wattage).toFixed(2);
  const wattsPerKg = (panel.wattage / panel.weight_kg).toFixed(2);
  const areaM2 = ((panel.length_cm * panel.width_cm) / 10000).toFixed(2);
  const wattsPerSqM = (panel.wattage / ((panel.length_cm * panel.width_cm) / 10000)).toFixed(0);

  return (
    <Card className={`overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
      isFadingOut ? 'opacity-0 scale-95' : isHidden ? 'opacity-50' : 'opacity-100'
    }`}>
      <div className="h-48 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 flex items-center justify-center relative overflow-hidden">
        {panel.image_url ? (
          <img 
            src={panel.image_url} 
            alt={`${panel.name} by ${panel.manufacturer}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
            }}
          />
        ) : (
          <Zap className="w-20 h-20 text-primary/30" />
        )}
        {isHidden && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <EyeOff className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        {showUserActions && (
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 bg-background/80 hover:bg-background"
              onClick={() => onToggleHidden?.(panel.id)}
              title={isHidden ? "Show panel" : "Hide panel"}
            >
              {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 bg-background/80 hover:bg-background"
              onClick={() => onToggleFavorite?.(panel.id)}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </Button>
          </div>
        )}
      </div>
      
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl flex-1 min-w-0">{panel.name}</CardTitle>
              {panel.web_url && (() => {
                try {
                  const domain = new URL(panel.web_url).hostname;
                  return (
                    <a 
                      href={panel.web_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:opacity-70 transition-opacity inline-flex items-center flex-shrink-0"
                      aria-label={`View on ${domain}`}
                      title={`View on ${domain}`}
                    >
                      <img 
                        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
                        alt={domain}
                        className="w-5 h-5 flex-shrink-0"
                        onError={(e) => {
                          // Fallback to ExternalLink icon if favicon fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const icon = document.createElement('div');
                          icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
                          target.parentElement?.appendChild(icon.firstChild!);
                        }}
                      />
                    </a>
                  );
                } catch {
                  return null;
                }
              })()}
            </div>
            <CardDescription>{panel.manufacturer}</CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg font-bold">
            {panel.wattage}W
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {panel.description}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Ruler className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Size:</span>
            <span className="font-medium">{formatArea(panel.length_cm, panel.width_cm, unitSystem)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Weight className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Weight:</span>
            <span className="font-medium">{formatWeight(panel.weight_kg, unitSystem)}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Voltage:</span>
            <span className="font-medium">{panel.voltage}V</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calculator className="w-4 h-4 text-secondary" />
            <span className="text-muted-foreground">$/W:</span>
            <span className="font-bold text-secondary">${pricePerWatt}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-muted-foreground">W/{unitSystem === 'imperial' ? 'lb' : 'kg'}:</span>
            <span className="font-bold text-accent">
              {unitSystem === 'imperial' ? (parseFloat(wattsPerKg) / 0.453592).toFixed(1) : wattsPerKg}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm col-span-2">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-muted-foreground">W/{unitSystem === 'imperial' ? 'ft²' : 'm²'}:</span>
            <span className="font-bold text-accent">{wattsPerSqM}</span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-primary">
              ${panel.price_usd.toFixed(2)}
            </span>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`select-${panel.id}`}
                checked={isSelected}
                onCheckedChange={() => onToggleSelection?.(panel.id)}
              />
              <label 
                htmlFor={`select-${panel.id}`} 
                className="text-sm font-medium cursor-pointer"
              >
                Select for comparison
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
