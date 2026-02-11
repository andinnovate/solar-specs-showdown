# Debugging Plan: ScraperAPI Search Functionality

## Problem Statement

Script: `search_solar_panels.py`
Issue: ScraperAPI request succeeds (6125ms) but **0 products parsed** from response

```
2025-10-17 16:03:14 - INFO - ScraperAPI request: SUCCESS (6125ms)
2025-10-17 16:03:14 - WARNING - No products found for keyword: solar panel monocrystalline
```

**Hypothesis:** ScraperAPI's search response structure differs from our expectations

---

## Root Cause Analysis

### Current Code Assumption

In `scraper.py::search_amazon()`:

```python
# We check if 'products' key exists
if 'products' in api_data and len(api_data['products']) > 0:
    return api_data
else:
    return None  # ← This is what's happening
```

**Possible Issues:**
1. ScraperAPI might return different key (e.g., `results`, `items`, `organic_results`)
2. Response might be structured differently than product detail API
3. AutoParse might not work for search results
4. Response might need different parameters

---

## Debugging Strategy

### Phase 1: Capture Raw Response (CRITICAL)

**Goal:** See EXACTLY what ScraperAPI returns

**Options:**

#### A. Add Response Logging to scraper.py ⭐ Recommended
```python
def search_amazon(self, keyword: str, page: int = 1):
    # ... existing code ...
    
    response = requests.get(self.base_url, params=payload, timeout=60)
    api_data = response.json()
    
    # NEW: Log full response for debugging
    if self.logger:
        self.logger.log_script_event(
            "DEBUG",
            f"ScraperAPI search response keys: {list(api_data.keys())}"
        )
        self.logger.log_script_event(
            "DEBUG", 
            f"Full response (first 500 chars): {str(api_data)[:500]}"
        )
```

#### B. Add --dump-response Flag ⭐⭐ Best for Analysis
```python
# In search_solar_panels.py
parser.add_argument(
    '--dump-response',
    type=str,
    help='Save raw ScraperAPI response to JSON file for debugging'
)

# After search:
if args.dump_response:
    import json
    with open(args.dump_response, 'w') as f:
        json.dump(search_results, f, indent=2)
    print(f"Response saved to: {args.dump_response}")
```

#### C. Temporary Debug Script ⭐⭐⭐ Fastest
Create `scripts/debug_search_response.py`:
```python
import requests
import json
from scripts.config import config

keyword = "solar panel monocrystalline"
search_url = f"https://www.amazon.com/s?k={keyword.replace(' ', '+')}"

payload = {
    'api_key': config.SCRAPERAPI_KEY,
    'url': search_url,
    'output_format': 'json',
    'autoparse': 'true',
    'country_code': 'us'
}

response = requests.get('https://api.scraperapi.com/', params=payload)
data = response.json()

# Save full response
with open('search_response_debug.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Response keys:", list(data.keys()))
print("\nFull response saved to: search_response_debug.json")
```

---

## Phase 2: Response Structure Analysis

Once we have the raw response, check:

### Expected Structure (Our Assumption)
```json
{
  "products": [
    {"asin": "B0C99GS958", "title": "...", ...},
    ...
  ]
}
```

### Possible Actual Structures

**Option 1: Different Key Name**
```json
{
  "results": [...],
  "organic_results": [...],
  "search_results": [...],
  "items": [...]
}
```

**Option 2: Nested Structure**
```json
{
  "search_information": {...},
  "organic_results": {
    "products": [...]
  }
}
```

**Option 3: No AutoParse for Search**
```json
{
  "html": "...",  // Raw HTML, not parsed
  "status": 200
}
```

**Option 4: Different Format Entirely**
```json
{
  "serpapi_data": {...},
  "pagination": {...}
}
```

---

## Phase 3: Fix Based on Findings

### If AutoParse Doesn't Work for Search

**Problem:** ScraperAPI's autoparse might only work for product detail pages

**Solution:** Use different parameters or endpoint
```python
payload = {
    'api_key': self.api_key,
    'url': search_url,
    'output_format': 'json',
    # Remove autoparse or try different value
}
```

### If Response Uses Different Key

**Problem:** Response has `results` instead of `products`

