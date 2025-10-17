# Debugging ScraperAPI Search Issues

## Quick Diagnosis Guide

If search returns 0 products despite successful API call:

```
✓ ScraperAPI request: SUCCESS (6125ms)  
✗ WARNING - No products found
```

**Most likely cause:** Response structure doesn't match our expectations

---

## Three Debugging Methods

### Method 1: Debug Script (Fastest - Recommended) ⭐⭐⭐

**Use the dedicated debug script to capture raw response:**

```bash
# Quick debug
python scripts/debug_search_response.py "solar panel monocrystalline"

# With custom page
python scripts/debug_search_response.py "solar panel 400w" --page 1
```

**What it does:**
- Makes ScraperAPI request
- Shows response structure analysis
- Saves full JSON to file: `scraperapi_search_debug_TIMESTAMP.json`
- Lists all top-level keys
- Shows which product keys exist
- No impact on staging/database

**Time:** 30 seconds to get response

---

### Method 2: Dump Response Flag ⭐⭐

**Use --dump-response flag on search script:**

```bash
# Save response while searching
python scripts/search_solar_panels.py "solar panel" \
  --dump-response "search_debug.json" \
  --verbose

# Use {keyword} placeholder for auto-naming
python scripts/search_solar_panels.py "solar panel" "bifacial" \
  --dump-response "debug_{keyword}.json"
```

**What it does:**
- Performs normal search
- Saves first page response to specified file
- Continues with staging workflow
- Good for production debugging

**Time:** Same as normal search + file write

---

### Method 3: Enhanced Logging ⭐

**Use LOG_LEVEL=DEBUG to see response structure:**

```bash
LOG_LEVEL=DEBUG python scripts/search_solar_panels.py \
  --verbose \
  "solar panel monocrystalline"
```

**What you'll see:**
```
DEBUG - Search response keys: ['search_information', 'organic_results', ...]
DEBUG - Found 'organic_results' key with 20 items
```

**Benefits:**
- No extra files
- See structure in real-time
- Logs to logs/search_solar_panels_TIMESTAMP.log

---

## Analyzing The Response

### Step 1: Check Response Keys

Open the debug JSON file and look at top-level keys:

```json
{
  "search_information": {...},
  "organic_results": [...],   ← Look for this!
  "ads": [...],
  "pagination": {...}
}
```

**We currently check for:** `products`  
**Might actually be:** `organic_results`, `results`, `search_results`, `items`

### Step 2: Check Product Structure

Look inside the products array:

```json
{
  "organic_results": [
    {
      "asin": "B0C99GS958",       ← We need this!
      "title": "...",
      "link": "https://...",
      "price": {...}
    }
  ]
}
```

### Step 3: Check If AutoParse Works

If response has `html` key instead of structured data:

```json
{
  "html": "<html>...</html>",  ← AutoParse didn't work
  "status": 200
}
```

**Fix:** AutoParse might not support search, need manual parsing or different approach

---

## Common Issues & Fixes

### Issue 1: Response Uses Different Key

**Symptom:**
```
DEBUG - Search response keys: ['organic_results', 'ads', 'pagination']
```

**Fix:** Update `scraper.py::search_amazon()`:
```python
# OLD
if 'products' in api_data and len(api_data['products']) > 0:

# NEW  
products_data = api_data.get('organic_results') or api_data.get('products') or []
if len(products_data) > 0:
    api_data['products'] = products_data
    return api_data
```

### Issue 2: AutoParse Returns HTML

**Symptom:**
```
DEBUG - Search response keys: ['html', 'status']
```

**Fix:** AutoParse doesn't work for search results
```python
# Remove autoparse or use different endpoint
payload = {
    'api_key': self.api_key,
    'url': search_url,
    'output_format': 'json',
    # Don't use autoparse for search
}
```

### Issue 3: Nested Product Structure

**Symptom:**
```json
{
  "search_results": {
    "items": [...]
  }
}
```

**Fix:** Navigate nested structure
```python
search_results = api_data.get('search_results', {})
products = search_results.get('items', [])
```

---

## Debugging Workflow

### Quickstart (15 minutes)

```bash
# Step 1: Capture response (30 sec)
python scripts/debug_search_response.py "solar panel"

# Step 2: Review JSON file (2 min)
cat scraperapi_search_debug_*.json | head -50

# Step 3: Identify structure differences (2 min)
# Look for: What key contains products? How is ASIN stored?

# Step 4: Update scraper.py (10 min)
# Fix search_amazon() to handle actual structure

# Step 5: Test (30 sec)
python scripts/search_solar_panels.py "solar panel" --verbose
```

---

## Log File Locations

### Script Logs
```
logs/search_solar_panels_TIMESTAMP.log
```

Contains:
- INFO: Search progress
- DEBUG: Response keys, product counts (with LOG_LEVEL=DEBUG)
- WARNING: Issues encountered
- ERROR: Failures

### Debug Response Files

**From debug script:**
```
scraperapi_search_debug_TIMESTAMP.json
```

**From --dump-response flag:**
```
search_debug.json
debug_solar_panel.json  # If using {keyword} placeholder
```

---

## Example Debug Session

```bash
# 1. Run debug script
$ python scripts/debug_search_response.py "solar panel"

Output:
  Response keys: ['organic_results', 'search_information', 'ads']
  ✓ Found 'organic_results' with 20 items
  ✓ Full response saved to: scraperapi_search_debug_20251017_160500.json

# 2. Check JSON
$ cat scraperapi_search_debug_*.json | jq '.organic_results[0] | keys'
["asin", "title", "link", "price", "rating"]

# 3. Fix scraper.py
# Change 'products' to 'organic_results'

# 4. Test
$ python scripts/search_solar_panels.py "solar panel" --verbose
  Found: 20 ASINs  ← Fixed!
```

---

## Quick Reference

| Scenario | Command | Output |
|----------|---------|--------|
| Capture raw response | `python scripts/debug_search_response.py "keyword"` | JSON file |
| See response keys | `LOG_LEVEL=DEBUG python scripts/search_solar_panels.py "keyword" --verbose` | Console + log |
| Save while searching | `python scripts/search_solar_panels.py "keyword" --dump-response debug.json` | JSON file |
| Check log file | `tail -50 logs/search_solar_panels_*.log` | Log entries |

---

## Contact ScraperAPI Support

If response structure is unclear:
1. Save response with debug script
2. Check ScraperAPI documentation for search endpoint
3. Contact support with example response

Useful info to provide:
- Endpoint: `https://api.scraperapi.com/`
- URL: Amazon search URL
- Parameters: autoparse=true, output_format=json
- Response keys found
- Expected structure

