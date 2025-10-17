# Manual Override System

This document explains how the manual override system protects admin edits from being overwritten by automatic scraper updates.

## Overview

When an admin manually edits a solar panel field in the Admin panel, that field is marked as "manually overridden" and protected from future automatic updates by the ScraperAPI scraper. This ensures that careful manual corrections and improvements are not lost during automated data refreshes.

## How It Works

### 1. Database Schema

A new column `manual_overrides` has been added to the `solar_panels` table:

```sql
ALTER TABLE solar_panels 
ADD COLUMN manual_overrides jsonb DEFAULT '[]'::jsonb;
```

This column stores an array of field names that have been manually edited, for example:
```json
["price_usd", "name", "wattage"]
```

### 2. Admin Panel (Frontend)

**Location:** `src/components/DatabaseManager.tsx`

**Features:**
- Admin can edit **ALL** fields (no hard locks)
- Fields with manual overrides show a lock icon (🔒) in amber color
- When saving edits, the system automatically detects which fields were changed
- Changed field names are added to the `manual_overrides` array
- A summary shows how many fields are protected (e.g., "🔒 3 field(s) protected from auto-updates")

**UI Elements:**
- 🔒 Lock icon appears next to field labels that have been manually edited
- Tooltip on hover: "Manually edited - protected from scraper updates"
- Success message on save: "Panel updated. X field(s) marked as manually edited."

### 3. Scraper (Backend)

**Location:** `scripts/database.py`

**New Method:** `update_panel_from_scraper()`

```python
async def update_panel_from_scraper(
    self, 
    panel_id: str, 
    panel_data: Dict, 
    respect_manual_overrides: bool = True
) -> Tuple[bool, List[str]]:
    """
    Update panel from scraper data, respecting manual overrides.
    Returns: (success, list_of_skipped_fields)
    """
```

**How It Works:**
1. Fetches the panel's `manual_overrides` array
2. Filters out any fields in `panel_data` that match the override list
3. Updates only the non-overridden fields
4. Logs which fields were skipped
5. Returns success status and list of skipped fields

**Example:**
```python
# Panel has manual_overrides = ["price_usd", "name"]
# Scraper tries to update: {"name": "New Name", "price_usd": 99.99, "wattage": 200}
# Result: Only wattage gets updated, name and price_usd are skipped
```

## Usage Examples

### Admin Workflow

1. **Find a panel with incorrect data** (e.g., wrong wattage from scraper)
2. **Click "Edit"** on the panel
3. **Correct the wattage** from 100W to 150W
4. **Click "Save Changes"**
5. System marks `wattage` as manually overridden
6. 🔒 icon appears next to "Wattage" field
7. Future scraper runs will not overwrite this value

### Scraper Workflow

```python
from scripts.database import SolarPanelDB

db = SolarPanelDB()

# Fetch new data from ScraperAPI
new_data = {
    'name': 'Updated Panel Name',
    'price_usd': 79.99,
    'wattage': 100  # Incorrect value from Amazon
}

# Update panel, respecting manual overrides
success, skipped = await db.update_panel_from_scraper(
    panel_id='abc-123',
    panel_data=new_data,
    respect_manual_overrides=True  # Default
)

if skipped:
    print(f"Skipped manually edited fields: {', '.join(skipped)}")
    # Example output: "Skipped manually edited fields: wattage"
```

## Field Coverage

All editable fields can be manually overridden:

**Product Info:**
- `name`
- `manufacturer`
- `description`

**Specifications:**
- `wattage`
- `voltage`
- `length_cm`
- `width_cm`
- `weight_kg`

**Pricing & Links:**
- `price_usd`
- `web_url`
- `image_url`

**System Fields (Not Editable):**
- `id`
- `created_at`
- `updated_at`
- `manual_overrides` (managed automatically)

## Use Cases

### 1. Correcting Physical Specifications

