import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertCircle, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  parseCSV, 
  processCSVRow, 
  findMatchingPanel, 
  calculateChanges,
  DEFAULT_FIELD_MAPPINGS,
  type CSVRow,
  type ProcessedPanel,
  type FieldMapping,
  type SolarPanelRow 
} from "@/lib/csvUtils";
import { FieldMappingInterface } from "./FieldMappingInterface";
import { ChangesetPreview } from "./ChangesetPreview";

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export const CSVImporter = () => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [csvHeaders, setCSVHeaders] = useState<string[]>([]);
  const [csvRows, setCSVRows] = useState<CSVRow[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(DEFAULT_FIELD_MAPPINGS);
  const [processedPanels, setProcessedPanels] = useState<ProcessedPanel[]>([]);
  const [existingPanels, setExistingPanels] = useState<SolarPanelRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Load existing panels from database
  useEffect(() => {
    loadExistingPanels();
  }, []);

  const loadExistingPanels = async () => {
    try {
      const { data, error } = await supabase
        .from('solar_panels')
        .select('*');
      
      if (error) throw error;
      setExistingPanels(data || []);
    } catch (err) {
      console.error('Error loading existing panels:', err);
      toast.error('Failed to load existing panels');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    
    if (csvFile) {
      handleFileSelect(csvFile);
    } else {
      setError('Please drop a CSV file');
    }
  }, []);

  const handleFileSelect = async (file: File) => {
    setError(null);
    setCSVFile(file);
    
    try {
      const content = await file.text();
      const { headers, rows } = parseCSV(content);
      
      setCSVHeaders(headers);
      setCSVRows(rows);
      setCurrentStep('mapping');
      
      toast.success(`Loaded CSV with ${rows.length} rows`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  };

  const handleFieldMappingComplete = (mappings: FieldMapping[]) => {
    setFieldMappings(mappings);
    processCSVData(mappings);
  };

  const processCSVData = async (mappings: FieldMapping[]) => {
    setError(null);
    
    try {
      const processed: ProcessedPanel[] = [];
      
      for (const csvRow of csvRows) {
        try {
          const processedData = processCSVRow(csvRow, mappings);
          const matchedPanel = findMatchingPanel(processedData, existingPanels);
          
          const processedPanel: ProcessedPanel = {
            ...processedData,
            originalData: csvRow,
            matchedPanel,
            isUpdate: !!matchedPanel,
            changes: matchedPanel ? calculateChanges(matchedPanel, processedData) : undefined
          };
          
          processed.push(processedPanel);
        } catch (err) {
          console.error(`Error processing row:`, csvRow, err);
          // Continue with other rows, but log the error
        }
      }
      
      setProcessedPanels(processed);
      setCurrentStep('preview');
      
      const newPanels = processed.filter(p => !p.isUpdate);
      const updatedPanels = processed.filter(p => p.isUpdate);
      
      toast.success(`Processed ${processed.length} panels: ${newPanels.length} new, ${updatedPanels.length} updates`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process CSV data');
    }
  };

  const handleImport = async () => {
    setCurrentStep('importing');
    setImportProgress(0);
    
    try {
      const newPanels = processedPanels.filter(p => !p.isUpdate);
      const updatedPanels = processedPanels.filter(p => p.isUpdate && Object.keys(p.changes || {}).length > 0);
      
      let completed = 0;
      const total = newPanels.length + updatedPanels.length;
      
      // Insert new panels
      if (newPanels.length > 0) {
        const { error: insertError } = await supabase
          .from('solar_panels')
          .insert(newPanels.map(p => ({
            name: p.name,
            manufacturer: p.manufacturer,
            length_cm: p.length_cm,
            width_cm: p.width_cm,
            weight_kg: p.weight_kg,
            wattage: p.wattage,
            voltage: p.voltage,
            price_usd: p.price_usd,
            description: p.description,
            image_url: p.image_url,
            web_url: p.web_url
          })));
        
        if (insertError) throw insertError;
        completed += newPanels.length;
        setImportProgress((completed / total) * 100);
      }
      
      // Update existing panels
      for (const panel of updatedPanels) {
        if (panel.matchedPanel && panel.changes && Object.keys(panel.changes).length > 0) {
          const { error: updateError } = await supabase
            .from('solar_panels')
            .update(panel.changes)
            .eq('id', panel.matchedPanel.id);
          
          if (updateError) throw updateError;
          completed++;
          setImportProgress((completed / total) * 100);
        }
      }
      
      setCurrentStep('complete');
      toast.success(`Import complete! ${newPanels.length} panels added, ${updatedPanels.length} panels updated`);
      
      // Reload existing panels for next import
      await loadExistingPanels();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setCurrentStep('preview');
    }
  };

  const resetImporter = () => {
    setCurrentStep('upload');
    setCSVFile(null);
    setCSVHeaders([]);
    setCSVRows([]);
    setProcessedPanels([]);
    setImportProgress(0);
    setError(null);
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'upload': return 'Upload CSV File';
      case 'mapping': return 'Map Fields';
      case 'preview': return 'Review Changes';
      case 'importing': return 'Importing Data';
      case 'complete': return 'Import Complete';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{getStepTitle()}</h3>
        <div className="flex items-center gap-2">
          {['upload', 'mapping', 'preview', 'importing', 'complete'].map((step, index) => (
            <div
              key={step}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === step
                  ? 'bg-primary text-white'
                  : index < ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(currentStep)
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index < ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(currentStep) ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <Card>
          <CardContent className="p-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Drop your CSV file here</h3>
              <p className="text-muted-foreground mb-4">
                Or click to select a file from your computer
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="hidden"
                id="csv-upload"
              />
              <Button asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  Select CSV File
                </label>
              </Button>
            </div>
            
            {csvFile && (
              <div className="mt-4 p-4 bg-muted rounded-lg flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{csvFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(csvFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Field Mapping Step */}
      {currentStep === 'mapping' && (
        <FieldMappingInterface
          csvHeaders={csvHeaders}
          fieldMappings={fieldMappings}
          onComplete={handleFieldMappingComplete}
          sampleRow={csvRows[0]}
        />
      )}

      {/* Preview Step */}
      {currentStep === 'preview' && (
        <div className="space-y-4">
          <ChangesetPreview
            processedPanels={processedPanels}
            onImport={handleImport}
            onCancel={resetImporter}
          />
        </div>
      )}

      {/* Importing Step */}
      {currentStep === 'importing' && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold">Importing Data...</h3>
              <Progress value={importProgress} className="w-full max-w-md mx-auto" />
              <p className="text-sm text-muted-foreground">
                {importProgress.toFixed(0)}% complete
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Step */}
      {currentStep === 'complete' && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-600">Import Successful!</h3>
              <p className="text-muted-foreground">
                Your solar panel data has been successfully imported into the database.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={resetImporter}>
                  Import Another File
                </Button>
                <Button variant="outline" asChild>
                  <a href="/">View Panels</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
