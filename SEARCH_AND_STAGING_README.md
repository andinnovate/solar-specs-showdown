# Search, Discovery & Staging Implementation

## Overview

Complete implementation of the search → discover → stage → ingest workflow for automated solar panel product discovery from Amazon.

## 🎯 What's Implemented

### ✅ Core Modules

1. **`scripts/asin_manager.py`** - ASIN staging queue management
   - Check if ASIN exists in database
   - Stage ASINs for ingestion
   - Get pending ASINs
   - Mark ASINs as processing/completed/failed
   - Retry failed ASINs
   - Staging statistics

2. **`scripts/scraper.py`** (enhanced) - Added search functionality
   - `search_amazon()` - Search Amazon via ScraperAPI with autoparse
   - `extract_asins_from_search()` - Extract ASIN list from autoparsed results
   - **Note:** Uses ScraperAPI's autoparse feature for automatic result parsing

3. **`scripts/database.py`** (enhanced) - Added ASIN methods
   - `asin_exists()` - Check if ASIN is in solar_panels
   - `extract_asin_from_url()` - Extract ASIN from URL
   - `get_panels_with_asins()` - Get all panels with ASINs
   - `get_panel_by_asin()` - Fetch panel by ASIN

### ✅ CLI Tools

1. **`scripts/search_solar_panels.py`** - Search and stage ASINs
   ```bash
   # Search for keywords
   python scripts/search_solar_panels.py "solar panel 400w" "bifacial solar panel"
   
   # Search multiple pages
   python scripts/search_solar_panels.py "solar panel" --pages 3
   
   # Set priority for immediate processing
   python scripts/search_solar_panels.py "premium solar panel" --priority 100
   
   # Show staging stats
   python scripts/search_solar_panels.py --stats-only
   ```

2. **`scripts/ingest_staged_asins.py`** - Process staging queue
   ```bash
   # Process next 10 ASINs
   python scripts/ingest_staged_asins.py --batch-size 10
   
   # Process only high-priority ASINs
   python scripts/ingest_staged_asins.py --priority-only --batch-size 20
   
   # Retry failed ASINs
   python scripts/ingest_staged_asins.py --retry-failed
   
   # Show staging stats
   python scripts/ingest_staged_asins.py --stats-only
   ```

### ✅ Database Schema

Migration file: `supabase/migrations/20251017000000_add_search_and_staging_tables.sql`

**New Tables:**
- `search_keywords` - Track search queries and results
- `asin_staging` - Queue ASINs for product detail ingestion

**Enhanced Tables:**
- `solar_panels` - Added `asin` column (VARCHAR(20) UNIQUE)

## 🚀 Quick Start

### 1. Apply Database Migration

```bash
cd /Users/ekanderson/solar_spec_showdown/solar-specs-showdown

# Using Supabase CLI
supabase db push

# OR using psql directly
psql $DATABASE_URL -f supabase/migrations/20251017000000_add_search_and_staging_tables.sql
```

### 2. Discover Products

```bash
# Search for solar panels
python scripts/search_solar_panels.py "solar panel 400w" "bifacial solar panel"
```

Output:
```
Keyword: solar panel 400w
  Found: 20 ASINs
  Newly Staged: 18
  Already in DB: 2
  Already Staged: 0

✅ 18 new ASINs staged for ingestion!
   Run: python scripts/ingest_staged_asins.py --batch-size 10
```

### 3. Ingest Product Details

```bash
# Process staged ASINs (batched, rate-limited)
python scripts/ingest_staged_asins.py --batch-size 10 --delay 2
```

Output:
```
Processing 10 ASIN(s)...

[1/10] Processing ASIN: B0C99GS958
    Source: search (keyword: solar panel 400w)
    ✓ Success!

INGESTION COMPLETE - SUMMARY
====================================
Total Processed: 10
Successful: 9
Failed: 1
====================================
```

## 📋 Complete Workflow

### Phase 1: Search & Discovery

```bash
# Discover ASINs from Amazon search
python scripts/search_solar_panels.py \
  "solar panel 400w" \
  "bifacial solar panel" \
  "monocrystalline solar" \
  --pages 2 \
  --priority 10
```

**What happens:**
1. Searches Amazon for each keyword
2. Extracts ASINs from search results
3. Checks if ASIN already exists in database
4. Stages new ASINs in `asin_staging` table
5. Logs search in `search_keywords` table

### Phase 2: Product Detail Ingestion

```bash
# Process staging queue
python scripts/ingest_staged_asins.py --batch-size 20 --delay 2
```

