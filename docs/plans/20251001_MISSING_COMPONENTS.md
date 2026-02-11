# Missing Components for Complete Search-to-Ingestion Workflow

## Executive Summary

We have **product detail ingestion** working (fetch by ASIN → parse → store).  
We are **missing the search and staging infrastructure** (search keywords → discover ASINs → queue for ingestion).

---

## ✅ What's Already Implemented

| Component | Status | File | Description |
|-----------|--------|------|-------------|
| Product Detail Fetch | ✅ Complete | `scripts/scraper.py` | Fetch product by ASIN via ScraperAPI |
| Unit Conversion | ✅ Complete | `scripts/scraper.py` | Parse & convert inches→cm, pounds→kg, etc. |
| Database Storage | ✅ Complete | `scripts/database.py` | Insert/update solar_panels table |
| API Usage Tracking | ✅ Complete | `scripts/database.py` | Track ScraperAPI calls in scraper_usage |
| Error Handling | ✅ Complete | `scripts/error_handling.py` | Retry logic, circuit breakers |
| Logging | ✅ Complete | `scripts/logging_config.py` | Structured logging system |
| CLI Tool | ✅ Complete | `scripts/fetch_solar_panels.py` | Fetch known ASINs and store |

---

## ❌ What's Missing

### 🔍 1. Search Functionality

**Missing:** Amazon product search via ScraperAPI

| Item | Status | Priority | Effort |
|------|--------|----------|--------|
| Search API method in scraper.py | ❌ Not Implemented | **HIGH** | 4 hours |
| Search result parser | ❌ Not Implemented | **HIGH** | 2 hours |
| ASIN extraction from search results | ❌ Not Implemented | **HIGH** | 1 hour |

**Files Needed:**
- `scripts/scraper.py` - Add `search_amazon()` method
- `scripts/search.py` - New module for search operations

**Example Missing Code:**
```python
def search_amazon(self, keyword: str, page: int = 1) -> Optional[Dict]:
    """Search Amazon via ScraperAPI"""
    search_url = f"https://www.amazon.com/s?k={keyword.replace(' ', '+')}"
    payload = {
        'api_key': self.api_key,
        'url': search_url,
        'output_format': 'json',
        'autoparse': 'true'
    }
    # Fetch and parse search results
    # Extract ASINs from product listings
```

---

### 🗄️ 2. Database Infrastructure

**Missing:** Tables for search tracking and ASIN staging

| Table | Status | Purpose |
|-------|--------|---------|
| `search_keywords` | ❌ Not Exists | Track search queries and results |
| `asin_staging` | ❌ Not Exists | Queue ASINs for ingestion |
| `solar_panels.asin` column | ❌ Not Exists | Fast ASIN lookup (currently using web_url) |

**Migration File:**
- ✅ Created: `supabase/migrations/20251017000000_add_search_and_staging_tables.sql`
- ❌ Not Applied: Needs to be run

**To Apply:**
```bash
supabase db push
# OR
psql $DATABASE_URL -f supabase/migrations/20251017000000_add_search_and_staging_tables.sql
```

---

### 🎯 3. ASIN Management

**Missing:** Logic to stage and deduplicate ASINs

| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Check if ASIN exists in DB | ❌ Not Implemented | **HIGH** | 1 hour |
| Check if ASIN already staged | ❌ Not Implemented | **HIGH** | 1 hour |
| Stage new ASIN | ❌ Not Implemented | **HIGH** | 2 hours |
| Get pending ASINs for ingestion | ❌ Not Implemented | **HIGH** | 1 hour |
| Mark ASIN as processing/completed | ❌ Not Implemented | **MEDIUM** | 2 hours |

**Files Needed:**
- `scripts/asin_manager.py` - New module for ASIN staging logic
- `scripts/database.py` - Add ASIN-related queries

