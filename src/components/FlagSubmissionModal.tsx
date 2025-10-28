import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Flag, AlertCircle, LogIn, Trash2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { UnitSystem } from "@/lib/unitConversions";
import { supabase } from "@/integrations/supabase/client";

type SolarPanel = Tables<"solar_panels">;

interface FlagSubmission {
  flaggedFields: string[];
  suggestedCorrections: Record<string, string | number>;
  userComment: string;
  recommendDeletion?: boolean;
  deletionReason?: string;
  deletionOtherReason?: string;
}

interface FlagSubmissionModalProps {
  panel: SolarPanel;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (flagData: FlagSubmission) => void;
  loading?: boolean;
  unitSystem?: UnitSystem;
}

const fieldConfig = {
  name: { label: "Name", type: "textarea", placeholder: "Enter correct name", prepopulate: true },
  manufacturer: { label: "Manufacturer", type: "textarea", placeholder: "Enter correct manufacturer", prepopulate: true },
  wattage: { label: "Wattage (W)", type: "number", placeholder: "Enter wattage" },
  voltage: { label: "Voltage (V)", type: "number", placeholder: "Enter voltage", step: "0.01" },
  length_cm: { label: "Length", type: "number", placeholder: "Enter length", step: "0.01", unit: "cm" },
  width_cm: { label: "Width", type: "number", placeholder: "Enter width", step: "0.01", unit: "cm" },
  weight_kg: { label: "Weight", type: "number", placeholder: "Enter weight", step: "0.01", unit: "kg" },
  price_usd: { label: "Price (USD)", type: "number", placeholder: "Enter price", step: "0.01" },
  description: { label: "Description", type: "textarea", placeholder: "Enter correct description", prepopulate: true }
};

