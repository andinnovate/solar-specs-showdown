"""
Pytest tests for ScraperAPI data parsing.
Tests unit conversions, dimension parsing, and full product data transformation.

Run with: pytest scripts/tests/test_scraper_parsing.py -v
"""

import pytest
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scripts.scraper import UnitConverter, ScraperAPIParser


class TestUnitConversions:
    """Test basic unit conversion functions"""
    
    def test_inches_to_cm(self):
        """Test inches to centimeters conversion"""
        assert UnitConverter.inches_to_cm(45.67) == 116.00
        assert UnitConverter.inches_to_cm(17.71) == 44.98
        assert UnitConverter.inches_to_cm(1.0) == 2.54
        assert UnitConverter.inches_to_cm(0) == 0.0
    
    def test_pounds_to_kg(self):
        """Test pounds to kilograms conversion"""
        assert UnitConverter.pounds_to_kg(15.87) == 7.20
        assert UnitConverter.pounds_to_kg(10.0) == 4.54
        assert UnitConverter.pounds_to_kg(0) == 0.0
    
    def test_parse_power_string(self):
        """Test power/wattage string parsing"""
        assert UnitConverter.parse_power_string("100 Watts") == 100
        assert UnitConverter.parse_power_string("100W") == 100
        assert UnitConverter.parse_power_string("100") == 100
        assert UnitConverter.parse_power_string("200.5 Watts") == 201  # Rounds to integer
    
    def test_parse_voltage_string(self):
        """Test voltage string parsing"""
        assert UnitConverter.parse_voltage_string("12 Volts") == 12.0
        assert UnitConverter.parse_voltage_string("12V") == 12.0
        assert UnitConverter.parse_voltage_string("24.5 Volts") == 24.5
        assert UnitConverter.parse_voltage_string("12") == 12.0
    
    def test_parse_price_string(self):
        """Test price string parsing"""
        assert UnitConverter.parse_price_string("$69.99") == 69.99
        assert UnitConverter.parse_price_string("69.99") == 69.99
        assert UnitConverter.parse_price_string("$1,299.99") == 1299.99
        assert UnitConverter.parse_price_string("$1,000") == 1000.0
    
    def test_parse_weight_string(self):
        """Test weight string parsing"""
        assert UnitConverter.parse_weight_string("15.87 pounds") == 7.20
        assert UnitConverter.parse_weight_string("7.2 kg") == 7.2
        assert UnitConverter.parse_weight_string("15.87 lbs") == 7.20


class TestDimensionParsing:
    """Test dimension string parsing with various formats"""
    
    def test_labeled_dimensions_with_quotes_inches(self):
        """Test format: '45.67"L x 17.71"W x 1.18"H' (labeled, inches)"""
        result = UnitConverter.parse_dimension_string('45.67"L x 17.71"W x 1.18"H')
        assert result is not None
        length, width = result
        assert length == 116.00
        assert width == 44.98
        assert length > width  # Length should be larger
    
    def test_labeled_dimensions_without_quotes_cm(self):
        """Test format: '115L x 66W x 3H' (labeled, cm)"""
        result = UnitConverter.parse_dimension_string("115L x 66W x 3H")
        assert result is not None
        length, width = result
        assert length == 115.0
        assert width == 66.0
    
    def test_simple_dimensions_with_inches(self):
        """Test format: '43 x 33.9 x 0.1 inches' (simple, inches)"""
        result = UnitConverter.parse_dimension_string("43 x 33.9 x 0.1 inches")
        assert result is not None
        length, width = result
        assert length == 109.22
        assert width == 86.11
        assert length > width  # Length should be larger
    
    def test_simple_dimensions_with_cm(self):
        """Test format: '115 x 66 x 3 cm' (simple, cm)"""
        result = UnitConverter.parse_dimension_string("115 x 66 x 3 cm")
        assert result is not None
        length, width = result
        assert length == 115.0
        assert width == 66.0
    
    def test_dimensions_reversed_auto_swap(self):
        """Test that dimensions auto-swap to ensure length > width"""
        # Smaller dimension first
        result = UnitConverter.parse_dimension_string("33.9 x 43 x 0.1 inches")
        assert result is not None
        length, width = result
        assert length == 109.22  # Should be the larger value
        assert width == 86.11   # Should be the smaller value
        assert length > width
    
    def test_dimensions_without_unit(self):
        """Test format: '100 x 50 x 2' (no unit, smart detection)"""
        result = UnitConverter.parse_dimension_string("100 x 50 x 2")
        assert result is not None
        length, width = result
        assert length == 100.0  # Large values assumed to be cm
        assert width == 50.0
    
    def test_dimensions_small_values_without_unit(self):
        """Test that small values without unit are treated as inches"""
        result = UnitConverter.parse_dimension_string("18 x 12 x 1")
        assert result is not None
        length, width = result
        # 18 inches = 45.72 cm, 12 inches = 30.48 cm
        assert length == 45.72
        assert width == 30.48


