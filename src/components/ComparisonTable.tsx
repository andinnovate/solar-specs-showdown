import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";
import { UnitSystem, formatDimensions, formatWeight, formatArea, formatWeightWithPieces, formatWattageWithPieces } from "@/lib/unitConversions";
import { Tables } from "@/integrations/supabase/types";

type SolarPanel = Tables<"solar_panels"> & {
  user_verified_overrides?: string[] | null;
  flag_count?: number;
  pending_flags?: number;
};

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

  const calculateMetrics = (panel: SolarPanel) => {
    // Price per watt uses total wattage (wattage × piece_count)
    const totalWattage = panel.wattage ? panel.wattage * (panel.piece_count || 1) : null;
    return {
      pricePerWatt: totalWattage && panel.price_usd ? (panel.price_usd / totalWattage).toFixed(2) : null,
      wattsPerKg: panel.wattage && panel.weight_kg ? (panel.wattage / panel.weight_kg).toFixed(2) : null,
      areaM2: panel.length_cm && panel.width_cm ? ((panel.length_cm * panel.width_cm) / 10000).toFixed(2) : null,
      wattsPerSqM: panel.wattage && panel.length_cm && panel.width_cm ? (panel.wattage / ((panel.length_cm * panel.width_cm) / 10000)).toFixed(0) : null,
    };
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto border rounded-lg w-full">
        <Table style={{ minWidth: `${200 + (panels.length * 300)}px` }}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] font-bold">Specification</TableHead>
              {panels.map((panel) => {
                const isHovered = hoveredPanelId === panel.id;
                const isHighlighted = hoveredPanelId && hoveredPanelId !== panel.id;
                
                return (
                  <TableHead 
                    key={panel.id} 
                    className={`text-center w-[300px] transition-all duration-200 ${
                      isHovered ? 'bg-blue-50 border-blue-200' : 
                      isHighlighted ? 'bg-gray-50 opacity-60' : ''
                    }`}
                    onMouseEnter={() => onPanelHover?.(panel.id)}
                    onMouseLeave={() => onPanelHover?.(null)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-2 font-bold">
                        {panel.name}
                        {panel.web_url && (() => {
                          try {
                            const domain = new URL(panel.web_url).hostname;
                            return (
                              <a 
                                href={panel.web_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:opacity-70 transition-opacity inline-flex items-center"
                                aria-label={`View on ${domain}`}
                              >
                                <img 
                                  src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
                                  alt={domain}
                                  className="w-4 h-4"
                                  onError={(e) => {
                                    // Fallback to ExternalLink icon if favicon fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const icon = document.createElement('div');
                                    icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
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
                  {panel.wattage ? (
                    <Badge variant="secondary" className="text-base">
                      {formatWattageWithPieces(panel.wattage, panel.piece_count || 1, unitSystem)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
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
                  {panel.voltage ? `${panel.voltage}V` : <span className="text-muted-foreground">N/A</span>}
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
                  {panel.price_usd === 0 ? (
                    <span className="text-orange-600">Unavailable</span>
                  ) : panel.price_usd ? (
                    `$${panel.price_usd.toFixed(2)}`
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
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
                    {metrics.pricePerWatt ? `$${metrics.pricePerWatt}` : <span className="text-muted-foreground">N/A</span>}
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
                  {panel.length_cm && panel.width_cm ? formatDimensions(panel.length_cm, panel.width_cm, unitSystem) : <span className="text-muted-foreground">N/A</span>}
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
                  {panel.length_cm && panel.width_cm ? formatArea(panel.length_cm, panel.width_cm, unitSystem) : <span className="text-muted-foreground">N/A</span>}
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
                  {panel.weight_kg ? formatWeightWithPieces(panel.weight_kg, panel.piece_count || 1, unitSystem) : <span className="text-muted-foreground">N/A</span>}
                </TableCell>
              ))}
            </TableRow>

            <TableRow className="bg-accent/5">
              <TableCell className="font-medium">Watts/{unitSystem === 'imperial' ? 'lb' : 'kg'}</TableCell>
              {panels.map((panel) => {
                const metrics = calculateMetrics(panel);
                if (metrics.wattsPerKg) {
                  const wattsPerKgNum = parseFloat(metrics.wattsPerKg);
                  const wattsPerUnit = unitSystem === 'imperial' 
                    ? (wattsPerKgNum / 0.453592).toFixed(1) // Convert kg to lb
                    : wattsPerKgNum.toFixed(2);
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
                } else {
                  return (
                    <TableCell 
                      key={panel.id} 
                      className={`${getCellClassName(panel.id)} text-muted-foreground`}
                      onMouseEnter={() => onPanelHover?.(panel.id)}
                      onMouseLeave={() => onPanelHover?.(null)}
                    >
                      N/A
                    </TableCell>
                  );
                }
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
                    {metrics.wattsPerSqM ? `${metrics.wattsPerSqM}W/${unitSystem === 'imperial' ? 'ft²' : 'm²'}` : <span className="text-muted-foreground">N/A</span>}
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
