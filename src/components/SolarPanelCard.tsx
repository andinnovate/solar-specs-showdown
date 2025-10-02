import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calculator, Zap, Weight, Ruler, ExternalLink } from "lucide-react";

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
  onCompare?: (id: string) => void;
  isComparing?: boolean;
}

export const SolarPanelCard = ({ panel, onCompare, isComparing }: SolarPanelCardProps) => {
  const pricePerWatt = (panel.price_usd / panel.wattage).toFixed(2);
  const wattsPerKg = (panel.wattage / panel.weight_kg).toFixed(2);
  const areaM2 = ((panel.length_cm * panel.width_cm) / 10000).toFixed(2);
  const wattsPerSqM = (panel.wattage / ((panel.length_cm * panel.width_cm) / 10000)).toFixed(0);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
      <div className="h-48 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 flex items-center justify-center">
        <Zap className="w-20 h-20 text-primary/30" />
      </div>
      
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{panel.name}</CardTitle>
              {panel.web_url && (
                <a 
                  href={panel.web_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/70 transition-colors"
                  aria-label="View on Amazon"
                >
                  <ExternalLink size={18} />
                </a>
              )}
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
            <span className="font-medium">{areaM2}m²</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Weight className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Weight:</span>
            <span className="font-medium">{panel.weight_kg}kg</span>
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
            <span className="text-muted-foreground">W/kg:</span>
            <span className="font-bold text-accent">{wattsPerKg}</span>
          </div>

          <div className="flex items-center gap-2 text-sm col-span-2">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-muted-foreground">W/m²:</span>
            <span className="font-bold text-accent">{wattsPerSqM}</span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-primary">
              ${panel.price_usd.toFixed(2)}
            </span>
            <Button 
              variant={isComparing ? "default" : "outline"}
              size="sm"
              onClick={() => onCompare?.(panel.id)}
            >
              {isComparing ? "✓ Selected" : "Compare"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
