import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SolarPanelCard } from "@/components/SolarPanelCard";
import { FilterPanel } from "@/components/FilterPanel";
import { ComparisonTable } from "@/components/ComparisonTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Sun, Grid, Table } from "lucide-react";
import { toast } from "sonner";

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

const Index = () => {
  const [panels, setPanels] = useState<SolarPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  
  const [filters, setFilters] = useState({
    wattageRange: [0, 1000] as [number, number],
    voltageRange: [0, 100] as [number, number],
    priceRange: [0, 1000] as [number, number],
    weightRange: [0, 100] as [number, number],
    lengthRange: [0, 300] as [number, number],
    widthRange: [0, 200] as [number, number],
    pricePerWattRange: [0, 10] as [number, number],
    wattsPerKgRange: [0, 100] as [number, number],
    wattsPerSqMRange: [0, 300] as [number, number],
  });

  useEffect(() => {
    loadPanels();
  }, []);

  const loadPanels = async () => {
    try {
      const { data, error } = await supabase
        .from('solar_panels')
        .select('*')
        .order('wattage', { ascending: false });

      if (error) throw error;
      setPanels(data || []);
      
      // Set initial filter bounds based on data
      if (data && data.length > 0) {
        const wattages = data.map(p => p.wattage);
        const voltages = data.map(p => p.voltage);
        const prices = data.map(p => p.price_usd);
        const weights = data.map(p => p.weight_kg);
        const lengths = data.map(p => p.length_cm);
        const widths = data.map(p => p.width_cm);
        const pricePerWatts = data.map(p => p.price_usd / p.wattage);
        const wattsPerKgs = data.map(p => p.wattage / p.weight_kg);
        const wattsPerSqMs = data.map(p => p.wattage / ((p.length_cm * p.width_cm) / 10000));
        
        setFilters({
          wattageRange: [Math.min(...wattages), Math.max(...wattages)],
          voltageRange: [Math.min(...voltages), Math.max(...voltages)],
          priceRange: [Math.min(...prices), Math.max(...prices)],
          weightRange: [Math.min(...weights), Math.max(...weights)],
          lengthRange: [Math.min(...lengths), Math.max(...lengths)],
          widthRange: [Math.min(...widths), Math.max(...widths)],
          pricePerWattRange: [Math.min(...pricePerWatts), Math.max(...pricePerWatts)],
          wattsPerKgRange: [Math.min(...wattsPerKgs), Math.max(...wattsPerKgs)],
          wattsPerSqMRange: [Math.min(...wattsPerSqMs), Math.max(...wattsPerSqMs)],
        });
      }
    } catch (error) {
      console.error('Error loading panels:', error);
      toast.error('Failed to load solar panels');
    } finally {
      setLoading(false);
    }
  };

  const bounds = useMemo(() => {
    if (panels.length === 0) {
      return {
        wattage: { min: 0, max: 1000 },
        voltage: { min: 0, max: 100 },
        price: { min: 0, max: 1000 },
        weight: { min: 0, max: 100 },
        length: { min: 0, max: 300 },
        width: { min: 0, max: 200 },
        pricePerWatt: { min: 0, max: 10 },
        wattsPerKg: { min: 0, max: 100 },
        wattsPerSqM: { min: 0, max: 300 },
      };
    }
    
    const pricePerWatts = panels.map(p => p.price_usd / p.wattage);
    const wattsPerKgs = panels.map(p => p.wattage / p.weight_kg);
    const wattsPerSqMs = panels.map(p => p.wattage / ((p.length_cm * p.width_cm) / 10000));
    
    return {
      wattage: {
        min: Math.min(...panels.map(p => p.wattage)),
        max: Math.max(...panels.map(p => p.wattage))
      },
      voltage: {
        min: Math.min(...panels.map(p => p.voltage)),
        max: Math.max(...panels.map(p => p.voltage))
      },
      price: {
        min: Math.min(...panels.map(p => p.price_usd)),
        max: Math.max(...panels.map(p => p.price_usd))
      },
      weight: {
        min: Math.min(...panels.map(p => p.weight_kg)),
        max: Math.max(...panels.map(p => p.weight_kg))
      },
      length: {
        min: Math.min(...panels.map(p => p.length_cm)),
        max: Math.max(...panels.map(p => p.length_cm))
      },
      width: {
        min: Math.min(...panels.map(p => p.width_cm)),
        max: Math.max(...panels.map(p => p.width_cm))
      },
      pricePerWatt: {
        min: Math.min(...pricePerWatts),
        max: Math.max(...pricePerWatts)
      },
      wattsPerKg: {
        min: Math.min(...wattsPerKgs),
        max: Math.max(...wattsPerKgs)
      },
      wattsPerSqM: {
        min: Math.min(...wattsPerSqMs),
        max: Math.max(...wattsPerSqMs)
      },
    };
  }, [panels]);

  const filteredPanels = useMemo(() => {
    return panels.filter(panel => {
      const pricePerWatt = panel.price_usd / panel.wattage;
      const wattsPerKg = panel.wattage / panel.weight_kg;
      const wattsPerSqM = panel.wattage / ((panel.length_cm * panel.width_cm) / 10000);
      
      return panel.wattage >= filters.wattageRange[0] &&
        panel.wattage <= filters.wattageRange[1] &&
        panel.voltage >= filters.voltageRange[0] &&
        panel.voltage <= filters.voltageRange[1] &&
        panel.price_usd >= filters.priceRange[0] &&
        panel.price_usd <= filters.priceRange[1] &&
        panel.weight_kg >= filters.weightRange[0] &&
        panel.weight_kg <= filters.weightRange[1] &&
        panel.length_cm >= filters.lengthRange[0] &&
        panel.length_cm <= filters.lengthRange[1] &&
        panel.width_cm >= filters.widthRange[0] &&
        panel.width_cm <= filters.widthRange[1] &&
        pricePerWatt >= filters.pricePerWattRange[0] &&
        pricePerWatt <= filters.pricePerWattRange[1] &&
        wattsPerKg >= filters.wattsPerKgRange[0] &&
        wattsPerKg <= filters.wattsPerKgRange[1] &&
        wattsPerSqM >= filters.wattsPerSqMRange[0] &&
        wattsPerSqM <= filters.wattsPerSqMRange[1];
    });
  }, [panels, filters]);

  const comparedPanels = useMemo(() => {
    return panels.filter(p => compareIds.includes(p.id));
  }, [panels, compareIds]);

  const handleCompare = (id: string) => {
    setCompareIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const resetFilters = () => {
    setFilters({
      wattageRange: [bounds.wattage.min, bounds.wattage.max],
      voltageRange: [bounds.voltage.min, bounds.voltage.max],
      priceRange: [bounds.price.min, bounds.price.max],
      weightRange: [bounds.weight.min, bounds.weight.max],
      lengthRange: [bounds.length.min, bounds.length.max],
      widthRange: [bounds.width.min, bounds.width.max],
      pricePerWattRange: [bounds.pricePerWatt.min, bounds.pricePerWatt.max],
      wattsPerKgRange: [bounds.wattsPerKg.min, bounds.wattsPerKg.max],
      wattsPerSqMRange: [bounds.wattsPerSqM.min, bounds.wattsPerSqM.max],
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Sun className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary">
              <Sun className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Solar Panel Comparison
              </h1>
              <p className="text-muted-foreground">
                Compare specs, efficiency, and value
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          {/* Filters Sidebar */}
          <aside>
            <FilterPanel 
              filters={filters}
              bounds={bounds}
              onFilterChange={setFilters}
              onReset={resetFilters}
            />
          </aside>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Stats Bar */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-bold text-foreground">{filteredPanels.length}</span> of {panels.length} panels
              </div>
              {compareIds.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => setCompareIds([])}
                >
                  Clear Comparison ({compareIds.length})
                </Button>
              )}
            </div>

            {/* Comparison Table */}
            {compareIds.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Table className="w-5 h-5" />
                  Comparison
                </h2>
                <ComparisonTable 
                  panels={comparedPanels}
                  onRemove={(id) => handleCompare(id)}
                />
                <Separator className="my-6" />
              </div>
            )}

            {/* Panels Grid */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Grid className="w-5 h-5" />
                All Panels
              </h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredPanels.map(panel => (
                  <SolarPanelCard 
                    key={panel.id}
                    panel={panel}
                    onCompare={handleCompare}
                    isComparing={compareIds.includes(panel.id)}
                  />
                ))}
              </div>
            </div>

            {filteredPanels.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No panels match your filters. Try adjusting the filter ranges.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
