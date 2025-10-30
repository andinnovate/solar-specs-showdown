import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseCSV,
  detectUnit,
  convertValue,
  processCSVRow,
  findMatchingPanel,
  calculateChanges,
  getFieldType,
  getUnitOptionsForField,
  type FieldMapping,
} from '../csvUtils';
import type { CSVRow } from '../csvUtils';

describe('csvUtils', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV content', () => {
      const csv = 'name,manufacturer,length_cm\nTest Panel,Test Corp,100';
      const result = parseCSV(csv);
      
      expect(result.headers).toEqual(['name', 'manufacturer', 'length_cm']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({
        name: 'Test Panel',
        manufacturer: 'Test Corp',
        length_cm: '100'
      });
    });

    it('should handle quoted fields', () => {
      const csv = '"name","manufacturer"\n"Test Panel, Inc","Test Corp"';
      const result = parseCSV(csv);
      
      expect(result.headers).toEqual(['name', 'manufacturer']);
      expect(result.rows[0].name).toBe('Test Panel, Inc');
    });

    it('should handle multiple rows', () => {
      const csv = 'name,length_cm\nPanel 1,100\nPanel 2,200';
      const result = parseCSV(csv);
      
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('Panel 1');
      expect(result.rows[1].name).toBe('Panel 2');
    });

    it('should skip empty lines', () => {
      const csv = 'name,length_cm\nPanel 1,100\n\nPanel 2,200';
      const result = parseCSV(csv);
      
      expect(result.rows).toHaveLength(2);
    });

    it('should throw error for invalid CSV', () => {
      const csv = 'name';
      expect(() => parseCSV(csv)).toThrow();
    });

    it('should throw error for empty CSV', () => {
      const csv = 'name,length_cm\n';
      expect(() => parseCSV(csv)).toThrow();
    });
  });

  describe('detectUnit', () => {
    it('should detect length units', () => {
      expect(detectUnit('100 in', 'length')).toBe('in');
      expect(detectUnit('50 inches', 'length')).toBe('in'); // First match wins
      expect(detectUnit('100cm', 'length')).toBe('cm');
      expect(detectUnit('30 mm', 'length')).toBe('mm');
    });

    it('should detect weight units', () => {
      expect(detectUnit('5 lb', 'weight')).toBe('lb');
      expect(detectUnit('10 lbs', 'weight')).toBe('lb'); // First match wins
      expect(detectUnit('5kg', 'weight')).toBe('kg');
      expect(detectUnit('100 g', 'weight')).toBe('g');
    });

    it('should detect price units', () => {
      expect(detectUnit('$100', 'price')).toBe('$');
      expect(detectUnit('100 USD', 'price')).toBe('usd');
    });

    it('should return null for no unit found', () => {
      expect(detectUnit('100', 'length')).toBeNull();
    });
  });

  describe('convertValue', () => {
    it('should convert inches to cm', () => {
      expect(convertValue('10 in', 'in', 'length')).toBeCloseTo(25.4, 1);
    });

    it('should convert mm to cm', () => {
      expect(convertValue('100 mm', 'mm', 'length')).toBe(10);
    });

    it('should convert pounds to kg', () => {
      expect(convertValue('10 lb', 'lb', 'weight')).toBeCloseTo(4.54, 2);
    });

    it('should convert grams to kg', () => {
      expect(convertValue('1000 g', 'g', 'weight')).toBe(1);
    });

    it('should handle already converted values', () => {
      expect(convertValue('100', 'cm', 'length')).toBe(100);
    });

    it('should throw error for invalid numeric value', () => {
      expect(() => convertValue('abc', 'cm', 'length')).toThrow();
    });

    it('should handle unknown units gracefully', () => {
      expect(convertValue('100 unknown', 'unknown', 'length')).toBe(100);
    });
  });

  describe('processCSVRow', () => {
    const fieldMappings: FieldMapping[] = [
      { csvHeader: 'name', dbField: 'name', required: true },
      { csvHeader: 'manufacturer', dbField: 'manufacturer', required: true },
      { csvHeader: 'length_cm', dbField: 'length_cm', unit: 'cm', required: true },
      { csvHeader: 'wattage', dbField: 'wattage', required: true },
    ];

    it('should process valid CSV row', () => {
      const csvRow: CSVRow = {
        name: 'Test Panel',
        manufacturer: 'Test Corp',
        length_cm: '100',
        wattage: '200',
      };

      const result = processCSVRow(csvRow, fieldMappings);

      expect(result.name).toBe('Test Panel');
      expect(result.manufacturer).toBe('Test Corp');
      expect(result.length_cm).toBe(100);
      expect(result.wattage).toBe(200);
      expect(result.piece_count).toBe(1); // Default value
    });

    it('should convert units properly', () => {
      const csvRow: CSVRow = {
        name: 'Test',
        manufacturer: 'Corp',
        length_cm: '10 in',
        wattage: '200',
      };

      const mappingsWithInches: FieldMapping[] = [
        ...fieldMappings.slice(0, 2),
        { csvHeader: 'length_cm', dbField: 'length_cm', unit: 'in', selectedUnit: 'in', required: true },
        fieldMappings[3],
      ];

      const result = processCSVRow(csvRow, mappingsWithInches);
      expect(result.length_cm).toBeCloseTo(25.4, 0);
    });

    it('should throw error for missing required field', () => {
      const csvRow: CSVRow = {
        name: 'Test Panel',
        // manufacturer missing
        length_cm: '100',
        wattage: '200',
      };

      expect(() => processCSVRow(csvRow, fieldMappings)).toThrow();
    });

    it('should handle optional fields', () => {
      const optionalMappings: FieldMapping[] = [
        ...fieldMappings,
        { csvHeader: 'description', dbField: 'description', required: false },
      ];

      const csvRow: CSVRow = {
        name: 'Test',
        manufacturer: 'Corp',
        length_cm: '100',
        wattage: '200',
        // description missing but optional
      };

      const result = processCSVRow(csvRow, optionalMappings);
      expect(result).toBeDefined();
    });

    it('should validate piece_count is positive integer', () => {
      const mappings: FieldMapping[] = [
        ...fieldMappings,
        { csvHeader: 'piece_count', dbField: 'piece_count', required: false },
      ];

      const csvRow: CSVRow = {
        name: 'Test',
        manufacturer: 'Corp',
        length_cm: '100',
        wattage: '200',
        piece_count: '2.5',
      };

      expect(() => processCSVRow(csvRow, mappings)).toThrow();
    });
  });

  describe('findMatchingPanel', () => {
    const existingPanels = [
      { id: '1', name: 'Panel A', manufacturer: 'Corp A', wattage: 100, price_usd: 50 },
      { id: '2', name: 'Panel B', manufacturer: 'Corp B', wattage: 200, price_usd: 100 },
    ] as any[];

    it('should find exact match by name and manufacturer', () => {
      const processed = { name: 'Panel A', manufacturer: 'Corp A', wattage: 100 };
      const match = findMatchingPanel(processed, existingPanels);
      
      expect(match).toEqual(existingPanels[0]);
    });

    it('should find fuzzy match by name only', () => {
      const processed = { name: 'Panel A', manufacturer: 'Different Corp', wattage: 100 };
      const match = findMatchingPanel(processed, existingPanels);
      
      expect(match).toEqual(existingPanels[0]);
    });

    it('should return undefined for no match', () => {
      const processed = { name: 'Panel C', manufacturer: 'Corp C', wattage: 300 };
      const match = findMatchingPanel(processed, existingPanels);
      
      expect(match).toBeUndefined();
    });

    it('should be case insensitive', () => {
      const processed = { name: 'panel a', manufacturer: 'corp a', wattage: 100 };
      const match = findMatchingPanel(processed, existingPanels);
      
      expect(match).toEqual(existingPanels[0]);
    });
  });

  describe('calculateChanges', () => {
    it('should calculate differences between existing and updated data', () => {
      const existing = { id: '1', name: 'Panel A', wattage: 100, price_usd: 50 } as any;
      const updated = { name: 'Panel B', wattage: 200, price_usd: 50 };

      const changes = calculateChanges(existing, updated);

      expect(changes).toEqual({ name: 'Panel B', wattage: 200 });
    });

    it('should return empty object when no changes', () => {
      const existing = { id: '1', name: 'Panel A', wattage: 100 } as any;
      const updated = { name: 'Panel A', wattage: 100 };

      const changes = calculateChanges(existing, updated);

      expect(changes).toEqual({});
    });

    it('should ignore unchanged fields', () => {
      const existing = { 
        id: '1', 
        name: 'Panel A', 
        wattage: 100, 
        price_usd: 50,
        manufacturer: 'Corp A'
      } as any;
      const updated = { 
        name: 'Panel A', 
        wattage: 200, 
        price_usd: 50,
        manufacturer: 'Corp A'
      };

      const changes = calculateChanges(existing, updated);

      expect(changes).toEqual({ wattage: 200 });
    });
  });

  describe('getFieldType', () => {
    it('should identify length fields', () => {
      expect(getFieldType('length_cm')).toBe('length');
      expect(getFieldType('width_cm')).toBe('length');
    });

    it('should identify weight fields', () => {
      expect(getFieldType('weight_kg')).toBe('weight');
    });

    it('should identify price fields', () => {
      expect(getFieldType('price_usd')).toBe('price');
    });

    it('should return null for unknown fields', () => {
      expect(getFieldType('name')).toBeNull();
      expect(getFieldType('manufacturer')).toBeNull();
    });
  });

  describe('getUnitOptionsForField', () => {
    it('should return length options for length fields', () => {
      const options = getUnitOptionsForField('length_cm');
      expect(options).toHaveLength(3);
      expect(options[0].value).toBe('in');
      expect(options[1].value).toBe('cm');
    });

    it('should return weight options for weight fields', () => {
      const options = getUnitOptionsForField('weight_kg');
      expect(options).toHaveLength(3);
      expect(options[0].value).toBe('lb');
    });

    it('should return price options for price fields', () => {
      const options = getUnitOptionsForField('price_usd');
      expect(options).toHaveLength(1);
      expect(options[0].value).toBe('$');
    });

    it('should return empty array for unknown fields', () => {
      const options = getUnitOptionsForField('name');
      expect(options).toHaveLength(0);
    });
  });
});

