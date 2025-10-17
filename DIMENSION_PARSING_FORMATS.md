# Supported Dimension Formats

The dimension parser in `scripts/scraper.py` supports multiple Amazon product dimension formats with automatic unit detection and conversion.

## ✅ Supported Formats

All formats are parsed and converted to **centimeters**, with **length always >= width**.

### Format 1: Labeled with L/W (with quotes - inches)
```
"45.67\"L x 17.71\"W x 1.18\"H"  → Length: 116.00 cm, Width: 44.98 cm
"45.67"L x 17.71"W x 1.18"H"     → Length: 116.00 cm, Width: 44.98 cm
```
- ✅ Detects inches from quote marks
- ✅ Respects L/W labels (doesn't swap)
- ✅ Converts to cm

### Format 2: Labeled with L/W (no quotes - cm)
```
"115L x 66W x 3H"                → Length: 115.00 cm, Width: 66.00 cm
"115 L x 66 W x 3 H"             → Length: 115.00 cm, Width: 66.00 cm
```
- ✅ No quotes = assumes cm
- ✅ Respects L/W labels
- ✅ Already in cm

### Format 3: Simple with unit specified
```
"43 x 33.9 x 0.1 inches"         → Length: 109.22 cm, Width: 86.11 cm
"115 x 66 x 3 cm"                → Length: 115.00 cm, Width: 66.00 cm
"100 x 50 x 2 centimeters"       → Length: 100.00 cm, Width: 50.00 cm
```
- ✅ Detects unit from text (inches/cm)
- ✅ Auto-swaps to ensure length >= width
- ✅ Converts to cm if needed

### Format 4: Simple reversed (auto-corrects)
```
"33.9 x 43 x 0.1 inches"         → Length: 109.22 cm, Width: 86.11 cm
"66 x 115 x 3 cm"                → Length: 115.00 cm, Width: 66.00 cm
```
- ✅ Auto-swaps dimensions to ensure length > width
- ✅ Detects unit from text
- ✅ Converts to cm if needed

### Format 5: Numbers only (smart detection)
```
"100 x 50 x 2"                   → Length: 100.00 cm, Width: 50.00 cm
"43 x 33.9 x 0.1"                → Length: 109.22 cm, Width: 86.11 cm
```
- ✅ If values > 20: assumes cm
- ✅ If values <= 20: assumes inches (converts to cm)
- ✅ Auto-swaps to ensure length >= width

## Parsing Logic

### Step 1: Pattern Matching
1. Try to match L/W labeled format
2. Try to match three dimensions with unit
3. Try to match three numbers only

### Step 2: Unit Detection
- **Has quotes** (`"` or `'`) → inches
- **Has "inch" text** → inches  
- **Has "cm" text** → centimeters
- **No unit, values > 20** → assumes cm
- **No unit, values <= 20** → assumes inches

### Step 3: Conversion
- If inches: multiply by 2.54 to get cm
- If cm: use as-is
- Round to 2 decimal places

### Step 4: Length/Width Assignment
- **If L/W labeled**: Use as labeled (trust the source)
- **If not labeled**: Put larger value as length, smaller as width

## Examples from Real Products

### Example 1: FivstaSola Bifacial 100W
```
Input:  "45.67\"L x 17.71\"W x 1.18\"H"
Output: Length: 116.00 cm, Width: 44.98 cm
Logic:  Has quotes + L/W labels → inches, convert to cm, respect labels
```

### Example 2: Renogy Flexible (from error log)
```
Input:  "43 x 33.9 x 0.1 inches"
Output: Length: 109.22 cm, Width: 86.11 cm
Logic:  Has "inches" → convert to cm, larger value becomes length
```

### Example 3: Large Panel
```
Input:  "115 x 66 x 3 cm"
Output: Length: 115.00 cm, Width: 66.00 cm
Logic:  Has "cm" → use as-is, larger value becomes length
```

### Example 4: Compact Panel (ambiguous)
```
Input:  "17.71 x 45.67 x 1.18 inches"
Output: Length: 116.00 cm, Width: 44.98 cm
Logic:  Has "inches" → convert to cm, auto-swap so 45.67 becomes length
```

## Error Handling

If parsing fails:
- Returns `None`
- Logs warning with the problematic string
- Allows script to flag panel for manual review
- Doesn't crash the ingestion process

## Testing

Run comprehensive tests:
```bash
python scripts/test_scraper_parsing.py
```

Test specific format:
```python
from scripts.scraper import UnitConverter

result = UnitConverter.parse_dimension_string("43 x 33.9 x 0.1 inches")
print(result)  # (109.22, 86.11)
```

## Database Storage

All dimensions are stored as:
```sql
length_cm DECIMAL(6,2) NOT NULL  -- Always the longer dimension
width_cm DECIMAL(6,2) NOT NULL   -- Always the shorter dimension
```

Range: 0.00 to 9999.99 cm (up to ~100 meters)

## Future Enhancements

Potential additions if needed:
- Support for mm (millimeters)
- Support for meters
- Support for Height extraction (currently ignored)
- Validation ranges (flag suspiciously large/small values)

