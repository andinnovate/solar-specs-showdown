import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { type FieldMapping, type CSVRow, detectUnit } from "@/lib/csvUtils";

interface FieldMappingInterfaceProps {
  csvHeaders: string[];
  fieldMappings: FieldMapping[];
  onComplete: (mappings: FieldMapping[]) => void;
  sampleRow: CSVRow;
}

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

export const FieldMappingInterface = ({
  csvHeaders,
  fieldMappings,
  onComplete,
  sampleRow
}: FieldMappingInterfaceProps) => {
  const [mappings, setMappings] = useState<FieldMapping[]>(fieldMappings);
  const [detectedUnits, setDetectedUnits] = useState<Record<string, string>>({});

  useEffect(() => {
    // Auto-detect field mappings based on header names
    const autoMappings = [...fieldMappings];
    const units: Record<string, string> = {};

    csvHeaders.forEach(csvHeader => {
      const lowerHeader = csvHeader.toLowerCase().trim();
      
      // Try to find matching DB field
      let matchedField: keyof typeof DB_FIELD_INFO | null = null;
      
      if (lowerHeader.includes('name') || lowerHeader.includes('model')) {
        matchedField = 'name';
      } else if (lowerHeader.includes('manufacturer') || lowerHeader.includes('brand') || lowerHeader.includes('company')) {
        matchedField = 'manufacturer';
      } else if (lowerHeader.includes('length') || lowerHeader.includes('height')) {
        matchedField = 'length_cm';
      } else if (lowerHeader.includes('width')) {
        matchedField = 'width_cm';
      } else if (lowerHeader.includes('weight') || lowerHeader.includes('mass')) {
        matchedField = 'weight_kg';
      } else if (lowerHeader.includes('watt') || lowerHeader.includes('power')) {
        matchedField = 'wattage';
      } else if (lowerHeader.includes('voltage') || lowerHeader.includes('volt')) {
        matchedField = 'voltage';
      } else if (lowerHeader.includes('price') || lowerHeader.includes('cost') || lowerHeader.includes('$')) {
        matchedField = 'price_usd';
      } else if (lowerHeader.includes('description') || lowerHeader.includes('desc')) {
        matchedField = 'description';
      } else if (lowerHeader.includes('image') && lowerHeader.includes('url')) {
        matchedField = 'image_url';
      } else if (lowerHeader.includes('web') || lowerHeader.includes('product') || lowerHeader.includes('link')) {
        matchedField = 'web_url';
      }

      if (matchedField) {
        const existingMapping = autoMappings.find(m => m.dbField === matchedField);
        if (existingMapping) {
          existingMapping.csvHeader = csvHeader;
        }

        // Detect units from sample data
        const sampleValue = sampleRow[csvHeader];
        if (sampleValue) {
          if (['length_cm', 'width_cm'].includes(matchedField)) {
            const unit = detectUnit(sampleValue, 'length');
            if (unit) units[csvHeader] = unit;
          } else if (matchedField === 'weight_kg') {
            const unit = detectUnit(sampleValue, 'weight');
            if (unit) units[csvHeader] = unit;
          } else if (matchedField === 'price_usd') {
            const unit = detectUnit(sampleValue, 'price');
            if (unit) units[csvHeader] = unit;
          }
        }
      }
    });

    setMappings(autoMappings);
    setDetectedUnits(units);
  }, [csvHeaders, fieldMappings, sampleRow]);

  const updateMapping = (dbField: keyof typeof DB_FIELD_INFO, csvHeader: string) => {
    const actualCsvHeader = csvHeader === "__NO_MAPPING__" ? "" : csvHeader;
    setMappings(prev => prev.map(mapping => 
      mapping.dbField === dbField 
        ? { ...mapping, csvHeader: actualCsvHeader }
        : mapping
    ));
  };

  const getMappingStatus = () => {
    const requiredFields = mappings.filter(m => m.required);
    const mappedRequired = requiredFields.filter(m => 
      m.csvHeader && csvHeaders.includes(m.csvHeader)
    );
    
    return {
      total: requiredFields.length,
      mapped: mappedRequired.length,
      isComplete: mappedRequired.length === requiredFields.length
    };
  };

  const handleComplete = () => {
    const finalMappings = mappings.filter(m => 
      m.csvHeader && csvHeaders.includes(m.csvHeader)
    );
    onComplete(finalMappings);
  };

  const status = getMappingStatus();

  return (
    <div className="space-y-6">
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
                {status.isComplete ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
                <span className="font-medium">
                  {status.mapped}/{status.total} required fields mapped
                </span>
              </div>
              <Button 
                onClick={handleComplete}
                disabled={!status.isComplete}
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
                  <TableHead>Sample Value</TableHead>
                  <TableHead>Detected Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => {
                  const fieldInfo = DB_FIELD_INFO[mapping.dbField];
                  const sampleValue = mapping.csvHeader ? sampleRow[mapping.csvHeader] : '';
                  const detectedUnit = mapping.csvHeader ? detectedUnits[mapping.csvHeader] : '';
                  
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
                        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {sampleValue || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {detectedUnit && (
                          <Badge variant="outline" className="text-xs">
                            {detectedUnit}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Sample Data Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sample CSV Data</CardTitle>
              </CardHeader>
              <CardContent>
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
                      <TableRow>
                        {csvHeaders.map(header => (
                          <TableCell key={header} className="text-xs font-mono">
                            {sampleRow[header] || '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {!status.isComplete && (
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
    </div>
  );
};
