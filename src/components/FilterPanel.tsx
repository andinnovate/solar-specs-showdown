import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface FilterPanelProps {
  filters: {
    wattageRange: [number, number];
    priceRange: [number, number];
    weightRange: [number, number];
  };
  bounds: {
    wattage: { min: number; max: number };
    price: { min: number; max: number };
    weight: { min: number; max: number };
  };
  onFilterChange: (filters: FilterPanelProps['filters']) => void;
  onReset: () => void;
}

export const FilterPanel = ({ filters, bounds, onFilterChange, onReset }: FilterPanelProps) => {
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
      </CardContent>
    </Card>
  );
};
