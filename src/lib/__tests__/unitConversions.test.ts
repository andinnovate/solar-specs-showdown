import { describe, it, expect } from 'vitest';
import {
  cmToInches,
  inchesToCm,
  kgToLbs,
  lbsToKg,
  convertLength,
  convertWeight,
  convertArea,
  convertWattsPerWeightValue,
  convertWattsPerAreaValue,
  formatDimensions,
  formatDimension,
  formatWeight,
  formatArea,
  formatWeightWithPieces,
  formatWattageWithPieces,
  wattsPerWeight,
  wattsPerArea,
} from '../unitConversions';

describe('unitConversions', () => {
  describe('cmToInches', () => {
    it('should convert centimeters to inches correctly', () => {
      expect(cmToInches(100)).toBe(39.4);
      expect(cmToInches(50)).toBe(19.7);
      expect(cmToInches(2.54)).toBe(1);
    });

    it('should round to 1 decimal place', () => {
      expect(cmToInches(1)).toBe(0.4);
      expect(cmToInches(10)).toBe(3.9);
    });
  });

  describe('inchesToCm', () => {
    it('should convert inches to centimeters correctly', () => {
      expect(inchesToCm(1)).toBe(2.5);
      expect(inchesToCm(10)).toBe(25.4);
      expect(inchesToCm(39.4)).toBeCloseTo(100, 0);
    });
  });

  describe('kgToLbs', () => {
    it('should convert kilograms to pounds correctly', () => {
      expect(kgToLbs(1)).toBe(2.2);
      expect(kgToLbs(10)).toBe(22);
      expect(kgToLbs(0.453592)).toBe(1);
    });

    it('should round to 1 decimal place', () => {
      expect(kgToLbs(2)).toBe(4.4);
      expect(kgToLbs(5)).toBe(11);
    });
  });

  describe('lbsToKg', () => {
    it('should convert pounds to kilograms correctly', () => {
      expect(lbsToKg(1)).toBe(0.5);
      expect(lbsToKg(2.2)).toBeCloseTo(1, 0);
      expect(lbsToKg(10)).toBe(4.5);
    });
  });

  describe('convertLength', () => {
    it('should return cm for metric system', () => {
      const result = convertLength(100, 'metric');
      expect(result.value).toBe(100);
      expect(result.unit).toBe('cm');
      expect(result.originalValue).toBe(100);
      expect(result.originalUnit).toBe('cm');
    });

    it('should convert to inches for imperial system', () => {
      const result = convertLength(100, 'imperial');
      expect(result.value).toBe(39.4);
      expect(result.unit).toBe('in');
      expect(result.originalValue).toBe(100);
      expect(result.originalUnit).toBe('cm');
    });
  });

  describe('convertWeight', () => {
    it('should return kg for metric system', () => {
      const result = convertWeight(10, 'metric');
      expect(result.value).toBe(10);
      expect(result.unit).toBe('kg');
    });

    it('should convert to lbs for imperial system', () => {
      const result = convertWeight(10, 'imperial');
      expect(result.value).toBe(22);
      expect(result.unit).toBe('lbs');
    });
  });

  describe('convertArea', () => {
    it('should return m² for metric system', () => {
      const result = convertArea(100, 50, 'metric');
      expect(result.value).toBe(0.5);
      expect(result.unit).toBe('m²');
    });

    it('should convert to ft² for imperial system', () => {
      const result = convertArea(100, 50, 'imperial');
      expect(result.unit).toBe('ft²');
      expect(result.value).toBeGreaterThan(0);
    });

    it('should round to appropriate decimal places', () => {
      const metric = convertArea(100, 100, 'metric');
      expect(metric.value).toBe(1);
      
      const imperial = convertArea(100, 100, 'imperial');
      expect(Number.isInteger(imperial.value) || imperial.value % 0.1 < 0.01).toBe(true);
    });
  });

  describe('convertWattsPerWeightValue', () => {
    it('should return the same value when unit system matches', () => {
      expect(convertWattsPerWeightValue(10, 'metric', 'metric')).toBe(10);
      expect(convertWattsPerWeightValue(10, 'imperial', 'imperial')).toBe(10);
    });

    it('should convert between W/kg and W/lb correctly', () => {
      expect(convertWattsPerWeightValue(10, 'metric', 'imperial')).toBeCloseTo(4.53592, 4);
      expect(convertWattsPerWeightValue(10, 'imperial', 'metric')).toBeCloseTo(22.0462, 4);
    });
  });

  describe('convertWattsPerAreaValue', () => {
    it('should return the same value when unit system matches', () => {
      expect(convertWattsPerAreaValue(100, 'metric', 'metric')).toBe(100);
      expect(convertWattsPerAreaValue(100, 'imperial', 'imperial')).toBe(100);
    });

    it('should convert between W/m² and W/ft² correctly', () => {
      expect(convertWattsPerAreaValue(100, 'metric', 'imperial')).toBeCloseTo(9.2903, 3);
      expect(convertWattsPerAreaValue(100, 'imperial', 'metric')).toBeCloseTo(1076.4, 1);
    });
  });

  describe('wattsPerWeight', () => {
    it('should return null for missing inputs', () => {
      expect(wattsPerWeight(null, 5, 'metric')).toBeNull();
      expect(wattsPerWeight(100, null, 'metric')).toBeNull();
      expect(wattsPerWeight(100, 0, 'metric')).toBeNull();
    });

    it('should calculate W/kg for metric and W/lb for imperial', () => {
      expect(wattsPerWeight(100, 10, 'metric')).toBe(10);
      expect(wattsPerWeight(100, 10, 'imperial')).toBeCloseTo(4.5, 1);
    });
  });

  describe('wattsPerArea', () => {
    it('should return null for missing inputs', () => {
      expect(wattsPerArea(null, 100, 50, 'metric')).toBeNull();
      expect(wattsPerArea(100, null, 50, 'metric')).toBeNull();
      expect(wattsPerArea(100, 0, 50, 'metric')).toBeNull();
    });

    it('should calculate W/m² for metric and W/ft² for imperial', () => {
      expect(wattsPerArea(100, 100, 50, 'metric')).toBe(200);
      expect(wattsPerArea(100, 100, 50, 'imperial')).toBeCloseTo(18.6, 1);
    });
  });

  describe('formatDimensions', () => {
    it('should format metric dimensions correctly', () => {
      expect(formatDimensions(100, 50, 'metric')).toBe('100 × 50 cm');
    });

    it('should format imperial dimensions correctly', () => {
      const result = formatDimensions(100, 50, 'imperial');
      expect(result).toMatch(/\d+(\.\d+)? × \d+(\.\d+)? in/);
    });
  });

  describe('formatDimension', () => {
    it('should format single metric dimension', () => {
      expect(formatDimension(100, 'metric')).toBe('100cm');
    });

    it('should format single imperial dimension', () => {
      const result = formatDimension(100, 'imperial');
      expect(result).toMatch(/\d+(\.\d+)?in/);
    });
  });

  describe('formatWeight', () => {
    it('should format metric weight', () => {
      expect(formatWeight(10, 'metric')).toBe('10kg');
    });

    it('should format imperial weight', () => {
      const result = formatWeight(10, 'imperial');
      expect(result).toMatch(/\d+(\.\d+)?lbs/);
    });
  });

  describe('formatArea', () => {
    it('should format metric area', () => {
      const result = formatArea(100, 50, 'metric');
      expect(result).toMatch(/\d+(\.\d+)?m²/);
    });

    it('should format imperial area', () => {
      const result = formatArea(100, 50, 'imperial');
      expect(result).toMatch(/\d+(\.\d+)?ft²/);
    });
  });

  describe('formatWeightWithPieces', () => {
    it('should show single weight for piece_count of 1', () => {
      const result = formatWeightWithPieces(5, 1, 'metric');
      expect(result).toBe('5kg');
    });

    it('should show total and per-piece weight for multiple pieces', () => {
      const result = formatWeightWithPieces(5, 4, 'metric');
      expect(result).toMatch(/20kg \(5kg\/ea\)/);
    });

    it('should work with imperial units', () => {
      const result = formatWeightWithPieces(5, 2, 'imperial');
      expect(result).toContain('lbs');
      expect(result).toContain('ea');
    });
  });

  describe('formatWattageWithPieces', () => {
    it('should show single wattage for piece_count of 1', () => {
      expect(formatWattageWithPieces(100, 1, 'metric')).toBe('100W');
    });

    it('should show total and per-piece wattage for multiple pieces', () => {
      const result = formatWattageWithPieces(100, 4, 'metric');
      expect(result).toBe('400W (100W/ea × 4 pcs)');
    });

    it('should return N/A for null wattage', () => {
      expect(formatWattageWithPieces(null, 1, 'metric')).toBe('N/A');
    });

    it('should work with imperial units (though wattage is unitless)', () => {
      const result = formatWattageWithPieces(100, 2, 'imperial');
      expect(result).toBe('200W (100W/ea × 2 pcs)');
    });
  });
});
