import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";
import { UnitSystem, formatDimensions, formatWeight, formatArea } from "@/lib/unitConversions";

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
  web_url?: string | null;
}

interface ComparisonTableProps {
  panels: SolarPanel[];
  onRemove: (id: string) => void;
  unitSystem?: UnitSystem;
  hoveredPanelId?: string | null;
  onPanelHover?: (panelId: string | null) => void;
}

export const ComparisonTable = ({ panels, onRemove, unitSystem = 'metric', hoveredPanelId, onPanelHover }: ComparisonTableProps) => {
  const getCellClassName = (panelId: string) => {
    const isHovered = hoveredPanelId === panelId;
    const isHighlighted = hoveredPanelId && hoveredPanelId !== panelId;
    
    return `text-center transition-all duration-200 ${
      isHovered ? 'bg-blue-50 border-blue-200' : 
      isHighlighted ? 'bg-gray-50 opacity-60' : ''
    }`;
  };
  if (panels.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Select panels to compare their specifications side by side
      </Card>
    );
  }

  const calculateMetrics = (panel: SolarPanel) => ({
    pricePerWatt: (panel.price_usd / panel.wattage).toFixed(2),
    wattsPerKg: (panel.wattage / panel.weight_kg).toFixed(2),
    areaM2: ((panel.length_cm * panel.width_cm) / 10000).toFixed(2),
    wattsPerSqM: (panel.wattage / ((panel.length_cm * panel.width_cm) / 10000)).toFixed(0),
  });

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] font-bold">Specification</TableHead>
              {panels.map((panel) => {
                const isHovered = hoveredPanelId === panel.id;
                const isHighlighted = hoveredPanelId && hoveredPanelId !== panel.id;
                
                return (
                  <TableHead 
                    key={panel.id} 
                    className={`text-center min-w-[180px] transition-all duration-200 ${
                      isHovered ? 'bg-blue-50 border-blue-200' : 
                      isHighlighted ? 'bg-gray-50 opacity-60' : ''
                    }`}
                    onMouseEnter={() => onPanelHover?.(panel.id)}
                    onMouseLeave={() => onPanelHover?.(null)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-2 font-bold">
                        {panel.name}
                        {panel.web_url && (
                          <a 
                            href={panel.web_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/70 transition-colors"
                            aria-label="View on Amazon"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{panel.manufacturer}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(panel.id)}
                        className="mt-1"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Wattage</TableCell>
              {panels.map((panel) => (
                <TableCell 
                  key={panel.id} 
                  className={getCellClassName(panel.id)}
                  onMouseEnter={() => onPanelHover?.(panel.id)}
                  onMouseLeave={() => onPanelHover?.(null)}
                >
                  <Badge variant="secondary" className="text-base">
                    {panel.wattage}W
                  </Badge>
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Voltage</TableCell>
              {panels.map((panel) => (
                <TableCell 
                  key={panel.id} 
                  className={`${getCellClassName(panel.id)} font-medium`}
                  onMouseEnter={() => onPanelHover?.(panel.id)}
                  onMouseLeave={() => onPanelHover?.(null)}
                >
                  {panel.voltage}V
                </TableCell>
              ))}
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Price</TableCell>
              {panels.map((panel) => (
                <TableCell 
                  key={panel.id} 
                  className={`${getCellClassName(panel.id)} font-bold text-lg`}
                  onMouseEnter={() => onPanelHover?.(panel.id)}
                  onMouseLeave={() => onPanelHover?.(null)}
                >
                  ${panel.price_usd.toFixed(2)}
                </TableCell>
              ))}
            </TableRow>

            <TableRow className="bg-secondary/5">
              <TableCell className="font-medium">$/Watt</TableCell>
              {panels.map((panel) => {
                const metrics = calculateMetrics(panel);
                return (
                  <TableCell 
                    key={panel.id} 
                    className={`${getCellClassName(panel.id)} font-bold text-secondary text-lg`}
                    onMouseEnter={() => onPanelHover?.(panel.id)}
                    onMouseLeave={() => onPanelHover?.(null)}
                  >
                    ${metrics.pricePerWatt}
                  </TableCell>
                );
              })}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Dimensions (L×W)</TableCell>
              {panels.map((panel) => (
                <TableCell 
                  key={panel.id} 
                  className={getCellClassName(panel.id)}
                  onMouseEnter={() => onPanelHover?.(panel.id)}
                  onMouseLeave={() => onPanelHover?.(null)}
                >
                  {formatDimensions(panel.length_cm, panel.width_cm, unitSystem)}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Area</TableCell>
              {panels.map((panel) => (
                <TableCell 
                  key={panel.id} 
                  className={getCellClassName(panel.id)}
                  onMouseEnter={() => onPanelHover?.(panel.id)}
                  onMouseLeave={() => onPanelHover?.(null)}
                >
                  {formatArea(panel.length_cm, panel.width_cm, unitSystem)}
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Weight</TableCell>
              {panels.map((panel) => (
                <TableCell 
                  key={panel.id} 
                  className={getCellClassName(panel.id)}
                  onMouseEnter={() => onPanelHover?.(panel.id)}
                  onMouseLeave={() => onPanelHover?.(null)}
                >
                  {formatWeight(panel.weight_kg, unitSystem)}
                </TableCell>
              ))}
            </TableRow>

            <TableRow className="bg-accent/5">
              <TableCell className="font-medium">Watts/{unitSystem === 'imperial' ? 'lb' : 'kg'}</TableCell>
              {panels.map((panel) => {
                const metrics = calculateMetrics(panel);
                const wattsPerUnit = unitSystem === 'imperial' 
                  ? (metrics.wattsPerKg / 0.453592).toFixed(1) // Convert kg to lb
                  : metrics.wattsPerKg;
                return (
                  <TableCell 
                    key={panel.id} 
                    className={`${getCellClassName(panel.id)} font-bold text-accent text-lg`}
                    onMouseEnter={() => onPanelHover?.(panel.id)}
                    onMouseLeave={() => onPanelHover?.(null)}
                  >
                    {wattsPerUnit}W/{unitSystem === 'imperial' ? 'lb' : 'kg'}
                  </TableCell>
                );
              })}
            </TableRow>

            <TableRow className="bg-accent/5">
              <TableCell className="font-medium">Watts/{unitSystem === 'imperial' ? 'ft²' : 'm²'}</TableCell>
              {panels.map((panel) => {
                const metrics = calculateMetrics(panel);
                return (
                  <TableCell 
                    key={panel.id} 
                    className={`${getCellClassName(panel.id)} font-bold text-accent text-lg`}
                    onMouseEnter={() => onPanelHover?.(panel.id)}
                    onMouseLeave={() => onPanelHover?.(null)}
                  >
                    {metrics.wattsPerSqM}W/{unitSystem === 'imperial' ? 'ft²' : 'm²'}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
