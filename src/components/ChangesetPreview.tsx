import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Edit, AlertTriangle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { type ProcessedPanel } from "@/lib/csvUtils";

interface ChangesetPreviewProps {
  processedPanels: ProcessedPanel[];
  onImport: () => void;
  onCancel: () => void;
}

export const ChangesetPreview = ({ processedPanels, onImport, onCancel }: ChangesetPreviewProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const newPanels = processedPanels.filter(p => !p.isUpdate);
  const updatedPanels = processedPanels.filter(p => p.isUpdate && Object.keys(p.changes || {}).length > 0);
  const noChangePanels = processedPanels.filter(p => p.isUpdate && Object.keys(p.changes || {}).length === 0);

  const formatValue = (value: unknown, field: string) => {
    if (value === null || value === undefined) return '—';
    
    if (field.includes('price')) {
      return `$${Number(value).toFixed(2)}`;
    }
    if (field.includes('length') || field.includes('width')) {
      return `${value} cm`;
    }
    if (field.includes('weight')) {
      return `${value} kg`;
    }
    if (field === 'wattage') {
      return `${value}W`;
    }
    if (field === 'voltage') {
      return `${value}V`;
    }
    
    return String(value);
  };

  const renderChangeComparison = (panel: ProcessedPanel) => {
    if (!panel.matchedPanel || !panel.changes) return null;

    const changedFields = Object.keys(panel.changes);
    
    return (
      <div className="space-y-2">
        {changedFields.map(field => (
          <div key={field} className="grid grid-cols-3 gap-2 text-sm">
            <span className="font-medium capitalize">
              {field.replace('_', ' ')}:
            </span>
            <span className="text-red-600 line-through">
              {formatValue((panel.matchedPanel as Record<string, unknown>)[field], field)}
            </span>
            <span className="text-green-600 font-medium">
              {formatValue((panel.changes as Record<string, unknown>)[field], field)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Import Summary
          </CardTitle>
          <CardDescription>
            Review the changes that will be made to your database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">New Panels</span>
              </div>
              <p className="text-2xl font-bold text-green-600 mt-2">{newPanels.length}</p>
              <p className="text-sm text-green-700">Will be added to database</p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-800">Updates</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-2">{updatedPanels.length}</p>
              <p className="text-sm text-blue-700">Existing panels will be updated</p>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-800">No Changes</span>
              </div>
              <p className="text-2xl font-bold text-gray-600 mt-2">{noChangePanels.length}</p>
              <p className="text-sm text-gray-700">Already up to date</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel Import
              </Button>
              <Button onClick={onImport} className="bg-green-600 hover:bg-green-700">
                Import {newPanels.length + updatedPanels.length} Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Changes */}
      {showDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Changes</CardTitle>
            <CardDescription>
              Review each panel that will be added or updated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="new" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="new" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New ({newPanels.length})
                </TabsTrigger>
                <TabsTrigger value="updated" className="flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Updated ({updatedPanels.length})
                </TabsTrigger>
                <TabsTrigger value="unchanged" className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  No Changes ({noChangePanels.length})
                </TabsTrigger>
              </TabsList>

              {/* New Panels */}
              <TabsContent value="new" className="space-y-4">
                {newPanels.length === 0 ? (
                  <Alert>
                    <AlertDescription>No new panels to add.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {newPanels.map((panel, index) => (
                      <Card key={index} className="border-green-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{panel.name}</CardTitle>
                            <Badge className="bg-green-100 text-green-800">New</Badge>
                          </div>
                          <CardDescription>{panel.manufacturer}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Wattage:</span> {panel.wattage}W
                            </div>
                            <div>
                              <span className="font-medium">Price:</span> ${panel.price_usd?.toFixed(2)}
                            </div>
                            <div>
                              <span className="font-medium">Size:</span> {panel.length_cm}×{panel.width_cm} cm
                            </div>
                            <div>
                              <span className="font-medium">Weight:</span> {panel.weight_kg} kg
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Updated Panels */}
              <TabsContent value="updated" className="space-y-4">
                {updatedPanels.length === 0 ? (
                  <Alert>
                    <AlertDescription>No panels need updates.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {updatedPanels.map((panel, index) => (
                      <Card key={index} className="border-blue-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{panel.name}</CardTitle>
                            <Badge className="bg-blue-100 text-blue-800">
                              {Object.keys(panel.changes || {}).length} changes
                            </Badge>
                          </div>
                          <CardDescription>{panel.manufacturer}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2 text-sm font-medium border-b pb-2">
                              <span>Field</span>
                              <span className="text-red-600">Current</span>
                              <span className="text-green-600">New</span>
                            </div>
                            {renderChangeComparison(panel)}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Unchanged Panels */}
              <TabsContent value="unchanged" className="space-y-4">
                {noChangePanels.length === 0 ? (
                  <Alert>
                    <AlertDescription>All panels have changes.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {noChangePanels.map((panel, index) => (
                      <Card key={index} className="border-gray-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{panel.name}</CardTitle>
                            <Badge variant="secondary">No changes</Badge>
                          </div>
                          <CardDescription>{panel.manufacturer}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            This panel already exists in the database with identical specifications.
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
