# Price Update Implementation Summary

## Current Status

### ✅ Ready for Use

The Python scripts are now **ready to perform ASIN ScraperAPI fetches and price updates**. Two scripts are available:

1. **`scripts/fetch_solar_panels.py`** - Fetch and store/update solar panels by ASIN
2. **`scripts/update_prices.py`** - Batch update prices for existing panels (NEW)

### Bugs Fixed

1. **`fetch_solar_panels.py`** - Fixed response structure handling
   - Previously tried to access `panel_data['asin']` directly
   - Now correctly extracts `parsed_data` from `fetch_product()` response structure
   - `fetch_product()` returns: `{'parsed_data': {...}, 'raw_response': {...}, 'metadata': {...}}`

2. **`database.py`** - Fixed field name mismatch
   - `update_panel_price()` was using `'price'` field
   - Changed to use `'price_usd'` to match database schema

## Scripts Overview

### 1. `fetch_solar_panels.py`

**Purpose**: Fetch solar panel data from Amazon via ScraperAPI and store/update in database.

**Features**:
- Fetches product data by ASIN
- Updates price if panel already exists
- Adds new panel if not found
- Handles retry logic and error recovery
- Tracks scraper usage

**Usage**:
```bash
# Fetch single ASIN
python scripts/fetch_solar_panels.py B0C99GS958

# Fetch multiple ASINs
python scripts/fetch_solar_panels.py B0C99GS958 B0CB9X9XX1 B0D2RT4S3B

# Read from file
python scripts/fetch_solar_panels.py --file asins.txt

# With options
python scripts/fetch_solar_panels.py --file asins.csv --delay 2.0 --max-retries 3 --notify
```

**Price Update Logic**:
- Checks if panel exists by ASIN
- If exists: Compares old vs new price, updates if different
- If not exists: Adds new panel with fetched data
- Records price history in `price_history` table

### 2. `update_prices.py` (NEW)

**Purpose**: Batch update prices for existing panels in the database.

**Features**:
- Finds panels needing price updates (by `updated_at` date)
- Fetches current prices from Amazon via ScraperAPI
- Updates prices only if changed
- Tracks price changes and errors
- Supports updating specific ASINs or all panels needing updates

**Usage**:
```bash
# Update panels last updated >7 days ago (default)
python scripts/update_prices.py

# Update panels last updated >30 days ago, limit to 50
python scripts/update_prices.py --days-old 30 --limit 50

# Update specific ASINs
python scripts/update_prices.py --asins B0C99GS958 B0CB9X9XX1

# With verbose logging and notifications
python scripts/update_prices.py --verbose --notify
```

**Price Update Logic**:
- Queries panels by `updated_at` timestamp
- Fetches current price from Amazon
- Updates only if price changed
- Records price history
- Skips panels with no ASIN

## Database Schema

### Price Fields
- **`solar_panels.price_usd`** - Current price in USD (DECIMAL(10,2), nullable)
- **`price_history`** table - Tracks price changes over time
  - `old_price` - Previous price
  - `new_price` - New price
  - `source` - Update source (e.g., 'scraperapi')
  - `created_at` - Timestamp of change

### Price Update Method
```python
await db.update_panel_price(
    panel_id: str,
    new_price: float,
    source: str = 'scraperapi'
) -> bool
```

This method:
1. Gets current price from database
2. Updates `price_usd` field
3. Records entry in `price_history` table
4. Updates `updated_at` timestamp

## Implementation Details

### ScraperAPI Integration

**Client**: `ScraperAPIClient` in `scripts/scraper.py`

**Method**: `fetch_product(asin: str) -> Dict`

**Response Structure**:
```python
{
    'parsed_data': {
        'asin': 'B0C99GS958',
        'name': 'Product Name',
        'manufacturer': 'Brand',
        'price_usd': 69.99,
        # ... other fields
    },
    'raw_response': {...},  # Raw ScraperAPI JSON
    'metadata': {
        'response_time_ms': 1234,
        'response_size_bytes': 5678,
        # ... other metadata
    }
}
```

### Error Handling

- **Retry Logic**: Exponential backoff with configurable max retries
- **Circuit Breaker**: Prevents cascading failures
- **403 Forbidden Handling**: Stops processing on API key/rate limit issues
- **Graceful Degradation**: Continues processing other panels on individual failures

### Price Parsing

Price is extracted from ScraperAPI response:
- Field: `api_response.get('pricing', '')`
- Parsed by: `UnitConverter.parse_price_string()`
- Handles formats: `"$69.99"`, `"69.99"`, `"$1,299.99"`
- Sets to `0` if product is unavailable
- Returns `None` if parsing fails

## Recommended Usage Patterns

### Daily Price Updates
```bash
# Cron job: Update prices every 6 hours
0 */6 * * * /path/to/venv/bin/python /path/to/scripts/update_prices.py --limit 50 --notify
```

### Manual Price Updates
```bash
# Update specific panels
python scripts/update_prices.py --asins B0C99GS958 B0CB9X9XX1 --verbose

# Update all panels needing updates
python scripts/update_prices.py --days-old 1 --limit 200
```

### New Panel Ingestion
```bash
# Fetch new panels from file
python scripts/fetch_solar_panels.py --file new_asins.txt --notify
```

## Monitoring

### Scraper Usage Tracking
- Table: `scraper_usage`
- Tracks: script name, ASIN, URL, success/failure, response time
- Query stats: `await db.get_scraper_usage_stats(days=7)`

### Price History
- Table: `price_history`
- Tracks: all price changes with timestamps
- Useful for: price trend analysis, audit trails

### Script Logs
- Table: `script_logs`
- Tracks: execution logs, errors, metadata
- Query by: script name, execution ID, date range

## Best Practices

1. **Rate Limiting**: Use `--delay` flag to space out requests (default: 2.0s)
2. **Batch Size**: Use `--limit` to control batch size (default: 100)
3. **Error Handling**: Scripts continue processing on individual failures
4. **Notifications**: Use `--notify` for email alerts on completion
5. **Logging**: Use `--verbose` for detailed debugging

## Future Enhancements

Potential improvements:
1. **Price Change Alerts**: Notify on significant price changes (>10%)
2. **Price Trend Analysis**: Track price patterns over time
3. **Scheduled Updates**: More granular scheduling options
4. **Price Validation**: Validate prices against expected ranges
5. **Multi-source Price Comparison**: Compare prices from multiple sources

## Testing

To test the price update functionality:

```bash
# Test with a single known ASIN
python scripts/update_prices.py --asins B0C99GS958 --verbose

# Test with small batch
python scripts/update_prices.py --days-old 30 --limit 5 --verbose
```

## Notes

- Price updates respect manual overrides (if implemented)
- Price history is preserved for audit purposes
- Failed updates are logged but don't stop batch processing
- ScraperAPI 403 errors stop processing immediately (API key/rate limit issues)

