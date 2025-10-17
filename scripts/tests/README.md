# ScraperAPI Parser Tests

Pytest test suite for ScraperAPI parsing and unit conversion functionality.

## Running Tests

### Run All Tests (Default - No External Calls)
```bash
# From project root - uses mocked/fixture data, NO API or DB calls
pytest

# Or explicitly from tests directory
pytest scripts/tests/

# With coverage
pytest --cov=scripts --cov-report=term-missing
```

**Default Behavior:** 
- Live API tests are **skipped** (no API credits)
- Integration tests are **skipped** (no database calls)
- Only unit tests with mocks/fixtures run

### Run Integration Tests (Real Test Database)
```bash
# Run integration tests against test Supabase instance
pytest --use-test-db

# Only integration tests
pytest -m integration --use-test-db

# Specific integration test file
pytest scripts/tests/test_asin_manager.py --use-test-db -v
```

⚠️ **Note:** Requires connection to test Supabase at `https://plsboshlmokjtwxpmrit.supabase.co`

### Run Tests Including Live API Calls
```bash
# Use --live-api flag to run tests that make real API calls
pytest --live-api

# Run everything (unit + integration + live API)
pytest --use-test-db --live-api
```

⚠️ **Warning:** Tests with `--live-api` flag will consume ScraperAPI credits!

### Common Test Patterns
```bash
# Just unit tests (default - fast, no external deps)
pytest                                  # 110 passed, 35 skipped

# Unit + integration tests (test database)
pytest --use-test-db                    # 144 passed, 1 skipped

# Everything including live API
pytest --use-test-db --live-api         # 145 passed
```

### Run Specific Test File
```bash
pytest scripts/tests/test_scraper_parsing.py -v
```

### Run Specific Test Class or Function
```bash
# Run all dimension parsing tests
pytest scripts/tests/test_scraper_parsing.py::TestDimensionParsing -v

# Run a specific test
pytest scripts/tests/test_scraper_parsing.py::TestUnitConversions::test_inches_to_cm -v
```

### Run Tests Matching Pattern
```bash
# Run all tests with "dimension" in the name
pytest scripts/tests/ -k dimension -v

# Run all parametrized tests
pytest scripts/tests/ -k parametrized -v
```

## Test Summary

**Total Tests:** 67
- **Mocked Tests:** 66 (run by default, no API credits used)
- **Live API Tests:** 1 (skipped by default, requires `--live-api` flag)

**Default Run:**
```bash
pytest
# Output: 66 passed, 1 skipped
```

**With Live API:**
```bash
pytest --live-api
# Output: 67 passed (uses 1+ API credits!)
```

## Test Coverage

### TestUnitConversions
Tests basic unit conversion functions:
- `test_inches_to_cm` - Inches to centimeters conversion
- `test_pounds_to_kg` - Pounds to kilograms conversion
- `test_parse_power_string` - Parse wattage from various formats
- `test_parse_voltage_string` - Parse voltage from various formats
- `test_parse_price_string` - Parse USD prices
- `test_parse_weight_string` - Parse weight with units

### TestDimensionParsing
Tests dimension string parsing with multiple formats:
- Labeled with L/W (inches and cm)
- Simple format with unit ("43 x 33.9 x 0.1 inches")
- Reversed dimension auto-swap
- Numbers only with smart unit detection

### TestProductParsing
Tests full ScraperAPI product data transformation:
- Complete product parsing
- Field validation
- Error handling (missing fields)

### Parametrized Tests
Efficient testing of multiple input formats:
- `test_dimension_parsing_parametrized` - 6 dimension formats
- `test_weight_parsing_parametrized` - 4 weight formats
- `test_price_parsing_parametrized` - 4 price formats
- `test_voltage_parsing_parametrized` - 4 voltage formats
- `test_power_parsing_parametrized` - 5 power formats

### TestLengthWidthOrdering
Tests that length is always >= width:
- Respects L/W labels when present
- Auto-swaps for unlabeled dimensions
- Verifies all formats maintain length > width

### TestEdgeCases
Tests error conditions:
- Invalid input strings
- Empty strings
- Missing data

### TestRealWorldFormats
Tests with actual Amazon product formats:
- Format from production error log
- Various real product dimension strings