**Example Missing Code:**
```python
class ASINManager:
    def is_asin_in_database(self, asin: str) -> bool:
        """Check solar_panels table for ASIN"""
        
    def is_asin_staged(self, asin: str) -> bool:
        """Check asin_staging table"""
        
    def stage_asin(self, asin: str, source: str, keyword: str):
        """Insert into asin_staging if not exists"""
        
    def get_pending_asins(self, limit: int = 50) -> List[Dict]:
        """Get ASINs with status='pending', ordered by priority"""
```

---

### 🔄 4. Workflow Orchestration

**Missing:** End-to-end pipeline scripts

| Script | Status | Purpose | Priority |
|--------|--------|---------|----------|
| `search_solar_panels.py` | ❌ Not Exists | Search & stage ASINs | **HIGH** |
| `ingest_staged_asins.py` | ❌ Not Exists | Process staging queue | **HIGH** |
| `discover_and_ingest.py` | ❌ Not Exists | Combined workflow | **MEDIUM** |
| `revalidate_panels.py` | ❌ Not Exists | Update existing panel prices | **MEDIUM** |

**Current Workaround:**
- Can manually call `fetch_solar_panels.py` with known ASINs
- No way to discover new ASINs automatically

**Example Missing Script:**
```bash
# This should work but doesn't yet:
python scripts/search_solar_panels.py "solar panel 400w"
# Should: Search Amazon, find 20 ASINs, stage them

python scripts/ingest_staged_asins.py --batch-size 10
# Should: Fetch details for 10 staged ASINs, store in DB
```

---

### 📊 5. Tracking & Monitoring

**Missing:** Visibility into search and staging status

| Feature | Status | Priority |
|---------|--------|----------|
| Search history tracking | ❌ Not Implemented | **LOW** |
| Staging queue dashboard | ❌ Not Implemented | **LOW** |
| Duplicate ASIN detection | ❌ Not Implemented | **HIGH** |
| Failed ingestion retry logic | ❌ Not Implemented | **MEDIUM** |

---

## 🚀 Implementation Priority

### Phase 1: Foundation (Week 1) - **CRITICAL**

**Must-Have for Basic Functionality:**

1. ✅ **Apply Database Migration** (30 min)
   ```bash
   supabase db push
   ```

2. ❌ **Implement ASIN Manager** (4 hours)
   - Create `scripts/asin_manager.py`
   - Add methods: `is_asin_in_database()`, `stage_asin()`, `get_pending_asins()`
   - Test with manual ASINs

3. ❌ **Add ASIN Methods to Database** (2 hours)
   - Update `scripts/database.py`
   - Add: `asin_exists()`, `get_panels_with_asins()`

4. ❌ **Create Staging Script** (3 hours)
   - Create `scripts/ingest_staged_asins.py`
   - Can process manually-staged ASINs
   - Integrates with existing `scraper.py`

**Result:** Can manually stage ASINs and ingest them (no search yet)

---

### Phase 2: Search Integration (Week 1-2) - **HIGH PRIORITY**

**Enable Automatic Discovery:**

1. ❌ **Add Search to Scraper** (4 hours)
   - Update `scripts/scraper.py`
   - Add `search_amazon()` method
   - Parse search results, extract ASINs

2. ❌ **Create Search Module** (3 hours)
   - Create `scripts/search.py`
   - Higher-level search operations
   - Save to `search_keywords` table

3. ❌ **Create Search Script** (4 hours)
   - Create `scripts/search_solar_panels.py`
   - CLI tool for keyword searches
   - Automatically stages discovered ASINs

**Result:** Can search Amazon, discover ASINs, stage for ingestion

---

### Phase 3: Revalidation (Week 2) - **MEDIUM PRIORITY**

**Separate from New Product Discovery:**

1. ❌ **Create Revalidation Script** (3 hours)
   - Create `scripts/revalidate_panels.py`
   - Find panels updated > N days ago
   - Fetch current price, update DB

