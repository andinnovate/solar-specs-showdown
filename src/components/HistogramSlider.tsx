import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface HistogramSliderProps {
  label: string;
  value: [number, number];
  min: number;
  max: number;
  step: number;
  data: number[]; // Array of all data points for this metric
  unit?: string;
  formatValue?: (value: number) => string;
  onValueChange: (value: [number, number]) => void;
  className?: string;
}

export const HistogramSlider = ({
  label,
  value,
  min,
  max,
  step,
  data,
  unit = "",
  formatValue,
  onValueChange,
  className
}: HistogramSliderProps) => {
  const histogramData = useMemo(() => {
    if (data.length === 0) return [];
    
    // Create bins for the histogram
    const binCount = 50; // Number of bins for smooth curve
    const binSize = (max - min) / binCount;
    const bins = new Array(binCount).fill(0);
    
    // Count data points in each bin
    data.forEach(point => {
      if (point >= min && point <= max) {
        const binIndex = Math.min(Math.floor((point - min) / binSize), binCount - 1);
        bins[binIndex]++;
      }
    });
    
    // Normalize to percentage of max bin
    const maxCount = Math.max(...bins);
    if (maxCount === 0) return [];
    
    return bins.map((count, index) => ({
      x: (index / binCount) * 100, // Position as percentage
      y: (count / maxCount) * 100, // Height as percentage
      value: min + (index * binSize)
    }));
  }, [data, min, max]);

  const formatDisplayValue = (val: number) => {
    if (formatValue) return formatValue(val);
    return `${val}${unit}`;
  };

  // Create SVG path for smooth curve
  const createSmoothPath = (points: typeof histogramData) => {
    if (points.length < 2) return "";
    
    let path = `M 0,100`; // Start at bottom left
    
    // Add curve points
    points.forEach((point, index) => {
      if (index === 0) {
        path += ` L ${point.x},${100 - point.y}`;
      } else {
        // Use quadratic curves for smoothness
        const prevPoint = points[index - 1];
        const controlX = (prevPoint.x + point.x) / 2;
        path += ` Q ${controlX},${100 - prevPoint.y} ${point.x},${100 - point.y}`;
      }
    });
    
    path += ` L 100,100 Z`; // Close path at bottom right
    return path;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-sm text-muted-foreground">
          {formatDisplayValue(value[0])} - {formatDisplayValue(value[1])}
        </span>
      </Label>
      
      <div className="relative">
        {/* Histogram Background */}
        <div className="absolute inset-0 h-8 w-full pointer-events-none">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0"
          >
            <defs>
              <linearGradient id={`histogram-gradient-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path
              d={createSmoothPath(histogramData)}
              fill={`url(#histogram-gradient-${label})`}
              stroke="hsl(var(--primary))"
              strokeWidth="0.5"
              strokeOpacity="0.6"
            />
          </svg>
        </div>
        
        {/* Slider */}
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onValueChange={onValueChange}
          className="py-4 relative z-10"
        />
      </div>
    </div>
  );
};
