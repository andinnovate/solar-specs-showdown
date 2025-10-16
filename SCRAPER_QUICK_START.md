# ScraperAPI Quick Start Guide

## 🚀 Quick Commands

```bash
# Test parsing (no API calls)
python scripts/test_scraper_parsing.py

# Test live API (uses 1 credit)
python scripts/test_live_scraper.py

# Fetch single product
python scripts/fetch_solar_panels.py B0C99GS958

# Fetch multiple products
python scripts/fetch_solar_panels.py B0C99GS958 B0CB9X9XX1 --delay 2
```

## 📦 Python Usage

```python
from scripts.scraper import ScraperAPIClient

# Initialize
client = ScraperAPIClient()

# Fetch product
data = client.fetch_product("B0C99GS958")

# Result is database-ready:
# {
#   'name': str,
#   'manufacturer': str,
#   'length_cm': 116.00,      # ✓ converted from inches
#   'width_cm': 44.98,        # ✓ converted from inches
#   'weight_kg': 7.20,        # ✓ converted from pounds
#   'wattage': 100,           # ✓ parsed from "100 Watts"
#   'voltage': 12.0,          # ✓ parsed from "12 Volts"
#   'price_usd': 69.99,       # ✓ parsed from "$69.99"
#   'description': str,
#   'image_url': str,
#   'web_url': str
# }
```

## 🔄 Unit Conversions

| Input | Output |
|-------|--------|
| `"45.67\"L x 17.71\"W x 1.18\"H"` | `116.00 cm × 44.98 cm` |
| `"15.87 pounds"` | `7.20 kg` |
| `"100 Watts"` | `100` (integer) |
| `"12 Volts"` | `12.0` (decimal) |
| `"$69.99"` | `69.99` (decimal) |

## 📚 Documentation

- **Full Guide**: `scripts/SCRAPER_README.md`
- **Implementation Details**: `SCRAPER_IMPLEMENTATION_SUMMARY.md`
- **Sample Data**: Run `python scraperapi_sample.py` to see raw API response

## ✅ What's Working

- ✅ Unit conversions (inches→cm, pounds→kg)
- ✅ Data parsing from ScraperAPI JSON
- ✅ Database integration
- ✅ Error handling & retry logic
- ✅ Usage tracking
- ✅ Comprehensive logging
- ✅ All tests passing

