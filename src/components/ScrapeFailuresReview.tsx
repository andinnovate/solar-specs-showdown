import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  Clock, 
  Database,
  ExternalLink,
  RefreshCw,
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
import type { Json } from "@/integrations/supabase/types";

interface RawScraperData {
  id: string;
  asin: string;
  panel_id: string | null;
  scraper_response: Json;
  scraper_version: string;
  response_size_bytes: number | null;
  processing_metadata: Json | null;
  created_at: string;
  updated_at: string;
}

interface ScrapeFailure {
  id: string;
  asin: string;
  panel_id: string | null;
  scraper_response: Json;
  scraper_version: string;
  response_size_bytes: number | null;
  processing_metadata: Json | null;
  created_at: string;
  updated_at: string;
  failure_reason?: string;
  error_details?: Record<string, unknown>;
}

const determineFailureReason = (item: RawScraperData): string | undefined => {
  // Check for parsing failures in processing_metadata
  if (item.processing_metadata?.parsing_failures && Array.isArray(item.processing_metadata.parsing_failures)) {
    const failures = item.processing_metadata.parsing_failures;
    if (failures.length > 0) {
      return `Parsing Failures: ${failures.join(', ')}`;
    }
  }

  // Check if panel_id is null (failed to create panel)
  if (!item.panel_id) {
    return 'Failed to create panel';
  }

  // Check scraper_response for error indicators
  if (item.scraper_response) {
    const response = item.scraper_response;
    
    // Check for common error patterns
    if (response.error) {
      return `ScraperAPI Error: ${response.error}`;
    }
    
    if (response.status === 'error') {
      return `ScraperAPI Status Error: ${response.message || 'Unknown error'}`;
    }
    
    if (response.success === false) {
      return `ScraperAPI Failed: ${response.message || 'Request failed'}`;
    }
    
    // Check if critical data is missing
    if (!response.title && !response.name && !response.product_name) {
      return 'Missing product name/title';
    }
    
    if (!response.price && !response.price_usd) {
      return 'Missing price information';
    }
  }

  return undefined;
};

const extractErrorDetails = (item: RawScraperData): Record<string, unknown> => {
  const details: Record<string, unknown> = {
    processing_metadata: item.processing_metadata
  };

  // Extract parsing failures if they exist
  if (item.processing_metadata?.parsing_failures) {
    details.parsing_failures = item.processing_metadata.parsing_failures;
    details.parsing_failure_count = item.processing_metadata.parsing_failures.length;
  }

  if (!item.scraper_response) return details;
  
  const response = item.scraper_response as Record<string, unknown>;
  
  // Extract error-related information
  return {
    ...details,
    error: response.error,
    status: response.status,
    message: response.message,
    success: response.success,
    has_title: !!(response.title || response.name || response.product_name),
    has_price: !!(response.price || response.price_usd),
    has_description: !!response.description,
    response_keys: Object.keys(response || {}),
    // Add specific parsing failure details
    parsing_failures: item.processing_metadata?.parsing_failures || [],
    parsing_failure_count: item.processing_metadata?.parsing_failures?.length || 0
  };
};

