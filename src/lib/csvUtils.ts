import { Database } from "@/integrations/supabase/types";

export type SolarPanelRow = Database["public"]["Tables"]["solar_panels"]["Row"];
export type SolarPanelInsert = Database["public"]["Tables"]["solar_panels"]["Insert"];
export type SolarPanelUpdate = Database["public"]["Tables"]["solar_panels"]["Update"];

// CSV row data (before processing)
export interface CSVRow {
  [key: string]: string;
}

// Processed panel data
export interface ProcessedPanel extends Omit<SolarPanelInsert, 'id' | 'created_at' | 'updated_at'> {
  originalData: CSVRow;
  matchedPanel?: SolarPanelRow;
  isUpdate: boolean;
  changes?: Partial<SolarPanelRow>;
}

// Field mapping configuration
export interface FieldMapping {
  csvHeader: string;
  dbField: keyof SolarPanelInsert;
  unit?: string;
  required: boolean;
}

// Supported units and conversions
export const UNIT_CONVERSIONS = {
  length: {
    'in': (value: number) => value * 2.54, // inches to cm
    'inch': (value: number) => value * 2.54,
    'inches': (value: number) => value * 2.54,
    'cm': (value: number) => value, // already in cm
    'centimeters': (value: number) => value,
    'mm': (value: number) => value / 10, // mm to cm
    'millimeters': (value: number) => value / 10,
  },
  weight: {
    'lb': (value: number) => value * 0.453592, // pounds to kg
    'lbs': (value: number) => value * 0.453592,
    'pounds': (value: number) => value * 0.453592,
    'kg': (value: number) => value, // already in kg
    'kilograms': (value: number) => value,
    'g': (value: number) => value / 1000, // grams to kg
    'grams': (value: number) => value / 1000,
  },
  price: {
    '$': (value: number) => value, // already in USD
    'usd': (value: number) => value,
    'dollars': (value: number) => value,
  }
} as const;

// Default field mappings
export const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  { csvHeader: 'name', dbField: 'name', required: true },
  { csvHeader: 'manufacturer', dbField: 'manufacturer', required: true },
  { csvHeader: 'length_cm', dbField: 'length_cm', unit: 'cm', required: true },
  { csvHeader: 'width_cm', dbField: 'width_cm', unit: 'cm', required: true },
  { csvHeader: 'weight_kg', dbField: 'weight_kg', unit: 'kg', required: true },
  { csvHeader: 'wattage', dbField: 'wattage', required: true },
  { csvHeader: 'voltage', dbField: 'voltage', required: false },
  { csvHeader: 'price_usd', dbField: 'price_usd', unit: 'usd', required: true },
  { csvHeader: 'description', dbField: 'description', required: false },
  { csvHeader: 'image_url', dbField: 'image_url', required: false },
  { csvHeader: 'web_url', dbField: 'web_url', required: false },
];

// Parse CSV content
export function parseCSV(content: string): { headers: string[]; rows: CSVRow[] } {
  try {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    // Simple CSV parsing - handle quoted fields
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}`);
        continue;
      }

      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return { headers, rows };
  } catch (error) {
    console.error('CSV parsing error:', error);
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Detect unit from value string
export function detectUnit(value: string, fieldType: 'length' | 'weight' | 'price'): string | null {
  const lowerValue = value.toLowerCase().trim();
  
  const unitPatterns = {
    length: ['in', 'inch', 'inches', 'cm', 'centimeters', 'mm', 'millimeters'],
    weight: ['lb', 'lbs', 'pounds', 'kg', 'kilograms', 'g', 'grams'],
    price: ['$', 'usd', 'dollars']
  };

  for (const unit of unitPatterns[fieldType]) {
    if (lowerValue.includes(unit)) {
      return unit;
    }
  }

  return null;
}

// Convert value with unit to standard database unit
export function convertValue(
  value: string, 
  fromUnit: string | null, 
  fieldType: 'length' | 'weight' | 'price'
): number {
  // Extract numeric value
  const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
  
  if (isNaN(numericValue)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  if (!fromUnit) {
    return numericValue; // Assume already in correct unit
  }

  const conversions = UNIT_CONVERSIONS[fieldType];
  const converter = conversions[fromUnit as keyof typeof conversions];
  
  if (!converter) {
    console.warn(`Unknown unit "${fromUnit}" for ${fieldType}, using value as-is`);
    return numericValue;
  }

  return converter(numericValue);
}

// Process CSV row into database format
export function processCSVRow(
  csvRow: CSVRow, 
  fieldMappings: FieldMapping[]
): Omit<SolarPanelInsert, 'id' | 'created_at' | 'updated_at'> {
  const processed: any = {};

  for (const mapping of fieldMappings) {
    const csvValue = csvRow[mapping.csvHeader];
    
    if (!csvValue || csvValue.trim() === '') {
      if (mapping.required) {
        throw new Error(`Required field "${mapping.csvHeader}" is missing or empty`);
      }
      continue;
    }

    let processedValue: any = csvValue.trim();

    // Handle numeric fields with potential unit conversions
    if (['length_cm', 'width_cm'].includes(mapping.dbField)) {
      const detectedUnit = detectUnit(csvValue, 'length');
      processedValue = convertValue(csvValue, detectedUnit, 'length');
    } else if (mapping.dbField === 'weight_kg') {
      const detectedUnit = detectUnit(csvValue, 'weight');
      processedValue = convertValue(csvValue, detectedUnit, 'weight');
    } else if (mapping.dbField === 'price_usd') {
      const detectedUnit = detectUnit(csvValue, 'price');
      processedValue = convertValue(csvValue, detectedUnit, 'price');
    } else if (['wattage', 'voltage'].includes(mapping.dbField)) {
      processedValue = parseFloat(processedValue);
      if (isNaN(processedValue)) {
        throw new Error(`Invalid numeric value for ${mapping.dbField}: ${csvValue}`);
      }
    }

    processed[mapping.dbField] = processedValue;
  }

  return processed;
}

// Find matching panel in database
export function findMatchingPanel(
  processedPanel: Omit<SolarPanelInsert, 'id' | 'created_at' | 'updated_at'>,
  existingPanels: SolarPanelRow[]
): SolarPanelRow | undefined {
  // First try exact name and manufacturer match
  let match = existingPanels.find(
    panel => 
      panel.name.toLowerCase() === processedPanel.name.toLowerCase() &&
      panel.manufacturer.toLowerCase() === processedPanel.manufacturer.toLowerCase()
  );

  if (match) return match;

  // Try fuzzy matching on name only (in case manufacturer is different)
  match = existingPanels.find(
    panel => panel.name.toLowerCase() === processedPanel.name.toLowerCase()
  );

  return match;
}

// Calculate changes between existing and new panel data
export function calculateChanges(
  existing: SolarPanelRow,
  updated: Omit<SolarPanelInsert, 'id' | 'created_at' | 'updated_at'>
): Partial<SolarPanelRow> {
  const changes: Partial<SolarPanelRow> = {};

  (Object.keys(updated) as Array<keyof typeof updated>).forEach(key => {
    if (key in existing && existing[key] !== updated[key]) {
      (changes as any)[key] = updated[key];
    }
  });

  return changes;
}
