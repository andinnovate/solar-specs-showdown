# ScraperAPI Integration for Solar Panel Data

This module provides automated fetching and parsing of Amazon solar panel data via ScraperAPI, with proper unit conversions and database integration.

## Overview

The scraper module (`scripts/scraper.py`) handles:
- ✅ Fetching product data from Amazon via ScraperAPI
- ✅ Parsing complex product specifications
- ✅ Unit conversions (inches→cm, pounds→kg)
- ✅ Data validation and normalization
- ✅ Database-ready output format

## Features

### Amazon Search (New!)

Search Amazon for products using ScraperAPI's autoparse feature:

```python
from scripts.scraper import ScraperAPIClient

client = ScraperAPIClient()

# Search Amazon
results = client.search_amazon("solar panel 400w", page=1)

# ScraperAPI autoparse returns structured data:
# results['products'] = [
#     {'asin': 'B0C99GS958', 'title': '...', 'price': {...}, ...},
#     ...
# ]

# Extract ASINs
asins = client.extract_asins_from_search(results)
# Returns: ['B0C99GS958', 'B0CB9X9XX1', ...]
```

**Key Features:**
- ✅ Uses ScraperAPI's autoparse (no manual HTML parsing)
- ✅ Returns structured JSON with product data
- ✅ Handles pagination
- ✅ Extracts ASINs automatically
- ✅ Full error handling and logging

### Unit Conversions

| Field | Input Format | Output Format | Example |
|-------|-------------|---------------|---------|
| Dimensions | `"45.67\"L x 17.71\"W x 1.18\"H"` | `length_cm`, `width_cm` | 116.00 cm, 44.98 cm |
| Weight | `"15.87 pounds"` | `weight_kg` | 7.20 kg |
| Power | `"100 Watts"` | `wattage` | 100 W |
| Voltage | `"12 Volts"` | `voltage` | 12.0 V |
| Price | `"$69.99"` | `price_usd` | 69.99 |

### Supported Formats

The parser handles multiple input formats:
- Dimensions: `"45\"L x 17\"W"`, `"115cm x 66cm"`, `"45L x 17W"`
- Weight: `"15.87 pounds"`, `"7.2 kg"`, `"7200 grams"`
- Price: `"$69.99"`, `"$1,299.99"`, `"69.99"`
- Power: `"100 Watts"`, `"100W"`, `"100"`
- Voltage: `"12 Volts"`, `"12V"`, `"12"`

## Installation

```bash
# Install required packages (should already be in requirements.txt)
pip install requests

# Ensure environment variables are set
export SCRAPERAPI_KEY="your-api-key-here"
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_KEY="your-service-key"
```

## Usage

### Basic Usage - Fetch Single Product

```python
from scripts.scraper import ScraperAPIClient

# Initialize client
client = ScraperAPIClient()

# Fetch product by ASIN
asin = "B0C99GS958"
product_data = client.fetch_product(asin)

if product_data:
    print(f"Name: {product_data['name']}")
    print(f"Price: ${product_data['price_usd']}")
    print(f"Wattage: {product_data['wattage']} W")
    # Data is ready for database insertion
```

### Fetch Multiple Products

```python
from scripts.scraper import ScraperAPIClient

client = ScraperAPIClient()
asins = ["B0C99GS958", "B0CB9X9XX1", "B0D2RT4S3B"]

# Fetch with 2-second delay between requests
results = client.fetch_multiple_products(asins, delay=2.0)

for asin, data in results.items():
    if data:
        print(f"✓ {asin}: {data['name']}")
    else:
        print(f"✗ {asin}: Failed to fetch")
```

### With Database Integration

```python
import asyncio
from scripts.scraper import ScraperAPIClient
from scripts.database import SolarPanelDB

async def fetch_and_store(asin):
    client = ScraperAPIClient()
    db = SolarPanelDB()
    
    # Fetch data
    product_data = client.fetch_product(asin)
    
    if product_data:
        # Store in database
        panel_id = await db.add_new_panel(product_data)
        print(f"Added panel with ID: {panel_id}")
        
        # Track API usage
        await db.track_scraper_usage(
            script_name='my_script',
            asin=asin,
            success=True
        )

asyncio.run(fetch_and_store("B0C99GS958"))
```

## Command-Line Scripts

### 1. Test Parsing (No API Calls)

Tests all parsing functions with sample data:

```bash
python scripts/test_scraper_parsing.py
```

Output:
```
============================================================
TESTING UNIT CONVERSIONS
============================================================
✓ Inches to CM: 45.67" = 116.0 cm
✓ Pounds to KG: 15.87 lbs = 7.2 kg
✅ All unit conversion tests passed!
```

### 2. Test Live API Integration

Tests actual ScraperAPI call (uses 1 API credit):

```bash
python scripts/test_live_scraper.py
```

### 3. Fetch and Store Panels

Fetch one or more ASINs and store in database:

```bash
# Fetch single panel
python scripts/fetch_solar_panels.py B0C99GS958

# Fetch multiple panels
python scripts/fetch_solar_panels.py B0C99GS958 B0CB9X9XX1 B0D2RT4S3B

# With options
python scripts/fetch_solar_panels.py B0C99GS958 \
  --verbose \
  --delay 2.0 \
  --max-retries 3 \
  --notify
```

