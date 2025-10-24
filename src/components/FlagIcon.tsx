import { useState } from "react";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlagIconProps {
  panelId: string;
  flagCount: number;
  flaggedFields?: string[];
  pendingFlags?: number;
  onFlag: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const fieldLabels: Record<string, string> = {
  name: "Name",
  manufacturer: "Manufacturer", 
  wattage: "Wattage",
  voltage: "Voltage",
  length_cm: "Length",
  width_cm: "Width", 
  weight_kg: "Weight",
  price_usd: "Price",
  web_url: "Web URL",
  image_url: "Image URL",
  description: "Description"
};

export const FlagIcon = ({ 
  panelId, 
  flagCount, 
  flaggedFields = [], 
  pendingFlags = 0,
  onFlag, 
  className,
  size = "md"
}: FlagIconProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4", 
    lg: "w-5 h-5"
  };

  const hasFlags = flagCount > 0;
  const hasPendingFlags = pendingFlags > 0;
  
  const flaggedFieldsText = flaggedFields
    .map(field => fieldLabels[field] || field)
    .join(", ");

  // Determine tooltip text based on flag status
  let tooltipText = "Submit information about a problem with this listing";
  if (hasPendingFlags) {
    tooltipText = `This listing has ${pendingFlags} pending flag${pendingFlags > 1 ? 's' : ''} awaiting review`;
  } else if (hasFlags) {
    tooltipText = `This listing has been flagged and resolved for: ${flaggedFieldsText}`;
  }

  return (
    <div className="relative group">
      <button
        onClick={onFlag}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 rounded",
          className
        )}
        title={tooltipText}
        aria-label={tooltipText}
      >
        <Flag 
          className={cn(
            sizeClasses[size],
            "transition-all duration-200",
            hasPendingFlags
              ? "text-red-500 fill-current" // Red for pending flags
              : "text-gray-400 hover:text-red-500", // Gray for no flags or resolved
            isHovered && !hasPendingFlags && "scale-110"
          )}
        />
        {hasPendingFlags && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
            {pendingFlags}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50">
          {tooltipText}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};
