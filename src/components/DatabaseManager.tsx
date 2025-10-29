import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Trash2, Edit2, Save, X, Lock, AlertCircle, Search, ArrowLeftRight, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type SolarPanel = Tables<"solar_panels">;

// Extended type to include manual_overrides which may not be in generated types yet
type SolarPanelWithOverrides = SolarPanel & {
  manual_overrides?: string[];
};

// Minimal panel type for list view
type MinimalPanel = {
  id: string;
  name: string;
  asin: string;
  manufacturer: string | null;
  web_url: string | null;
  created_at: string;
  updated_at: string;
};

export const DatabaseManager = () => {
  const [panels, setPanels] = useState<MinimalPanel[]>([]);
  const [filteredPanels, setFilteredPanels] = useState<MinimalPanel[]>([]);
  const [fullPanelData, setFullPanelData] = useState<Record<string, SolarPanelWithOverrides>>({});
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedPanel, setEditedPanel] = useState<Partial<SolarPanelWithOverrides>>({});
  const [originalPanel, setOriginalPanel] = useState<Partial<SolarPanelWithOverrides>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadPanels();
  }, []);

  useEffect(() => {
    // Filter panels based on search term
    if (!searchTerm.trim()) {
      setFilteredPanels(panels);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredPanels(
        panels.filter((panel) => {
          return (
            panel.name.toLowerCase().includes(term) ||
            panel.asin.toLowerCase().includes(term) ||
            (panel.manufacturer && panel.manufacturer.toLowerCase().includes(term)) ||
            (panel.web_url && panel.web_url.toLowerCase().includes(term))
          );
        })
      );
    }
  }, [searchTerm, panels]);

  const loadPanels = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("solar_panels")
        .select("id, name, asin, manufacturer, web_url, created_at, updated_at")
        .order("name", { ascending: true });

      if (error) throw error;
      setPanels((data || []) as MinimalPanel[]);
      setFilteredPanels((data || []) as MinimalPanel[]);
    } catch (error) {
      console.error("Error loading panels:", error);
      toast.error("Failed to load panels");
    } finally {
      setLoading(false);
    }
  };

  const loadPanelDetails = async (panelId: string) => {
    // If already loaded, don't fetch again
    if (fullPanelData[panelId]) {
      return;
    }

    try {
      setLoadingDetails(prev => new Set(prev).add(panelId));
      
      const { data, error } = await supabase
        .from("solar_panels")
        .select("*")
        .eq("id", panelId)
        .single();

      if (error) throw error;
      
      if (data) {
        setFullPanelData(prev => ({
          ...prev,
          [panelId]: data as SolarPanelWithOverrides
        }));
      }
    } catch (error) {
      console.error("Error loading panel details:", error);
      toast.error("Failed to load panel details");
    } finally {
      setLoadingDetails(prev => {
        const next = new Set(prev);
        next.delete(panelId);
        return next;
      });
    }
  };

  const togglePanelExpansion = async (panelId: string) => {
    if (expandedPanels.has(panelId)) {
      // Collapse
      setExpandedPanels(prev => {
        const next = new Set(prev);
        next.delete(panelId);
        return next;
      });
    } else {
      // Expand - load details if not already loaded
      setExpandedPanels(prev => new Set(prev).add(panelId));
      await loadPanelDetails(panelId);
    }
  };

  const startEdit = async (panelId: string) => {
    // Load full panel data if not already loaded
    if (!fullPanelData[panelId]) {
      await loadPanelDetails(panelId);
    }
    
    const panel = fullPanelData[panelId];
    if (!panel) {
      toast.error("Failed to load panel data for editing");
      return;
    }
    
    setEditingId(panel.id);
    setEditedPanel({ ...panel });
    setOriginalPanel({ ...panel });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditedPanel({});
    setOriginalPanel({});
  };

  const checkAndResolveFlags = async (panelId: string) => {
    try {
      // Get all pending flags for this panel
      const { data: flags, error: flagsError } = await supabase
        .from('user_flags' as any)
        .select('id, flag_type, flagged_fields')
        .eq('panel_id', panelId)
        .eq('status', 'pending');

      if (flagsError || !flags || flags.length === 0) {
        return;
      }

      // Get current panel data after update to check if fields are resolved
      const { data: currentPanel, error: panelError } = await supabase
        .from('solar_panels')
        .select('*')
        .eq('id', panelId)
        .single();

      if (panelError || !currentPanel) {
        return;
      }

      // Use current panel data as the final state (already includes the updates)
      const finalPanelData = currentPanel;

      // Map flagged field names to database fields
      const fieldMapping: Record<string, string[]> = {
        'dimensions': ['length_cm', 'width_cm'],
        'weight': ['weight_kg'],
        'price': ['price_usd'],
        // Direct mappings
        'wattage': ['wattage'],
        'voltage': ['voltage'],
        'name': ['name'],
        'manufacturer': ['manufacturer'],
        'description': ['description'],
      };

      // Get current user for resolved_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check each flag
      for (const flag of flags) {
        const flagData = flag as any;
        const flaggedFields = (flagData.flagged_fields as string[]) || [];
        const flagType = flagData.flag_type as string;

        // For system_missing_data flags, check if all missing fields are now present
        if (flagType === 'system_missing_data' || flagType === 'system_parse_failure') {
          let allResolved = true;

          for (const flaggedField of flaggedFields) {
            const dbFields = fieldMapping[flaggedField] || [flaggedField];
            
            // Check if all required fields are present and not null
            const fieldResolved = dbFields.every(dbField => {
              const value = (finalPanelData as any)[dbField];
              return value !== null && value !== undefined && value !== '';
            });

            if (!fieldResolved) {
              allResolved = false;
              break;
            }
          }

          // If all missing fields are resolved, auto-approve the flag
          if (allResolved) {
            await supabase
              .from('user_flags' as any)
              .update({
                status: 'approved',
                admin_note: 'Automatically approved: Missing data resolved via admin panel edit',
                resolved_by: user.id,
                resolved_at: new Date().toISOString()
              })
              .eq('id', flagData.id);

            toast.success(`Flag auto-approved: Missing data resolved`);
          }
        } else if (flagType === 'user') {
          // For user flags, check if all flagged fields have been corrected
          // This is optional - we could auto-approve if fields match suggested corrections
          // For now, we'll leave user flags for manual review
        }
      }
    } catch (error) {
      console.error('Error checking flags:', error);
      // Don't show error to user - flag checking is non-critical
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      // Detect which fields were manually changed
      const changedFields: string[] = [];
      const editableFields = [
        'name', 'manufacturer', 'price_usd', 'wattage', 'voltage',
        'length_cm', 'width_cm', 'weight_kg', 'web_url', 'image_url', 'description', 'asin', 'piece_count'
      ];

      editableFields.forEach(field => {
        const key = field as keyof SolarPanelWithOverrides;
        if (editedPanel[key] !== originalPanel[key]) {
          changedFields.push(field);
        }
      });

      // Check if ASIN has changed - if so, need to cascade updates
      const asinChanged = changedFields.includes('asin') && editedPanel.asin && originalPanel.asin;
      const oldAsin = originalPanel.asin;
      const newAsin = editedPanel.asin;

      // Merge with existing manual overrides
      const existingOverrides = originalPanel.manual_overrides || [];
      const newOverrides = Array.from(new Set([...existingOverrides, ...changedFields]));

      // Remove system fields from the update
      const { id, created_at, updated_at, manual_overrides, ...updateData } = editedPanel;

      const { error } = await supabase
        .from("solar_panels")
        .update({
          ...updateData,
          manual_overrides: newOverrides,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);

      if (error) throw error;

      // If ASIN changed, cascade updates to related tables
      if (asinChanged && oldAsin && newAsin) {
        try {
          // Update raw_scraper_data entries for this panel
          const { error: rawDataError } = await supabase
            .from('raw_scraper_data' as any)
            .update({ asin: newAsin })
            .eq('asin', oldAsin);

          if (rawDataError) {
            console.error('Error updating raw_scraper_data:', rawDataError);
            toast.warning('Panel updated but failed to update related scrape data');
          }

          // Update filtered_asins entries
          const { error: filteredError } = await supabase
            .from('filtered_asins' as any)
            .update({ asin: newAsin })
            .eq('asin', oldAsin);

          if (filteredError) {
            console.error('Error updating filtered_asins:', filteredError);
            // Don't show error as this is less critical
          }

          // Note: user_flags don't have ASIN directly, so no update needed there
        } catch (cascadeError) {
          console.error('Error cascading ASIN update:', cascadeError);
          toast.warning('Panel ASIN updated but some related data may need manual review');
        }
      }

      // Check and auto-approve flags if missing data is resolved (after update is complete)
      await checkAndResolveFlags(editingId);

      // Update full panel data cache if it exists
      if (fullPanelData[editingId]) {
        const { data: updatedPanel } = await supabase
          .from("solar_panels")
          .select("*")
          .eq("id", editingId)
          .single();
        
        if (updatedPanel) {
          setFullPanelData(prev => ({
            ...prev,
            [editingId]: updatedPanel as SolarPanelWithOverrides
          }));
        }
      }

      if (changedFields.length > 0) {
        toast.success(`Panel updated. ${changedFields.length} field(s) marked as manually edited.`);
      } else {
        toast.success("Panel updated successfully");
      }
      
      setEditingId(null);
      setEditedPanel({});
      setOriginalPanel({});
      // Reload minimal panel list to get updated timestamps
      await loadPanels();
    } catch (error) {
      console.error("Error updating panel:", error);
      toast.error("Failed to update panel");
    }
  };

  const deletePanel = async (id: string) => {
    try {
      // First, get panel details including web_url
      const { data: panel } = await supabase
        .from("solar_panels")
        .select("web_url, name, manufacturer, wattage")
        .eq("id", id)
        .single();

      // Delete the panel (raw_scraper_data with panel_id will cascade)
      const { error } = await supabase
        .from("solar_panels")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Extract ASIN from web_url and delete orphaned raw_scraper_data
      // Also log to filtered_asins to prevent re-ingestion
      if (panel?.web_url) {
        const asinMatch = panel.web_url.match(/\/dp\/([A-Z0-9]{10})/);
        if (asinMatch && asinMatch[1]) {
          const asin = asinMatch[1];
          
          // Delete raw_scraper_data entries that match this ASIN and have no panel_id
          const { error: rawDataError } = await supabase
            .from("raw_scraper_data" as any)
            .delete()
            .eq("asin", asin)
            .is("panel_id", null);

          if (rawDataError) {
            console.error("Error deleting orphaned raw_scraper_data:", rawDataError);
            // Don't throw - panel deletion was successful
          }

          // Log to filtered_asins to prevent re-ingestion
          try {
            const productName = panel.name || `${panel.manufacturer || 'Unknown'} Panel`;
            const { error: filterError } = await supabase
              .from("filtered_asins" as any)
              .insert({
                asin: asin,
                filter_stage: 'ingest',
                filter_reason: 'admin_deleted',
                product_name: productName,
                product_url: panel.web_url,
                wattage: panel.wattage || null,
                confidence: 1.0,
                created_by: 'admin'
              });

            if (filterError) {
              console.error("Error logging to filtered_asins:", filterError);
              // Don't throw - panel deletion was successful
            }
          } catch (filterErr) {
            console.error("Error logging deletion to filtered_asins:", filterErr);
            // Don't throw - panel deletion was successful
          }
        }
      }

      toast.success("Panel deleted successfully. ASIN has been blacklisted from future ingestion.");
      setDeleteConfirm(null);
      loadPanels();
    } catch (error) {
      console.error("Error deleting panel:", error);
      toast.error("Failed to delete panel");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading panels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with search */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ASIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredPanels.length} of {panels.length} panels
        </div>
      </div>

      {/* Info alert */}
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          Fields edited by admin are marked with a lock icon and will not be overwritten by automatic scraper updates.
        </AlertDescription>
      </Alert>

      {/* Panels list */}
      <div className="space-y-4">
        {filteredPanels.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "No panels found matching your search" : "No panels in database"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPanels.map((panel) => {
            const isExpanded = expandedPanels.has(panel.id);
            const isEditing = editingId === panel.id;
            const fullPanel = fullPanelData[panel.id];
            const isLoadingDetails = loadingDetails.has(panel.id);
            const currentPanel = isEditing ? editedPanel : (fullPanel || panel);
            const displayPanel = fullPanel || panel;

            const manualOverrides = (displayPanel as SolarPanelWithOverrides).manual_overrides || [];
            const hasManualOverride = (field: string) => manualOverrides.includes(field);

            const swapLengthWidth = () => {
              if (!isEditing) return;
              
              const currentLength = (currentPanel as any).length_cm;
              const currentWidth = (currentPanel as any).width_cm;
              
              setEditedPanel({
                ...editedPanel,
                length_cm: currentWidth,
                width_cm: currentLength,
              });
            };

            return (
              <Card key={panel.id} className={isEditing ? "border-primary" : ""}>
                <CardContent className="pt-4">
                  {/* Compact view header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{panel.name}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                            <span className="font-mono">{panel.asin}</span>
                            {panel.web_url && (
                              <a
                                href={panel.web_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate max-w-xs"
                              >
                                {panel.web_url}
                              </a>
                            )}
                            {panel.manufacturer && (
                              <span>{panel.manufacturer}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Created: {new Date(panel.created_at).toLocaleDateString()}</span>
                        <span>Updated: {new Date(panel.updated_at).toLocaleDateString()}</span>
                        <span className="font-mono">ID: {panel.id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePanelExpansion(panel.id)}
                        disabled={isLoadingDetails}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Collapse
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            View Details
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteConfirm(panel.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(panel.id)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details view */}
                  {isExpanded && (
                    <>
                      {isLoadingDetails ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-muted-foreground">Loading details...</p>
                          </div>
                        </div>
                      ) : fullPanel ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left column - Basic info */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                Name
                                {hasManualOverride('name') && (
                                  <span title="Manually edited - protected from scraper updates">
                                    <Lock className="h-3 w-3 text-amber-600" />
                                  </span>
                                )}
                              </Label>
                              {isEditing ? (
                                <Input
                                  value={currentPanel.name || ""}
                                  onChange={(e) =>
                                    setEditedPanel({ ...editedPanel, name: e.target.value })
                                  }
                                />
                              ) : (
                                <p className="text-sm font-medium">{displayPanel.name}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                ASIN
                                {hasManualOverride('asin') && (
                                  <span title="Manually edited - protected from scraper updates">
                                    <Lock className="h-3 w-3 text-amber-600" />
                                  </span>
                                )}
                              </Label>
                              {isEditing ? (
                                <Input
                                  value={currentPanel.asin || ""}
                                  onChange={(e) =>
                                    setEditedPanel({ ...editedPanel, asin: e.target.value })
                                  }
                                  placeholder="B0ABCD1234"
                                />
                              ) : (
                                <p className="text-sm font-mono">{displayPanel.asin}</p>
                              )}
                            </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Manufacturer
                          {hasManualOverride('manufacturer') && (
                            <span title="Manually edited - protected from scraper updates">
                              <Lock className="h-3 w-3 text-amber-600" />
                            </span>
                          )}
                        </Label>
                        {isEditing ? (
                          <Input
                            value={(currentPanel as any).manufacturer || ""}
                            onChange={(e) =>
                              setEditedPanel({ ...editedPanel, manufacturer: e.target.value })
                            }
                          />
                        ) : (
                          <p className="text-sm">{(displayPanel as any).manufacturer}</p>
                        )}
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                  Wattage
                                  {hasManualOverride('wattage') && (
                                    <span title="Manually edited - protected from scraper updates">
                                      <Lock className="h-3 w-3 text-amber-600" />
                                    </span>
                                  )}
                                </Label>
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    value={(currentPanel as any).wattage || ""}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  wattage: parseInt(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm">{(displayPanel as any).wattage ? `${(displayPanel as any).wattage} W` : 'N/A'}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            Voltage
                            {hasManualOverride('voltage') && (
                              <span title="Manually edited - protected from scraper updates">
                              <Lock className="h-3 w-3 text-amber-600" />
                            </span>
                            )}
                          </Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={(currentPanel as any).voltage || ""}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  voltage: parseFloat(e.target.value),
                                })
                              }
                              placeholder="Optional"
                            />
                          ) : (
                            <p className="text-sm">
                              {(displayPanel as any).voltage ? `${(displayPanel as any).voltage} V` : "Not set"}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            Piece Count
                            {hasManualOverride('piece_count') && (
                              <span title="Manually edited - protected from scraper updates">
                                <Lock className="h-3 w-3 text-amber-600" />
                              </span>
                            )}
                          </Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              min="1"
                              value={(currentPanel as any).piece_count || 1}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  piece_count: parseInt(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm">{(displayPanel as any).piece_count || 1} {((displayPanel as any).piece_count || 1) === 1 ? 'piece' : 'pieces'}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Price (USD)
                          {hasManualOverride('price_usd') && (
                            <span title="Manually edited - protected from scraper updates">
                              <Lock className="h-3 w-3 text-amber-600" />
                            </span>
                          )}
                        </Label>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={(currentPanel as any).price_usd || ""}
                            onChange={(e) =>
                              setEditedPanel({
                                ...editedPanel,
                                price_usd: parseFloat(e.target.value),
                              })
                            }
                          />
                        ) : (
                          <p className="text-sm">${(displayPanel as any).price_usd ? (displayPanel as any).price_usd.toFixed(2) : 'N/A'}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            Length (cm)
                            {hasManualOverride('length_cm') && (
                              <span title="Manually edited - protected from scraper updates">
                              <Lock className="h-3 w-3 text-amber-600" />
                            </span>
                            )}
                          </Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={(currentPanel as any).length_cm || ""}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  length_cm: parseFloat(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm">{(displayPanel as any).length_cm ?? 'N/A'}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            Width (cm)
                            {hasManualOverride('width_cm') && (
                              <span title="Manually edited - protected from scraper updates">
                              <Lock className="h-3 w-3 text-amber-600" />
                            </span>
                            )}
                          </Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={(currentPanel as any).width_cm || ""}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  width_cm: parseFloat(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm">{(displayPanel as any).width_cm ?? 'N/A'}</p>
                          )}
                        </div>
                        {isEditing && (
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={swapLengthWidth}
                              className="w-full h-10"
                              title="Swap length and width values"
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            Weight (kg)
                            {hasManualOverride('weight_kg') && (
                              <span title="Manually edited - protected from scraper updates">
                              <Lock className="h-3 w-3 text-amber-600" />
                            </span>
                            )}
                          </Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={(currentPanel as any).weight_kg || ""}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  weight_kg: parseFloat(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm">{(displayPanel as any).weight_kg ?? 'N/A'}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right column - URLs and description */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Web URL
                          {hasManualOverride('web_url') && (
                            <span title="Manually edited - protected from scraper updates">
                              <Lock className="h-3 w-3 text-amber-600" />
                            </span>
                          )}
                        </Label>
                        {isEditing ? (
                          <Input
                            value={(currentPanel as any).web_url || ""}
                            onChange={(e) =>
                              setEditedPanel({ ...editedPanel, web_url: e.target.value })
                            }
                            placeholder="https://..."
                          />
                        ) : (
                          <p className="text-sm text-blue-600 hover:underline truncate">
                            {(displayPanel as any).web_url ? (
                              <a href={(displayPanel as any).web_url} target="_blank" rel="noopener noreferrer">
                                {(displayPanel as any).web_url}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">Not set</span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Image URL
                          {hasManualOverride('image_url') && (
                            <span title="Manually edited - protected from scraper updates">
                              <Lock className="h-3 w-3 text-amber-600" />
                            </span>
                          )}
                        </Label>
                        {isEditing ? (
                          <Input
                            value={(currentPanel as any).image_url || ""}
                            onChange={(e) =>
                              setEditedPanel({ ...editedPanel, image_url: e.target.value })
                            }
                            placeholder="https://..."
                          />
                        ) : (
                          <p className="text-sm truncate">
                            {(displayPanel as any).image_url ? (
                              <a
                                href={(displayPanel as any).image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {(displayPanel as any).image_url}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">Not set</span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Description
                          {hasManualOverride('description') && (
                            <span title="Manually edited - protected from scraper updates">
                              <Lock className="h-3 w-3 text-amber-600" />
                            </span>
                          )}
                        </Label>
                        {isEditing ? (
                          <Textarea
                            value={(currentPanel as any).description || ""}
                            onChange={(e) =>
                              setEditedPanel({ ...editedPanel, description: e.target.value })
                            }
                            rows={4}
                            placeholder="Product description..."
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {(displayPanel as any).description || "No description"}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 text-xs text-muted-foreground pt-4 border-t">
                        <p>Created: {new Date(displayPanel.created_at).toLocaleString()}</p>
                        <p>Updated: {new Date(displayPanel.updated_at).toLocaleString()}</p>
                        {manualOverrides.length > 0 && (
                          <p className="text-amber-600 font-medium">
                            🔒 {manualOverrides.length} field(s) protected from auto-updates
                          </p>
                        )}
                        <p className="font-mono text-[10px]">ID: {displayPanel.id}</p>
                      </div>
                    </div>

                    {/* Edit mode action buttons - only show in expanded view */}
                    {isEditing && (
                      <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
                        <Button variant="outline" onClick={cancelEdit}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button onClick={saveEdit}>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </div>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this solar panel? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteConfirm && (
            <div className="py-4">
              <p className="font-medium">
                {panels.find((p) => p.id === deleteConfirm)?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(fullPanelData[deleteConfirm] as any)?.manufacturer || 'N/A'}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deletePanel(deleteConfirm)}
            >
              Delete Panel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