**Scenario:** ScraperAPI incorrectly parses "1000V" (system voltage) as the panel voltage instead of "12V" (actual panel voltage).

**Action:** Admin manually corrects voltage to 12.0V

**Result:** `voltage` is added to `manual_overrides`, preventing future scraper runs from reverting to 1000V

### 2. Improving Product Names

**Scenario:** Amazon listing has unclear name: "100W Solar Panel Black"

**Action:** Admin changes to: "Renogy 100W Monocrystalline Solar Panel"

**Result:** `name` is protected from being overwritten by scraper updates

### 3. Fixing Dimension Parsing Errors

**Scenario:** Scraper incorrectly converts dimensions

**Action:** Admin verifies on product page and manually enters correct dimensions

**Result:** `length_cm`, `width_cm`, `weight_kg` are protected

### 4. Price Updates (Not Overridden by Default)

**Scenario:** Prices change frequently and should be auto-updated

**Action:** Admin does NOT manually edit price unless it's clearly wrong

**Result:** Price continues to be updated by scraper on each run

## Clearing Manual Overrides

To allow the scraper to update a field again:

**Option 1: Via SQL**
```sql
UPDATE solar_panels 
SET manual_overrides = manual_overrides - 'wattage'
WHERE id = 'abc-123';
```

**Option 2: Via Admin Panel**
Future enhancement: Add a "Reset Protection" button to clear specific field overrides

**Option 3: Complete Reset**
```sql
UPDATE solar_panels 
SET manual_overrides = '[]'::jsonb
WHERE id = 'abc-123';
```

## Migration

To add the manual override column to existing databases:

```bash
# Apply migration
psql -h [your-host] -d [your-db] -f supabase/migrations/20251017000001_add_manual_overrides.sql
```

Or via Supabase CLI:
```bash
supabase db push
```

## Best Practices

### For Admins

1. **Only manually edit when necessary** - Let scrapers handle routine updates
2. **Document why you're overriding** - Use notes or comments if available
3. **Verify before editing specs** - Check manufacturer's actual product page
4. **Don't override prices unnecessarily** - Prices change frequently

### For Developers

1. **Always use `update_panel_from_scraper()`** for automated updates
2. **Check returned `skipped_fields`** to monitor what's being protected
3. **Log skipped updates** for audit trail
4. **Provide admin tools** to manage overrides if needed

### For Scraper Scripts

```python
# ✅ GOOD: Respects manual overrides
success, skipped = await db.update_panel_from_scraper(panel_id, data)

# ❌ BAD: Overwrites everything (use only for initial import)
await db.client.table('solar_panels').update(data).eq('id', panel_id).execute()
```

## Monitoring

### Check Protected Fields

```sql
SELECT 
    id,
    name,
    manufacturer,
    manual_overrides,
    jsonb_array_length(COALESCE(manual_overrides, '[]'::jsonb)) as num_protected
FROM solar_panels
WHERE jsonb_array_length(COALESCE(manual_overrides, '[]'::jsonb)) > 0
ORDER BY num_protected DESC;
```

### Find Panels with Specific Overrides

```sql
SELECT id, name, manufacturer, manual_overrides
FROM solar_panels
WHERE manual_overrides ? 'wattage';
```

## Future Enhancements

1. **Admin UI Improvements:**
   - Button to clear individual field protections
   - Visual diff showing what scraper wanted to change
   - History of manual edits

2. **Scraper Improvements:**
   - Email notifications when many fields are skipped
   - Dashboard showing override statistics
   - "Force update" option with confirmation

3. **Audit Trail:**
   - Track who made manual edits
   - Track when fields were protected
   - Track when scraper attempts were blocked

## Summary

The manual override system creates a balance between:
- **Automation:** Scrapers keep data fresh
- **Quality:** Admins can fix errors and improve data
- **Safety:** Manual corrections are never lost

This ensures the database maintains high quality while benefiting from automated updates.

