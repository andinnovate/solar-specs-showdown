# CSV Import Feature Guide

## Overview

The Solar Panel Comparison app now includes a comprehensive CSV import system that allows you to bulk upload and update solar panel data. The system includes intelligent field mapping, unit conversion, duplicate detection, and change preview capabilities.

## Features

### 🔄 **Smart Field Mapping**
- Automatically detects and maps CSV headers to database fields
- Supports flexible header names (e.g., "Panel Name", "name", "model" all map to the name field)
- Manual override capability for custom CSV formats

### 📏 **Unit Conversion**
- **Length**: Automatically converts inches ↔ centimeters
- **Weight**: Automatically converts pounds ↔ kilograms  
- **Price**: Handles various currency formats ($, USD, dollars)
- Detects units from data values (e.g., "68.5 in", "45.2 lbs", "$299.99")

### 🔍 **Duplicate Detection**
- Identifies existing panels by name and manufacturer
- Shows exactly what will be updated vs. what will be added
- Highlights specific field changes with before/after comparison

### 👀 **Change Preview**
- Review all changes before importing
- Separate tabs for new panels, updates, and unchanged records
- Detailed change comparison showing old vs. new values

### 📊 **Progress Tracking**
- Real-time import progress with visual indicators
- Step-by-step workflow (Upload → Mapping → Preview → Import → Complete)
- Success/error feedback with detailed messaging

## How to Use

### 1. Access Admin Panel
- Navigate to `/admin` in your browser
- Or click the "Admin Panel" button in the main app header

### 2. Upload CSV File
- Drag and drop a CSV file or click to select
- Supported format: `.csv` files with headers in the first row
- Sample file provided: `sample_panels.csv`

### 3. Map Fields
- Review auto-detected field mappings
- Adjust mappings if your CSV uses different header names
- All required fields must be mapped to proceed
- Preview sample data to verify mappings

### 4. Review Changes
- See summary of new panels vs. updates
- Review detailed changes for each panel
- Verify unit conversions are correct
- Cancel if needed or proceed with import

### 5. Import Complete
- Watch real-time progress
- View success confirmation
- Option to import another file or return to main app

## CSV Format Requirements

### Required Fields
- `name` - Panel name/model
- `manufacturer` - Company name
- `length_cm` - Panel length (supports unit conversion)
- `width_cm` - Panel width (supports unit conversion)  
- `weight_kg` - Panel weight (supports unit conversion)
- `wattage` - Power output in watts
- `price_usd` - Price (supports unit conversion)

### Optional Fields
- `voltage` - Operating voltage
- `description` - Product description
- `image_url` - Link to product image
- `web_url` - Link to product page

### Sample CSV Format

```csv
name,manufacturer,length_in,width_in,weight_lbs,wattage,voltage,price_dollars,description,web_url
"SolarMax 420","SunTech Industries",68.5,40.2,45.2,420,42.1,299.99,"High-efficiency panel","https://example.com"
"PowerPro 500","EliteEnergy",78.7,42.1,52.8,500,48.5,389.50,"Premium bifacial panel","https://example.com"
```

## Supported Units

### Length
- `in`, `inch`, `inches` → converts to `cm`
- `cm`, `centimeters` → no conversion
- `mm`, `millimeters` → converts to `cm`

### Weight  
- `lb`, `lbs`, `pounds` → converts to `kg`
- `kg`, `kilograms` → no conversion
- `g`, `grams` → converts to `kg`

### Price
- `$`, `usd`, `dollars` → no conversion (assumes USD)

## Error Handling

The system includes comprehensive error handling:
- **Invalid CSV format**: Clear error messages for malformed files
- **Missing required fields**: Highlights which fields need mapping
- **Invalid data types**: Validates numeric fields and provides specific error messages
- **Database errors**: Graceful handling with rollback capability
- **Network issues**: Retry logic and user-friendly error messages

## Database Integration

- **Row Level Security**: Respects existing Supabase RLS policies
- **Atomic Operations**: All-or-nothing import (if any record fails, none are imported)
- **Timestamp Management**: Automatically updates `updated_at` for modified records
- **Duplicate Prevention**: Uses name + manufacturer as unique identifier

## Technical Implementation

- **Frontend**: React with TypeScript, shadcn/ui components
- **Backend**: Supabase (PostgreSQL) with real-time capabilities
- **File Processing**: Client-side CSV parsing with Papa Parse-like functionality
- **State Management**: React hooks with step-by-step workflow
- **Type Safety**: Full TypeScript support with Supabase generated types

## Troubleshooting

### Common Issues

**"Cannot find required field" error**
- Ensure all required fields are mapped in the field mapping step
- Check that your CSV has the necessary columns

**"Invalid numeric value" error**  
- Verify numeric fields contain valid numbers
- Check for special characters or formatting issues

**"Panel already exists" but shows as new**
- The system matches on name + manufacturer
- Slight differences in spelling will create new records

**Import stuck on "Processing"**
- Check browser console for errors
- Verify Supabase connection and permissions
- Try with a smaller CSV file first

### Getting Help

1. Check the browser console for detailed error messages
2. Verify your CSV format matches the sample file
3. Test with the provided `sample_panels.csv` file
4. Ensure you have proper database permissions

## Future Enhancements

Potential improvements for future versions:
- Excel file support (.xlsx)
- Bulk delete functionality
- Import history and rollback
- Custom field validation rules
- Scheduled imports
- API endpoint for programmatic imports