**Solution:** Check multiple possible keys
```python
# Try multiple possible keys
products_data = (
    api_data.get('products') or 
    api_data.get('results') or 
    api_data.get('organic_results') or
    api_data.get('search_results') or
    api_data.get('items') or
    []
)

if len(products_data) > 0:
    api_data['products'] = products_data
    return api_data
```

---

## Implementation Plan

### Step 1: Add Debug Logging (10 minutes)

**File:** `scripts/scraper.py`

**Changes:**
1. Log response structure (keys)
2. Log first product structure
3. Add --dump-response option to search script

### Step 2: Run Debug Script (5 minutes)

Create and run temporary debug script to capture raw response

### Step 3: Analyze Response (5 minutes)

Review saved JSON to understand structure

### Step 4: Fix Parser (15 minutes)

Update `search_amazon()` and/or `_parse_search_results()` based on findings

### Step 5: Test Fix (5 minutes)

Re-run search and verify products are found

**Total Time: ~40 minutes**

---

## Quick Wins to Try First

### 1. Check Response Keys (2 minutes)
Add this to `search_amazon()` right after `api_data = response.json()`:
```python
print(f"DEBUG: Response keys: {list(api_data.keys())}")
print(f"DEBUG: Response type: {type(api_data)}")
if isinstance(api_data, dict):
    for key in api_data.keys():
        print(f"  {key}: {type(api_data[key])}")
```

### 2. Save Response to File (1 minute)
```python
import json
with open('/tmp/scraperapi_search_debug.json', 'w') as f:
    json.dump(api_data, f, indent=2)
print("Response saved to /tmp/scraperapi_search_debug.json")
```

### 3. Check Without AutoParse (2 minutes)
Try removing `autoparse` parameter to see raw response

---

## Recommended Approach

**Fastest Path:**

1. **Add temporary debug prints** to `scraper.py::search_amazon()` (2 min)
2. **Run search** with `LOG_LEVEL=DEBUG` (1 min)
3. **Check output** to see response structure (1 min)
4. **Fix parser** based on actual structure (10 min)
5. **Remove debug prints** (1 min)

**Total: ~15 minutes** to diagnose and fix

---

## Enhanced Logging Strategy

### Option A: File Logging for Responses

Add to `logging_config.py`:
```python
def log_api_response(self, endpoint: str, response_data: dict, truncate: int = 1000):
    """Log API responses to separate file for debugging"""
    import json
    
    # Log summary to main log
    self.log_script_event("DEBUG", f"API {endpoint} response keys: {list(response_data.keys())}")
    
    # Log full response to api_responses.log
    api_log_file = os.path.join(self.log_dir, 'api_responses.log')
    with open(api_log_file, 'a') as f:
        f.write(f"\n{'='*80}\n")
        f.write(f"Timestamp: {datetime.now().isoformat()}\n")
        f.write(f"Endpoint: {endpoint}\n")
        f.write(json.dumps(response_data, indent=2)[:truncate])
        f.write(f"\n{'='*80}\n\n")
```

### Option B: Environment Variable Control

```python
# In scraper.py
DEBUG_SAVE_RESPONSES = os.getenv('DEBUG_SAVE_RESPONSES', 'false').lower() == 'true'

if DEBUG_SAVE_RESPONSES:
    # Save response to file
    filename = f"debug_search_{int(time.time())}.json"
    with open(filename, 'w') as f:
        json.dump(api_data, f, indent=2)
```

Usage:
```bash
DEBUG_SAVE_RESPONSES=true python scripts/search_solar_panels.py "solar panel"
```

---

## What We'll Likely Find

Based on ScraperAPI documentation:

**Most Likely:** Search responses don't use `autoparse` the same way
- Product detail: `autoparse=true` works great
- Search results: Might need manual parsing or different structure

**Fix Will Probably Be:**
- Update key checking logic
- Handle different response structure
- Possibly disable autoparse for search

---

## Next Steps

**Recommend:**

1. Create `scripts/debug_search_response.py` - simple script to dump raw response
2. Run it once to see actual response structure
3. Update `search_amazon()` method based on findings
4. Add permanent debug logging for future issues

**Estimated fix time:** 15-30 minutes once we see the response structure

