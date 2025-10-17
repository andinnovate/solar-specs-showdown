# Search to Ingestion Workflow Plan

## Overview

Complete data flow from ScraperAPI Amazon search → ASIN discovery → Product detail ingestion → Database storage.

## Current State vs. Required State

### ✅ What We Have

1. **Product Detail Ingestion** (`scripts/scraper.py`)
   - ✅ Fetch product by ASIN
   - ✅ Parse product data with unit conversions
   - ✅ Store in `solar_panels` table
   - ✅ Track API usage in `scraper_usage`

2. **Database Tables**
   - ✅ `solar_panels` - Main panel data
   - ✅ `scraper_usage` - API usage tracking (has ASIN field)
   - ✅ `price_history` - Price change tracking
   - ✅ `script_logs` - Execution logs

3. **Revalidation Logic**
   - ✅ `get_panels_needing_price_update()` - Find stale panels
   - ✅ `update_panel_price()` - Update existing panel prices

### ❌ What's Missing

1. **Search Functionality**
   - ❌ No ScraperAPI Amazon search implementation
   - ❌ No search keyword tracking
   - ❌ No search result parsing

2. **ASIN Management**
   - ❌ No ASIN staging table
   - ❌ No ASIN deduplication logic
   - ❌ No ASIN extraction from web_url
   - ❌ No "already exists" check before fetching

3. **Search Tracking**
   - ❌ No search keyword history
   - ❌ No search results tracking
   - ❌ No ASIN discovery tracking

4. **Workflow Orchestration**
   - ❌ No search → stage → ingest pipeline
   - ❌ No batch processing of staged ASINs
   - ❌ No workflow status tracking

---

## Proposed Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH & DISCOVERY PHASE                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
         ┌────────────────────────────────────────┐
         │  1. Search Amazon via ScraperAPI       │
         │     Keywords: "solar panel 400W"       │
         │     → Returns: Search results JSON     │
         └────────────────────────────────────────┘
                               │
                               ▼
         ┌────────────────────────────────────────┐
         │  2. Extract ASINs from Results         │
         │     Parse each product in results      │
         │     Extract ASIN: B0C99GS958          │
         └────────────────────────────────────────┘
                               │
                               ▼
         ┌────────────────────────────────────────┐
         │  3. Log Search in search_keywords      │
         │     keyword: "solar panel 400W"        │
         │     results_count: 20                  │
         │     asins_found: [B0C99GS958, ...]    │
         └────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ASIN STAGING PHASE                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
         ┌────────────────────────────────────────┐
         │  4. Check if ASIN Exists               │
         │     Query solar_panels WHERE           │
         │     web_url LIKE '%/dp/B0C99GS958'     │
         └────────────────────────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
             EXISTS                     NOT EXISTS
                 │                           │
                 ▼                           ▼
         ┌──────────────┐          ┌──────────────────┐
         │  Skip ASIN   │          │ 5. Stage ASIN    │
         │  (already    │          │    Insert into   │
         │   in DB)     │          │    asin_staging  │
         └──────────────┘          └──────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PRODUCT DETAIL INGESTION                       │
└─────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
         ┌────────────────────────────────────────┐
         │  6. Fetch Product Details (Batched)    │
         │     For each staged ASIN:              │
         │     - Fetch via ScraperAPI             │
         │     - Parse & convert units            │
         │     - Insert into solar_panels         │
         │     - Mark ASIN as processed           │
         └────────────────────────────────────────┘
                                              │
                                              ▼
         ┌────────────────────────────────────────┐
         │  7. Track Ingestion Status             │
         │     Update asin_staging:               │
         │     - status: 'completed'              │
         │     - ingested_at: NOW()               │
         │     - panel_id: <new UUID>             │
         └────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SEPARATE: REVALIDATION                        │
│               (Price Updates for Existing Panels)                │
└─────────────────────────────────────────────────────────────────┘
         ┌────────────────────────────────────────┐
         │  8. Revalidate Stale Panels (Daily)    │
         │     - Find panels updated > 30 days    │
         │     - Extract ASIN from web_url        │
         │     - Fetch current price              │
         │     - Update panel & log price_history │
         └────────────────────────────────────────┘
