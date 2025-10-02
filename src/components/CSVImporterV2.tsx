import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, AlertCircle, CheckCircle, ArrowRight } from "lucide-react";
import { parseCSV, DEFAULT_FIELD_MAPPINGS, type CSVRow, type FieldMapping } from "@/lib/csvUtils";

type ImportStep = 'upload' | 'mapping' | 'complete';

export const CSVImporterV2 = () => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [csvHeaders, setCSVHeaders] = useState<string[]>([]);
  const [csvRows, setCSVRows] = useState<CSVRow[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(DEFAULT_FIELD_MAPPINGS);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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
      
      console.log(`Loaded CSV with ${rows.length} rows and headers:`, headers);
    } catch (err) {
      console.error('CSV parsing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  };

  const resetImporter = () => {
    setCurrentStep('upload');
    setCSVFile(null);
    setCSVHeaders([]);
    setCSVRows([]);
    setError(null);
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'upload': return 'Upload CSV File';
      case 'mapping': return 'Review Data';
      case 'complete': return 'Import Complete';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{getStepTitle()}</h3>
        <div className="flex items-center gap-2">
          {['upload', 'mapping', 'complete'].map((step, index) => (
            <div
              key={step}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === step
                  ? 'bg-primary text-white'
                  : index < ['upload', 'mapping', 'complete'].indexOf(currentStep)
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index < ['upload', 'mapping', 'complete'].indexOf(currentStep) ? (
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
                id="csv-upload-v2"
              />
              <Button asChild>
                <label htmlFor="csv-upload-v2" className="cursor-pointer">
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

      {/* Mapping/Preview Step */}
      {currentStep === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              CSV Data Preview
            </CardTitle>
            <CardDescription>
              Review the parsed CSV data. Found {csvRows.length} rows with {csvHeaders.length} columns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Headers */}
            <div>
              <h4 className="font-medium mb-2">CSV Headers:</h4>
              <div className="flex flex-wrap gap-2">
                {csvHeaders.map(header => (
                  <Badge key={header} variant="outline">
                    {header}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Sample Data */}
            <div>
              <h4 className="font-medium mb-2">Sample Data (first 3 rows):</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {csvHeaders.map(header => (
                        <TableHead key={header} className="text-xs">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.slice(0, 3).map((row, index) => (
                      <TableRow key={index}>
                        {csvHeaders.map(header => (
                          <TableCell key={header} className="text-xs font-mono">
                            {row[header] || '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={resetImporter}>
                Upload Different File
              </Button>
              <Button onClick={() => setCurrentStep('complete')}>
                Continue (Preview Only)
              </Button>
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
              <h3 className="text-lg font-semibold text-green-600">CSV Parsed Successfully!</h3>
              <p className="text-muted-foreground">
                Your CSV file has been successfully parsed. Found {csvRows.length} data rows.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={resetImporter}>
                  Upload Another File
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
