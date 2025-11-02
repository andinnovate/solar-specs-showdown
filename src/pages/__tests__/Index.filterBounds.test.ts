import { describe, it, expect } from 'vitest';
import type { Tables } from '@/integrations/supabase/types';

type SolarPanel = Tables<'solar_panels'> & {
  piece_count?: number;
  user_verified_overrides?: string[] | null;
  flag_count?: number;
  pending_flags?: number;
};

// Function extracted from Index.tsx for testing
function calculateBounds(panels: SolarPanel[]) {
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
  const wattsPerKgs = panels.filter(p => p.wattage !== null && p.weight_kg !== null).map(p => p.wattage! / p.weight_kg!);
  const wattsPerSqMs = panels.filter(p => p.wattage !== null && p.length_cm !== null && p.width_cm !== null).map(p => p.wattage! / ((p.length_cm! * p.width_cm!) / 10000));
  
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
}

describe('Filter Bounds Calculations', () => {
  it('should return default bounds for empty panels array', () => {
    const bounds = calculateBounds([]);
    
    expect(bounds.wattage).toEqual({ min: 0, max: 1000 });
    expect(bounds.voltage).toEqual({ min: 0, max: 100 });
    expect(bounds.price).toEqual({ min: 0, max: 1000 });
    expect(bounds.weight).toEqual({ min: 0, max: 100 });
    expect(bounds.length).toEqual({ min: 0, max: 300 });
    expect(bounds.width).toEqual({ min: 0, max: 200 });
    expect(bounds.pricePerWatt).toEqual({ min: 0, max: 10 });
    expect(bounds.wattsPerKg).toEqual({ min: 0, max: 100 });
    expect(bounds.wattsPerSqM).toEqual({ min: 0, max: 300 });
  });

  it('should calculate correct bounds for panels with complete data', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: 100,
        voltage: 12,
        price_usd: 80,
        weight_kg: 5,
        length_cm: 100,
        width_cm: 50,
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
      {
        id: '2',
        name: 'Panel 2',
        manufacturer: 'Test',
        wattage: 200,
        voltage: 24,
        price_usd: 300,
        weight_kg: 10,
        length_cm: 150,
        width_cm: 80,
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    expect(bounds.wattage).toEqual({ min: 100, max: 200 });
    expect(bounds.voltage).toEqual({ min: 12, max: 24 });
    expect(bounds.price).toEqual({ min: 80, max: 300 });
    expect(bounds.weight).toEqual({ min: 5, max: 10 });
    expect(bounds.length).toEqual({ min: 100, max: 150 });
    expect(bounds.width).toEqual({ min: 50, max: 80 });
  });

  it('should filter out null values correctly', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: 100,
        voltage: null, // null value
        price_usd: 80,
        weight_kg: 5,
        length_cm: null, // null value
        width_cm: 50,
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
      {
        id: '2',
        name: 'Panel 2',
        manufacturer: 'Test',
        wattage: 200,
        voltage: 24,
        price_usd: 300,
        weight_kg: null, // null value
        length_cm: 150,
        width_cm: 80,
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    expect(bounds.wattage).toEqual({ min: 100, max: 200 });
    expect(bounds.voltage).toEqual({ min: 24, max: 24 }); // Only Panel 2
    expect(bounds.price).toEqual({ min: 80, max: 300 });
    expect(bounds.weight).toEqual({ min: 5, max: 5 }); // Only Panel 1
    expect(bounds.length).toEqual({ min: 150, max: 150 }); // Only Panel 2
    expect(bounds.width).toEqual({ min: 50, max: 80 });
  });

  it('should calculate price per watt correctly using piece_count', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: 100,
        voltage: 12,
        price_usd: 100, // $100 for 1 piece of 100W = $1/W
        weight_kg: 5,
        length_cm: 100,
        width_cm: 50,
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
      {
        id: '2',
        name: 'Panel 2',
        manufacturer: 'Test',
        wattage: 100,
        voltage: 24,
        price_usd: 150, // $150 for 2 pieces of 100W = $150/(100*2) = $0.75/W
        weight_kg: 10,
        length_cm: 150,
        width_cm: 80,
        piece_count: 2,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    // Panel 1: $100 / (100W * 1) = $1.00/W
    // Panel 2: $150 / (100W * 2) = $0.75/W
    expect(bounds.pricePerWatt.min).toBe(0.75);
    expect(bounds.pricePerWatt.max).toBe(1.0);
  });

  it('should calculate watts per kg correctly', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: 200, // 200W
        voltage: 12,
        price_usd: 100,
        weight_kg: 10, // 10kg
        length_cm: 100,
        width_cm: 50,
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
      {
        id: '2',
        name: 'Panel 2',
        manufacturer: 'Test',
        wattage: 300, // 300W
        voltage: 24,
        price_usd: 200,
        weight_kg: 15, // 15kg
        length_cm: 150,
        width_cm: 80,
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    // Panel 1: 200W / 10kg = 20 W/kg
    // Panel 2: 300W / 15kg = 20 W/kg
    expect(bounds.wattsPerKg.min).toBe(20);
    expect(bounds.wattsPerKg.max).toBe(20);
  });

  it('should calculate watts per square meter correctly', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: 100, // 100W
        voltage: 12,
        price_usd: 100,
        weight_kg: 5,
        length_cm: 100, // 1m
        width_cm: 100, // 1m = 1 m²
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
      {
        id: '2',
        name: 'Panel 2',
        manufacturer: 'Test',
        wattage: 200, // 200W
        voltage: 24,
        price_usd: 200,
        weight_kg: 10,
        length_cm: 200, // 2m
        width_cm: 100, // 1m = 2 m²
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    // Panel 1: 100W / 1m² = 100 W/m²
    // Panel 2: 200W / 2m² = 100 W/m²
    expect(bounds.wattsPerSqM.min).toBe(100);
    expect(bounds.wattsPerSqM.max).toBe(100);
  });

  it('should handle panels with all null values by returning defaults', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: null,
        voltage: null,
        price_usd: null,
        weight_kg: null,
        length_cm: null,
        width_cm: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    // Should return defaults since all values are null
    expect(bounds.wattage).toEqual({ min: 0, max: 1000 });
    expect(bounds.voltage).toEqual({ min: 0, max: 100 });
    expect(bounds.price).toEqual({ min: 0, max: 1000 });
    expect(bounds.weight).toEqual({ min: 0, max: 100 });
    expect(bounds.length).toEqual({ min: 0, max: 300 });
    expect(bounds.width).toEqual({ min: 0, max: 200 });
    expect(bounds.pricePerWatt).toEqual({ min: 0, max: 10 });
    expect(bounds.wattsPerKg).toEqual({ min: 0, max: 100 });
    expect(bounds.wattsPerSqM).toEqual({ min: 0, max: 300 });
  });

  it('should handle mixed null and valid values correctly', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: 100,
        voltage: 12,
        price_usd: 80,
        weight_kg: 5,
        length_cm: 100,
        width_cm: 50,
        piece_count: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
      {
        id: '2',
        name: 'Panel 2',
        manufacturer: 'Test',
        wattage: null,
        voltage: null,
        price_usd: null,
        weight_kg: null,
        length_cm: null,
        width_cm: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    // Should only calculate based on Panel 1 since Panel 2 has all nulls
    expect(bounds.wattage).toEqual({ min: 100, max: 100 });
    expect(bounds.voltage).toEqual({ min: 12, max: 12 });
    expect(bounds.price).toEqual({ min: 80, max: 80 });
    expect(bounds.weight).toEqual({ min: 5, max: 5 });
  });

  it('should handle price per watt calculation when wattage is null', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: null, // null wattage
        voltage: 12,
        price_usd: 100,
        weight_kg: 5,
        length_cm: 100,
        width_cm: 50,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    // Should return default since price/usd or wattage is null
    expect(bounds.pricePerWatt).toEqual({ min: 0, max: 10 });
  });

  it('should handle watts per kg calculation when both values are present', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: 250,
        voltage: 12,
        price_usd: 100,
        weight_kg: 12.5, // 12.5kg
        length_cm: 100,
        width_cm: 50,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    // 250W / 12.5kg = 20 W/kg
    expect(bounds.wattsPerKg).toEqual({ min: 20, max: 20 });
  });

  it('should handle watts per sq meter calculation correctly', () => {
    const panels: SolarPanel[] = [
      {
        id: '1',
        name: 'Panel 1',
        manufacturer: 'Test',
        wattage: 320,
        voltage: 12,
        price_usd: 100,
        weight_kg: 5,
        length_cm: 200, // 2m
        width_cm: 100, // 1m = 2 m²
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any,
    ];

    const bounds = calculateBounds(panels);
    
    // 320W / 2m² = 160 W/m²
    expect(bounds.wattsPerSqM).toEqual({ min: 160, max: 160 });
  });
});