Options:
- `--verbose, -v`: Enable debug logging
- `--delay SECONDS`: Delay between requests (default: 2.0)
- `--max-retries N`: Maximum retry attempts (default: 3)
- `--notify`: Send email notification on completion

## Database Schema Mapping

```python
# ScraperAPI Response → Database Schema
{
    "name": str,                    # → name (TEXT)
    "brand": "Visit FivstaSola",    # → manufacturer (TEXT, cleaned)
    "product_information": {
        "Product Dimensions": "45.67\"L x 17.71\"W x 1.18\"H",
        # → length_cm (DECIMAL 116.00) + width_cm (DECIMAL 44.98)
        
        "Item Weight": "15.87 pounds",
        # → weight_kg (DECIMAL 7.20)
        
        "Maximum Power": "100 Watts",
        # → wattage (INTEGER 100)
        
        "Maximum Voltage": "12 Volts",
        # → voltage (DECIMAL 12.00)
    },
    "pricing": "$69.99",            # → price_usd (DECIMAL 69.99)
    "images": ["url"],              # → image_url (TEXT)
    "full_description": "text",     # → description (TEXT)
    "asin": "B0C99GS958"           # → web_url (generated)
}
```

## Error Handling

The scraper includes comprehensive error handling:

```python
from scripts.scraper import ScraperAPIClient
from scripts.error_handling import RetryConfig, RetryHandler
from scripts.logging_config import ScriptLogger

logger = ScriptLogger("my_script")
client = ScraperAPIClient(script_logger=logger)

# Setup retry logic
retry_config = RetryConfig(
    max_retries=3,
    base_delay=2.0,
    exponential_base=2.0
)
retry_handler = RetryHandler(retry_config, logger)

# Execute with retry
import asyncio
async def fetch_with_retry(asin):
    return await retry_handler.execute_with_retry(
        client.fetch_product,
        asin,
        service_name="scraperapi"
    )

data = asyncio.run(fetch_with_retry("B0C99GS958"))
```

## Monitoring and Usage Tracking

All ScraperAPI requests are automatically tracked in the `scraper_usage` table:

```sql
SELECT 
    script_name,
    COUNT(*) as total_requests,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
    AVG(response_time_ms) as avg_response_time
FROM scraper_usage
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY script_name;
```

Python API:
```python
from scripts.database import SolarPanelDB

db = SolarPanelDB()
stats = await db.get_scraper_usage_stats(days=7)

print(f"Total requests: {stats['total_requests']}")
print(f"Success rate: {stats['success_rate']}%")
```

## Unit Conversion Reference

### Length Conversions
```python
from scripts.scraper import UnitConverter

# Inches to centimeters
cm = UnitConverter.inches_to_cm(45.67)  # → 116.00

# Parse dimension strings
dims = UnitConverter.parse_dimension_string('45.67"L x 17.71"W')
# → (116.00, 44.98)
```

### Weight Conversions
```python
# Pounds to kilograms
kg = UnitConverter.pounds_to_kg(15.87)  # → 7.20

# Parse weight strings
kg = UnitConverter.parse_weight_string("15.87 pounds")  # → 7.20
```

## Testing

Run all tests:
```bash
# Unit tests (no API calls)
python scripts/test_scraper_parsing.py

# Integration test (uses 1 API credit)
python scripts/test_live_scraper.py
```

## Common Issues

### Issue: "ScraperAPI key is required"
**Solution**: Set the `SCRAPERAPI_KEY` environment variable:
```bash
export SCRAPERAPI_KEY="your-api-key"
```

### Issue: Failed to parse dimensions
**Cause**: Unusual dimension format in Amazon listing
**Solution**: The parser logs warnings. Check logs and add new format to `parse_dimension_string()`

### Issue: Rate limiting / Too many requests
**Solution**: Increase delay between requests:
```python
results = client.fetch_multiple_products(asins, delay=3.0)
```

## API Costs

ScraperAPI charges per request. Monitor usage:
```python
from scripts.database import SolarPanelDB

db = SolarPanelDB()
stats = await db.get_scraper_usage_stats(days=30)
print(f"Last 30 days: {stats['total_requests']} requests")
```

## Integration with Existing Workflows

### Update Prices Daily
```bash
# Create cron job (see scripts/cron_setup.py)
0 2 * * * cd /path/to/project && python scripts/fetch_solar_panels.py $(cat asin_list.txt)
```

### Import from CSV, then Fetch Details
```python
# 1. Import basic data via CSV
# 2. Extract ASINs from web_url
# 3. Fetch full details via ScraperAPI

import asyncio
from scripts.scraper import ScraperAPIClient
from scripts.database import SolarPanelDB

async def enrich_panels():
    db = SolarPanelDB()
    client = ScraperAPIClient()
    
    # Get panels needing updates
    panels = await db.get_panels_needing_price_update(days_old=30)
    
    for panel in panels:
        # Extract ASIN from web_url
        if '/dp/' in panel.get('web_url', ''):
            asin = panel['web_url'].split('/dp/')[1].split('/')[0]
            data = client.fetch_product(asin)
            
            if data:
                # Update price
                await db.update_panel_price(
                    panel['id'], 
                    data['price_usd']
                )

asyncio.run(enrich_panels())
```

## See Also

- [scripts/database.py](database.py) - Database operations
- [scripts/error_handling.py](error_handling.py) - Error handling utilities
- [scripts/logging_config.py](logging_config.py) - Logging configuration
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Production deployment

