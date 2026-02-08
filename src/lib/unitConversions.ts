// Unit conversion utilities for metric/imperial display

export type UnitSystem = 'metric' | 'imperial';

// Conversion constants
const CM_TO_INCHES = 0.393701;
const KG_TO_LBS = 2.20462;
const SQM_TO_SQFT = 10.764;
const KG_PER_LB = 1 / KG_TO_LBS;

const roundTo = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

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

export const convertWattsPerWeightValue = (
  value: number,
  fromUnitSystem: UnitSystem,
  toUnitSystem: UnitSystem
): number => {
  if (fromUnitSystem === toUnitSystem) {
    return value;
  }
  return toUnitSystem === 'imperial' ? value * KG_PER_LB : value / KG_PER_LB;
};

export const convertWattsPerAreaValue = (
  value: number,
  fromUnitSystem: UnitSystem,
  toUnitSystem: UnitSystem
): number => {
  if (fromUnitSystem === toUnitSystem) {
    return value;
  }
  return toUnitSystem === 'imperial' ? value / SQM_TO_SQFT : value * SQM_TO_SQFT;
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
    const areaFt2 = areaM2 * SQM_TO_SQFT; // Convert m² to ft²
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

export const wattsPerWeight = (
  wattage: number | null,
  weightKg: number | null,
  unitSystem: UnitSystem
): number | null => {
  if (wattage === null || weightKg === null || weightKg === 0) {
    return null;
  }
  const wattsPerKg = wattage / weightKg;
  const converted =
    unitSystem === 'imperial' ? wattsPerKg * KG_PER_LB : wattsPerKg;
  return unitSystem === 'imperial' ? roundTo(converted, 1) : roundTo(converted, 2);
};

export const wattsPerArea = (
  wattage: number | null,
  lengthCm: number | null,
  widthCm: number | null,
  unitSystem: UnitSystem
): number | null => {
  if (wattage === null || lengthCm === null || widthCm === null || lengthCm === 0 || widthCm === 0) {
    return null;
  }
  const areaM2 = (lengthCm * widthCm) / 10000;
  if (areaM2 === 0) {
    return null;
  }
  const wattsPerSqM = wattage / areaM2;
  const converted =
    unitSystem === 'imperial' ? wattsPerSqM / SQM_TO_SQFT : wattsPerSqM;
  return unitSystem === 'imperial' ? roundTo(converted, 1) : Math.round(converted);
};

// Format weight with piece count information
// Shows "X lbs (Y lbs/ea)" for multi-piece sets or "X lbs" for single pieces
export const formatWeightWithPieces = (kg: number, pieceCount: number, unitSystem: UnitSystem): string => {
  const perPieceWeight = formatWeight(kg, unitSystem);
  
  if (pieceCount > 1) {
    const totalWeight = kg * pieceCount;
    const totalWeightDisplay = convertWeight(totalWeight, unitSystem);
    return `${totalWeightDisplay.value}${totalWeightDisplay.unit} (${perPieceWeight}/ea)`;
  }
  
  return perPieceWeight;
};

// Format wattage with piece count information
// Shows "X W (Y W/ea × Z pcs)" for multi-piece sets or "X W" for single pieces
export const formatWattageWithPieces = (wattage: number | null, pieceCount: number, unitSystem: UnitSystem): string => {
  if (wattage === null) {
    return 'N/A';
  }
  
  if (pieceCount > 1) {
    const totalWattage = wattage * pieceCount;
    return `${totalWattage}W (${wattage}W/ea × ${pieceCount} pcs)`;
  }
  
  return `${wattage}W`;
};
