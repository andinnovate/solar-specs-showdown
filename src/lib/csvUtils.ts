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
  hasError?: boolean;
  errorMessage?: string;
  rowIndex?: number;
}

// Field mapping configuration
export interface FieldMapping {
  csvHeader: string;
  dbField: keyof Omit<SolarPanelInsert, 'id' | 'created_at' | 'updated_at'>;
  unit?: string;
  selectedUnit?: string; // User-selected unit for conversion
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

// Unit options for user selection
export const UNIT_OPTIONS = {
  length: [
    { value: 'in', label: 'Inches (in)' },
    { value: 'cm', label: 'Centimeters (cm)' },
    { value: 'mm', label: 'Millimeters (mm)' }
  ],
  weight: [
    { value: 'lb', label: 'Pounds (lb)' },
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 'g', label: 'Grams (g)' }
  ],
  price: [
    { value: '$', label: 'US Dollars ($)' }
  ]
} as const;

// Get field type for unit selection
export function getFieldType(dbField: string): 'length' | 'weight' | 'price' | null {
  if (dbField === 'length_cm' || dbField === 'width_cm') return 'length';
  if (dbField === 'weight_kg') return 'weight';
  if (dbField === 'price_usd') return 'price';
  return null;
}

// Get unit options for a field
export function getUnitOptionsForField(dbField: string) {
  const fieldType = getFieldType(dbField);
  return fieldType ? UNIT_OPTIONS[fieldType] : [];
}

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

    const rawHeaders = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    
    // Filter out empty headers and keep track of valid column indices
    const validColumnIndices: number[] = [];
    const headers: string[] = [];
    
    rawHeaders.forEach((header, index) => {
      if (header && header.length > 0) {
        headers.push(header);
        validColumnIndices.push(index);
      }
    });
    
    console.log('Filtered headers:', headers);
    console.log('Valid column indices:', validColumnIndices);
    
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      const allValues = parseCSVLine(line).map(v => v.replace(/^"|"$/g, '').trim());
      
      // Only use values from valid column indices
      const row: CSVRow = {};
      headers.forEach((header, headerIndex) => {
        const valueIndex = validColumnIndices[headerIndex];
        row[header] = allValues[valueIndex] || '';
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
  const converter = conversions[fromUnit as keyof typeof conversions] as ((value: number) => number) | undefined;
  
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
  const processed: Record<string, unknown> = {};

  for (const mapping of fieldMappings) {
    const csvValue = csvRow[mapping.csvHeader];
    
    if (!csvValue || csvValue.trim() === '') {
      if (mapping.required) {
        throw new Error(`Required field "${mapping.csvHeader}" is missing or empty`);
      }
      continue;
    }

    let processedValue: unknown = csvValue.trim();

    // Handle numeric fields with potential unit conversions
    if (['length_cm', 'width_cm'].includes(mapping.dbField)) {
      // Use selected unit if available, otherwise detect from value
      const unitToUse = mapping.selectedUnit || detectUnit(csvValue, 'length');
      processedValue = convertValue(csvValue, unitToUse, 'length');
    } else if (mapping.dbField === 'weight_kg') {
      // Use selected unit if available, otherwise detect from value
      const unitToUse = mapping.selectedUnit || detectUnit(csvValue, 'weight');
      processedValue = convertValue(csvValue, unitToUse, 'weight');
    } else if (mapping.dbField === 'price_usd') {
      // Use selected unit if available, otherwise detect from value
      const unitToUse = mapping.selectedUnit || detectUnit(csvValue, 'price');
      processedValue = convertValue(csvValue, unitToUse, 'price');
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

  // Only compare valid database columns, ignore unmapped CSV fields
  const validColumns = [
    'name', 'manufacturer', 'length_cm', 'width_cm', 'weight_kg', 
    'wattage', 'voltage', 'price_usd', 'description', 'image_url', 'web_url'
  ];

  validColumns.forEach(key => {
    if (key in existing && key in updated && existing[key] !== updated[key]) {
      (changes as Record<string, unknown>)[key] = updated[key];
    }
  });

  return changes;
}
