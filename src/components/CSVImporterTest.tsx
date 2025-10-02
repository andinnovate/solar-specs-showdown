import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, AlertCircle } from "lucide-react";

export const CSVImporterTest = () => {
  const [error, setError] = useState<string | null>(null);
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Component loaded');

  const handleFileSelect = async (file: File) => {
    console.log('handleFileSelect called with:', file);
    setDebugInfo(`File selected: ${file.name}`);
    setError(null);
    setCSVFile(file);
    
    try {
      console.log('File selected:', file.name, file.size);
      const content = await file.text();
      console.log('File content preview:', content.substring(0, 200));
      setDebugInfo(`File read successfully. Size: ${file.size} bytes`);
    } catch (err) {
      console.error('Error reading file:', err);
      setError(err instanceof Error ? err.message : 'Failed to read file');
      setDebugInfo(`Error: ${err}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSV Import Test</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Test CSV Upload</h3>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
              id="csv-test-upload"
            />
            <Button asChild>
              <label htmlFor="csv-test-upload" className="cursor-pointer">
                Select CSV File
              </label>
            </Button>
          </div>
          
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm font-mono">{debugInfo}</p>
          </div>

          {csvFile && (
            <div className="mt-4 p-4 bg-green-100 rounded-lg">
              <p className="font-medium">{csvFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(csvFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