```

---

## Required Database Tables

### 1. `search_keywords` (NEW)

Tracks search queries performed and their results.

```sql
CREATE TABLE search_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  search_type VARCHAR(50) DEFAULT 'amazon', -- amazon, google, manual
  results_count INTEGER,
  asins_found TEXT[], -- Array of ASINs found
  search_metadata JSONB, -- Full search response metadata
  script_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_search_keywords_keyword ON search_keywords(keyword);
CREATE INDEX idx_search_keywords_created_at ON search_keywords(created_at);
```

**Purpose:**
- Track what search terms have been used
- Avoid duplicate searches
- Analyze search effectiveness
- Historical record of discovery sources

### 2. `asin_staging` (NEW)

Staging table for ASINs pending detail ingestion.

```sql
CREATE TABLE asin_staging (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asin VARCHAR(20) NOT NULL UNIQUE,
  source VARCHAR(50) NOT NULL, -- 'search', 'manual', 'competitor'
  source_keyword TEXT, -- What search keyword found this
  search_id UUID REFERENCES search_keywords(id),
  priority INTEGER DEFAULT 0, -- Higher = fetch sooner
  status VARCHAR(20) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  panel_id UUID REFERENCES solar_panels(id), -- Set after ingestion
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  ingested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_asin_staging_asin ON asin_staging(asin);
CREATE INDEX idx_asin_staging_status ON asin_staging(status);
CREATE INDEX idx_asin_staging_priority ON asin_staging(priority DESC);
CREATE INDEX idx_asin_staging_source ON asin_staging(source);
```

**Purpose:**
- Queue ASINs for processing
- Track ingestion status
- Prevent duplicate fetches
- Prioritize important products
- Link back to search source

### 3. `solar_panels` - Add `asin` Column (MODIFY)

Add dedicated ASIN column for efficient lookups.

```sql
ALTER TABLE solar_panels 
ADD COLUMN asin VARCHAR(20) UNIQUE;

-- Extract ASINs from existing web_url values
UPDATE solar_panels
SET asin = SUBSTRING(web_url FROM '/dp/([A-Z0-9]{10})');

CREATE INDEX idx_solar_panels_asin ON solar_panels(asin);
```

**Purpose:**
- Fast ASIN existence checks
- Avoid parsing web_url repeatedly
- Enable foreign key relationships
- Unique constraint prevents duplicates

---

## Required Code Components

### 1. Search Module: `scripts/search.py` (NEW)

```python
class AmazonSearchClient:
    """Search Amazon via ScraperAPI"""
    
    def search_products(self, keyword: str, page: int = 1) -> Dict:
        """
        Search Amazon for products.
        Returns: {
            'products': [
                {'asin': 'B0C99GS958', 'title': '...', 'price': '...'},
                ...
            ],
            'total_results': 1000,
            'page': 1
        }
        """
        
    def extract_asins(self, search_results: Dict) -> List[str]:
        """Extract list of ASINs from search results"""
        
    def save_search_results(self, keyword: str, results: Dict):
        """Save search to search_keywords table"""
```

### 2. ASIN Staging Module: `scripts/asin_manager.py` (NEW)

```python
class ASINManager:
    """Manage ASIN staging and deduplication"""
    
    def is_asin_in_database(self, asin: str) -> bool:
        """Check if ASIN already exists in solar_panels"""
        
    def is_asin_staged(self, asin: str) -> bool:
        """Check if ASIN is already in staging queue"""
        
    def stage_asin(self, asin: str, source: str, keyword: str = None):
        """Add ASIN to staging table"""
        
    def get_pending_asins(self, limit: int = 50) -> List[Dict]:
        """Get ASINs ready for ingestion"""
        
    def mark_asin_processing(self, asin: str):
        """Mark ASIN as currently being processed"""
        
    def mark_asin_completed(self, asin: str, panel_id: str):
        """Mark ASIN as successfully ingested"""
        
    def mark_asin_failed(self, asin: str, error: str):
        """Mark ASIN ingestion as failed"""
```

### 3. Orchestration Script: `scripts/discover_and_ingest.py` (NEW)

```python
#!/usr/bin/env python3
"""
Complete workflow: Search → Stage → Ingest
"""

async def discover_products(keywords: List[str]):
    """Phase 1: Search and discover ASINs"""
    search_client = AmazonSearchClient()
    asin_manager = ASINManager()
    
    for keyword in keywords:
        # Search
        results = search_client.search_products(keyword)
        asins = search_client.extract_asins(results)
        
        # Save search
        search_client.save_search_results(keyword, results)
        
        # Stage new ASINs
        for asin in asins:
            if not asin_manager.is_asin_in_database(asin):
                if not asin_manager.is_asin_staged(asin):
                    asin_manager.stage_asin(asin, 'search', keyword)

async def ingest_staged_products(batch_size: int = 10):
    """Phase 2: Fetch details for staged ASINs"""
    asin_manager = ASINManager()
    scraper = ScraperAPIClient()
    db = SolarPanelDB()
    
    pending = asin_manager.get_pending_asins(limit=batch_size)
    
    for staged_asin in pending:
        asin = staged_asin['asin']
        
        # Mark as processing
        asin_manager.mark_asin_processing(asin)
        
        # Fetch product details
        product_data = scraper.fetch_product(asin)
        
        if product_data:
            # Add ASIN to product data
            product_data['asin'] = asin
            
            # Insert into database
            panel_id = await db.add_new_panel(product_data)
            
            # Mark as completed
            asin_manager.mark_asin_completed(asin, panel_id)
        else:
            asin_manager.mark_asin_failed(asin, "Failed to fetch")
```

### 4. Update `scripts/scraper.py` (MODIFY)

Add search capability:

```python
class ScraperAPIClient:
    # ... existing methods ...
    
    def search_amazon(self, keyword: str, page: int = 1) -> Optional[Dict]:
        """
        Search Amazon for a keyword via ScraperAPI.
        
        Endpoint: https://api.scraperapi.com/
        Params:
          - api_key
          - url: https://www.amazon.com/s?k=solar+panel+400w
          - output_format: json
          - autoparse: true
        """
        search_url = f"https://www.amazon.com/s?k={keyword.replace(' ', '+')}&page={page}"
        
        payload = {
            'api_key': self.api_key,
            'url': search_url,
            'output_format': 'json',
            'autoparse': 'true',
            'country_code': 'us'
        }
        
        # ... implementation ...
```

### 5. Update `scripts/database.py` (MODIFY)

Add ASIN-related methods:

```python
class SolarPanelDB:
    # ... existing methods ...
    
    async def asin_exists(self, asin: str) -> bool:
        """Check if ASIN exists in solar_panels"""
        result = self.client.table('solar_panels').select('id').eq('asin', asin).execute()
        return len(result.data) > 0
    
    async def extract_asin_from_url(self, web_url: str) -> Optional[str]:
        """Extract ASIN from Amazon URL"""
        import re
        match = re.search(r'/dp/([A-Z0-9]{10})', web_url)
        return match.group(1) if match else None
    
    async def get_panels_with_asins(self) -> List[Dict]:
        """Get all panels with their ASINs for revalidation"""
        result = self.client.table('solar_panels').select('id, asin, web_url, updated_at').execute()
        return result.data
```

---

## Workflow Scripts

### Script 1: `scripts/search_solar_panels.py` (NEW)

Search for solar panels by keywords and stage ASINs.

```bash
# Search for specific keywords
python scripts/search_solar_panels.py "solar panel 400w" "bifacial solar panel"

# Search with pagination
python scripts/search_solar_panels.py "monocrystalline solar" --pages 3

# Search and immediately ingest
python scripts/search_solar_panels.py "solar panel" --auto-ingest --batch-size 10
```

### Script 2: `scripts/ingest_staged_asins.py` (NEW)

Process ASINs in staging queue.

```bash
# Ingest next 10 pending ASINs
python scripts/ingest_staged_asins.py --batch-size 10

# Ingest with priority filter
python scripts/ingest_staged_asins.py --priority-only --batch-size 20

# Retry failed ASINs
python scripts/ingest_staged_asins.py --retry-failed
```

### Script 3: `scripts/revalidate_panels.py` (NEW)

Separate from ingestion - updates existing panel prices.

```bash
# Revalidate panels older than 30 days
python scripts/revalidate_panels.py --days-old 30

# Revalidate specific ASINs
python scripts/revalidate_panels.py --asins B0C99GS958 B0CB9X9XX1
```

---

## Migration Plan

### Phase 1: Database Schema (Immediate)

1. Create migration file: `20251017000000_add_search_and_staging_tables.sql`
2. Add `search_keywords` table
3. Add `asin_staging` table
4. Add `asin` column to `solar_panels`
5. Extract ASINs from existing `web_url` values

### Phase 2: Code Implementation (Week 1)

1. Implement `scripts/search.py` - Amazon search via ScraperAPI
2. Implement `scripts/asin_manager.py` - ASIN staging logic
3. Update `scripts/scraper.py` - Add search_amazon() method
4. Update `scripts/database.py` - Add ASIN-related queries

### Phase 3: Workflow Scripts (Week 1)

1. Create `scripts/search_solar_panels.py`
2. Create `scripts/ingest_staged_asins.py`
3. Create `scripts/revalidate_panels.py`
4. Create `scripts/discover_and_ingest.py` - Combined workflow

### Phase 4: Testing & Validation (Week 1)

1. Test search functionality
2. Test ASIN staging deduplication
3. Test end-to-end workflow
4. Verify separation between discovery and revalidation

### Phase 5: Automation (Week 2)

1. Set up cron jobs for daily search
2. Set up cron jobs for staged ASIN ingestion
3. Set up cron jobs for revalidation (separate schedule)
4. Add monitoring and alerts

---

## Key Benefits of This Architecture

### ✅ Separation of Concerns

- **Discovery** (Search → Stage) is separate from **Ingestion** (Fetch Details)
- **New Products** (ingestion) is separate from **Price Updates** (revalidation)
- Can search without fetching, fetch without searching

### ✅ Cost Control

- Stage ASINs first, fetch details later (batched)
- Avoid duplicate API calls
- Prioritize important products
- Rate limiting between phases

### ✅ Traceability

- Know where each ASIN came from (search keyword)
- Track search history
- Monitor ingestion success rate
- Audit trail for all operations

### ✅ Resilience

- Failed ingestions can be retried
- Partial failures don't block progress
- Status tracking at every step
- Error handling per ASIN

### ✅ Scalability

- Process thousands of ASINs in batches
- Priority queue for important products
- Parallel processing possible
- Can pause/resume at any stage

---

## Example Usage Flow

```bash
# Day 1: Discovery
python scripts/search_solar_panels.py "solar panel 400w" "bifacial solar panel" "monocrystalline"
# Result: 150 ASINs staged, 45 already in DB (skipped)

# Day 1: Initial Ingestion (small batch)
python scripts/ingest_staged_asins.py --batch-size 10
# Result: 10 products fetched and stored

# Day 2: Continue Ingestion
python scripts/ingest_staged_asins.py --batch-size 50
# Result: 50 more products fetched

# Day 30: Revalidation (separate process)
python scripts/revalidate_panels.py --days-old 30
# Result: 100 panels updated with current prices

# Day 31: New search
python scripts/search_solar_panels.py "portable solar panel"
# Result: 20 new ASINs staged (no duplicates)
```

---

## Next Steps

1. **Review this plan** with team
2. **Create migration** for new tables
3. **Implement search functionality** first
4. **Test with small batch** before full automation
5. **Document** all new scripts and workflows

This architecture provides a robust, scalable, and maintainable system for discovering and ingesting solar panel data from Amazon while keeping costs under control and maintaining full traceability.