class TestProductParsing:
    """Test full product data parsing from ScraperAPI response"""
    
    @pytest.fixture
    def sample_product_data(self):
        """Sample ScraperAPI response data"""
        return {
            "name": "Bifacial 100 Watt Solar Panel, 12V 100W Monocrystalline Solar Panel Panel High Efficiency Module Monocrystalline Technology Work with Charger for RV Camping Home Boat Marine Off-Grid",
            "product_information": {
                "Brand": "FivstaSola",
                "Material": "Monocrystalline Silicon",
                "Product Dimensions": "45.67\"L x 17.71\"W x 1.18\"H",
                "Efficiency": "High Efficiency",
                "Included Components": "solar panel",
                "Maximum Voltage": "12 Volts",
                "Maximum Power": "100 Watts",
                "Special Feature": "Bifacial technology, 10BB Upgraded Design",
                "Manufacturer": "FivstaSola",
                "Item Weight": "15.87 pounds",
                "Item model number": "FS-100-36M-D",
                "Size": "Bifacial 100W",
                "ASIN": "B0C99GS958",
                "Customer Reviews": {
                    "ratings_count": 99,
                    "stars": 3.8
                }
            },
            "brand": "Visit the FivstaSola Store",
            "pricing": "$69.99",
            "images": [
                "https://m.media-amazon.com/images/I/41TBLsm6sHL.jpg"
            ],
            "full_description": "Product description FivstaSola...",
            "asin": "B0C99GS958"
        }
    
    def test_parse_product_data_success(self, sample_product_data):
        """Test successful parsing of complete product data"""
        parsed = ScraperAPIParser.parse_product_data(sample_product_data)
        
        assert parsed is not None
        assert 'name' in parsed
        assert 'manufacturer' in parsed
        assert 'length_cm' in parsed
        assert 'width_cm' in parsed
        assert 'weight_kg' in parsed
        assert 'wattage' in parsed
        assert 'voltage' in parsed
        assert 'price_usd' in parsed
    
    def test_parsed_values_match_expected(self, sample_product_data):
        """Test that parsed values match expected conversions"""
        parsed = ScraperAPIParser.parse_product_data(sample_product_data)
        
        assert parsed['manufacturer'] == "FivstaSola"
        assert parsed['length_cm'] == 116.00
        assert parsed['width_cm'] == 44.98
        assert parsed['weight_kg'] == 7.20
        assert parsed['wattage'] == 100
        assert parsed['voltage'] == 12.0
        assert parsed['price_usd'] == 69.99
        assert parsed['web_url'] == "https://www.amazon.com/dp/B0C99GS958"
        assert parsed['image_url'] == "https://m.media-amazon.com/images/I/41TBLsm6sHL.jpg"
    
    def test_parse_product_data_missing_name(self, sample_product_data):
        """Test that parsing fails gracefully when name is missing"""
        sample_product_data['name'] = None
        parsed = ScraperAPIParser.parse_product_data(sample_product_data)
        assert parsed is None
    
    def test_parse_product_data_missing_dimensions(self, sample_product_data):
        """Test that parsing fails when dimensions are missing"""
        sample_product_data['product_information']['Product Dimensions'] = ''
        parsed = ScraperAPIParser.parse_product_data(sample_product_data)
        assert parsed is None


@pytest.mark.parametrize("input_str,expected", [
    # Dimension formats
    ("115L x 66W x 3H", (115.0, 66.0)),
    ("115 x 66 x 3 cm", (115.0, 66.0)),
    ("43 x 33.9 x 0.1 inches", (109.22, 86.11)),
    ("33.9 x 43 x 0.1 inches", (109.22, 86.11)),  # Auto-swap
    ("100 x 50 x 2", (100.0, 50.0)),
    ('45.67"L x 17.71"W x 1.18"H', (116.00, 44.98)),
])
def test_dimension_parsing_parametrized(input_str, expected):
    """Parametrized test for various dimension formats"""
    result = UnitConverter.parse_dimension_string(input_str)
    assert result is not None, f"Failed to parse: {input_str}"
    assert result == expected, f"Expected {expected}, got {result}"


@pytest.mark.parametrize("input_str,expected", [
    ("15.87 pounds", 7.20),
    ("7.2 kg", 7.2),
    ("15.87 lbs", 7.20),
    ("10 kilograms", 10.0),
])
def test_weight_parsing_parametrized(input_str, expected):
    """Parametrized test for various weight formats"""
    result = UnitConverter.parse_weight_string(input_str)
    assert result == expected, f"Expected {expected}, got {result}"


@pytest.mark.parametrize("input_str,expected", [
    ("$69.99", 69.99),
    ("69.99", 69.99),
    ("$1,299.99", 1299.99),
    ("$1,000", 1000.0),
])
def test_price_parsing_parametrized(input_str, expected):
    """Parametrized test for various price formats"""
    result = UnitConverter.parse_price_string(input_str)
    assert result == expected, f"Expected {expected}, got {result}"


