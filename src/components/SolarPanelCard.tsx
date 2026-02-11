import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calculator, Zap, Weight, Ruler, ExternalLink, Eye, EyeOff, Star, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { UnitSystem, convertWeight, formatDimensions, formatArea, formatWeightWithPieces, wattsPerWeight, wattsPerArea } from "@/lib/unitConversions";
import { FlagIcon } from "@/components/FlagIcon";
import { FlagSubmissionModal } from "@/components/FlagSubmissionModal";
import { useState } from "react";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { addAmazonAffiliateTag } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { bandToClass, getOutlierLevel, getStatBand, outlierIndicatorText, OutlierLevel, StatMetric, StatThresholdMap, STAT_DIRECTIONS } from "@/lib/statBands";

type SolarPanel = Tables<"solar_panels"> & {
  user_verified_overrides?: string[] | null;
  flag_count?: number;
  pending_flags?: number;
};

interface SolarPanelCardProps {
  panel: SolarPanel;
  onToggleSelection?: (id: string) => void;
  isSelected?: boolean;
  isHidden?: boolean;
  isFavorite?: boolean;
  isFadingOut?: boolean;
  onToggleHidden?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  showUserActions?: boolean;
  unitSystem?: UnitSystem;
  statThresholds?: StatThresholdMap;
}

