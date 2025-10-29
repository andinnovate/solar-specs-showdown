# CSV Export Script for Solar Panels Database

This script exports the `solar_panels` table to CSV format for database migration, backup, or analysis purposes.

## Features

- ✅ Export all or limited number of rows
- ✅ Include all 18 columns from the solar_panels table
- ✅ Proper handling of JSON fields (missing_fields)
- ✅ Auto-generated filenames with timestamps
- ✅ Table statistics and validation
- ✅ Comprehensive error handling and logging

## Prerequisites

1. **Python Environment**: Make sure you have the Python virtual environment activated:
   ```bash
   source dev/bin/activate
   ```

2. **Environment Variables**: Ensure your `.env` file contains the required Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

## Usage

### Basic Commands

```bash
# Show table statistics
python scripts/export_solar_panels_csv.py --stats

# Export first 10 rows for testing
python scripts/export_solar_panels_csv.py --limit 10

# Export all data
python scripts/export_solar_panels_csv.py --all

# Export with custom filename
python scripts/export_solar_panels_csv.py --limit 100 --output my_export.csv
```

### Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--limit N` | Export only first N rows (for testing) | `--limit 50` |
| `--all` | Export all rows in the table | `--all` |
| `--output FILE` | Specify output CSV filename | `--output backup.csv` |
| `--stats` | Show table statistics and exit | `--stats` |
| `--verbose` | Enable detailed logging | `--verbose` |

### Examples

#### 1. Test Export (Small Dataset)
```bash
# Export 5 rows to test the process
python scripts/export_solar_panels_csv.py --limit 5 --output test_export.csv
```

#### 2. Full Database Export
```bash
# Export all 166 panels with auto-generated filename
python scripts/export_solar_panels_csv.py --all
# Output: solar_panels_export_all_20251028_144502.csv
```

#### 3. Production Migration Export
```bash
# Export with timestamp for production migration
python scripts/export_solar_panels_csv.py --all --output production_migration_$(date +%Y%m%d_%H%M%S).csv
```

#### 4. Check Database Status
```bash
# See current table statistics
python scripts/export_solar_panels_csv.py --stats
```

## Output Format

The CSV file includes all 18 columns from the solar_panels table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `asin` | String | Amazon Standard Identification Number |
| `name` | String | Product name |
| `manufacturer` | String | Brand/manufacturer |
| `length_cm` | Decimal | Panel length in centimeters |
| `width_cm` | Decimal | Panel width in centimeters |
| `weight_kg` | Decimal | Panel weight in kilograms |
| `wattage` | Integer | Power output in watts |
| `voltage` | Decimal | Operating voltage in volts |
| `price_usd` | Decimal | Price in US dollars |
| `description` | Text | Product description |
| `image_url` | String | Product image URL |
| `web_url` | String | Product page URL |
| `piece_count` | Integer | Number of pieces in set |
| `missing_fields` | JSON | Array of missing field names |
| `pending_flags` | Integer | Number of pending user flags |
| `created_at` | Timestamp | Record creation time |
| `updated_at` | Timestamp | Last update time |

## Sample Output

```csv
id,asin,name,manufacturer,length_cm,width_cm,weight_kg,wattage,voltage,price_usd,description,image_url,web_url,piece_count,missing_fields,pending_flags,created_at,updated_at
f9aae950-168a-420e-b039-405220865b29,B0DHH14WFS,"TBER 50W/12V Solar Panel Kit...",Brand: TBER,43.0,8.0,3.08,50,,59.99,"50 watt solar panel kit...",https://m.media-amazon.com/images/I/51vfNpkk6sL.jpg,https://www.amazon.com/dp/B0DHH14WFS,1,[],0,2025-10-26T19:43:29.734682+00:00,2025-10-26T19:43:29.734682+00:00
```

## Importing to Another Database

The exported CSV can be imported into another Supabase database using:

1. **Supabase Dashboard**: Upload CSV via the Table Editor
2. **Supabase CLI**: Use `supabase db reset` with the CSV
3. **Custom Script**: Write a Python script to read and insert the CSV data

### Import Considerations

- **UUIDs**: The `id` field contains UUIDs that may conflict in the target database
- **Timestamps**: `created_at` and `updated_at` preserve original timestamps
- **JSON Fields**: `missing_fields` is exported as JSON string
- **Constraints**: Ensure target database has matching schema

## Error Handling

The script includes comprehensive error handling:

- ✅ Database connection validation
- ✅ Query execution error handling
- ✅ File write error handling
- ✅ JSON serialization error handling
- ✅ Detailed logging for debugging

## Performance

- **Small exports** (< 100 rows): ~1-2 seconds
- **Medium exports** (100-1000 rows): ~5-10 seconds  
- **Large exports** (1000+ rows): ~30+ seconds

## Troubleshooting

### Common Issues

1. **Module not found**: Ensure virtual environment is activated
   ```bash
   source dev/bin/activate
   ```

2. **Database connection error**: Check `.env` file credentials
   ```bash
   python scripts/export_solar_panels_csv.py --stats
   ```

3. **Permission denied**: Ensure write permissions for output directory
   ```bash
   chmod 755 .
   ```

### Debug Mode

Enable verbose logging for troubleshooting:
```bash
python scripts/export_solar_panels_csv.py --limit 10 --verbose
```

## Integration with Web UI

The exported CSV files are compatible with the web UI's CSV upload mechanism:

1. Export data using this script
2. Upload CSV via the admin panel
3. Data is automatically processed and imported

This enables seamless database migration between environments.
