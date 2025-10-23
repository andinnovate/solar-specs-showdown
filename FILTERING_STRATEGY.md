# Product Filtering Strategy

## Problem
Search results include non-solar-panel products:
- Testers/meters
- Charge controllers
- Starter kits
- Mounts/brackets
- Security camera panels
- Low-wattage items (<30W)

## Solution: Two-Stage Filtering

### Stage 1: Search Script Filtering (Pre-Staging)
**Location:** `search_solar_panels.py`
**Purpose:** Filter before staging to avoid database pollution

**Filter Criteria:**
1. **Name-based exclusions:**
   - Contains "tester", "meter", "multimeter"
   - Contains "charge controller" (without "solar panel")
   - Contains "mount", "bracket", "stand"
   - Contains "security", "camera"
   - Contains "kit" (unless explicitly solar panel kit)

2. **Category-based exclusions:**
   - Electronics test equipment
   - Security cameras
   - Mounting hardware

3. **Wattage-based exclusions:**
   - Under 30W (if wattage can be parsed from name)

### Stage 2: Ingest Script Filtering (Pre-Database)
**Location:** `ingest_staged_asins.py`
**Purpose:** Final validation before database insertion

**Filter Criteria:**
1. **Wattage validation:**
   - Reject if wattage < 30W
   - Log rejection reason

2. **Product type validation:**
   - Ensure it's actually a solar panel
   - Check dimensions make sense for a panel

## Database Tracking

### New Table: `filtered_asins`
```sql
CREATE TABLE filtered_asins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asin VARCHAR(10) NOT NULL,
    filter_stage VARCHAR(20) NOT NULL, -- 'search' or 'ingest'
    filter_reason VARCHAR(100) NOT NULL,
    product_name TEXT,
    product_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Track Rejections:
- **Search stage:** "non_solar_panel", "low_wattage", "accessory"
- **Ingest stage:** "wattage_too_low", "invalid_product_type"

## Implementation Plan

### 1. Create Product Filter Class
**File:** `scripts/product_filter.py`

```python
class ProductFilter:
    def is_solar_panel(self, product_name: str, product_data: dict) -> bool:
        """Check if product is likely a solar panel"""
        
    def extract_wattage(self, product_name: str) -> Optional[int]:
        """Extract wattage from product name"""
        
    def should_reject(self, product_name: str, product_data: dict) -> tuple[bool, str]:
        """Return (should_reject, reason)"""
```

### 2. Update Search Script
**File:** `scripts/search_solar_panels.py`

```python
# Before staging ASIN
if filter.should_reject(product_name, product_data)[0]:
    # Log to filtered_asins table
    # Skip staging
    continue
```

### 3. Update Ingest Script
**File:** `scripts/ingest_staged_asins.py`

```python
# Before database insertion
if panel_data['wattage'] < 30:
    # Log to filtered_asins table
    # Mark as rejected
    continue
```

### 4. Database Migration
**File:** `supabase/migrations/20251017000001_add_filtered_asins_table.sql`

## Filtering Rules

### Name-Based Exclusions
```python
EXCLUSION_PATTERNS = [
    r'\btester\b',           # Solar panel tester
    r'\bmeter\b',            # Multimeter
    r'\bmultimeter\b',       # Multimeter
    r'\bcharge controller\b', # Charge controller (standalone)
    r'\bmount\b',            # Mounting hardware
    r'\bbracket\b',          # Mounting hardware
    r'\bstand\b',            # Mounting hardware
    r'\bsecurity\b',         # Security cameras
    r'\bcamera\b',           # Security cameras
    r'\bwire\b',             # Wiring/connectors
    r'\bconnector\b',        # Wiring/connectors
    r'\bclamp\b',            # Mounting hardware
    r'\bbolt\b',             # Mounting hardware
    r'\bscrew\b',            # Mounting hardware
]
```

### Wattage-Based Exclusions
```python
def extract_wattage_from_name(name: str) -> Optional[int]:
    """Extract wattage from product name"""
    # Patterns: "100W", "100 Watt", "100 Watts"
    patterns = [
        r'(\d+)\s*W\b',           # "100W"
        r'(\d+)\s*Watt\b',        # "100 Watt"
        r'(\d+)\s*Watts\b',       # "100 Watts"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, name, re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None
```

### Allowlist for Kits
```python
KIT_ALLOWLIST = [
    r'solar panel.*kit',
    r'kit.*solar panel',
    r'solar.*starter.*kit',
    r'off.*grid.*kit',
]
```

## Reporting

### Filtered ASINs Report
```bash
# Show filtering statistics
python scripts/report_filtered_asins.py --summary

# Show specific rejections
python scripts/report_filtered_asins.py --reason "non_solar_panel"
```

### Database Queries
```sql
-- Filtering statistics
SELECT 
    filter_stage,
    filter_reason,
    COUNT(*) as count
FROM filtered_asins 
GROUP BY filter_stage, filter_reason;

-- Recent rejections
SELECT asin, filter_reason, product_name, created_at
FROM filtered_asins 
ORDER BY created_at DESC 
LIMIT 20;
```

## Testing Strategy

### 1. Test with Known Products
```python
test_products = [
    ("ECO-WORTHY 400W Solar Panels", True),      # Should pass
    ("Solar Panel Tester", False),               # Should reject
    ("Charge Controller", False),                 # Should reject
    ("Solar Panel Mount", False),               # Should reject
    ("10W Solar Panel", False),                  # Should reject (low wattage)
    ("100W Solar Panel Kit", True),              # Should pass
]
```

### 2. Test with Real Search Results
```bash
# Run search with filtering enabled
python scripts/search_solar_panels.py "solar panel" --pages 1 --verbose

# Check what was filtered
python scripts/report_filtered_asins.py --summary
```

## Benefits

1. **Clean Database:** Only actual solar panels stored
2. **Accurate Analysis:** Wattage distributions reflect real panels
3. **Audit Trail:** Track what was filtered and why
4. **Performance:** Avoid processing irrelevant products
5. **Quality:** Ensure data quality for analysis

## Implementation Order

1. Create `product_filter.py` with filtering logic
2. Add `filtered_asins` table migration
3. Update search script to filter before staging
4. Update ingest script to filter before database insertion
5. Add reporting script for filtered ASINs
6. Test with real search results
7. Monitor filtering effectiveness

## Success Metrics

- **Filtering Rate:** % of search results filtered out
- **False Positives:** Legitimate panels incorrectly filtered
- **False Negatives:** Non-panels that passed through
- **Data Quality:** Average wattage of stored panels
- **Coverage:** % of search results that are actual panels
