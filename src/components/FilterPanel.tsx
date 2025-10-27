import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HistogramSlider } from "@/components/HistogramSlider";
import { RotateCcw, ChevronDown, ChevronRight, Star, Ruler, Filter } from "lucide-react";
import { UnitSystem, cmToInches, kgToLbs } from "@/lib/unitConversions";

interface SolarPanel {
  id: string;
  asin: string;
  name: string;
  manufacturer: string;
  length_cm: number | null;  // Now nullable
  width_cm: number | null;   // Now nullable
  weight_kg: number | null;  // Now nullable
  wattage: number | null;    // Now nullable
  voltage: number | null;
  price_usd: number | null;  // Now nullable
  piece_count?: number;       // Number of pieces in the set
  description?: string;
  image_url?: string;
  web_url?: string | null;
  missing_fields?: string[];  // NEW
}

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
    showFavoritesOnly: boolean;
    showIncomplete: boolean;  // NEW
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
  panels: SolarPanel[]; // Add panels data for histogram calculation
  favoritePanelIds?: Set<string>; // Add favorite panel IDs for filtering
  unitSystem: UnitSystem;
  onFilterChange: (filters: FilterPanelProps['filters']) => void;
  onReset: () => void;
  onUnitSystemChange: (unitSystem: UnitSystem) => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  appliedFiltersCount?: { count: number; appliedFilters: string[] };
}

