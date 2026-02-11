export type StatMetric =
  | 'price'
  | 'pricePerWatt'
  | 'wattage'
  | 'wattsPerWeight'
  | 'wattsPerArea'
  | 'weight';

export type StatDirection = 'higher' | 'lower';
export type StatBand = 'green' | 'yellow' | 'orange' | 'red' | 'neutral';
export type OutlierLevel = 'none' | 'outlier' | 'extreme';

export interface StatThresholds {
  q20: number;
  q40: number;
  q60: number;
  q80: number;
  q1: number;
  q3: number;
  iqr: number;
  lowOutlier: number;
  highOutlier: number;
  lowExtreme: number;
  highExtreme: number;
  sampleSize: number;
  outlierEligible: boolean;
}

export type StatThresholdMap = Record<StatMetric, StatThresholds | null>;

export const STAT_DIRECTIONS: Record<StatMetric, StatDirection> = {
  price: 'lower',
  pricePerWatt: 'lower',
  wattage: 'higher',
  wattsPerWeight: 'higher',
  wattsPerArea: 'higher',
  weight: 'lower',
};

const quantileSorted = (sorted: number[], q: number): number => {
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const lower = sorted[base];
  const upper = sorted[base + 1] ?? lower;
  return lower + rest * (upper - lower);
};

export const computeStatThresholds = (values: number[]): StatThresholds | null => {
  const cleaned = values.filter(value => Number.isFinite(value));
  if (cleaned.length < 5) {
    return null;
  }
  const sorted = [...cleaned].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  const outlierEligible = cleaned.length >= 12 && iqr > 0;
  const lowOutlier = outlierEligible ? q1 - 1.5 * iqr : -Infinity;
  const highOutlier = outlierEligible ? q3 + 1.5 * iqr : Infinity;
  const lowExtreme = outlierEligible ? q1 - 3 * iqr : -Infinity;
  const highExtreme = outlierEligible ? q3 + 3 * iqr : Infinity;

  return {
    q20: quantileSorted(sorted, 0.2),
    q40: quantileSorted(sorted, 0.4),
    q60: quantileSorted(sorted, 0.6),
    q80: quantileSorted(sorted, 0.8),
    q1,
    q3,
    iqr,
    lowOutlier,
    highOutlier,
    lowExtreme,
    highExtreme,
    sampleSize: cleaned.length,
    outlierEligible,
  };
};

export const getStatBand = (
  value: number | null,
  thresholds: StatThresholds | null,
  direction: StatDirection
): StatBand => {
  if (value === null || thresholds === null) {
    return 'neutral';
  }

  if (direction === 'higher') {
    if (value >= thresholds.q80) return 'green';
    if (value >= thresholds.q60) return 'yellow';
    if (value >= thresholds.q40) return 'orange';
    return 'red';
  }

  if (value <= thresholds.q20) return 'green';
  if (value <= thresholds.q40) return 'yellow';
  if (value <= thresholds.q60) return 'orange';
  return 'red';
};

export const getOutlierLevel = (
  value: number | null,
  thresholds: StatThresholds | null
): OutlierLevel => {
  if (value === null || thresholds === null || !thresholds.outlierEligible) {
    return 'none';
  }
  if (value < thresholds.lowExtreme || value > thresholds.highExtreme) {
    return 'extreme';
  }
  if (value < thresholds.lowOutlier || value > thresholds.highOutlier) {
    return 'outlier';
  }
  return 'none';
};

export const bandToClass = (band: StatBand): string => {
  switch (band) {
    case 'green':
      return 'text-emerald-600';
    case 'yellow':
      return 'text-yellow-600';
    case 'orange':
      return 'text-orange-600';
    case 'red':
      return 'text-red-600';
    default:
      return '';
  }
};

export const outlierIndicatorText = (level: OutlierLevel): string | null => {
  if (level === 'extreme') {
    return '!!';
  }
  if (level === 'outlier') {
    return '!';
  }
  return null;
};
