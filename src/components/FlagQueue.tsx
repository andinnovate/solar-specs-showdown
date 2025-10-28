import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Flag, 
  Check, 
  X, 
  Edit, 
  User, 
  Calendar, 
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Trash2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cmToInches, inchesToCm, kgToLbs, lbsToKg } from "@/lib/unitConversions";

interface FlagData {
  id: string;
  panel_id: string;
  user_id: string | null;  // System flags have null user_id
  flag_type: string;  // NEW: 'user', 'system_missing_data', 'system_parse_failure', 'deletion_recommendation'
  flagged_fields: string[];
  suggested_corrections: Record<string, any>;
  user_comment: string;
  status: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
  resolved_at: string;
  resolved_by: string;
  deletion_reason?: string;
  deletion_other_reason?: string;
  panel_name: string;
  manufacturer: string;
  wattage: number | null;  // Now nullable
  price_usd: number | null;  // Now nullable
  user_email: string | null;  // System flags have null user_email
  resolved_by_email: string;
  // Current panel values for comparison
  current_name?: string;
  current_manufacturer?: string;
  current_wattage?: number;
  current_voltage?: number;
  current_length_cm?: number;
  current_width_cm?: number;
  current_weight_kg?: number;
  current_price_usd?: number;
  current_description?: string;
  web_url?: string;
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

const deletionReasonLabels: Record<string, string> = {
  not_solar_panel: "Not a solar panel",
  wattage_too_low: "Wattage too low",
  other: "Other"
};

export const FlagQueue = () => {
  const [flags, setFlags] = useState<FlagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<FlagData | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [flagFilter, setFlagFilter] = useState<'all' | 'user' | 'system'>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; flag: FlagData | null }>({
    isOpen: false,
    flag: null
  });
  const [editedCorrections, setEditedCorrections] = useState<Record<string, any>>({});
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('solar-panel-unit-system');
      return (saved as 'metric' | 'imperial') || 'metric';
    }
    return 'metric';
  });

  useEffect(() => {
    loadFlags();
  }, [flagFilter]);

  const loadFlags = async () => {
    try {
      setLoading(true);
      
      // Query the admin_flag_queue view to get pending flags with current panel data
      let query = supabase
        .from('admin_flag_queue' as any)
        .select(`
          *,
          solar_panels!inner(
            name,
            manufacturer,
            wattage,
            voltage,
            length_cm,
            width_cm,
            weight_kg,
            price_usd,
            description,
            web_url
          )
        `);
      
      // Apply filter based on flag type
      if (flagFilter !== 'all') {
        if (flagFilter === 'system') {
          query = query.like('flag_type', 'system_%');
        } else if (flagFilter === 'user') {
          // User reports include both 'user' flags and 'deletion_recommendation' flags
          query = query.in('flag_type', ['user', 'deletion_recommendation']);
        }
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to load flags: ${error.message}`);
      }

      // Process the data to include current panel values
      const processedData = (data as any[])?.map(flag => ({
        ...flag,
        current_name: flag.solar_panels?.name,
        current_manufacturer: flag.solar_panels?.manufacturer,
        current_wattage: flag.solar_panels?.wattage,
        current_voltage: flag.solar_panels?.voltage,
        current_length_cm: flag.solar_panels?.length_cm,
        current_width_cm: flag.solar_panels?.width_cm,
        current_weight_kg: flag.solar_panels?.weight_kg,
        current_price_usd: flag.solar_panels?.price_usd,
        current_description: flag.solar_panels?.description,
        web_url: flag.solar_panels?.web_url,
      })) || [];

      setFlags(processedData as FlagData[]);
    } catch (error) {
      console.error('Error loading flags:', error);
      toast.error('Failed to load flags');
    } finally {
      setLoading(false);
    }
  };

  const applyEditedCorrections = async (panelId: string, corrections: Record<string, any>) => {
    try {
      // Convert values back to metric for storage
      const convertedCorrections: Record<string, any> = {};
      
      for (const [field, value] of Object.entries(corrections)) {
        if (typeof value === 'number') {
          convertedCorrections[field] = convertValueForStorage(field, value.toString());
        } else {
          convertedCorrections[field] = value;
        }
      }

      // Apply the edited corrections to the solar_panels table
      const { error } = await supabase
        .from('solar_panels')
        .update(convertedCorrections)
        .eq('id', panelId);

      if (error) {
        console.error('Error applying corrections:', error);
        toast.error('Failed to apply corrections to panel');
        throw error;
      }

      toast.success('Corrections applied to panel');
    } catch (error) {
      console.error('Error applying corrections:', error);
      toast.error('Failed to apply corrections');
    }
  };

  const handleFlagAction = async (flagId: string, action: 'approve' | 'reject', note?: string) => {
    try {
      setActionLoading(true);
      
      // Get current user for resolved_by field
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to manage flags');
      }

      // Get the flag data to check if it's a deletion recommendation
      const { data: flagData, error: flagError } = await supabase
        .from('user_flags' as any)
        .select('flag_type, panel_id')
        .eq('id', flagId)
        .single();

      if (flagError) {
        throw new Error(`Failed to get flag data: ${flagError.message}`);
      }

      // Update the flag status
      const { error } = await supabase
        .from('user_flags' as any)
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          admin_note: note || null,
          resolved_by: user.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', flagId);

      if (error) {
        throw new Error(`Failed to ${action} flag: ${error.message}`);
      }

      // If approving a deletion recommendation, delete the panel
      if (action === 'approve' && (flagData as any).flag_type === 'deletion_recommendation') {
        const { error: deleteError } = await supabase
          .from('solar_panels')
          .delete()
          .eq('id', (flagData as any).panel_id);

        if (deleteError) {
          console.error('Failed to delete panel:', deleteError);
          toast.error('Flag approved but failed to delete panel. Please delete manually.');
        } else {
          toast.success('Flag approved and panel deleted successfully');
        }
      } else {
        toast.success(`Flag ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      }
      
      setSelectedFlag(null);
      setAdminNote("");
      loadFlags();
    } catch (error) {
      console.error(`Error ${action}ing flag:`, error);
      toast.error(`Failed to ${action} flag`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (flag: FlagData) => {
    setDeleteDialog({ isOpen: true, flag });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.flag) return;

    const flag = deleteDialog.flag;
    setActionLoading(true);

    try {
      // Delete the flag
      const { error } = await supabase
        .from('user_flags' as any)
        .delete()
        .eq('id', flag.id);

      if (error) {
        throw new Error(`Failed to delete flag: ${error.message}`);
      }

      // Also delete the associated panel if it exists
      if (flag.panel_id) {
        const { error: panelError } = await supabase
          .from('solar_panels')
          .delete()
          .eq('id', flag.panel_id);

        if (panelError) {
          console.error('Error deleting panel:', panelError);
          // Don't throw - flag deletion was successful
        }
      }

      // Also delete associated raw_scraper_data entries
      // Extract ASIN from web_url
      if (flag.web_url) {
        const asinMatch = flag.web_url.match(/\/dp\/([A-Z0-9]{10})/);
        if (asinMatch && asinMatch[1]) {
          const asin = asinMatch[1];
          
          // Delete raw_scraper_data entries for this ASIN
          const { error: rawDataError } = await supabase
            .from('raw_scraper_data' as any)
            .delete()
            .eq('asin', asin);

          if (rawDataError) {
            console.error('Error deleting raw_scraper_data:', rawDataError);
            // Don't throw - flag deletion was successful
          }

          // Log to filtered_asins to prevent re-ingestion
          const productName = flag.panel_name || `${flag.manufacturer || 'Unknown'} Panel`;
          const { error: filterError } = await supabase
            .from('filtered_asins' as any)
            .insert({
              asin: asin,
              filter_stage: 'ingest',
              filter_reason: 'admin_deleted',
              product_name: productName,
              product_url: flag.web_url,
              wattage: flag.wattage || null,
              confidence: 1.0,
              created_by: 'admin'
            });

          if (filterError) {
            console.error('Error logging to filtered_asins:', filterError);
            // Don't throw - deletion was successful
          }
        }
      }

      toast.success('Flag, panel, and associated scrape data deleted successfully. ASIN has been blacklisted from future ingestion.');
      
      // Refresh the list
      await loadFlags();
    } catch (error) {
      console.error('Error deleting flag:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete flag');
    } finally {
      setDeleteDialog({ isOpen: false, flag: null });
      setActionLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, flag: null });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "default",
      approved: "default",
      rejected: "destructive"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "default"}>
        {status}
      </Badge>
    );
  };

  const getCurrentValue = (flag: FlagData, field: string) => {
    const fieldMap: Record<string, string> = {
      name: 'current_name',
      manufacturer: 'current_manufacturer',
      wattage: 'current_wattage',
      voltage: 'current_voltage',
      length_cm: 'current_length_cm',
      width_cm: 'current_width_cm',
      weight_kg: 'current_weight_kg',
      price_usd: 'current_price_usd',
      description: 'current_description'
    };
    
    const currentField = fieldMap[field];
    return currentField ? (flag as any)[currentField] : null;
  };

  const extractASIN = (url: string) => {
    if (!url) return null;
    
    // Amazon ASIN patterns
    const patterns = [
      /\/dp\/([A-Z0-9]{10})/,  // /dp/ASIN
      /\/product\/([A-Z0-9]{10})/,  // /product/ASIN
      /\/gp\/product\/([A-Z0-9]{10})/,  // /gp/product/ASIN
      /[?&]asin=([A-Z0-9]{10})/,  // ?asin=ASIN
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  };

  const formatValueForDisplay = (field: string, value: any): string => {
    if (value === null || value === undefined) return '';
    
    switch (field) {
      case 'length_cm':
      case 'width_cm':
        if (unitSystem === 'imperial') {
          return `in (${cmToInches(parseFloat(value))} in)`;
        }
        return `cm (${value})`;
      
      case 'weight_kg':
        if (unitSystem === 'imperial') {
          return `lbs (${kgToLbs(parseFloat(value))} lbs)`;
        }
        return `kg (${value})`;
      
      default:
        return String(value);
    }
  };

  const convertValueForDisplay = (field: string, value: any): number => {
    if (value === null || value === undefined) return 0;
    const numValue = parseFloat(value);
    
    switch (field) {
      case 'length_cm':
      case 'width_cm':
        return unitSystem === 'imperial' ? cmToInches(numValue) : numValue;
      
      case 'weight_kg':
        return unitSystem === 'imperial' ? kgToLbs(numValue) : numValue;
      
      default:
        return numValue;
    }
  };

  const convertValueForStorage = (field: string, value: string): number => {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) return 0;
    
    switch (field) {
      case 'length_cm':
      case 'width_cm':
        return unitSystem === 'imperial' ? inchesToCm(numValue) : numValue;
      
      case 'weight_kg':
        return unitSystem === 'imperial' ? lbsToKg(numValue) : numValue;
      
      default:
        return numValue;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading flags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="w-6 h-6 text-red-500" />
            Flag Queue
          </h2>
          <p className="text-muted-foreground">
            Review user-submitted flags for incorrect panel information
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {flags.length} flag{flags.length !== 1 ? 's' : ''} pending review
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={flagFilter} onValueChange={(value) => setFlagFilter(value as 'all' | 'user' | 'system')}>
        <TabsList>
          <TabsTrigger value="all">All Flags</TabsTrigger>
          <TabsTrigger value="user">User Reports</TabsTrigger>
          <TabsTrigger value="system">Missing Data</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Flags List */}
      {flags.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">No flags pending review</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => (
            <Card key={flag.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{flag.panel_name}</CardTitle>
                    <CardDescription>
                      {flag.manufacturer} • {flag.wattage ? `${flag.wattage}W` : 'Power N/A'} • {flag.price_usd ? `$${flag.price_usd}` : 'Price N/A'}
                    </CardDescription>
                    {flag.flag_type?.startsWith('system_') && (
                      <Badge variant="secondary" className="mb-2">
                        System Flag: Missing Data
                      </Badge>
                    )}
                    {flag.flag_type === 'deletion_recommendation' && (
                      <Badge variant="destructive" className="mb-2">
                        <Trash2 className="w-3 h-3 mr-1" />
                        Deletion Recommendation
                      </Badge>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {flag.flag_type === 'deletion_recommendation' ? (
                        <div>
                          <div className="font-medium">Deletion Reason:</div>
                          <div>{deletionReasonLabels[flag.deletion_reason || ''] || flag.deletion_reason}</div>
                          {flag.deletion_reason === 'other' && flag.deletion_other_reason && (
                            <div className="mt-1 italic">"{flag.deletion_other_reason}"</div>
                          )}
                        </div>
                      ) : (
                        `Missing fields: ${flag.flagged_fields?.join(', ')}`
                      )}
                    </div>
                    {flag.web_url && extractASIN(flag.web_url) && (
                      <div className="text-sm">
                        <a 
                          href={flag.web_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                        >
                          ASIN: {extractASIN(flag.web_url)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(flag.status)}
                    {getStatusBadge(flag.status)}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Flagged Fields or Deletion Reason */}
                <div>
                  <Label className="text-sm font-medium">
                    {flag.flag_type === 'deletion_recommendation' ? 'Deletion Recommendation:' : 'Flagged Fields:'}
                  </Label>
                  {flag.flag_type === 'deletion_recommendation' ? (
                    <div className="mt-1 space-y-2">
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="font-medium text-red-800">
                          {deletionReasonLabels[flag.deletion_reason || ''] || flag.deletion_reason}
                        </div>
                        {flag.deletion_reason === 'other' && flag.deletion_other_reason && (
                          <div className="mt-1 text-sm text-red-700 italic">
                            "{flag.deletion_other_reason}"
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {flag.flagged_fields.map((field) => (
                        <Badge key={field} variant="outline">
                          {fieldLabels[field] || field}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggested Corrections */}
                {Object.keys(flag.suggested_corrections).length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Suggested Corrections:</Label>
                    <div className="mt-1 space-y-2">
                      {Object.entries(flag.suggested_corrections).map(([field, value]) => {
                        const currentValue = getCurrentValue(flag, field);
                        return (
                          <div key={field} className="text-sm space-y-1">
                            <div className="font-medium">{fieldLabels[field] || field}:</div>
                            <div className="flex items-center gap-2">
                              {currentValue && (
                                <span className="text-muted-foreground line-through text-xs">
                                  Current: {String(currentValue)}
                                </span>
                              )}
                              <span className="text-green-600 font-medium">
                                → {String(value)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* User Comment */}
                {flag.user_comment && (
                  <div>
                    <Label className="text-sm font-medium">User Comment:</Label>
                    <p className="text-sm text-muted-foreground mt-1">{flag.user_comment}</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {flag.user_email}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(flag.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                {flag.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFlag(flag)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Review
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(flag)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedFlag} onOpenChange={() => setSelectedFlag(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Flag</DialogTitle>
            <DialogDescription>
              Review and approve or reject this flag submission
            </DialogDescription>
          </DialogHeader>

          {selectedFlag && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Panel:</Label>
                <p className="text-sm">{selectedFlag.panel_name} by {selectedFlag.manufacturer}</p>
                {selectedFlag.web_url && extractASIN(selectedFlag.web_url) && (
                  <div className="mt-1">
                    <a 
                      href={selectedFlag.web_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm inline-flex items-center gap-1"
                    >
                      ASIN: {extractASIN(selectedFlag.web_url)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">Flagged Fields:</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedFlag.flagged_fields.map((field) => (
                    <Badge key={field} variant="outline">
                      {fieldLabels[field] || field}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* System flags with missing data - show editable fields */}
              {selectedFlag.flag_type?.startsWith('system_') && selectedFlag.flagged_fields.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Missing Data - Add Values:</Label>
                  <div className="mt-1 space-y-3">
                    {selectedFlag.flagged_fields.map((field) => {
                      const currentValue = getCurrentValue(selectedFlag, field);
                      const suggestedValue = selectedFlag.suggested_corrections?.[field];
                      
                      // Convert value for display
                      const displayValue = convertValueForDisplay(field, suggestedValue || currentValue || 0);
                      const editedValue = editedCorrections[field] !== undefined ? editedCorrections[field] : displayValue;
                      
                      // Get the unit for this field
                      const unit = field === 'length_cm' || field === 'width_cm' 
                        ? (unitSystem === 'imperial' ? 'in' : 'cm')
                        : field === 'weight_kg'
                        ? (unitSystem === 'imperial' ? 'lbs' : 'kg')
                        : '';
                      
                      return (
                        <div key={field} className="space-y-1">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {fieldLabels[field] || field}
                            {unit && <span className="text-xs text-muted-foreground">({unit})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editedValue}
                              onChange={(e) => {
                                setEditedCorrections({
                                  ...editedCorrections,
                                  [field]: parseFloat(e.target.value) || 0
                                });
                              }}
                              className="mt-1 flex-1"
                              placeholder={`Enter ${fieldLabels[field] || field}`}
                            />
                            {unit && <span className="text-xs text-muted-foreground mt-1">{unit}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* User flag corrections */}
              {Object.keys(selectedFlag.suggested_corrections).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Edit Corrections:</Label>
                  <div className="mt-1 space-y-3">
                    {Object.entries(selectedFlag.suggested_corrections).map(([field, value]) => {
                      const currentValue = getCurrentValue(selectedFlag, field);
                      
                      // Convert the suggested value for display
                      const displayValue = convertValueForDisplay(field, value);
                      const editedValue = editedCorrections[field] !== undefined ? editedCorrections[field] : displayValue;
                      
                      // Get the unit for this field
                      const unit = field === 'length_cm' || field === 'width_cm' 
                        ? (unitSystem === 'imperial' ? 'in' : 'cm')
                        : field === 'weight_kg'
                        ? (unitSystem === 'imperial' ? 'lbs' : 'kg')
                        : '';
                      
                      // Display current value with unit conversion
                      const displayCurrentValue = currentValue 
                        ? convertValueForDisplay(field, currentValue)
                        : null;
                      
                      return (
                        <div key={field} className="space-y-1">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {fieldLabels[field] || field}
                            {unit && <span className="text-xs text-muted-foreground">({unit})</span>}
                          </div>
                          {displayCurrentValue !== null && (
                            <div className="text-xs text-muted-foreground line-through">
                              Current: {String(displayCurrentValue)}{unit ? ` ${unit}` : ''}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editedValue}
                              onChange={(e) => {
                                setEditedCorrections({
                                  ...editedCorrections,
                                  [field]: parseFloat(e.target.value) || 0
                                });
                              }}
                              className="mt-1 flex-1"
                            />
                            {unit && <span className="text-xs text-muted-foreground mt-1">{unit}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedFlag.user_comment && (
                <div>
                  <Label className="text-sm font-medium">User Comment:</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedFlag.user_comment}</p>
                </div>
              )}

              <div>
                <Label htmlFor="admin-note">Admin Note (Optional)</Label>
                <Textarea
                  id="admin-note"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add a note about your decision..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedFlag(null)}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (selectedFlag) {
                  setSelectedFlag(null);
                  handleDeleteClick(selectedFlag);
                }
              }}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={actionLoading}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedFlag) {
                  setEditedCorrections({});
                  handleFlagAction(selectedFlag.id, 'reject', adminNote);
                }
              }}
              disabled={actionLoading}
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button
              onClick={async () => {
                if (selectedFlag) {
                  // If there are edited corrections, update the panel with them
                  if (Object.keys(editedCorrections).length > 0) {
                    await applyEditedCorrections(selectedFlag.panel_id, editedCorrections);
                  }
                  setEditedCorrections({});
                  handleFlagAction(selectedFlag.id, 'approve', adminNote);
                }
              }}
              disabled={actionLoading}
            >
              <Check className="w-4 h-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={handleDeleteCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flag?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this flag for panel: <strong>{deleteDialog.flag?.panel_name}</strong>?
              <br /><br />
              This action cannot be undone. The flag will be permanently removed from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