## Test Files

### test_scraper_parsing.py
Unit tests for parsing functions (no API calls):
- Unit conversions (inches, pounds, etc.)
- Dimension parsing with multiple formats
- Full product data transformation
- Edge cases and error handling

**53 tests** - All use fixtures/sample data, no API calls

### test_live_scraper.py
Integration tests with mocked and real API calls:
- Mocked product fetching (13 tests, no API calls)
- Mocked search functionality (3 tests, no API calls)
- Error handling (5 tests, no API calls)
- Optional real API test (1 test, requires `--live-api` flag)

**13 mocked tests + 1 live test** = 14 tests total

### fixtures.py
Sample data from real ScraperAPI responses:
- `SAMPLE_PRODUCT_DETAIL_RESPONSE` - FivstaSola 100W panel
- `SAMPLE_RENOGY_PRODUCT_RESPONSE` - Renogy flexible panel
- `SAMPLE_SEARCH_RESPONSE` - Amazon search results
- `SAMPLE_ERROR_RESPONSE` - Error response

## Test Statistics

**Total Tests:** 67
- **Mocked Tests:** 66 (run by default, no API credits)
- **Live API Tests:** 1 (skipped by default)

**Breakdown:**
- Unit Conversion Tests: 6
- Dimension Parsing Tests: 7
- Product Parsing Tests: 4
- Parametrized Tests: 29 (across 5 categories)
- Length/Width Ordering Tests: 3
- Edge Cases: 5
- Real-World Format Tests: 4
- Integration Tests (Mocked): 8
- Error Handling Tests: 5

**Default run status:** ✅ 66 passed, 1 skipped (0 API credits used)

## Test Data

### Sample Product Data
Based on real ScraperAPI response for ASIN B0C99GS958 (FivstaSola Bifacial 100W)

### Supported Formats Tested

**Dimensions:**
- `"45.67\"L x 17.71\"W x 1.18\"H"` (labeled, inches with quotes)
- `"115L x 66W x 3H"` (labeled, cm without quotes)
- `"43 x 33.9 x 0.1 inches"` (simple format with unit)
- `"115 x 66 x 3 cm"` (simple format, metric)
- `"100 x 50 x 2"` (numbers only, smart detection)
- `"33.9 x 43 x 0.1 inches"` (reversed, auto-swaps)

**Weight:**
- `"15.87 pounds"`, `"7.2 kg"`, `"15.87 lbs"`, `"10 kilograms"`

**Price:**
- `"$69.99"`, `"69.99"`, `"$1,299.99"`, `"$1,000"`

**Power:**
- `"100 Watts"`, `"100W"`, `"100"`, `"200.5 Watts"`

**Voltage:**
- `"12 Volts"`, `"12V"`, `"24.5 Volts"`, `"12"`

## Adding New Tests

### Example: Add new dimension format test

```python
def test_new_dimension_format(self):
    """Test format: '50cm x 100cm x 5cm'"""
    result = UnitConverter.parse_dimension_string("50cm x 100cm x 5cm")
    assert result is not None
    length, width = result
    assert length == 100.0  # Should auto-swap
    assert width == 50.0
    assert length > width
```

### Example: Add parametrized test case

```python
@pytest.mark.parametrize("input_str,expected", [
    ("45 x 22 x 1 inches", (114.3, 55.88)),
    # Add more test cases...
])
def test_my_new_dimension_formats(input_str, expected):
    result = UnitConverter.parse_dimension_string(input_str)
    assert result == expected
```

## Continuous Integration

Add to CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Python tests
  run: |
    pip install pytest pytest-cov
    pytest scripts/tests/ -v --cov=scripts
```

## Requirements

Add to `requirements.txt` (for CI/CD):
```
pytest>=8.0.0
pytest-cov>=5.0.0  # Optional, for coverage reports
```

## See Also

- [scripts/scraper.py](../scraper.py) - Implementation being tested
- [DIMENSION_PARSING_FORMATS.md](../../DIMENSION_PARSING_FORMATS.md) - Format documentation
- [scripts/SCRAPER_README.md](../SCRAPER_README.md) - Usage guide