2. ❌ **Schedule Revalidation** (1 hour)
   - Add to cron jobs
   - Run nightly or weekly

**Result:** Existing panels stay up-to-date automatically

---

### Phase 4: Automation (Week 2-3) - **LOW PRIORITY**

**Set It and Forget It:**

1. ❌ **Scheduled Searches** (2 hours)
   - Cron job for daily searches
   - List of target keywords

2. ❌ **Scheduled Ingestion** (1 hour)
   - Cron job to process staging queue
   - Rate-limited batches

3. ❌ **Monitoring & Alerts** (4 hours)
   - Dashboard for staging status
   - Email alerts for failures

**Result:** Fully automated discovery and ingestion

---

## 📋 Immediate Next Steps

### To Get Working Today (Minimal Viable):

1. **Apply Migration**
   ```bash
   cd /Users/ekanderson/solar_spec_showdown/solar-specs-showdown
   supabase db push
   ```

2. **Create ASIN Manager** (~4 hours)
   - Start with `scripts/asin_manager.py`
   - Implement basic ASIN checking and staging
   - Test with SQL manually:
     ```sql
     INSERT INTO asin_staging (asin, source, source_keyword)
     VALUES ('B0C99GS958', 'manual', 'test');
     ```

3. **Create Ingestion Script** (~3 hours)
   - Start with `scripts/ingest_staged_asins.py`
   - Read from `asin_staging` where `status='pending'`
   - Call existing `ScraperAPIClient.fetch_product()`
   - Update staging status

4. **Test End-to-End**
   ```bash
   # Stage ASIN manually
   psql -c "INSERT INTO asin_staging (asin, source) VALUES ('B0C99GS958', 'manual')"
   
   # Run ingestion
   python scripts/ingest_staged_asins.py --batch-size 1
   
   # Verify in DB
   psql -c "SELECT * FROM solar_panels WHERE asin='B0C99GS958'"
   ```

---

## 💡 Current Capabilities vs. Goal

### What Works Now:
```bash
# Can fetch if you already know the ASIN
python scripts/fetch_solar_panels.py B0C99GS958
```

### What We Want:
```bash
# Discovery phase
python scripts/search_solar_panels.py "solar panel 400w"
# → Finds 20 ASINs, stages them

# Ingestion phase (batched, rate-limited)
python scripts/ingest_staged_asins.py --batch-size 10
# → Processes 10 staged ASINs

# Maintenance phase (separate)
python scripts/revalidate_panels.py --days-old 30
# → Updates prices for existing panels
```

---

## 📊 Effort Estimate

| Phase | Tasks | Hours | Can Start |
|-------|-------|-------|-----------|
| Phase 1: Foundation | Database + ASIN Manager + Staging Script | 9 hours | ✅ Immediately |
| Phase 2: Search | Search API + Search Module + Search Script | 11 hours | After Phase 1 |
| Phase 3: Revalidation | Revalidation Script + Scheduling | 4 hours | After Phase 1 |
| Phase 4: Automation | Cron Jobs + Monitoring | 7 hours | After Phase 2 |
| **TOTAL** | **All Phases** | **31 hours** | **~1 week dev time** |

---

## 🎯 Recommended Path

**If you need something working quickly:**
1. Apply the migration (30 min)
2. Manually insert test ASINs into `asin_staging` via SQL (10 min)
3. Create basic `ingest_staged_asins.py` (2-3 hours)
4. Test with 1-2 ASINs

**For full implementation:**
Follow phases 1-4 in order. Focus on Phase 1 first to establish the foundation.

---

## 📝 Summary

- **Product detail fetching**: ✅ Done
- **Search discovery**: ❌ Missing
- **ASIN staging**: ❌ Missing (schema ready, code not implemented)
- **Workflow orchestration**: ❌ Missing
- **Automation**: ❌ Missing

**Bottom Line:** We have the "fetch and parse" working. We need the "search and stage" infrastructure to make it a complete automated system.