export const ScrapeFailuresReview = () => {
  const [failures, setFailures] = useState<ScrapeFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; failure: ScrapeFailure | null }>({
    isOpen: false,
    failure: null
  });

  const loadFailures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Query raw_scraper_data table for entries that might indicate failures
      // We'll look for entries where panel_id is null (failed to create panel) 
      // or where the processing_metadata contains parsing_failures
      const { data, error } = await supabase
        .from('raw_scraper_data')
        .select('*')
        .or('panel_id.is.null,processing_metadata->parsing_failures.not.is.null')
        .order('created_at', { ascending: false })
        .limit(100); // Limit to recent entries

      if (error) {
        throw new Error(`Failed to load scrape data: ${error.message}`);
      }

      // Filter for potential failures
      const potentialFailures = ((data as unknown as RawScraperData[]) || []).map(item => {
        const failure: ScrapeFailure = {
          ...item,
          failure_reason: determineFailureReason(item),
          error_details: extractErrorDetails(item)
        };
        return failure;
      }).filter(item => item.failure_reason) || [];

      setFailures(potentialFailures);
    } catch (err) {
      console.error('Error loading failures:', err);
      setError(err instanceof Error ? err.message : 'Failed to load scrape failures');
      toast.error('Failed to load scrape failures');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFailures();
  }, [loadFailures]);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleDeleteClick = (failure: ScrapeFailure) => {
    setDeleteDialog({ isOpen: true, failure });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.failure) return;

    const failure = deleteDialog.failure;
    setLoading(true);

    try {
      const asin = failure.asin;

      // 1. Delete the raw_scraper_data entry
      const { error } = await supabase
        .from('raw_scraper_data')
        .delete()
        .eq('id', failure.id);

      if (error) {
        throw new Error(`Failed to delete failure record: ${error.message}`);
      }

      // 2. Delete the associated panel if it exists
      if (failure.panel_id) {
        const { error: panelError } = await supabase
          .from('solar_panels')
          .delete()
          .eq('id', failure.panel_id);

        if (panelError) {
          console.error('Error deleting panel:', panelError);
        }
      }

      // 3. Delete any admin flags associated with this panel or ASIN
      if (failure.panel_id) {
        const { error: flagError } = await supabase
          .from('user_flags')
          .delete()
          .eq('panel_id', failure.panel_id);

        if (flagError) {
          console.error('Error deleting flags:', flagError);
        }
      }

      // 4. Log to filtered_asins to prevent re-ingestion
      try {
        const productName = failure.scraper_response?.name || failure.scraper_response?.title || asin;
        const webUrl = failure.scraper_response?.url || failure.scraper_response?.product_url;
        
        const { error: filterError } = await supabase
          .from('filtered_asins')
          .insert({
            asin: asin,
            filter_stage: 'ingest',
            filter_reason: 'admin_deleted',
            product_name: productName,
            product_url: webUrl,
            wattage: failure.scraper_response?.wattage || null,
            confidence: 1.0,
            created_by: 'admin'
          });

        if (filterError) {
          console.error('Error logging to filtered_asins:', filterError);
        }
      } catch (filterErr) {
        console.error('Error logging deletion to filtered_asins:', filterErr);
      }

      toast.success(`Deleted failure record, panel, flags, and blacklisted ASIN: ${asin}`);
      
      // Refresh the list
      await loadFailures();
    } catch (err) {
      console.error('Error deleting failure:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete failure record');
      setError(err instanceof Error ? err.message : 'Failed to delete failure record');
    } finally {
      setDeleteDialog({ isOpen: false, failure: null });
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, failure: null });
  };

  const formatJson = (obj: unknown): string => {
    return JSON.stringify(obj, null, 2);
  };

  const getFailureBadgeVariant = (reason: string) => {
    if (reason.includes('Parsing Failures')) {
      return 'destructive';
    }
    if (reason.includes('ScraperAPI Error') || reason.includes('Status Error')) {
      return 'destructive';
    }
    if (reason.includes('Missing')) {
      return 'secondary';
    }
    return 'outline';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading scrape failures...</p>
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
            <AlertCircle className="w-6 h-6 text-red-500" />
            Scrape Failures Review
          </h2>
          <p className="text-muted-foreground">
            Review failed scraping attempts and analyze underlying data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {failures.length} failure{failures.length !== 1 ? 's' : ''} found
            {failures.filter(f => f.failure_reason?.includes('Parsing Failures')).length > 0 && (
              <span className="ml-2 text-red-600">
                ({failures.filter(f => f.failure_reason?.includes('Parsing Failures')).length} parsing failures)
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={loadFailures}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Failures List */}
      {failures.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">No scrape failures found</p>
            <p className="text-sm text-muted-foreground mt-1">
              All recent scraping attempts appear to be successful
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {failures.map((failure) => (
            <Card key={failure.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      ASIN: {failure.asin}
                      {failure.panel_id && (
                        <Badge variant="outline" className="text-xs">
                          Panel Created
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(failure.created_at).toLocaleDateString()}
                        </div>
                        {failure.response_size_bytes && (
                          <div className="flex items-center gap-1">
                            <Database className="w-3 h-3" />
                            {failure.response_size_bytes} bytes
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span>Version:</span>
                          {failure.scraper_version}
                        </div>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getFailureBadgeVariant(failure.failure_reason!)}>
                      {failure.failure_reason}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(failure.id)}
                    >
                      {expandedItems.has(failure.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(failure)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete this failure record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Expanded Content */}
              {expandedItems.has(failure.id) && (
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Parsing Failures Section */}
                    {failure.error_details?.parsing_failures && failure.error_details.parsing_failures.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 text-red-600 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Parsing Failures ({failure.error_details.parsing_failure_count})
                        </h4>
                        <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                          <ul className="space-y-1">
                            {failure.error_details.parsing_failures.map((failure: string, index: number) => (
                              <li key={index} className="text-sm text-red-700 flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">•</span>
                                {failure}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Error Details */}
                    {failure.error_details && (
                      <div>
                        <h4 className="font-medium mb-2">Error Analysis</h4>
                        <div className="bg-muted p-3 rounded-md">
                          <pre className="text-sm overflow-x-auto">
                            {formatJson(failure.error_details)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Raw Scraper Response */}
                    <div>
                      <h4 className="font-medium mb-2">Raw ScraperAPI Response</h4>
                      <div className="bg-muted p-3 rounded-md max-h-96 overflow-auto">
                        <pre className="text-sm">
                          {formatJson(failure.scraper_response)}
                        </pre>
                      </div>
                    </div>

                    {/* Processing Metadata */}
                    {failure.processing_metadata && (
                      <div>
                        <h4 className="font-medium mb-2">Processing Metadata</h4>
                        <div className="bg-muted p-3 rounded-md">
                          <pre className="text-sm">
                            {formatJson(failure.processing_metadata)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={handleDeleteCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Failure Record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this failure record for ASIN: <strong>{deleteDialog.failure?.asin}</strong>?
              <br /><br />
              This action cannot be undone. The raw scraper data will be permanently removed from the database.
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
