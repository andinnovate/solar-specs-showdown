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
import { Trash2, Edit2, Save, X, Lock, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";

type SolarPanel = Tables<"solar_panels">;

// Extended type to include manual_overrides which may not be in generated types yet
type SolarPanelWithOverrides = SolarPanel & {
  manual_overrides?: string[];
};

export const DatabaseManager = () => {
  const [panels, setPanels] = useState<SolarPanelWithOverrides[]>([]);
  const [filteredPanels, setFilteredPanels] = useState<SolarPanelWithOverrides[]>([]);
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
            panel.manufacturer.toLowerCase().includes(term) ||
            panel.wattage.toString().includes(term) ||
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
        .select("*")
        .order("manufacturer", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setPanels(data || []);
      setFilteredPanels(data || []);
    } catch (error) {
      console.error("Error loading panels:", error);
      toast.error("Failed to load panels");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (panel: SolarPanelWithOverrides) => {
    setEditingId(panel.id);
    setEditedPanel({ ...panel });
    setOriginalPanel({ ...panel });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditedPanel({});
    setOriginalPanel({});
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      // Detect which fields were manually changed
      const changedFields: string[] = [];
      const editableFields = [
        'name', 'manufacturer', 'price_usd', 'wattage', 'voltage',
        'length_cm', 'width_cm', 'weight_kg', 'web_url', 'image_url', 'description'
      ];

      editableFields.forEach(field => {
        const key = field as keyof SolarPanelWithOverrides;
        if (editedPanel[key] !== originalPanel[key]) {
          changedFields.push(field);
        }
      });

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

      if (changedFields.length > 0) {
        toast.success(`Panel updated. ${changedFields.length} field(s) marked as manually edited.`);
      } else {
        toast.success("Panel updated successfully");
      }
      
      setEditingId(null);
      setEditedPanel({});
      setOriginalPanel({});
      loadPanels();
    } catch (error) {
      console.error("Error updating panel:", error);
      toast.error("Failed to update panel");
    }
  };

  const deletePanel = async (id: string) => {
    try {
      const { error } = await supabase
        .from("solar_panels")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Panel deleted successfully");
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
            placeholder="Search by name, manufacturer, wattage, or ASIN..."
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
            const isEditing = editingId === panel.id;
            const currentPanel = isEditing ? editedPanel : panel;

            const manualOverrides = panel.manual_overrides || [];
            const hasManualOverride = (field: string) => manualOverrides.includes(field);

            return (
              <Card key={panel.id} className={isEditing ? "border-primary" : ""}>
                <CardContent className="pt-6">
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
                          <p className="text-sm font-medium">{panel.name}</p>
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
                            value={currentPanel.manufacturer || ""}
                            onChange={(e) =>
                              setEditedPanel({ ...editedPanel, manufacturer: e.target.value })
                            }
                          />
                        ) : (
                          <p className="text-sm">{panel.manufacturer}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
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
                              value={currentPanel.wattage || ""}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  wattage: parseInt(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm">{panel.wattage} W</p>
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
                              value={currentPanel.voltage || ""}
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
                              {panel.voltage ? `${panel.voltage} V` : "Not set"}
                            </p>
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
                            value={currentPanel.price_usd || ""}
                            onChange={(e) =>
                              setEditedPanel({
                                ...editedPanel,
                                price_usd: parseFloat(e.target.value),
                              })
                            }
                          />
                        ) : (
                          <p className="text-sm">${panel.price_usd.toFixed(2)}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4">
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
                              value={currentPanel.length_cm || ""}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  length_cm: parseFloat(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm">{panel.length_cm}</p>
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
                              value={currentPanel.width_cm || ""}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  width_cm: parseFloat(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm">{panel.width_cm}</p>
                          )}
                        </div>
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
                              value={currentPanel.weight_kg || ""}
                              onChange={(e) =>
                                setEditedPanel({
                                  ...editedPanel,
                                  weight_kg: parseFloat(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm">{panel.weight_kg}</p>
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
                            value={currentPanel.web_url || ""}
                            onChange={(e) =>
                              setEditedPanel({ ...editedPanel, web_url: e.target.value })
                            }
                            placeholder="https://..."
                          />
                        ) : (
                          <p className="text-sm text-blue-600 hover:underline truncate">
                            {panel.web_url ? (
                              <a href={panel.web_url} target="_blank" rel="noopener noreferrer">
                                {panel.web_url}
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
                            value={currentPanel.image_url || ""}
                            onChange={(e) =>
                              setEditedPanel({ ...editedPanel, image_url: e.target.value })
                            }
                            placeholder="https://..."
                          />
                        ) : (
                          <p className="text-sm truncate">
                            {panel.image_url ? (
                              <a
                                href={panel.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {panel.image_url}
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
                            value={currentPanel.description || ""}
                            onChange={(e) =>
                              setEditedPanel({ ...editedPanel, description: e.target.value })
                            }
                            rows={4}
                            placeholder="Product description..."
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {panel.description || "No description"}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 text-xs text-muted-foreground pt-4 border-t">
                        <p>Created: {new Date(panel.created_at).toLocaleString()}</p>
                        <p>Updated: {new Date(panel.updated_at).toLocaleString()}</p>
                        {manualOverrides.length > 0 && (
                          <p className="text-amber-600 font-medium">
                            🔒 {manualOverrides.length} field(s) protected from auto-updates
                          </p>
                        )}
                        <p className="font-mono text-[10px]">ID: {panel.id}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
                    {isEditing ? (
                      <>
                        <Button variant="outline" onClick={cancelEdit}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button onClick={saveEdit}>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="destructive"
                          onClick={() => setDeleteConfirm(panel.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                        <Button onClick={() => startEdit(panel)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
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
                {panels.find((p) => p.id === deleteConfirm)?.manufacturer}
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

