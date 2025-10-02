import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

interface FilterPanelProps {
  filters: {
    wattageRange: [number, number];
    voltageRange: [number, number];
    priceRange: [number, number];
    weightRange: [number, number];
    lengthRange: [number, number];
    widthRange: [number, number];
    pricePerWattRange: [number, number];
    wattsPerKgRange: [number, number];
    wattsPerSqMRange: [number, number];
  };
  bounds: {
    wattage: { min: number; max: number };
    voltage: { min: number; max: number };
    price: { min: number; max: number };
    weight: { min: number; max: number };
    length: { min: number; max: number };
    width: { min: number; max: number };
    pricePerWatt: { min: number; max: number };
    wattsPerKg: { min: number; max: number };
    wattsPerSqM: { min: number; max: number };
  };
  onFilterChange: (filters: FilterPanelProps['filters']) => void;
  onReset: () => void;
}

export const FilterPanel = ({ filters, bounds, onFilterChange, onReset }: FilterPanelProps) => {
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Filters */}
        <div className="space-y-2">
          <Label className="flex justify-between">
            <span>Price (USD)</span>
            <span className="font-mono text-sm text-muted-foreground">
              ${filters.priceRange[0]} - ${filters.priceRange[1]}
            </span>
          </Label>
          <Slider
            min={bounds.price.min}
            max={bounds.price.max}
            step={5}
            value={filters.priceRange}
            onValueChange={(value) => 
              onFilterChange({ ...filters, priceRange: value as [number, number] })
            }
            className="py-4"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex justify-between">
            <span>Length (cm)</span>
            <span className="font-mono text-sm text-muted-foreground">
              {filters.lengthRange[0]}cm - {filters.lengthRange[1]}cm
            </span>
          </Label>
          <Slider
            min={bounds.length.min}
            max={bounds.length.max}
            step={5}
            value={filters.lengthRange}
            onValueChange={(value) => 
              onFilterChange({ ...filters, lengthRange: value as [number, number] })
            }
            className="py-4"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex justify-between">
            <span>Width (cm)</span>
            <span className="font-mono text-sm text-muted-foreground">
              {filters.widthRange[0]}cm - {filters.widthRange[1]}cm
            </span>
          </Label>
          <Slider
            min={bounds.width.min}
            max={bounds.width.max}
            step={5}
            value={filters.widthRange}
            onValueChange={(value) => 
              onFilterChange({ ...filters, widthRange: value as [number, number] })
            }
            className="py-4"
          />
        </div>

        {/* More Filters Collapsible Section */}
        <Collapsible open={showMoreFilters} onOpenChange={setShowMoreFilters}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <span className="text-sm font-medium">More Filters</span>
              {showMoreFilters ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Wattage</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {filters.wattageRange[0]}W - {filters.wattageRange[1]}W
                </span>
              </Label>
              <Slider
                min={bounds.wattage.min}
                max={bounds.wattage.max}
                step={10}
                value={filters.wattageRange}
                onValueChange={(value) => 
                  onFilterChange({ ...filters, wattageRange: value as [number, number] })
                }
                className="py-4"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Voltage</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {filters.voltageRange[0]}V - {filters.voltageRange[1]}V
                </span>
              </Label>
              <Slider
                min={bounds.voltage.min}
                max={bounds.voltage.max}
                step={0.5}
                value={filters.voltageRange}
                onValueChange={(value) => 
                  onFilterChange({ ...filters, voltageRange: value as [number, number] })
                }
                className="py-4"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Weight (kg)</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {filters.weightRange[0]}kg - {filters.weightRange[1]}kg
                </span>
              </Label>
              <Slider
                min={bounds.weight.min}
                max={bounds.weight.max}
                step={0.5}
                value={filters.weightRange}
                onValueChange={(value) => 
                  onFilterChange({ ...filters, weightRange: value as [number, number] })
                }
                className="py-4"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>$/W (USD per Watt)</span>
                <span className="font-mono text-sm text-muted-foreground">
                  ${filters.pricePerWattRange[0].toFixed(2)} - ${filters.pricePerWattRange[1].toFixed(2)}
                </span>
              </Label>
              <Slider
                min={bounds.pricePerWatt.min}
                max={bounds.pricePerWatt.max}
                step={0.01}
                value={filters.pricePerWattRange}
                onValueChange={(value) => 
                  onFilterChange({ ...filters, pricePerWattRange: value as [number, number] })
                }
                className="py-4"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>W/kg (Watts per kg)</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {filters.wattsPerKgRange[0].toFixed(1)} - {filters.wattsPerKgRange[1].toFixed(1)}
                </span>
              </Label>
              <Slider
                min={bounds.wattsPerKg.min}
                max={bounds.wattsPerKg.max}
                step={0.5}
                value={filters.wattsPerKgRange}
                onValueChange={(value) => 
                  onFilterChange({ ...filters, wattsPerKgRange: value as [number, number] })
                }
                className="py-4"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>W/m² (Watts per m²)</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {filters.wattsPerSqMRange[0].toFixed(0)} - {filters.wattsPerSqMRange[1].toFixed(0)}
                </span>
              </Label>
              <Slider
                min={bounds.wattsPerSqM.min}
                max={bounds.wattsPerSqM.max}
                step={1}
                value={filters.wattsPerSqMRange}
                onValueChange={(value) => 
                  onFilterChange({ ...filters, wattsPerSqMRange: value as [number, number] })
                }
                className="py-4"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