export const FlagSubmissionModal = ({ 
  panel, 
  isOpen, 
  onClose, 
  onSubmit, 
  loading = false,
  unitSystem = 'metric'
}: FlagSubmissionModalProps) => {
  const [flaggedFields, setFlaggedFields] = useState<string[]>([]);
  const [suggestedCorrections, setSuggestedCorrections] = useState<Record<string, string | number>>({});
  const [userComment, setUserComment] = useState("");
  const [recommendDeletion, setRecommendDeletion] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionOtherReason, setDeletionOtherReason] = useState("");
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('Auth error:', error);
        }
        setUser(user);
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    if (isOpen) {
      checkAuth();
    }
  }, [isOpen]);

  // Unit conversion functions
  const cmToInches = (cm: number) => cm / 2.54;
  const inchesToCm = (inches: number) => inches * 2.54;
  const kgToPounds = (kg: number) => kg * 2.20462;
  const poundsToKg = (pounds: number) => pounds / 2.20462;

  // Get display value for a field (converted to user's unit system)
  const getDisplayValue = (field: string) => {
    const value = panel[field as keyof SolarPanel];
    if (value === null || value === undefined) return "Not set";
    
    if (unitSystem === 'imperial') {
      if (field === 'length_cm') return cmToInches(value as number).toFixed(2);
      if (field === 'width_cm') return cmToInches(value as number).toFixed(2);
      if (field === 'weight_kg') return kgToPounds(value as number).toFixed(2);
    }
    
    return value.toString();
  };

  // Get unit label for a field
  const getUnitLabel = (field: string) => {
    if (unitSystem === 'imperial') {
      if (field === 'length_cm') return 'Length (in)';
      if (field === 'width_cm') return 'Width (in)';
      if (field === 'weight_kg') return 'Weight (lbs)';
    }
    return fieldConfig[field as keyof typeof fieldConfig]?.label || field;
  };

  // Convert user input back to metric for submission
  const convertToMetric = (field: string, value: number) => {
    if (unitSystem === 'imperial') {
      if (field === 'length_cm') return inchesToCm(value);
      if (field === 'width_cm') return inchesToCm(value);
      if (field === 'weight_kg') return poundsToKg(value);
    }
    return value;
  };

  // Get display value for input fields (converted to user's unit system)
  const getInputValue = (field: string) => {
    const value = suggestedCorrections[field];
    if (value === undefined || value === null) return "";
    
    if (unitSystem === 'imperial' && typeof value === 'number') {
      if (field === 'length_cm') return cmToInches(value).toString();
      if (field === 'width_cm') return cmToInches(value).toString();
      if (field === 'weight_kg') return kgToPounds(value).toString();
    }
    
    return value.toString();
  };

  const handleFieldToggle = (field: string, checked: boolean) => {
    if (checked) {
      setFlaggedFields(prev => [...prev, field]);
      
      // Prepopulate text fields with current values
      const config = fieldConfig[field as keyof typeof fieldConfig];
      if (config && 'prepopulate' in config && config.prepopulate) {
        const currentValue = panel[field as keyof SolarPanel];
        if (currentValue !== null && currentValue !== undefined) {
          setSuggestedCorrections(prev => ({
            ...prev,
            [field]: currentValue as string | number
          }));
        }
      }
    } else {
      setFlaggedFields(prev => prev.filter(f => f !== field));
      // Remove suggested correction for unchecked field
      setSuggestedCorrections(prev => {
        const newCorrections = { ...prev };
        delete newCorrections[field];
        return newCorrections;
      });
    }
  };

  const handleCorrectionChange = (field: string, value: string) => {
    const fieldType = fieldConfig[field as keyof typeof fieldConfig]?.type;
    let processedValue: string | number = value;
    
    if (fieldType === "number") {
      const numValue = value === "" ? 0 : parseFloat(value);
      // Convert to metric for storage
      processedValue = convertToMetric(field, numValue);
    }
    
    setSuggestedCorrections(prev => ({
      ...prev,
      [field]: processedValue
    }));
  };

  const handleSubmit = () => {
    if (flaggedFields.length === 0 && !recommendDeletion) {
      return;
    }

    if (recommendDeletion && !deletionReason) {
      return;
    }

    if (recommendDeletion && deletionReason === 'other' && !deletionOtherReason.trim()) {
      return;
    }

    onSubmit({
      flaggedFields,
      suggestedCorrections,
      userComment,
      recommendDeletion,
      deletionReason: recommendDeletion ? deletionReason : undefined,
      deletionOtherReason: recommendDeletion && deletionReason === 'other' ? deletionOtherReason : undefined
    });
  };

  const handleClose = () => {
    setFlaggedFields([]);
    setSuggestedCorrections({});
    setUserComment("");
    setRecommendDeletion(false);
    setDeletionReason("");
    setDeletionOtherReason("");
    onClose();
  };

  const getCurrentValue = (field: string) => {
    const value = panel[field as keyof SolarPanel];
    if (value === null || value === undefined) return "Not set";
    if (typeof value === "number") return value.toString();
    return value as string;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            Flag Incorrect Information
          </DialogTitle>
          <DialogDescription>
            Help improve data quality by reporting incorrect information for: <strong>{panel.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {authLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Checking authentication...</p>
            </div>
          </div>
        ) : !user ? (
          <div className="text-center py-8 space-y-4">
            <LogIn className="w-12 h-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Account Required</h3>
              <p className="text-muted-foreground">
                You must be logged in to submit flags for incorrect information.
              </p>
              <p className="text-sm text-muted-foreground">
                Please create an account or log in to help improve our data quality.
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => {
                // You can add login redirect logic here
                window.location.href = '/auth';
              }}>
                <LogIn className="w-4 h-4 mr-2" />
                Log In
              </Button>
            </div>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Field Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">What information is incorrect?</Label>
            <p className="text-sm text-muted-foreground">
              Check the boxes for any fields that contain incorrect information.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(fieldConfig).map(([field, config]) => (
                <div key={field} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={field}
                      checked={flaggedFields.includes(field)}
                      onCheckedChange={(checked) => handleFieldToggle(field, checked as boolean)}
                    />
                    <Label htmlFor={field} className="text-sm font-medium">
                      {getUnitLabel(field)}
                    </Label>
                  </div>
                  
                  <div className="text-xs text-muted-foreground ml-6">
                    Current: <span className="font-mono">{getDisplayValue(field)}</span>
                  </div>

                  {flaggedFields.includes(field) && (
                    <div className="ml-6 space-y-1">
                      <Label htmlFor={`correction-${field}`} className="text-xs">
                        Suggested correction:
                      </Label>
                      {config.type === "textarea" ? (
                        <Textarea
                          id={`correction-${field}`}
                          placeholder={config.placeholder}
                          value={getInputValue(field)}
                          onChange={(e) => handleCorrectionChange(field, e.target.value)}
                          rows={field === 'description' ? 4 : 2}
                          className="text-sm resize-y"
                        />
                      ) : (
                        <Input
                          id={`correction-${field}`}
                          type={config.type}
                          step={'step' in config ? config.step : undefined}
                          placeholder={config.placeholder}
                          value={getInputValue(field)}
                          onChange={(e) => handleCorrectionChange(field, e.target.value)}
                          className="text-sm"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Additional Comments */}
          <div className="space-y-2">
            <Label htmlFor="comment">Additional Information (Optional)</Label>
            <Textarea
              id="comment"
              placeholder="Provide any additional context about the incorrect information..."
              value={userComment}
              onChange={(e) => setUserComment(e.target.value)}
              rows={3}
            />
          </div>

          {/* Deletion Recommendation */}
          <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recommend-deletion"
                checked={recommendDeletion}
                onCheckedChange={(checked) => setRecommendDeletion(checked as boolean)}
              />
              <Label htmlFor="recommend-deletion" className="text-sm font-medium text-red-800">
                <Trash2 className="w-4 h-4 inline mr-1" />
                Recommend deletion of this panel
              </Label>
            </div>
            
            {recommendDeletion && (
              <div className="ml-6 space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-red-800">Reason for deletion:</Label>
                  <RadioGroup value={deletionReason} onValueChange={setDeletionReason}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="not_solar_panel" id="not_solar_panel" />
                      <Label htmlFor="not_solar_panel" className="text-sm text-red-700">
                        Not a solar panel
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="wattage_too_low" id="wattage_too_low" />
                      <Label htmlFor="wattage_too_low" className="text-sm text-red-700">
                        Wattage too low
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other" className="text-sm text-red-700">
                        Other
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {deletionReason === 'other' && (
                  <div className="space-y-2">
                    <Label htmlFor="deletion-other-reason" className="text-sm font-medium text-red-800">
                      Please specify:
                    </Label>
                    <Textarea
                      id="deletion-other-reason"
                      placeholder="Explain why this panel should be deleted..."
                      value={deletionOtherReason}
                      onChange={(e) => setDeletionOtherReason(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                )}
                
                <div className="flex items-start gap-2 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Deletion recommendations will be reviewed by our team.</p>
                    <p>If approved, this panel will be permanently removed from the database.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          {flaggedFields.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Your flag will be reviewed by our team.</p>
                <p>If approved, the suggested corrections will be applied and protected from automatic updates.</p>
              </div>
            </div>
          )}
        </div>
        )}

        {user && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={(flaggedFields.length === 0 && !recommendDeletion) || loading || (recommendDeletion && !deletionReason) || (recommendDeletion && deletionReason === 'other' && !deletionOtherReason.trim())}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? "Submitting..." : (
                recommendDeletion ? 
                  `Submit Deletion Recommendation` : 
                  `Submit Flag${flaggedFields.length > 0 ? ` (${flaggedFields.length} field${flaggedFields.length > 1 ? 's' : ''})` : ''}`
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
