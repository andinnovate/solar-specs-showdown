import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface FlagData {
  id: string;
  panel_id: string;
  user_id: string;
  flagged_fields: string[];
  suggested_corrections: Record<string, any>;
  user_comment: string;
  status: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
  resolved_at: string;
  resolved_by: string;
  panel_name: string;
  manufacturer: string;
  wattage: number;
  price_usd: number;
  user_email: string;
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

export const FlagQueue = () => {
  const [flags, setFlags] = useState<FlagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<FlagData | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    try {
      setLoading(true);
      
      // Query the admin_flag_queue view to get pending flags with current panel data
      const { data, error } = await supabase
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
        `)
        .order('created_at', { ascending: false });

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

  const handleFlagAction = async (flagId: string, action: 'approve' | 'reject', note?: string) => {
    try {
      setActionLoading(true);
      
      // Get current user for resolved_by field
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to manage flags');
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
      
      toast.success(`Flag ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
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
                      {flag.manufacturer} • {flag.wattage}W • ${flag.price_usd}
                    </CardDescription>
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
                {/* Flagged Fields */}
                <div>
                  <Label className="text-sm font-medium">Flagged Fields:</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {flag.flagged_fields.map((field) => (
                      <Badge key={field} variant="outline">
                        {fieldLabels[field] || field}
                      </Badge>
                    ))}
                  </div>
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

              {Object.keys(selectedFlag.suggested_corrections).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Suggested Corrections:</Label>
                  <div className="mt-1 space-y-2">
                    {Object.entries(selectedFlag.suggested_corrections).map(([field, value]) => {
                      const currentValue = getCurrentValue(selectedFlag, field);
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
              variant="destructive"
              onClick={() => selectedFlag && handleFlagAction(selectedFlag.id, 'reject')}
              disabled={actionLoading}
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button
              onClick={() => selectedFlag && handleFlagAction(selectedFlag.id, 'approve')}
              disabled={actionLoading}
            >
              <Check className="w-4 h-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
