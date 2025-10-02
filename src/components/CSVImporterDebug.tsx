import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";

export const CSVImporterDebug = () => {
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>(['Debug logger initialized']);
  const [error, setError] = useState<string | null>(null);
  const [csvData, setCSVData] = useState<{headers: string[], rows: any[]} | null>(null);

  const addDebugLog = (message: string) => {
    console.log(message);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleFileSelect = async (file: File) => {
    addDebugLog(`File selected: ${file.name} (${file.size} bytes)`);
    setError(null);
    setCSVFile(file);
    
    try {
      addDebugLog('Starting to read file...');
      const content = await file.text();
      addDebugLog(`File read successfully. Length: ${content.length} characters`);
      addDebugLog(`First 100 chars: ${content.substring(0, 100)}`);
      
      // Basic CSV parsing with detailed logging
      addDebugLog('Starting CSV parsing...');
      const lines = content.trim().split('\n');
      addDebugLog(`Found ${lines.length} lines`);
      
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
      }
      
      // Simple parsing for debugging
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      addDebugLog(`Headers: ${JSON.stringify(headers)}`);
      
      const rows = [];
      for (let i = 1; i < Math.min(lines.length, 6); i++) { // Only parse first 5 rows for debugging
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
        addDebugLog(`Row ${i}: ${JSON.stringify(row)}`);
      }
      
      setCSVData({ headers, rows });
      addDebugLog('CSV parsing completed successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addDebugLog(`ERROR: ${errorMessage}`);
      setError(errorMessage);
      console.error('CSV processing error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSV Import Debug Mode</CardTitle>
          <CardDescription>
            This version provides detailed logging to debug CSV import issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Upload CSV File (Debug Mode)</h3>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
              id="csv-upload-debug"
            />
            <Button asChild>
              <label htmlFor="csv-upload-debug" className="cursor-pointer">
                Select CSV File
              </label>
            </Button>
          </div>
          
          {csvFile && (
            <div className="p-4 bg-muted rounded-lg flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">{csvFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(csvFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          )}

          {/* Debug Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Debug Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto">
                {debugLog.map((log, index) => (
                  <div key={index} className="text-xs font-mono mb-1 p-1 bg-gray-50 rounded">
                    {log}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CSV Data Preview */}
          {csvData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  CSV Data Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <strong>Headers ({csvData.headers.length}):</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {csvData.headers.map(header => (
                        <Badge key={header} variant="outline" className="text-xs">
                          {header}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <strong>Sample Rows ({csvData.rows.length}):</strong>
                    <div className="mt-1 text-xs">
                      <pre className="bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(csvData.rows, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