**What happens:**
1. Gets pending ASINs from staging queue (ordered by priority)
2. Fetches full product details via ScraperAPI
3. Parses and converts units (inches→cm, pounds→kg)
4. Inserts into `solar_panels` table
5. Updates staging status to 'completed'
6. Tracks API usage

## 🔄 Data Flow Diagram

```
User Input
    │
    ▼
┌─────────────────────────────────────┐
│  search_solar_panels.py             │
│  Keywords: ["solar panel 400w"]     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ScraperAPI Amazon Search           │
│  Returns: 20 products with ASINs    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ASIN Manager                       │
│  - Check if ASIN exists: 2 exist    │
│  - Stage new ASINs: 18 staged       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  asin_staging Table                 │
│  18 records with status='pending'   │
└──────────────┬──────────────────────┘
               │
     (Later)   │
               ▼
┌─────────────────────────────────────┐
│  ingest_staged_asins.py             │
│  Batch: 10 ASINs                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ScraperAPI Product Details         │
│  Fetch full data for each ASIN      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Parse & Convert Units              │
│  inches→cm, pounds→kg, etc.         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  solar_panels Table                 │
│  10 new panels inserted             │
└─────────────────────────────────────┘
```

## 📊 Database Schema

### `search_keywords`

```sql
CREATE TABLE search_keywords (
  id UUID PRIMARY KEY,
  keyword TEXT NOT NULL,
  search_type VARCHAR(50) DEFAULT 'amazon',
  results_count INTEGER,
  asins_found TEXT[],  -- Array of discovered ASINs
  script_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Track what keywords have been searched and their results.

### `asin_staging`

```sql
CREATE TABLE asin_staging (
  id UUID PRIMARY KEY,
  asin VARCHAR(20) UNIQUE NOT NULL,
  source VARCHAR(50) NOT NULL,  -- 'search', 'manual', etc.
  source_keyword TEXT,
  search_id UUID REFERENCES search_keywords(id),
  priority INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  panel_id UUID REFERENCES solar_panels(id),
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMP,
  ingested_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Queue ASINs for processing with deduplication and retry logic.

## 🎛️ CLI Reference

### search_solar_panels.py

```bash
python scripts/search_solar_panels.py [keywords...] [options]

Arguments:
  keywords              One or more search keywords

Options:
  --pages N             Number of pages to search per keyword (default: 1)
  --priority N          Priority level for staged ASINs (default: 0)
  -v, --verbose         Enable verbose logging
  --stats-only          Show staging stats and exit

Examples:
  # Single keyword, 1 page
  python scripts/search_solar_panels.py "solar panel 400w"
  
  # Multiple keywords, 3 pages each
  python scripts/search_solar_panels.py "solar panel" "bifacial" --pages 3
  
  # High priority for immediate processing
  python scripts/search_solar_panels.py "premium solar" --priority 100
```

### ingest_staged_asins.py

```bash
python scripts/ingest_staged_asins.py [options]

Options:
  --batch-size N        Number of ASINs to process (default: 10)
  --delay SECONDS       Delay between requests (default: 2.0)
  --priority-only       Only process high-priority ASINs
  --max-retries N       Maximum retry attempts (default: 3)
  -v, --verbose         Enable verbose logging
  --retry-failed        Retry previously failed ASINs
  --stats-only          Show staging stats and exit

Examples:
  # Process 10 ASINs with 2s delay
  python scripts/ingest_staged_asins.py --batch-size 10 --delay 2
  
  # Process only priority ASINs
  python scripts/ingest_staged_asins.py --priority-only
  
  # Retry failed ASINs
  python scripts/ingest_staged_asins.py --retry-failed --batch-size 5
  
  # Show stats
  python scripts/ingest_staged_asins.py --stats-only
```

## 💡 Usage Examples

### Example 1: Discover New Products

```bash
# Step 1: Search for products
python scripts/search_solar_panels.py \
  "solar panel 400w" \
  "solar panel 500w" \
  --pages 2

# Output:
# ✅ 35 new ASINs staged for ingestion!

# Step 2: Process some ASINs
python scripts/ingest_staged_asins.py --batch-size 10

# Output:
# ✓ 10 panels successfully ingested!

# Step 3: Process more later
python scripts/ingest_staged_asins.py --batch-size 10
```

### Example 2: Priority Processing

```bash
# Mark urgent products with high priority
python scripts/search_solar_panels.py "premium solar panel" --priority 100

# Process high-priority items first
python scripts/ingest_staged_asins.py --priority-only --batch-size 5
```

### Example 3: Retry Failures

```bash
# Show current stats
python scripts/ingest_staged_asins.py --stats-only

# Output:
# Pending: 45
# Failed: 5

# Retry failed ASINs
python scripts/ingest_staged_asins.py --retry-failed
```

## 🔍 Monitoring & Maintenance

### Check Staging Queue Status

```bash
python scripts/search_solar_panels.py --stats-only

# OR

python scripts/ingest_staged_asins.py --stats-only
```

### Query Database Directly

```sql
-- See pending ASINs
SELECT asin, source, source_keyword, priority, attempts
FROM asin_staging
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC
LIMIT 10;

-- Search history
SELECT keyword, results_count, array_length(asins_found, 1) as asins
FROM search_keywords
ORDER BY created_at DESC
LIMIT 10;

-- Recent ingestions
SELECT s.asin, s.source_keyword, s.ingested_at, p.name
FROM asin_staging s
JOIN solar_panels p ON s.panel_id = p.id
WHERE s.status = 'completed'
ORDER BY s.ingested_at DESC
LIMIT 10;
```

### Clear Duplicate Records

```python
from scripts.asin_manager import ASINManager

manager = ASINManager()
cleared = await manager.clear_duplicates()
print(f"Cleared {cleared} duplicate records")
```

## ⚙️ Configuration

### Environment Variables

```bash
# Required
SCRAPERAPI_KEY=your-api-key
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key

# Optional
MAX_CONCURRENT_REQUESTS=5
REQUEST_DELAY=2.0
MAX_RETRIES=3
```

## 🚨 Error Handling

The system includes comprehensive error handling:

- **Retry Logic**: Failed ASINs are retried up to `max_attempts` times
- **Rate Limiting**: Configurable delays between requests
- **Duplicate Detection**: ASINs already in database are skipped
- **Status Tracking**: Every ASIN has a status (pending/processing/completed/failed)
- **Error Logging**: All errors logged to `script_logs` table

## 📈 Cost Management

ScraperAPI charges per request. Monitor usage:

```bash
# Check ScraperAPI usage
python -c "
import asyncio
from scripts.database import SolarPanelDB

async def stats():
    db = SolarPanelDB()
    stats = await db.get_scraper_usage_stats(days=30)
    print(f'Last 30 days: {stats[\"total_requests\"]} requests')
    print(f'Success rate: {stats[\"success_rate\"]:.1f}%')

asyncio.run(stats())
"
```

## 🎯 Best Practices

1. **Search First, Ingest Later**
   - Run searches to discover ASINs
   - Process staging queue in batches
   - Separate discovery from ingestion

2. **Use Priority Levels**
   - High priority (100+): Urgent products
   - Normal (0): Regular products
   - Negative: Low priority

3. **Batch Processing**
   - Process 10-20 ASINs at a time
   - Use 2-3 second delays between requests
   - Monitor API usage

4. **Monitor Failures**
   - Check `--stats-only` regularly
   - Retry failed ASINs
   - Investigate persistent failures

## 🐛 Troubleshooting

### No ASINs Staged

**Problem:** Search finds ASINs but none are staged

**Solution:** ASINs may already be in database
```bash
# Check if ASINs exist
SELECT asin, name FROM solar_panels WHERE asin IN ('B0C99GS958', ...);
```

### Failed Ingestions

**Problem:** ASINs marked as 'failed'

**Solutions:**
1. Check ScraperAPI credits
2. Retry with `--retry-failed`
3. Check error messages in database

### Rate Limiting

**Problem:** Too many requests errors

**Solution:** Increase delay
```bash
python scripts/ingest_staged_asins.py --delay 5
```

## 📝 Next Steps

1. ✅ **Applied**: Database migration
2. ✅ **Implemented**: Search and staging
3. ⏳ **Pending**: Automation (cron jobs)
4. ⏳ **Pending**: Revalidation script (separate from discovery)

## 🔗 Related Documentation

- [SEARCH_INGESTION_WORKFLOW.md](SEARCH_INGESTION_WORKFLOW.md) - Complete workflow planning
- [MISSING_COMPONENTS.md](MISSING_COMPONENTS.md) - Gap analysis
- [scripts/SCRAPER_README.md](scripts/SCRAPER_README.md) - ScraperAPI details
- [SCRAPER_IMPLEMENTATION_SUMMARY.md](SCRAPER_IMPLEMENTATION_SUMMARY.md) - Implementation summary

---

**Status:** ✅ Search, discovery, and staging functionality fully implemented and ready to use!