export const SolarPanelCard = ({ 
  panel, 
  onToggleSelection, 
  isSelected = false, 
  isHidden = false, 
  isFavorite = false, 
  isFadingOut = false,
  onToggleHidden, 
  onToggleFavorite, 
  showUserActions = false,
  unitSystem = 'metric',
  statThresholds
}: SolarPanelCardProps) => {
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagLoading, setFlagLoading] = useState(false);

  // Helper functions for missing data
  const hasMissingData = (panel: SolarPanel): boolean => {
    const missingFields = panel.missing_fields as string[] | null;
    if (!missingFields || missingFields.length === 0) {
      return false;
    }
    
    // If user_verified_overrides exists, exclude those fields from missing data check
    const verifiedOverrides = panel.user_verified_overrides as string[] | null;
    if (verifiedOverrides && verifiedOverrides.length > 0) {
      const unverifiedMissingFields = missingFields.filter(
        field => !verifiedOverrides.includes(field)
      );
      return unverifiedMissingFields.length > 0;
    }
    
    return true;
  };

  const getMissingFieldsDisplay = (panel: SolarPanel): string => {
    const missingFields = panel.missing_fields as string[] | null;
    if (!missingFields || missingFields.length === 0) {
      return '';
    }
    
    // Filter out fields that are in user_verified_overrides
    let fieldsToShow = missingFields;
    const verifiedOverrides = panel.user_verified_overrides as string[] | null;
    if (verifiedOverrides && verifiedOverrides.length > 0) {
      fieldsToShow = missingFields.filter(
        field => !verifiedOverrides.includes(field)
      );
    }
    
    if (fieldsToShow.length === 0) {
      return '';
    }
    
    const fieldMap: Record<string, string> = {
      'wattage': 'Power rating',
      'dimensions': 'Dimensions',
      'weight': 'Weight',
      'voltage': 'Voltage',
      'price': 'Price'
    };
    return fieldsToShow.map(f => fieldMap[f] || f).join(', ');
  };
  
  // Calculate price per watt using total wattage (wattage × piece_count)
  const pieceCount = panel.piece_count || 1;
  const totalWattage = panel.wattage ? panel.wattage * pieceCount : null;
  const priceValue = panel.price_usd && panel.price_usd > 0 ? panel.price_usd : null;
  const pricePerWattValue = totalWattage && priceValue ? Math.round((priceValue / totalWattage) * 100) / 100 : null;
  const pricePerWattDisplay = pricePerWattValue !== null ? pricePerWattValue.toFixed(2) : null;
  const wattsPerKg = wattsPerWeight(panel.wattage ?? null, panel.weight_kg ?? null, unitSystem);
  const wattsPerSqM = wattsPerArea(panel.wattage ?? null, panel.length_cm ?? null, panel.width_cm ?? null, unitSystem);
  const totalWeightValue = panel.weight_kg && panel.weight_kg > 0
    ? convertWeight(panel.weight_kg * pieceCount, unitSystem).value
    : null;

  const getStatPresentation = (metric: StatMetric, value: number | null, fallbackClass: string) => {
    const thresholds = statThresholds?.[metric] ?? null;
    const band = getStatBand(value, thresholds, STAT_DIRECTIONS[metric]);
    const bandClass = bandToClass(band);
    const outlierLevel = getOutlierLevel(value, thresholds);
    return {
      className: bandClass || fallbackClass,
      outlierLevel,
    };
  };

  const renderOutlierIndicator = (level: OutlierLevel) => {
    const indicator = outlierIndicatorText(level);
    if (!indicator) {
      return null;
    }
    const title = level === 'extreme' ? 'Extreme outlier (IQR)' : 'Outlier (IQR)';
    return (
      <span className="ml-1 text-red-600 font-bold" title={title} aria-label={title}>
        {indicator}
      </span>
    );
  };

  const wattagePresentation = getStatPresentation('wattage', totalWattage, '');
  const pricePresentation = getStatPresentation('price', priceValue, 'text-primary');
  const pricePerWattPresentation = getStatPresentation('pricePerWatt', pricePerWattValue, 'text-secondary');
  const weightPresentation = getStatPresentation('weight', totalWeightValue, 'text-foreground');
  const wattsPerWeightPresentation = getStatPresentation('wattsPerWeight', wattsPerKg, 'text-accent');
  const wattsPerAreaPresentation = getStatPresentation('wattsPerArea', wattsPerSqM, 'text-accent');

  return (
    <Card className={`overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
      isFadingOut ? 'opacity-0 scale-95' : isHidden ? 'opacity-50' : 'opacity-100'
    }`}>
      <div className="h-48 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 flex items-center justify-center relative overflow-hidden">
        {panel.image_url ? (
          <img 
            src={panel.image_url} 
            alt={`${panel.name} by ${panel.manufacturer}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
            }}
          />
        ) : (
          <Zap className="w-20 h-20 text-primary/30" />
        )}
        {isHidden && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <EyeOff className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          <FlagIcon
            panelId={panel.id}
            flagCount={panel.flag_count || 0}
            flaggedFields={panel.user_verified_overrides || []}
            pendingFlags={panel.pending_flags || 0}
            onFlag={() => setShowFlagModal(true)}
            className="bg-background/80 hover:bg-background rounded p-1"
            size="sm"
          />
          {showUserActions && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-background/80 hover:bg-background"
                onClick={() => onToggleHidden?.(panel.id)}
                title={isHidden ? "Show panel" : "Hide panel"}
              >
                {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-background/80 hover:bg-background"
                onClick={() => onToggleFavorite?.(panel.id)}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
            </>
          )}
        </div>
      </div>
      
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl flex-1 min-w-0">{panel.name}</CardTitle>
              {panel.web_url && (() => {
                try {
                  const domain = new URL(panel.web_url).hostname;
                  const affiliateUrl = addAmazonAffiliateTag(panel.web_url);
                  return (
                    <a 
                      href={affiliateUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:opacity-70 transition-opacity inline-flex items-center flex-shrink-0"
                      aria-label={`View on ${domain}`}
                      title={`View on ${domain}`}
                    >
                      <img 
                        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
                        alt={domain}
                        className="w-5 h-5 flex-shrink-0"
                        onError={(e) => {
                          // Fallback to ExternalLink icon if favicon fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const icon = document.createElement('div');
                          icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
                          target.parentElement?.appendChild(icon.firstChild!);
                        }}
                      />
                    </a>
                  );
                } catch {
                  return null;
                }
              })()}
            </div>
            <CardDescription>
              {panel.manufacturer}
              {(panel.piece_count || 1) > 1 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({panel.piece_count} pieces)
                </span>
              )}
            </CardDescription>
            {hasMissingData(panel) && (
              <Badge variant="outline" className="mt-2 text-xs">
                <AlertCircle className="w-3 h-3 mr-1" />
                Incomplete data
              </Badge>
            )}
          </div>
          {panel.wattage ? (
            <div className="text-right">
              <Badge variant="secondary" className={cn("text-lg font-bold", wattagePresentation.className)}>
                {totalWattage}W
                {renderOutlierIndicator(wattagePresentation.outlierLevel)}
              </Badge>
              {(panel.piece_count || 1) > 1 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {panel.wattage}W/ea × {panel.piece_count} pcs
                </div>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="text-sm">
              Power N/A
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {panel.description}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Ruler className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Size:</span>
            {panel.length_cm && panel.width_cm ? (
              <span className="font-medium">
                {formatArea(panel.length_cm, panel.width_cm, unitSystem)}
                <span className="text-muted-foreground text-xs ml-1">
                  ({formatDimensions(panel.length_cm, panel.width_cm, unitSystem)})
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Not available
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 ml-1 text-xs"
                  onClick={() => setShowFlagModal(true)}
                >
                  Help improve
                </Button>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Weight className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Weight:</span>
            {panel.weight_kg ? (
              <span className={cn("font-medium", weightPresentation.className)}>
                {formatWeightWithPieces(panel.weight_kg, panel.piece_count || 1, unitSystem)}
                {renderOutlierIndicator(weightPresentation.outlierLevel)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Not available
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 ml-1 text-xs"
                  onClick={() => setShowFlagModal(true)}
                >
                  Help improve
                </Button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Voltage:</span>
            {panel.voltage ? (
              <span className="font-medium">{panel.voltage}V</span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Not available
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 ml-1 text-xs"
                  onClick={() => setShowFlagModal(true)}
                >
                  Help improve
                </Button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calculator className="w-4 h-4 text-secondary" />
            <span className="text-muted-foreground">$/W:</span>
            {pricePerWattDisplay ? (
              <span className={cn("font-bold", pricePerWattPresentation.className)}>
                ${pricePerWattDisplay}
                {renderOutlierIndicator(pricePerWattPresentation.outlierLevel)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">N/A</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-muted-foreground">W/{unitSystem === 'imperial' ? 'lb' : 'kg'}:</span>
            {wattsPerKg !== null ? (
              <span className={cn("font-bold", wattsPerWeightPresentation.className)}>
                {wattsPerKg}
                {renderOutlierIndicator(wattsPerWeightPresentation.outlierLevel)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">N/A</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm col-span-2">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-muted-foreground">W/{unitSystem === 'imperial' ? 'ft²' : 'm²'}:</span>
            {wattsPerSqM !== null ? (
              <span className={cn("font-bold", wattsPerAreaPresentation.className)}>
                {wattsPerSqM}
                {renderOutlierIndicator(wattsPerAreaPresentation.outlierLevel)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">N/A</span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between items-center">
            {panel.price_usd === 0 ? (
              <span className="text-lg text-orange-600 font-medium">
                Currently Unavailable
              </span>
            ) : panel.price_usd ? (
              <span className={cn("text-2xl font-bold", pricePresentation.className)}>
                ${panel.price_usd.toFixed(2)}
                {renderOutlierIndicator(pricePresentation.outlierLevel)}
              </span>
            ) : (
              <span className="text-lg text-muted-foreground">
                Price not available
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 ml-1 text-xs"
                  onClick={() => setShowFlagModal(true)}
                >
                  Help improve
                </Button>
              </span>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`select-${panel.id}`}
                checked={isSelected}
                onCheckedChange={() => onToggleSelection?.(panel.id)}
              />
              <label 
                htmlFor={`select-${panel.id}`} 
                className="text-sm font-medium cursor-pointer"
              >
                Select for comparison
              </label>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Flag Submission Modal */}
      <FlagSubmissionModal
        panel={panel}
        isOpen={showFlagModal}
        onClose={() => setShowFlagModal(false)}
        onSubmit={async (flagData) => {
          setFlagLoading(true);
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
              throw new Error('You must be logged in to submit flags');
            }

            console.log('Current user:', user.id, user.email);

            // Submit flag to database
            const flagInsertData: TablesInsert<'user_flags'> = {
              panel_id: panel.id,
              user_id: user.id,
              flagged_fields: flagData.flaggedFields, // This should be JSONB array
              suggested_corrections: flagData.suggestedCorrections, // This should be JSONB object
              user_comment: flagData.userComment,
              status: 'pending'
            };

            // Add deletion recommendation data if present
            if (flagData.recommendDeletion) {
              flagInsertData.flag_type = 'deletion_recommendation';
              flagInsertData.deletion_reason = flagData.deletionReason;
              if (flagData.deletionOtherReason) {
                flagInsertData.deletion_other_reason = flagData.deletionOtherReason;
              }
            }

            const { data, error } = await supabase
              .from('user_flags')
              .insert(flagInsertData)
              .select()
              .single();

            if (error) {
              // Check if it's a table doesn't exist error
              if (error.message.includes('relation "user_flags" does not exist')) {
                throw new Error('Flag submission system is not yet set up. Please contact an administrator.');
              }
              throw new Error(`Failed to submit flag: ${error.message}`);
            }

            console.log('Flag submitted successfully:', data);
            setShowFlagModal(false);
            
            // Show success message (you might want to add a toast notification here)
            alert('Flag submitted successfully! Thank you for helping improve our data.');
            
          } catch (error) {
            console.error('Failed to submit flag:', error);
            alert(`Failed to submit flag: ${error instanceof Error ? error.message : 'Unknown error'}`);
          } finally {
            setFlagLoading(false);
          }
        }}
        loading={flagLoading}
        unitSystem={unitSystem}
      />
    </Card>
  );
};
