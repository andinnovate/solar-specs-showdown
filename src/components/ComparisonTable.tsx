import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";

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
}

export const ComparisonTable = ({ panels, onRemove }: ComparisonTableProps) => {
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
              {panels.map((panel) => (
                <TableHead key={panel.id} className="text-center min-w-[180px]">
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
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Wattage</TableCell>
              {panels.map((panel) => (
                <TableCell key={panel.id} className="text-center">
                  <Badge variant="secondary" className="text-base">
                    {panel.wattage}W
                  </Badge>
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Voltage</TableCell>
              {panels.map((panel) => (
                <TableCell key={panel.id} className="text-center font-medium">
                  {panel.voltage}V
                </TableCell>
              ))}
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Price</TableCell>
              {panels.map((panel) => (
                <TableCell key={panel.id} className="text-center font-bold text-lg">
                  ${panel.price_usd.toFixed(2)}
                </TableCell>
              ))}
            </TableRow>

            <TableRow className="bg-secondary/5">
              <TableCell className="font-medium">$/Watt</TableCell>
              {panels.map((panel) => {
                const metrics = calculateMetrics(panel);
                return (
                  <TableCell key={panel.id} className="text-center font-bold text-secondary text-lg">
                    ${metrics.pricePerWatt}
                  </TableCell>
                );
              })}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Dimensions (L×W)</TableCell>
              {panels.map((panel) => (
                <TableCell key={panel.id} className="text-center">
                  {panel.length_cm}cm × {panel.width_cm}cm
                </TableCell>
              ))}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Area</TableCell>
              {panels.map((panel) => {
                const metrics = calculateMetrics(panel);
                return (
                  <TableCell key={panel.id} className="text-center">
                    {metrics.areaM2}m²
                  </TableCell>
                );
              })}
            </TableRow>

            <TableRow>
              <TableCell className="font-medium">Weight</TableCell>
              {panels.map((panel) => (
                <TableCell key={panel.id} className="text-center">
                  {panel.weight_kg}kg
                </TableCell>
              ))}
            </TableRow>

            <TableRow className="bg-accent/5">
              <TableCell className="font-medium">Watts/kg</TableCell>
              {panels.map((panel) => {
                const metrics = calculateMetrics(panel);
                return (
                  <TableCell key={panel.id} className="text-center font-bold text-accent text-lg">
                    {metrics.wattsPerKg}W/kg
                  </TableCell>
                );
              })}
            </TableRow>

            <TableRow className="bg-accent/5">
              <TableCell className="font-medium">Watts/m²</TableCell>
              {panels.map((panel) => {
                const metrics = calculateMetrics(panel);
                return (
                  <TableCell key={panel.id} className="text-center font-bold text-accent text-lg">
                    {metrics.wattsPerSqM}W/m²
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