export const FilterPanel = ({ filters, bounds, panels, favoritePanelIds, unitSystem, onFilterChange, onReset, onUnitSystemChange, isCollapsed, onToggleCollapsed, appliedFiltersCount }: FilterPanelProps) => {

  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Calculate derived data arrays for histograms (filter out null values)
  // Note: For price per watt, use total wattage (wattage × piece_count)
  const priceData = panels.filter(p => p.price_usd !== null).map(p => p.price_usd!);
  const pricePerWattData = panels.filter(p => p.price_usd !== null && p.wattage !== null).map(p => {
    const totalWattage = p.wattage! * (p.piece_count || 1);
    return p.price_usd! / totalWattage;
  });
  const lengthData = panels.filter(p => p.length_cm !== null).map(p => unitSystem === 'imperial' ? cmToInches(p.length_cm!) : p.length_cm!);
  const widthData = panels.filter(p => p.width_cm !== null).map(p => unitSystem === 'imperial' ? cmToInches(p.width_cm!) : p.width_cm!);
  const wattageData = panels.filter(p => p.wattage !== null).map(p => p.wattage!);
  const voltageData = panels.filter(p => p.voltage !== null).map(p => p.voltage!);
  const weightData = panels.filter(p => p.weight_kg !== null).map(p => unitSystem === 'imperial' ? kgToLbs(p.weight_kg!) : p.weight_kg!);
  const wattsPerKgData = panels.filter(p => p.wattage !== null && p.weight_kg !== null).map(p => p.wattage! / p.weight_kg!);
  const wattsPerSqMData = panels.filter(p => p.wattage !== null && p.length_cm !== null && p.width_cm !== null).map(p => p.wattage! / ((p.length_cm! * p.width_cm!) / 10000));

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
              {appliedFiltersCount && appliedFiltersCount.count > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({appliedFiltersCount.count} applied: {appliedFiltersCount.appliedFilters.join(', ')}{appliedFiltersCount.count > 3 ? '...' : ''})
                </span>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {onToggleCollapsed && (
              <Button variant="ghost" size="sm" onClick={onToggleCollapsed}>
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="space-y-6">
        {/* Top Row: Favorites and Unit Toggle */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Favorites Filter */}
          {favoritePanelIds && favoritePanelIds.size > 0 && (
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg flex-1">
              <Checkbox
                id="showFavoritesOnly"
                checked={filters.showFavoritesOnly}
                onCheckedChange={(checked) => 
                  onFilterChange({ ...filters, showFavoritesOnly: checked as boolean })
                }
              />
              <Label htmlFor="showFavoritesOnly" className="flex items-center gap-2 cursor-pointer">
                <Star className="w-4 h-4" />
                Show favorites only ({favoritePanelIds.size} panels)
              </Label>
            </div>
          )}

          {/* Show Incomplete Data Filter */}
          <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg flex-1">
            <Checkbox
              id="showIncomplete"
              checked={filters.showIncomplete}
              onCheckedChange={(checked) => 
                onFilterChange({ ...filters, showIncomplete: checked as boolean })
              }
            />
            <Label htmlFor="showIncomplete" className="flex items-center gap-2 cursor-pointer">
              <Ruler className="w-4 h-4" />
              Show panels with incomplete data
            </Label>
          </div>

          {/* Unit System Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-1">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              <span className="text-sm font-medium">Units</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={unitSystem === 'metric' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUnitSystemChange('metric')}
                className="text-xs px-3"
              >
                Metric
              </Button>
              <Button
                variant={unitSystem === 'imperial' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUnitSystemChange('imperial')}
                className="text-xs px-3"
              >
                Imperial
              </Button>
            </div>
          </div>
        </div>

        {/* Primary Filters with Histograms - Paired Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Price Pair */}
          <HistogramSlider
            label="Price (USD)"
            value={filters.priceRange}
            min={bounds.price.min}
            max={bounds.price.max}
            step={5}
            data={priceData}
            unit=""
            formatValue={(val) => `$${val}`}
            onValueChange={(value) => onFilterChange({ ...filters, priceRange: value })}
          />

          <HistogramSlider
            label="$/W (USD per Watt)"
            value={filters.pricePerWattRange}
            min={bounds.pricePerWatt.min}
            max={bounds.pricePerWatt.max}
            step={0.01}
            data={pricePerWattData}
            unit=""
            formatValue={(val) => `$${val.toFixed(2)}`}
            onValueChange={(value) => onFilterChange({ ...filters, pricePerWattRange: value })}
          />

          {/* Dimensions Pair */}
          <HistogramSlider
            label={`Length (${unitSystem === 'imperial' ? 'in' : 'cm'})`}
            value={filters.lengthRange}
            min={bounds.length.min}
            max={bounds.length.max}
            step={unitSystem === 'imperial' ? 1 : 5}
            data={lengthData}
            unit={unitSystem === 'imperial' ? 'in' : 'cm'}
            onValueChange={(value) => onFilterChange({ ...filters, lengthRange: value })}
          />

          <HistogramSlider
            label={`Width (${unitSystem === 'imperial' ? 'in' : 'cm'})`}
            value={filters.widthRange}
            min={bounds.width.min}
            max={bounds.width.max}
            step={unitSystem === 'imperial' ? 1 : 5}
            data={widthData}
            unit={unitSystem === 'imperial' ? 'in' : 'cm'}
            onValueChange={(value) => onFilterChange({ ...filters, widthRange: value })}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Electrical Pair */}
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

              {/* Weight */}
              <div>
                <HistogramSlider
                  label={`Weight (${unitSystem === 'imperial' ? 'lbs' : 'kg'})`}
                  value={filters.weightRange}
                  min={bounds.weight.min}
                  max={bounds.weight.max}
                  step={unitSystem === 'imperial' ? 1 : 0.5}
                  data={weightData}
                  unit={unitSystem === 'imperial' ? 'lbs' : 'kg'}
                  onValueChange={(value) => onFilterChange({ ...filters, weightRange: value })}
                />
              </div>

              {/* Empty placeholder to balance the grid */}
              <div></div>

              {/* Efficiency Pair */}
              <div className="space-y-2">
                <Label className="flex justify-between">
                  <span>W/{unitSystem === 'imperial' ? 'lb' : 'kg'} (Watts per {unitSystem === 'imperial' ? 'lb' : 'kg'})</span>
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
                  <span>W/{unitSystem === 'imperial' ? 'ft²' : 'm²'} (Watts per {unitSystem === 'imperial' ? 'ft²' : 'm²'})</span>
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
            </div>
          </CollapsibleContent>
        </Collapsible>
        </CardContent>
      )}
    </Card>
  );
};
