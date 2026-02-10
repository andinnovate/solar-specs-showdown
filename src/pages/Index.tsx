import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SolarPanelCard } from "@/components/SolarPanelCard";
import { FilterPanel } from "@/components/FilterPanel";
import { ComparisonTable } from "@/components/ComparisonTable";
import { VisualComparison } from "@/components/VisualComparison";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sun, Grid, Table, List, ArrowUpDown, User, Settings, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useUserPanelPreferences } from "@/hooks/useUserPanelPreferences";
import {
  UnitSystem,
  formatDimensions,
  formatWeight,
  wattsPerWeight,
  wattsPerArea,
  convertWattsPerWeightValue,
  convertWattsPerAreaValue,
} from "@/lib/unitConversions";
import { isAdminUser } from "@/lib/adminUtils";
import { Tables } from "@/integrations/supabase/types";
import { addAmazonAffiliateTag } from "@/lib/utils";

type SolarPanel = Tables<"solar_panels"> & {
  user_verified_overrides?: string[] | null;
  flag_count?: number;
  pending_flags?: number;
};

type ViewMode = 'cards' | 'list';
type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'wattage-asc' | 'wattage-desc' | 'efficiency-asc' | 'efficiency-desc' | 'value-asc' | 'value-desc';

const Index = () => {
  const [panels, setPanels] = useState<SolarPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  
  const handlePanelHover = (panelId: string | null) => {
    setHoveredPanelId(panelId);
  };

  const getAppliedFiltersCount = () => {
    let count = 0;
    const appliedFilters: string[] = [];

    // Check each filter range to see if it's not at default bounds
    if (filters.wattageRange[0] !== bounds.wattage.min || filters.wattageRange[1] !== bounds.wattage.max) {
      count++;
      appliedFilters.push('Wattage');
    }
    if (filters.voltageRange[0] !== bounds.voltage.min || filters.voltageRange[1] !== bounds.voltage.max) {
      count++;
      appliedFilters.push('Voltage');
    }
    if (filters.priceRange[0] !== bounds.price.min || filters.priceRange[1] !== bounds.price.max) {
      count++;
      appliedFilters.push('Price');
    }
    if (filters.pricePerWattRange[0] !== bounds.pricePerWatt.min || filters.pricePerWattRange[1] !== bounds.pricePerWatt.max) {
      count++;
      appliedFilters.push('$/W');
    }
    if (filters.lengthRange[0] !== bounds.length.min || filters.lengthRange[1] !== bounds.length.max) {
      count++;
      appliedFilters.push('Length');
    }
    if (filters.widthRange[0] !== bounds.width.min || filters.widthRange[1] !== bounds.width.max) {
      count++;
      appliedFilters.push('Width');
    }
    if (filters.weightRange[0] !== bounds.weight.min || filters.weightRange[1] !== bounds.weight.max) {
      count++;
      appliedFilters.push('Weight');
    }
    if (filters.wattsPerKgRange[0] !== bounds.wattsPerKg.min || filters.wattsPerKgRange[1] !== bounds.wattsPerKg.max) {
      count++;
      appliedFilters.push(unitSystem === 'imperial' ? 'W/lb' : 'W/kg');
    }
    if (filters.wattsPerSqMRange[0] !== bounds.wattsPerSqM.min || filters.wattsPerSqMRange[1] !== bounds.wattsPerSqM.max) {
      count++;
      appliedFilters.push(unitSystem === 'imperial' ? 'W/ft²' : 'W/m²');
    }
    if (filters.showFavoritesOnly) {
      count++;
      appliedFilters.push('Favorites');
    }

    return { count, appliedFilters: appliedFilters.slice(0, 3) }; // Show max 3 filter names
  };
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [user, setUser] = useState<{ id?: string; email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [fadingOutPanels, setFadingOutPanels] = useState<Set<string>>(new Set());
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => {
    // Load from localStorage, default to 'metric'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('solar-panel-unit-system');
      return (saved as UnitSystem) || 'metric';
    }
    return 'metric';
  });
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  // Wrapper function to save unit system to localStorage
  const handleUnitSystemChange = (newUnitSystem: UnitSystem) => {
    if (newUnitSystem !== unitSystem) {
      setFilters(prev => {
        const wattsPerKgRange: [number, number] = [
          convertWattsPerWeightValue(prev.wattsPerKgRange[0], unitSystem, newUnitSystem),
          convertWattsPerWeightValue(prev.wattsPerKgRange[1], unitSystem, newUnitSystem),
        ].map(value =>
          newUnitSystem === 'imperial'
            ? Math.round(value * 10) / 10
            : Math.round(value * 100) / 100
        ) as [number, number];

        const wattsPerSqMRange: [number, number] = [
          convertWattsPerAreaValue(prev.wattsPerSqMRange[0], unitSystem, newUnitSystem),
          convertWattsPerAreaValue(prev.wattsPerSqMRange[1], unitSystem, newUnitSystem),
        ].map(value =>
          newUnitSystem === 'imperial'
            ? Math.round(value * 10) / 10
            : Math.round(value)
        ) as [number, number];

        return {
          ...prev,
          wattsPerKgRange,
          wattsPerSqMRange,
        };
      });
    }
    setUnitSystem(newUnitSystem);
    if (typeof window !== 'undefined') {
      localStorage.setItem('solar-panel-unit-system', newUnitSystem);
    }
  };
  
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
    showFavoritesOnly: false,
    showIncomplete: true,  // NEW: Default to showing incomplete panels
  });

  // Initialize user preferences hook
  const {
    hiddenPanels,
    favoritePanels,
    loading: preferencesLoading,
    togglePanelHidden,
    togglePanelFavorite,
    isPanelHidden,
    isPanelFavorite,
  } = useUserPanelPreferences(user?.id);

  useEffect(() => {
    loadPanels();
    
    // Check auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsAdmin(isAdminUser(user));
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAdmin(isAdminUser(currentUser));
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadPanels = async () => {
    try {
      const { data, error } = await supabase
        .from('solar_panels')
        .select('*')
        .order('wattage', { ascending: false });

      if (error) throw error;
      // Transform data to match SolarPanel interface, including piece_count default
      const transformedData = (data || []).map(panel => {
        const missingFields = Array.isArray(panel.missing_fields)
          ? (panel.missing_fields as string[])
          : null;
        const verifiedOverrides = Array.isArray(panel.user_verified_overrides)
          ? (panel.user_verified_overrides as string[])
          : null;

        return {
          ...panel,
          piece_count: panel.piece_count ?? 1,
          missing_fields: missingFields,
          user_verified_overrides: verifiedOverrides,
          flag_count: panel.flag_count ?? 0,
          pending_flags: panel.pending_flags ?? 0
        };
      });
      setPanels(transformedData);
      
      // Set initial filter bounds based on transformed data (matching bounds logic)
      if (transformedData && transformedData.length > 0) {
        // Filter out null values for calculations (matching bounds logic)
        const validWattages = transformedData.filter(p => p.wattage !== null).map(p => p.wattage!);
        const validVoltages = transformedData.filter(p => p.voltage !== null).map(p => p.voltage!);
        const validPrices = transformedData.filter(p => p.price_usd !== null).map(p => p.price_usd!);
        const validWeights = transformedData.filter(p => p.weight_kg !== null).map(p => p.weight_kg!);
        const validLengths = transformedData.filter(p => p.length_cm !== null).map(p => p.length_cm!);
        const validWidths = transformedData.filter(p => p.width_cm !== null).map(p => p.width_cm!);
        const validPricePerWatts = transformedData.filter(p => p.price_usd !== null && p.wattage !== null).map(p => {
          const totalWattage = p.wattage! * (p.piece_count || 1);
          return p.price_usd! / totalWattage;
        });
        const validWattsPerKgs = transformedData
          .map(p => wattsPerWeight(p.wattage ?? null, p.weight_kg ?? null, unitSystem))
          .filter((value): value is number => value !== null);
        const validWattsPerSqMs = transformedData
          .map(p => wattsPerArea(p.wattage ?? null, p.length_cm ?? null, p.width_cm ?? null, unitSystem))
          .filter((value): value is number => value !== null);
        
        setFilters({
          wattageRange: validWattages.length > 0 ? [Math.min(...validWattages), Math.max(...validWattages)] : [0, 1000],
          voltageRange: validVoltages.length > 0 ? [Math.min(...validVoltages), Math.max(...validVoltages)] : [0, 100],
          priceRange: validPrices.length > 0 ? [Math.min(...validPrices), Math.max(...validPrices)] : [0, 1000],
          weightRange: validWeights.length > 0 ? [Math.min(...validWeights), Math.max(...validWeights)] : [0, 100],
          lengthRange: validLengths.length > 0 ? [Math.min(...validLengths), Math.max(...validLengths)] : [0, 300],
          widthRange: validWidths.length > 0 ? [Math.min(...validWidths), Math.max(...validWidths)] : [0, 200],
          pricePerWattRange: validPricePerWatts.length > 0 ? [Math.min(...validPricePerWatts), Math.max(...validPricePerWatts)] : [0, 10],
          wattsPerKgRange: validWattsPerKgs.length > 0 ? [Math.min(...validWattsPerKgs), Math.max(...validWattsPerKgs)] : [0, 100],
          wattsPerSqMRange: validWattsPerSqMs.length > 0 ? [Math.min(...validWattsPerSqMs), Math.max(...validWattsPerSqMs)] : [0, 300],
          showFavoritesOnly: false,
          showIncomplete: true,  // NEW: Reset to showing incomplete panels
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
    
    // Filter out null values for calculations
    const validWattages = panels.filter(p => p.wattage !== null).map(p => p.wattage!);
    const validVoltages = panels.filter(p => p.voltage !== null).map(p => p.voltage!);
    const validPrices = panels.filter(p => p.price_usd !== null).map(p => p.price_usd!);
    const validWeights = panels.filter(p => p.weight_kg !== null).map(p => p.weight_kg!);
    const validLengths = panels.filter(p => p.length_cm !== null).map(p => p.length_cm!);
    const validWidths = panels.filter(p => p.width_cm !== null).map(p => p.width_cm!);
    const pricePerWatts = panels.filter(p => p.price_usd !== null && p.wattage !== null).map(p => {
      const totalWattage = p.wattage! * (p.piece_count || 1);
      return p.price_usd! / totalWattage;
    });
    const wattsPerKgs = panels
      .map(p => wattsPerWeight(p.wattage ?? null, p.weight_kg ?? null, unitSystem))
      .filter((value): value is number => value !== null);
    const wattsPerSqMs = panels
      .map(p => wattsPerArea(p.wattage ?? null, p.length_cm ?? null, p.width_cm ?? null, unitSystem))
      .filter((value): value is number => value !== null);
    
    return {
      wattage: validWattages.length > 0 ? {
        min: Math.min(...validWattages),
        max: Math.max(...validWattages)
      } : { min: 0, max: 1000 },
      voltage: validVoltages.length > 0 ? {
        min: Math.min(...validVoltages),
        max: Math.max(...validVoltages)
      } : { min: 0, max: 100 },
      price: validPrices.length > 0 ? {
        min: Math.min(...validPrices),
        max: Math.max(...validPrices)
      } : { min: 0, max: 1000 },
      weight: validWeights.length > 0 ? {
        min: Math.min(...validWeights),
        max: Math.max(...validWeights)
      } : { min: 0, max: 100 },
      length: validLengths.length > 0 ? {
        min: Math.min(...validLengths),
        max: Math.max(...validLengths)
      } : { min: 0, max: 300 },
      width: validWidths.length > 0 ? {
        min: Math.min(...validWidths),
        max: Math.max(...validWidths)
      } : { min: 0, max: 200 },
      pricePerWatt: pricePerWatts.length > 0 ? {
        min: Math.min(...pricePerWatts),
        max: Math.max(...pricePerWatts)
      } : { min: 0, max: 10 },
      wattsPerKg: wattsPerKgs.length > 0 ? {
        min: Math.min(...wattsPerKgs),
        max: Math.max(...wattsPerKgs)
      } : { min: 0, max: 100 },
      wattsPerSqM: wattsPerSqMs.length > 0 ? {
        min: Math.min(...wattsPerSqMs),
        max: Math.max(...wattsPerSqMs)
      } : { min: 0, max: 300 },
    };
  }, [panels, unitSystem]);

  const filteredPanels = useMemo(() => {
    return panels.filter(panel => {
      // Filter out hidden panels if user is logged in (but keep fading out panels for animation)
      if (user && isPanelHidden(panel.id) && !fadingOutPanels.has(panel.id)) {
        return false;
      }

      // Filter for favorites only if enabled
      if (filters.showFavoritesOnly && user && !isPanelFavorite(panel.id)) {
        return false;
      }

      // Filter for incomplete panels if disabled
      const missingFields = panel.missing_fields as string[] | null;
      if (!filters.showIncomplete && missingFields && missingFields.length > 0) {
        // Check if all missing fields are in user_verified_overrides
        const verifiedOverrides = panel.user_verified_overrides as string[] | null;
        if (verifiedOverrides && verifiedOverrides.length > 0) {
          const unverifiedMissingFields = missingFields.filter(
            field => !verifiedOverrides.includes(field)
          );
          if (unverifiedMissingFields.length > 0) {
            return false;
          }
        } else {
          return false;
        }
      }

      // Calculate metrics only if values exist
      // Price per watt uses total wattage (wattage × piece_count)
      const totalWattage = panel.wattage ? panel.wattage * (panel.piece_count || 1) : null;
      const pricePerWatt = panel.price_usd && totalWattage ? panel.price_usd / totalWattage : null;
      const wattsPerKg = wattsPerWeight(panel.wattage ?? null, panel.weight_kg ?? null, unitSystem);
      const wattsPerSqM = wattsPerArea(panel.wattage ?? null, panel.length_cm ?? null, panel.width_cm ?? null, unitSystem);
      
      return (panel.wattage === null || (panel.wattage >= filters.wattageRange[0] && panel.wattage <= filters.wattageRange[1])) &&
        (panel.voltage === null || (panel.voltage >= filters.voltageRange[0] && panel.voltage <= filters.voltageRange[1])) &&
        (panel.price_usd === null || panel.price_usd === 0 || (panel.price_usd >= filters.priceRange[0] && panel.price_usd <= filters.priceRange[1])) &&
        (panel.weight_kg === null || (panel.weight_kg >= filters.weightRange[0] && panel.weight_kg <= filters.weightRange[1])) &&
        (panel.length_cm === null || (panel.length_cm >= filters.lengthRange[0] && panel.length_cm <= filters.lengthRange[1])) &&
        (panel.width_cm === null || (panel.width_cm >= filters.widthRange[0] && panel.width_cm <= filters.widthRange[1])) &&
        (pricePerWatt === null || (pricePerWatt >= filters.pricePerWattRange[0] && pricePerWatt <= filters.pricePerWattRange[1])) &&
        (wattsPerKg === null || (wattsPerKg >= filters.wattsPerKgRange[0] && wattsPerKg <= filters.wattsPerKgRange[1])) &&
        (wattsPerSqM === null || (wattsPerSqM >= filters.wattsPerSqMRange[0] && wattsPerSqM <= filters.wattsPerSqMRange[1]));
    });
  }, [panels, filters, user, isPanelHidden, isPanelFavorite, fadingOutPanels, unitSystem]);

  const sortedPanels = useMemo(() => {
    const sorted = [...filteredPanels];
    
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'price-asc':
        return sorted.sort((a, b) => a.price_usd - b.price_usd);
      case 'price-desc':
        return sorted.sort((a, b) => b.price_usd - a.price_usd);
      case 'wattage-asc':
        return sorted.sort((a, b) => a.wattage - b.wattage);
      case 'wattage-desc':
        return sorted.sort((a, b) => b.wattage - a.wattage);
      case 'efficiency-asc':
        return sorted.sort((a, b) => {
          const effA = wattsPerArea(a.wattage ?? null, a.length_cm ?? null, a.width_cm ?? null, unitSystem) ?? 0;
          const effB = wattsPerArea(b.wattage ?? null, b.length_cm ?? null, b.width_cm ?? null, unitSystem) ?? 0;
          return effA - effB;
        });
      case 'efficiency-desc':
        return sorted.sort((a, b) => {
          const effA = wattsPerArea(a.wattage ?? null, a.length_cm ?? null, a.width_cm ?? null, unitSystem) ?? 0;
          const effB = wattsPerArea(b.wattage ?? null, b.length_cm ?? null, b.width_cm ?? null, unitSystem) ?? 0;
          return effB - effA;
        });
      case 'value-asc':
        return sorted.sort((a, b) => (a.price_usd / a.wattage) - (b.price_usd / b.wattage));
      case 'value-desc':
        return sorted.sort((a, b) => (b.price_usd / b.wattage) - (a.price_usd / a.wattage));
      default:
        return sorted;
    }
  }, [filteredPanels, sortBy, unitSystem]);

  const comparedPanels = useMemo(() => {
    return panels.filter(p => selectedIds.has(p.id));
  }, [panels, selectedIds]);

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleStartComparison = () => {
    if (selectedIds.size >= 2) {
      setShowComparison(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setShowComparison(false);
  };

  const handleHidePanel = (id: string) => {
    // Add to fading out set
    setFadingOutPanels(prev => new Set([...prev, id]));
    
    // Call the actual toggle function after a delay to allow animation
    setTimeout(() => {
      togglePanelHidden(id);
      // Remove from fading out set after animation completes
      setFadingOutPanels(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }, 300); // Match the CSS transition duration
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
      showFavoritesOnly: false,
      showIncomplete: true,  // NEW: Reset to showing incomplete panels
    });
  };

  const getSortOptions = () => {
    const allOptions = [
      { value: 'name-asc', label: 'Name A-Z', category: 'basic' },
      { value: 'name-desc', label: 'Name Z-A', category: 'basic' },
      { value: 'price-asc', label: 'Price Low to High', category: 'price', highlighted: isFiltered('price') },
      { value: 'price-desc', label: 'Price High to Low', category: 'price', highlighted: isFiltered('price') },
      { value: 'wattage-asc', label: 'Wattage Low to High', category: 'specs', highlighted: isFiltered('wattage') },
      { value: 'wattage-desc', label: 'Wattage High to Low', category: 'specs', highlighted: isFiltered('wattage') },
      { value: 'efficiency-asc', label: `Efficiency Low to High (W/${unitSystem === 'imperial' ? 'ft²' : 'm²'})`, category: 'efficiency', highlighted: isFiltered('efficiency') },
      { value: 'efficiency-desc', label: `Efficiency High to Low (W/${unitSystem === 'imperial' ? 'ft²' : 'm²'})`, category: 'efficiency', highlighted: isFiltered('efficiency') },
      { value: 'value-asc', label: 'Best Value ($/W Low to High)', category: 'value', highlighted: isFiltered('value') },
      { value: 'value-desc', label: 'Worst Value ($/W High to Low)', category: 'value', highlighted: isFiltered('value') },
    ];
    return allOptions;
  };

  const isFiltered = (type: string) => {
    switch (type) {
      case 'price':
        return filters.priceRange[0] > bounds.price.min || filters.priceRange[1] < bounds.price.max;
      case 'wattage':
        return filters.wattageRange[0] > bounds.wattage.min || filters.wattageRange[1] < bounds.wattage.max;
      case 'efficiency':
        return filters.wattsPerSqMRange[0] > bounds.wattsPerSqM.min || filters.wattsPerSqMRange[1] < bounds.wattsPerSqM.max;
      case 'value':
        return filters.pricePerWattRange[0] > bounds.pricePerWatt.min || filters.pricePerWattRange[1] < bounds.pricePerWatt.max;
      default:
        return false;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Sun className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-6" style={{ maxWidth: '100vw', width: '100%' }}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary">
                <img
                  src="/logo.svg"
                  alt="Solar Panel Comparison"
                  className="w-8 h-8"
                />
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
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {isAdmin && (
                    <Button variant="outline" asChild>
                      <a href="/admin">
                        <Settings className="w-4 h-4 mr-2" />
                        Admin Panel
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <a href="/preferences">
                      <User className="w-4 h-4 mr-2" />
                      My Preferences
                    </a>
                  </Button>
                </>
              ) : (
                <Button variant="outline" asChild>
                  <a href="/preferences">
                    <User className="w-4 h-4 mr-2" />
                    Sign In
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Filters Section */}
      <section className="px-4 py-4 border-b bg-background/50" style={{ maxWidth: '100vw', width: '100vw', overflowX: 'hidden' }}>
        <div style={{ maxWidth: '100%', width: '100%' }}>
          <FilterPanel 
            filters={filters}
            bounds={bounds}
            panels={panels}
            favoritePanelIds={favoritePanels}
            unitSystem={unitSystem}
            onFilterChange={setFilters}
            onReset={resetFilters}
            onUnitSystemChange={handleUnitSystemChange}
            isCollapsed={filtersCollapsed}
            onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
            appliedFiltersCount={getAppliedFiltersCount()}
          />
        </div>
      </section>

      <main className="px-4 py-8" style={{ maxWidth: '100vw', width: '100vw', overflowX: 'hidden' }}>
        <div style={{ maxWidth: '100%', width: '100%' }}>
          {/* Main Content */}
          <div className="space-y-6">
            {/* Stats Bar with Controls */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-bold text-foreground">{sortedPanels.length}</span> of {panels.length} panels
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-primary">
                    • <span className="font-bold">{selectedIds.size}</span> selected
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getSortOptions().map(option => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          className={option.highlighted ? 'bg-primary/10 font-medium' : ''}
                        >
                          {option.highlighted && '⭐ '}{option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* View Toggle */}
                <div className="flex items-center border rounded-lg p-1">
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>

                {/* Compare buttons - show Compare All when ≤10 panels, or Compare when some selected */}
                {(sortedPanels.length <= 10 || selectedIds.size > 0) && (
                  <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {selectedIds.size} selected
                      </span>
                    )}
                    
                    {/* Compare All button - show when ≤10 panels */}
                    {sortedPanels.length <= 10 && (
                      <Button 
                        variant={selectedIds.size === 0 ? "default" : "outline"}
                        onClick={() => {
                          // Select all panels and start comparison
                          const allPanelIds = new Set(sortedPanels.map(p => p.id));
                          setSelectedIds(allPanelIds);
                          setShowComparison(true);
                        }}
                      >
                        Compare All ({sortedPanels.length})
                      </Button>
                    )}
                    
                    {/* Compare button - show when panels are selected */}
                    {selectedIds.size > 0 && (
                      <Button 
                        variant="default" 
                        onClick={handleStartComparison}
                        disabled={selectedIds.size < 2}
                      >
                        Compare ({selectedIds.size})
                      </Button>
                    )}
                    
                    {/* Clear Selection button - show when panels are selected */}
                    {selectedIds.size > 0 && (
                      <Button 
                        variant="outline" 
                        onClick={handleClearSelection}
                      >
                        Clear Selection
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Comparison Table */}
            {showComparison && comparedPanels.length >= 2 && (
              <div className="space-y-2 max-w-full">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Table className="w-5 h-5" />
                  Comparison
                </h2>
                
                {/* Amazon Affiliate Disclosure */}
                <div className="bg-muted/50 border border-muted-foreground/20 rounded-lg p-3 text-sm text-muted-foreground">
                  <p>
                    <strong>Disclosure:</strong> As an Amazon Associate I earn from qualifying purchases. 
                    Product links may contain affiliate links through which we receive a small commission at no additional cost to you.
                  </p>
                </div>
                
                <div className="w-full overflow-hidden" style={{ maxWidth: '100%' }}>
                  <ComparisonTable 
                    panels={comparedPanels}
                    onRemove={(id) => {
                      setSelectedIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(id);
                        return newSet;
                      });
                    }}
                    unitSystem={unitSystem}
                    hoveredPanelId={hoveredPanelId}
                    onPanelHover={handlePanelHover}
                  />
                </div>
                
                {/* Visual Comparison */}
                <VisualComparison 
                  panels={comparedPanels}
                  unitSystem={unitSystem}
                  hoveredPanelId={hoveredPanelId}
                  onPanelHover={handlePanelHover}
                />
                
                <Separator className="my-6" />
              </div>
            )}

            {/* Panels Display */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {viewMode === 'cards' ? <Grid className="w-5 h-5" /> : <List className="w-5 h-5" />}
                All Panels
              </h2>
              
              {/* Amazon Affiliate Disclosure */}
              <div className="bg-muted/50 border border-muted-foreground/20 rounded-lg p-3 text-sm text-muted-foreground">
                <p>
                  <strong>Disclosure:</strong> As an Amazon Associate I earn from qualifying purchases. 
                  Product links may contain affiliate links through which we receive a small commission at no additional cost to you.
                </p>
              </div>
              
              {viewMode === 'cards' ? (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {sortedPanels.map(panel => (
            <SolarPanelCard 
              key={panel.id}
              panel={panel}
              onToggleSelection={handleToggleSelection}
              isSelected={selectedIds.has(panel.id)}
              isHidden={isPanelHidden(panel.id)}
              isFavorite={isPanelFavorite(panel.id)}
              isFadingOut={fadingOutPanels.has(panel.id)}
              onToggleHidden={handleHidePanel}
              onToggleFavorite={togglePanelFavorite}
              showUserActions={!!user}
              unitSystem={unitSystem}
            />
                  ))}
                </div>
              ) : (
                <div className="bg-background border rounded-lg overflow-hidden">
                  {/* List Header */}
                  <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b font-medium text-sm">
                    <div className="col-span-3">Panel</div>
                    <div className="col-span-1 text-center">Wattage</div>
                    <div className="col-span-1 text-center">Price</div>
                    <div className="col-span-1 text-center">$/W</div>
                    <div className="col-span-2 text-center">Dimensions</div>
                    <div className="col-span-1 text-center">Weight</div>
                    <div className="col-span-1 text-center">W/{unitSystem === 'imperial' ? 'ft²' : 'm²'}</div>
                    <div className="col-span-2 text-center">Actions</div>
                  </div>
                  
                  {/* List Items */}
                  {sortedPanels.map((panel, index) => {
                    const pricePerWatt = panel.price_usd / panel.wattage;
                    const efficiency = wattsPerArea(panel.wattage ?? null, panel.length_cm ?? null, panel.width_cm ?? null, unitSystem);
                    const isSelected = selectedIds.has(panel.id);
                    
                    return (
                      <div 
                        key={panel.id} 
                        className={`grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-muted/20 transition-colors ${
                          selectedIds.has(panel.id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="col-span-3">
                          <div className="font-medium">{panel.name}</div>
                          <div className="text-sm text-muted-foreground">{panel.manufacturer}</div>
                        </div>
                        <div className="col-span-1 text-center font-mono">{panel.wattage}W</div>
                        <div className="col-span-1 text-center font-mono">${panel.price_usd}</div>
                        <div className="col-span-1 text-center font-mono">${pricePerWatt.toFixed(2)}</div>
                        <div className="col-span-2 text-center font-mono text-sm">
                          {formatDimensions(panel.length_cm, panel.width_cm, unitSystem)}
                        </div>
                        <div className="col-span-1 text-center font-mono">{formatWeight(panel.weight_kg, unitSystem)}</div>
                        <div className="col-span-1 text-center font-mono">{efficiency ?? 'N/A'}</div>
                        <div className="col-span-2 flex items-center justify-center gap-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`list-select-${panel.id}`}
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelection(panel.id)}
                            />
                            <label 
                              htmlFor={`list-select-${panel.id}`} 
                              className="text-xs cursor-pointer"
                            >
                              Select
                            </label>
                          </div>
                          {panel.web_url && (() => {
                            try {
                              const domain = new URL(panel.web_url).hostname;
                              const affiliateUrl = addAmazonAffiliateTag(panel.web_url);
                              return (
                                <a 
                                  href={affiliateUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:opacity-70 transition-opacity inline-flex items-center p-2"
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
                                      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {sortedPanels.length === 0 && (
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
