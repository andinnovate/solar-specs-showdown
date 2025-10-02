import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, AlertCircle, CheckCircle, ArrowRight, Plus, Edit } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  parseCSV, 
  processCSVRow, 
  findMatchingPanel, 
  calculateChanges,
  convertValue,
  DEFAULT_FIELD_MAPPINGS,
  getUnitOptionsForField,
  getFieldType,
  type CSVRow,
  type ProcessedPanel,
  type FieldMapping,
  type SolarPanelRow 
} from "@/lib/csvUtils";

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

const DB_FIELD_INFO = {
  name: { label: 'Panel Name', required: true, description: 'The name/model of the solar panel' },
  manufacturer: { label: 'Manufacturer', required: true, description: 'Company that makes the panel' },
  length_cm: { label: 'Length (cm)', required: true, description: 'Panel length in centimeters' },
  width_cm: { label: 'Width (cm)', required: true, description: 'Panel width in centimeters' },
  weight_kg: { label: 'Weight (kg)', required: true, description: 'Panel weight in kilograms' },
  wattage: { label: 'Wattage', required: true, description: 'Power output in watts' },
  voltage: { label: 'Voltage', required: false, description: 'Operating voltage' },
  price_usd: { label: 'Price (USD)', required: true, description: 'Price in US dollars' },
  description: { label: 'Description', required: false, description: 'Product description' },
  image_url: { label: 'Image URL', required: false, description: 'Link to product image' },
  web_url: { label: 'Product URL', required: false, description: 'Link to product page' },
} as const;