@pytest.mark.parametrize("input_str,expected", [
    ("12 Volts", 12.0),
    ("12V", 12.0),
    ("24.5 Volts", 24.5),
    ("12", 12.0),
])
def test_voltage_parsing_parametrized(input_str, expected):
    """Parametrized test for various voltage formats"""
    result = UnitConverter.parse_voltage_string(input_str)
    assert result == expected, f"Expected {expected}, got {result}"


@pytest.mark.parametrize("input_str,expected", [
    ("100 Watts", 100),
    ("100W", 100),
    ("100", 100),
    ("200.4 Watts", 200),  # Rounds to integer (standard rounding)
    ("200.5 Watts", 201),  # Rounds to integer (standard rounding)
    ("200.6 Watts", 201),  # Rounds up
])
def test_power_parsing_parametrized(input_str, expected):
    """Parametrized test for various power formats"""
    result = UnitConverter.parse_power_string(input_str)
    assert result == expected, f"Expected {expected}, got {result}"


class TestLengthWidthOrdering:
    """Test that length is always the longer dimension"""
    
    def test_length_greater_than_width_labeled(self):
        """Test L/W labels are respected"""
        result = UnitConverter.parse_dimension_string('45.67"L x 17.71"W')
        length, width = result
        assert length == 116.00
        assert width == 44.98
    
    def test_length_greater_than_width_unlabeled(self):
        """Test unlabeled dimensions auto-swap"""
        # Larger first
        result1 = UnitConverter.parse_dimension_string("43 x 33.9 x 0.1 inches")
        length1, width1 = result1
        assert length1 >= width1
        
        # Smaller first (should auto-swap)
        result2 = UnitConverter.parse_dimension_string("33.9 x 43 x 0.1 inches")
        length2, width2 = result2
        assert length2 >= width2
        
        # Should produce same result regardless of input order
        assert length1 == length2
        assert width1 == width2
    
    def test_all_formats_ensure_length_greater(self):
        """Test that all formats result in length >= width"""
        test_strings = [
            '45.67"L x 17.71"W x 1.18"H',
            "115L x 66W x 3H",
            "43 x 33.9 x 0.1 inches",
            "115 x 66 x 3 cm",
            "100 x 50 x 2",
            "17.71 x 45.67 x 1 inches",  # Reversed
        ]
        
        for dim_string in test_strings:
            result = UnitConverter.parse_dimension_string(dim_string)
            assert result is not None, f"Failed to parse: {dim_string}"
            length, width = result
            assert length >= width, f"Length ({length}) should be >= width ({width}) for: {dim_string}"


class TestEdgeCases:
    """Test edge cases and error conditions"""
    
    def test_invalid_dimension_string(self):
        """Test that invalid strings return None"""
        assert UnitConverter.parse_dimension_string("invalid") is None
        assert UnitConverter.parse_dimension_string("") is None
        assert UnitConverter.parse_dimension_string("x x x") is None
    
    def test_invalid_weight_string(self):
        """Test that invalid weight strings return None"""
        assert UnitConverter.parse_weight_string("invalid") is None
        assert UnitConverter.parse_weight_string("") is None
    
    def test_invalid_price_string(self):
        """Test that invalid price strings return None"""
        assert UnitConverter.parse_price_string("invalid") is None
        assert UnitConverter.parse_price_string("") is None
    
    def test_invalid_power_string(self):
        """Test that invalid power strings return None"""
        assert UnitConverter.parse_power_string("invalid") is None
        assert UnitConverter.parse_power_string("") is None
    
    def test_invalid_voltage_string(self):
        """Test that invalid voltage strings return None"""
        assert UnitConverter.parse_voltage_string("invalid") is None
        assert UnitConverter.parse_voltage_string("") is None


class TestRealWorldFormats:
    """Test with actual Amazon product dimension formats"""
    
    def test_format_from_error_log(self):
        """Test the exact format that failed in production (from error log)"""
        # This was failing: "43 x 33.9 x 0.1 inches"
        result = UnitConverter.parse_dimension_string("43 x 33.9 x 0.1 inches")
        assert result is not None
        length, width = result
        assert length == 109.22
        assert width == 86.11
        assert length > width
    
    @pytest.mark.parametrize("dim_string,expected_length,expected_width", [
        ('45.67"L x 17.71"W x 1.18"H', 116.00, 44.98),  # FivstaSola format
        ("43 x 33.9 x 0.1 inches", 109.22, 86.11),      # Renogy Flexible format
        ("115 x 66 x 3 cm", 115.0, 66.0),                # Metric format
        ("100L x 50W x 2H", 100.0, 50.0),                # Labeled without quotes
    ])
    def test_various_real_formats(self, dim_string, expected_length, expected_width):
        """Test various real-world Amazon dimension formats"""
        result = UnitConverter.parse_dimension_string(dim_string)
        assert result is not None
        length, width = result
        assert length == expected_length
        assert width == expected_width
        assert length >= width


if __name__ == "__main__":
    # Allow running with pytest or directly
    pytest.main([__file__, "-v"])

