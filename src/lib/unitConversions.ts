// Unit conversion utilities for metric/imperial display

export type UnitSystem = 'metric' | 'imperial';

// Conversion constants
const CM_TO_INCHES = 0.393701;
const KG_TO_LBS = 2.20462;

export interface UnitDisplay {
  value: number;
  unit: string;
  originalValue: number;
  originalUnit: string;
}

// Convert centimeters to inches
export const cmToInches = (cm: number): number => {
  return Math.round(cm * CM_TO_INCHES * 10) / 10; // Round to 1 decimal place
};

// Convert inches to centimeters
export const inchesToCm = (inches: number): number => {
  return Math.round(inches / CM_TO_INCHES * 10) / 10; // Round to 1 decimal place
};

// Convert kilograms to pounds
export const kgToLbs = (kg: number): number => {
  return Math.round(kg * KG_TO_LBS * 10) / 10; // Round to 1 decimal place
};

// Convert pounds to kilograms
export const lbsToKg = (lbs: number): number => {
  return Math.round(lbs / KG_TO_LBS * 10) / 10; // Round to 1 decimal place
};

// Convert length based on unit system
export const convertLength = (cm: number, unitSystem: UnitSystem): UnitDisplay => {
  if (unitSystem === 'imperial') {
    return {
      value: cmToInches(cm),
      unit: 'in',
      originalValue: cm,
      originalUnit: 'cm'
    };
  }
  return {
    value: cm,
    unit: 'cm',
    originalValue: cm,
    originalUnit: 'cm'
  };
};

// Convert weight based on unit system
export const convertWeight = (kg: number, unitSystem: UnitSystem): UnitDisplay => {
  if (unitSystem === 'imperial') {
    return {
      value: kgToLbs(kg),
      unit: 'lbs',
      originalValue: kg,
      originalUnit: 'kg'
    };
  }
  return {
    value: kg,
    unit: 'kg',
    originalValue: kg,
    originalUnit: 'kg'
  };
};

// Format area display (always in m² for metric, ft² for imperial)
export const convertArea = (lengthCm: number, widthCm: number, unitSystem: UnitSystem): UnitDisplay => {
  const areaM2 = (lengthCm * widthCm) / 10000; // Convert cm² to m²
  
  if (unitSystem === 'imperial') {
    const areaFt2 = areaM2 * 10.764; // Convert m² to ft²
    return {
      value: Math.round(areaFt2 * 10) / 10, // Round to 1 decimal place
      unit: 'ft²',
      originalValue: areaM2,
      originalUnit: 'm²'
    };
  }
  
  return {
    value: Math.round(areaM2 * 100) / 100, // Round to 2 decimal places
    unit: 'm²',
    originalValue: areaM2,
    originalUnit: 'm²'
  };
};

// Format dimensions display (e.g., "45.2 × 26.1 in" or "115 × 66 cm")
export const formatDimensions = (lengthCm: number, widthCm: number, unitSystem: UnitSystem): string => {
  const lengthDisplay = convertLength(lengthCm, unitSystem);
  const widthDisplay = convertLength(widthCm, unitSystem);
  
  return `${lengthDisplay.value} × ${widthDisplay.value} ${lengthDisplay.unit}`;
};

// Format single dimension display
export const formatDimension = (cm: number, unitSystem: UnitSystem): string => {
  const display = convertLength(cm, unitSystem);
  return `${display.value}${display.unit}`;
};

// Format weight display
export const formatWeight = (kg: number, unitSystem: UnitSystem): string => {
  const display = convertWeight(kg, unitSystem);
  return `${display.value}${display.unit}`;
};

// Format area display
export const formatArea = (lengthCm: number, widthCm: number, unitSystem: UnitSystem): string => {
  const display = convertArea(lengthCm, widthCm, unitSystem);
  return `${display.value}${display.unit}`;
};