export const CSVImporterComplete = () => {
  console.log('CSVImporterComplete: Component rendering...');
  
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
  
  console.log('CSVImporterComplete: Current step:', currentStep);

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
    console.log('CSVImporterComplete: handleFileSelect called with:', file.name);
    setError(null);
    setCSVFile(file);
    
    try {
      console.log('CSVImporterComplete: Reading file content...');
      const content = await file.text();
      console.log('CSVImporterComplete: File content length:', content.length);
      
      console.log('CSVImporterComplete: Parsing CSV...');
      const { headers, rows } = parseCSV(content);
      console.log('CSVImporterComplete: Parsed headers:', headers);
      console.log('CSVImporterComplete: Parsed rows count:', rows.length);
      
      setCSVHeaders(headers);
      setCSVRows(rows);
      
      console.log('CSVImporterComplete: Starting auto-mapping...');
      // Auto-detect field mappings
      const autoMappings = [...fieldMappings];
      headers.forEach(csvHeader => {
        const lowerHeader = csvHeader.toLowerCase().trim();
        
        let matchedField: keyof typeof DB_FIELD_INFO | null = null;
        
        // More specific matching for user's CSV format
        if (lowerHeader === 'model' || lowerHeader.includes('name')) {
          matchedField = 'name';
        } else if (lowerHeader === 'brand' || lowerHeader.includes('manufacturer')) {
          matchedField = 'manufacturer';
        } else if (lowerHeader === 'length' || lowerHeader.includes('height')) {
          matchedField = 'length_cm';
        } else if (lowerHeader === 'width') {
          matchedField = 'width_cm';
        } else if (lowerHeader === 'weight' || lowerHeader.includes('mass')) {
          matchedField = 'weight_kg';
        } else if (lowerHeader === 'watts' || lowerHeader.includes('watt') || lowerHeader.includes('power')) {
          matchedField = 'wattage';
        } else if (lowerHeader === 'voltage' || lowerHeader.includes('volt')) {
          matchedField = 'voltage';
        } else if (lowerHeader === 'price' || lowerHeader.includes('cost') || lowerHeader.includes('dollar')) {
          matchedField = 'price_usd';
        } else if (lowerHeader.includes('description') || lowerHeader.includes('desc')) {
          matchedField = 'description';
        } else if (lowerHeader.includes('image') && lowerHeader.includes('url')) {
          matchedField = 'image_url';
        } else if (lowerHeader === 'link' || lowerHeader.includes('web') || lowerHeader.includes('product')) {
          matchedField = 'web_url';
        }

        if (matchedField) {
          const existingMapping = autoMappings.find(m => m.dbField === matchedField);
          if (existingMapping) {
            existingMapping.csvHeader = csvHeader;
            
            // Auto-detect units based on header names
            if (matchedField === 'length_cm' || matchedField === 'width_cm') {
              if (lowerHeader.includes('inch') || lowerHeader.includes('in')) {
                existingMapping.selectedUnit = 'in';
              } else if (lowerHeader.includes('mm')) {
                existingMapping.selectedUnit = 'mm';
              } else {
                existingMapping.selectedUnit = 'cm'; // default
              }
            } else if (matchedField === 'weight_kg') {
              if (lowerHeader.includes('lb') || lowerHeader.includes('pound')) {
                existingMapping.selectedUnit = 'lb';
              } else if (lowerHeader.includes('gram') || lowerHeader.includes('g')) {
                existingMapping.selectedUnit = 'g';
              } else {
                existingMapping.selectedUnit = 'kg'; // default
              }
            } else if (matchedField === 'price_usd') {
              existingMapping.selectedUnit = '$'; // default
            }
          }
        }
      });

      console.log('CSVImporterComplete: Auto-mappings completed:', autoMappings);
      setFieldMappings(autoMappings);
      
      console.log('CSVImporterComplete: Setting step to mapping...');
      setCurrentStep('mapping');
      
      console.log('CSVImporterComplete: Showing success toast...');
      toast.success(`Loaded CSV with ${rows.length} rows`);
      
      console.log('CSVImporterComplete: File processing completed successfully');
    } catch (err) {
      console.error('CSVImporterComplete: Error in handleFileSelect:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  };

  const handleFieldMappingComplete = () => {
    processCSVData();
  };

  const processCSVData = async () => {
    setError(null);
    
    try {
      const processed: ProcessedPanel[] = [];
      
      for (const csvRow of csvRows) {
        try {
          const processedData = processCSVRow(csvRow, fieldMappings);
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
          toast.error(`Error processing row with name: ${csvRow.name || 'unknown'}`);
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

  const updateMapping = (dbField: keyof typeof DB_FIELD_INFO, csvHeader: string) => {
    const actualCsvHeader = csvHeader === "__NO_MAPPING__" ? "" : csvHeader;
    setFieldMappings(prev => prev.map(mapping => 
      mapping.dbField === dbField 
        ? { ...mapping, csvHeader: actualCsvHeader }
        : mapping
    ));
  };

  const updateUnitSelection = (dbField: keyof typeof DB_FIELD_INFO, selectedUnit: string) => {
    setFieldMappings(prev => prev.map(mapping => 
      mapping.dbField === dbField 
        ? { ...mapping, selectedUnit }
        : mapping
    ));
  };

  const getMappingStatus = () => {
    const requiredFields = fieldMappings.filter(m => m.required);
    const mappedRequired = requiredFields.filter(m => 
      m.csvHeader && csvHeaders.includes(m.csvHeader)
    );
    
    return {
      total: requiredFields.length,
      mapped: mappedRequired.length,
      isComplete: mappedRequired.length === requiredFields.length
    };
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

  const newPanels = processedPanels.filter(p => !p.isUpdate);
  const updatedPanels = processedPanels.filter(p => p.isUpdate && Object.keys(p.changes || {}).length > 0);
  const noChangePanels = processedPanels.filter(p => p.isUpdate && Object.keys(p.changes || {}).length === 0);

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
                id="csv-upload-complete"
              />
              <Button asChild>
                <label htmlFor="csv-upload-complete" className="cursor-pointer">
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Map CSV Fields to Database
            </CardTitle>
            <CardDescription>
              Match your CSV column headers to the corresponding database fields. 
              Required fields must be mapped to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {getMappingStatus().isComplete ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-medium">
                    {getMappingStatus().mapped}/{getMappingStatus().total} required fields mapped
                  </span>
                </div>
                <Button 
                  onClick={handleFieldMappingComplete}
                  disabled={!getMappingStatus().isComplete}
                  className="ml-auto"
                >
                  Continue to Preview
                </Button>
              </div>

              {/* Mapping Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Database Field</TableHead>
                    <TableHead>CSV Column</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Sample Value</TableHead>
                    <TableHead>Converted Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldMappings.map((mapping) => {
                    const fieldInfo = DB_FIELD_INFO[mapping.dbField];
                    const sampleValue = mapping.csvHeader ? csvRows[0]?.[mapping.csvHeader] : '';
                    const unitOptions = getUnitOptionsForField(mapping.dbField);
                    const fieldType = getFieldType(mapping.dbField);
                    
                    // Calculate conversion preview
                    let convertedPreview = '';
                    if (sampleValue && mapping.selectedUnit && fieldType) {
                      try {
                        const numericValue = parseFloat(sampleValue.replace(/[^0-9.-]/g, ''));
                        if (!isNaN(numericValue)) {
                          const converted = convertValue(sampleValue, mapping.selectedUnit, fieldType);
                          const targetUnit = fieldType === 'length' ? 'cm' : fieldType === 'weight' ? 'kg' : 'USD';
                          convertedPreview = `${converted.toFixed(2)} ${targetUnit}`;
                        }
                      } catch (e) {
                        convertedPreview = 'Invalid';
                      }
                    }
                    
                    return (
                      <TableRow key={mapping.dbField}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{fieldInfo.label}</span>
                              {fieldInfo.required && (
                                <Badge variant="destructive" className="text-xs">Required</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {fieldInfo.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping.csvHeader || '__NO_MAPPING__'}
                            onValueChange={(value) => updateMapping(mapping.dbField, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select CSV column..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__NO_MAPPING__">-- No mapping --</SelectItem>
                              {csvHeaders
                                .filter(header => header && header.trim().length > 0)
                                .map(header => (
                                  <SelectItem key={header} value={header}>
                                    {header}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {unitOptions.length > 0 ? (
                            <Select
                              value={mapping.selectedUnit || ''}
                              onValueChange={(value) => updateUnitSelection(mapping.dbField, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select unit..." />
                              </SelectTrigger>
                              <SelectContent>
                                {unitOptions.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {sampleValue || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {convertedPreview && (
                            <span className="text-sm font-mono bg-green-50 px-2 py-1 rounded text-green-700">
                              {convertedPreview}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {!getMappingStatus().isComplete && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please map all required fields before continuing. Required fields are marked with a red badge.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {currentStep === 'preview' && (
        <div className="space-y-4">
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
                    <CheckCircle className="w-5 h-5 text-gray-600" />
                    <span className="font-semibold text-gray-800">No Changes</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-600 mt-2">{noChangePanels.length}</p>
                  <p className="text-sm text-gray-700">Already up to date</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <Button variant="outline" onClick={resetImporter}>
                  Cancel Import
                </Button>
                <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700">
                  Import {newPanels.length + updatedPanels.length} Changes
                </Button>
              </div>
            </CardContent>
          </Card>
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
