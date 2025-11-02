import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  XCircle,
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
  current_piece_count?: number;
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
  description: "Description",
  piece_count: "Piece Count"
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
  const [fullEditMode, setFullEditMode] = useState(false);
  const [fullPanelEdit, setFullPanelEdit] = useState<Record<string, any>>({});
  const [originalPanelData, setOriginalPanelData] = useState<Record<string, any>>({});
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('solar-panel-unit-system');
      return (saved as 'metric' | 'imperial') || 'metric';
    }
    return 'metric';
  });
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFlags();
  }, [flagFilter]);

  const loadFlags = async () => {
    try {
      setLoading(true);
      
      // Securely fetch via RPC to avoid direct view access and auth.users exposure
      const { data, error } = await (supabase as any).rpc('admin_get_flag_queue');

      if (error) {
        throw new Error(`Failed to load flags: ${error.message}`);
      }

      // Apply client-side filter based on flag type
      const filtered = (data as any[])?.filter(flag => {
        if (flagFilter === 'all') return true;
        if (flagFilter === 'system') return typeof flag.flag_type === 'string' && flag.flag_type.startsWith('system_');
        if (flagFilter === 'user') return ['user', 'deletion_recommendation'].includes(flag.flag_type);
        return true;
      }) || [];

      // The view already includes panel_name, manufacturer, wattage, price_usd from solar_panels JOIN
      // Map those to the current_* format expected by the UI
      const processedData = filtered.map(flag => ({
        ...flag,
        current_name: flag.panel_name,
        current_manufacturer: flag.manufacturer,
        current_wattage: flag.wattage,
        current_price_usd: flag.price_usd,
        // Note: voltage, length_cm, width_cm, weight_kg, description, web_url not in view
        // These will be loaded separately if needed in loadFullPanelData
      })) || [];

      setFlags(processedData as FlagData[]);
    } catch (error) {
      console.error('Error loading flags:', error);
      toast.error('Failed to load flags');
    } finally {
      setLoading(false);
    }
  };

  const loadFullPanelData = async (panelId: string) => {
    try {
      const { data, error } = await supabase
        .from('solar_panels')
        .select('*')
        .eq('id', panelId)
        .single();

      if (error) {
        throw new Error(`Failed to load panel data: ${error.message}`);
      }

      if (data) {
        // Store original data for comparison
        setOriginalPanelData(data);
        
        // Convert metric values to display units and populate edit state
        const displayData: Record<string, any> = {};
        const editableFields = ['name', 'manufacturer', 'wattage', 'voltage', 'length_cm', 'width_cm', 'weight_kg', 'price_usd', 'description', 'image_url', 'web_url', 'asin', 'piece_count'];
        
        editableFields.forEach(field => {
          const value = (data as any)[field];
          if (value !== null && value !== undefined) {
            if (field === 'length_cm' || field === 'width_cm' || field === 'weight_kg') {
              displayData[field] = convertValueForDisplay(field, value);
            } else {
              displayData[field] = value;
            }
          } else {
            displayData[field] = '';
          }
        });
        
        setFullPanelEdit(displayData);
      }
    } catch (error) {
      console.error('Error loading panel data:', error);
      toast.error('Failed to load panel data');
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

  const applyFullPanelEdit = async (panelId: string, edits: Record<string, any>) => {
    try {
      // Convert values back to metric for storage
      const convertedEdits: Record<string, any> = {};
      
      for (const [field, value] of Object.entries(edits)) {
        // Skip empty values (keep existing)
        if (value === '' || value === null) {
          continue;
        }
        
        if (field === 'length_cm' || field === 'width_cm' || field === 'weight_kg') {
          // Convert from display unit to metric
          convertedEdits[field] = convertValueForStorage(field, value.toString());
        } else if (field === 'wattage' || field === 'voltage' || field === 'price_usd' || field === 'piece_count') {
          // Numeric fields
          convertedEdits[field] = parseFloat(value) || null;
        } else {
          // String fields
          convertedEdits[field] = value || null;
        }
      }

      // Detect which fields were changed for manual_overrides tracking
      const changedFields: string[] = [];
      const editableFields = ['name', 'manufacturer', 'wattage', 'voltage', 'length_cm', 'width_cm', 'weight_kg', 'price_usd', 'description', 'image_url', 'web_url', 'asin', 'piece_count'];
      
      editableFields.forEach(field => {
        const originalValue = (originalPanelData as any)[field];
        const newValue = convertedEdits[field];
        
        // Compare values properly (handle null/undefined)
        if (originalValue !== newValue && newValue !== undefined) {
          changedFields.push(field);
        }
      });

      // Get existing manual_overrides
      const { data: currentPanel } = await supabase
        .from('solar_panels')
        .select('manual_overrides')
        .eq('id', panelId)
        .single();

      const existingOverrides = ((currentPanel as any)?.manual_overrides as string[]) || [];
      const newOverrides = Array.from(new Set([...existingOverrides, ...changedFields]));

      // Apply the edits with manual_overrides
      const { error } = await supabase
        .from('solar_panels')
        .update({
          ...convertedEdits,
          manual_overrides: newOverrides,
          updated_at: new Date().toISOString()
        })
        .eq('id', panelId);

      if (error) {
        console.error('Error applying full panel edit:', error);
        toast.error('Failed to apply panel edits');
        throw error;
      }

      toast.success(`Panel updated. ${changedFields.length} field(s) marked as manually edited.`);
    } catch (error) {
      console.error('Error applying full panel edit:', error);
      toast.error('Failed to apply panel edits');
      throw error;
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

  const handleClearFlag = async (flag: FlagData) => {
    try {
      setActionLoading(true);
      
      // Simply delete the flag - no changes applied, panel remains unchanged
      const { error } = await supabase
        .from('user_flags' as any)
        .delete()
        .eq('id', flag.id);

      if (error) {
        throw new Error(`Failed to clear flag: ${error.message}`);
      }

      toast.success('Flag cleared successfully');
      loadFlags();
    } catch (error) {
      console.error('Error clearing flag:', error);
      toast.error('Failed to clear flag');
    } finally {
      setActionLoading(false);
    }
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

  const toggleFlagSelection = (flagId: string) => {
    setSelectedFlags(prev => {
      const next = new Set(prev);
      if (next.has(flagId)) {
        next.delete(flagId);
      } else {
        next.add(flagId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFlags.size === flags.filter(f => f.status === 'pending').length) {
      setSelectedFlags(new Set());
    } else {
      setSelectedFlags(new Set(flags.filter(f => f.status === 'pending').map(f => f.id)));
    }
  };

  const handleBulkAccept = async () => {
    if (selectedFlags.size === 0) return;
    
    try {
      setActionLoading(true);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to manage flags');
      }

      const selectedFlagObjects = flags.filter(f => selectedFlags.has(f.id));
      
      for (const flag of selectedFlagObjects) {
        // Apply suggested corrections if they exist
        if (Object.keys(flag.suggested_corrections).length > 0) {
          const corrections: Record<string, any> = {};
          
          for (const [field, value] of Object.entries(flag.suggested_corrections)) {
            if (typeof value === 'number') {
              corrections[field] = convertValueForStorage(field, value.toString());
            } else {
              corrections[field] = value;
            }
          }

          if (Object.keys(corrections).length > 0) {
            await supabase
              .from('solar_panels')
              .update(corrections)
              .eq('id', flag.panel_id);
          }
        }

        // Approve the flag
        await supabase
          .from('user_flags' as any)
          .update({
            status: 'approved',
            admin_note: 'Bulk approved with changes applied',
            resolved_by: user.id,
            resolved_at: new Date().toISOString()
          })
          .eq('id', flag.id);
      }

      toast.success(`${selectedFlags.size} flag(s) approved and changes applied`);
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error) {
      console.error('Error bulk accepting flags:', error);
      toast.error('Failed to accept flags');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkClear = async () => {
    if (selectedFlags.size === 0) return;
    
    try {
      setActionLoading(true);
      
      for (const flagId of selectedFlags) {
        await supabase
          .from('user_flags' as any)
          .delete()
          .eq('id', flagId);
      }

      toast.success(`${selectedFlags.size} flag(s) cleared successfully`);
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error) {
      console.error('Error bulk clearing flags:', error);
      toast.error('Failed to clear flags');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFlags.size === 0) return;
    
    try {
      setActionLoading(true);
      
      const selectedFlagObjects = flags.filter(f => selectedFlags.has(f.id));
      
      for (const flag of selectedFlagObjects) {
        // Load panel data to get web_url if not available in flag
        let webUrl = flag.web_url;
        if (!webUrl && flag.panel_id) {
          const { data: panelData } = await supabase
            .from('solar_panels')
            .select('web_url')
            .eq('id', flag.panel_id)
            .single();
          webUrl = panelData?.web_url;
        }

        // Delete the flag
        await supabase
          .from('user_flags' as any)
          .delete()
          .eq('id', flag.id);

        // Delete the associated panel if it exists
        if (flag.panel_id) {
          await supabase
            .from('solar_panels')
            .delete()
            .eq('id', flag.panel_id);
        }

        // Extract ASIN from web_url and handle cleanup
        if (webUrl) {
          const asinMatch = webUrl.match(/\/dp\/([A-Z0-9]{10})/);
          if (asinMatch && asinMatch[1]) {
            const asin = asinMatch[1];
            
            // Delete raw_scraper_data entries
            await supabase
              .from('raw_scraper_data' as any)
              .delete()
              .eq('asin', asin);

            // Log to filtered_asins
            const productName = flag.panel_name || `${flag.manufacturer || 'Unknown'} Panel`;
            await supabase
              .from('filtered_asins' as any)
              .insert({
                asin: asin,
                filter_stage: 'ingest',
                filter_reason: 'admin_deleted',
                product_name: productName,
                product_url: webUrl,
                wattage: flag.wattage || null,
                confidence: 1.0,
                created_by: 'admin'
              });
          }
        }
      }

      toast.success(`${selectedFlags.size} flag(s) and panels deleted successfully. ASINs have been blacklisted.`);
      setSelectedFlags(new Set());
      loadFlags();
    } catch (error) {
      console.error('Error bulk deleting flags:', error);
      toast.error('Failed to delete flags');
    } finally {
      setActionLoading(false);
    }
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
      description: 'current_description',
      piece_count: 'current_piece_count'
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
        <div className="flex-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="w-6 h-6 text-red-500" />
            Flag Queue
          </h2>
          <p className="text-muted-foreground">
            Review user-submitted flags for incorrect panel information
          </p>
        </div>
        <div className="flex items-center gap-4">
          {flags.length > 0 && flags.some(f => f.status === 'pending') && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={
                  flags.filter(f => f.status === 'pending').length > 0 &&
                  selectedFlags.size === flags.filter(f => f.status === 'pending').length
                }
                onCheckedChange={toggleSelectAll}
              />
              <Label htmlFor="select-all" className="text-sm cursor-pointer">
                Select All ({selectedFlags.size} selected)
              </Label>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            {flags.length} flag{flags.length !== 1 ? 's' : ''} pending review
          </div>
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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
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
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox
                      checked={selectedFlags.has(flag.id)}
                      onCheckedChange={() => toggleFlagSelection(flag.id)}
                      aria-label={`Select flag ${flag.id}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFlag(flag)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Review
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClearFlag(flag)}
                      disabled={actionLoading}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Clear Flag
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
      <Dialog open={!!selectedFlag} onOpenChange={() => {
        setSelectedFlag(null);
        setFullEditMode(false);
        setFullPanelEdit({});
        setOriginalPanelData({});
        setEditedCorrections({});
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Review Flag</DialogTitle>
                <DialogDescription>
                  Review and approve or reject this flag submission
                </DialogDescription>
              </div>
              {selectedFlag && (
                <Button
                  variant={fullEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (!fullEditMode) {
                      setFullEditMode(true);
                      loadFullPanelData(selectedFlag.panel_id);
                    } else {
                      setFullEditMode(false);
                    }
                  }}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  {fullEditMode ? 'Cancel Full Edit' : 'Full Edit'}
                </Button>
              )}
            </div>
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

              {/* Full Edit Section */}
              {fullEditMode && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-base font-semibold">Full Panel Edit</Label>
                    <Badge variant="secondary">All Fields</Badge>
                  </div>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {/* Product Info */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Product Information</h4>
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="edit-name">Name *</Label>
                          <Input
                            id="edit-name"
                            value={fullPanelEdit.name || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, name: e.target.value })}
                            placeholder="Panel name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-manufacturer">Manufacturer *</Label>
                          <Input
                            id="edit-manufacturer"
                            value={fullPanelEdit.manufacturer || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, manufacturer: e.target.value })}
                            placeholder="Manufacturer name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-description">Description</Label>
                          <Textarea
                            id="edit-description"
                            value={fullPanelEdit.description || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, description: e.target.value })}
                            placeholder="Product description"
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Specifications */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Specifications</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="edit-wattage">Wattage (W)</Label>
                          <Input
                            id="edit-wattage"
                            type="number"
                            value={fullPanelEdit.wattage || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, wattage: e.target.value })}
                            placeholder="Wattage"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-voltage">Voltage (V)</Label>
                          <Input
                            id="edit-voltage"
                            type="number"
                            step="0.01"
                            value={fullPanelEdit.voltage || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, voltage: e.target.value })}
                            placeholder="Voltage"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-length">
                            Length ({unitSystem === 'imperial' ? 'in' : 'cm'})
                          </Label>
                          <Input
                            id="edit-length"
                            type="number"
                            step="0.01"
                            value={fullPanelEdit.length_cm || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, length_cm: e.target.value })}
                            placeholder="Length"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-width">
                            Width ({unitSystem === 'imperial' ? 'in' : 'cm'})
                          </Label>
                          <Input
                            id="edit-width"
                            type="number"
                            step="0.01"
                            value={fullPanelEdit.width_cm || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, width_cm: e.target.value })}
                            placeholder="Width"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-weight">
                            Weight ({unitSystem === 'imperial' ? 'lbs' : 'kg'})
                          </Label>
                          <Input
                            id="edit-weight"
                            type="number"
                            step="0.01"
                            value={fullPanelEdit.weight_kg || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, weight_kg: e.target.value })}
                            placeholder="Weight"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-piece-count">Piece Count</Label>
                          <Input
                            id="edit-piece-count"
                            type="number"
                            value={fullPanelEdit.piece_count || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, piece_count: e.target.value })}
                            placeholder="Number of pieces"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pricing & Links */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Pricing & Links</h4>
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="edit-price">Price (USD)</Label>
                          <Input
                            id="edit-price"
                            type="number"
                            step="0.01"
                            value={fullPanelEdit.price_usd || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, price_usd: e.target.value })}
                            placeholder="Price in USD"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-web-url">Web URL</Label>
                          <Input
                            id="edit-web-url"
                            value={fullPanelEdit.web_url || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, web_url: e.target.value })}
                            placeholder="Product URL"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-image-url">Image URL</Label>
                          <Input
                            id="edit-image-url"
                            value={fullPanelEdit.image_url || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, image_url: e.target.value })}
                            placeholder="Image URL"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-asin">ASIN</Label>
                          <Input
                            id="edit-asin"
                            value={fullPanelEdit.asin || ''}
                            onChange={(e) => setFullPanelEdit({ ...fullPanelEdit, asin: e.target.value })}
                            placeholder="Amazon ASIN"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
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
            <Button variant="outline" onClick={() => {
              setSelectedFlag(null);
              setFullEditMode(false);
              setFullPanelEdit({});
              setOriginalPanelData({});
              setEditedCorrections({});
            }}>
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
                  try {
                    // If full edit mode is active and has changes, apply full panel edit
                    if (fullEditMode && Object.keys(fullPanelEdit).length > 0) {
                      await applyFullPanelEdit(selectedFlag.panel_id, fullPanelEdit);
                      setFullPanelEdit({});
                      setOriginalPanelData({});
                    }
                    
                    // If there are edited corrections, update the panel with them
                    if (Object.keys(editedCorrections).length > 0) {
                      await applyEditedCorrections(selectedFlag.panel_id, editedCorrections);
                    }
                    
                    // Clear all edit states
                    setEditedCorrections({});
                    setFullEditMode(false);
                    
                    // Approve the flag
                    handleFlagAction(selectedFlag.id, 'approve', adminNote);
                  } catch (error) {
                    // Error already handled in applyFullPanelEdit or applyEditedCorrections
                    console.error('Error applying edits before approval:', error);
                  }
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
            <AlertDialogTitle>Delete Flag and Panel?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this flag and the associated panel: <strong>{deleteDialog.flag?.panel_name}</strong>?
              <br /><br />
              This action will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Delete the flag from the database</li>
                <li>Delete the associated panel from the database</li>
                <li>Delete associated scraper data</li>
                <li>Blacklist the ASIN from future ingestion</li>
              </ul>
              <br />
              This action cannot be undone.
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

      {/* Floating Bulk Action Buttons */}
      {selectedFlags.size > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex gap-2 shadow-lg">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 flex items-center gap-2">
            <span className="text-sm font-medium px-2">
              {selectedFlags.size} selected
            </span>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            <div className="flex gap-2">
              <Button
                onClick={handleBulkAccept}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Accept Changes
              </Button>
              <Button
                onClick={handleBulkClear}
                disabled={actionLoading}
                variant="outline"
                className="text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Clear Flags
              </Button>
              <Button
                onClick={handleBulkDelete}
                disabled={actionLoading}
                variant="destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete Panels
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
