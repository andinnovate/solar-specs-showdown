#!/usr/bin/env python3
"""
Test wattage parsing functionality.
Tests various wattage formats including scientific notation.
"""

import pytest
from scripts.scraper import UnitConverter
from scripts.product_filter import ProductFilter


class TestWattageParsing:
    """Test cases for wattage parsing functionality."""
    
    def test_unit_converter_basic_formats(self):
        """Test basic wattage formats."""
        test_cases = [
            ("100 Watts", 100),
            ("100W", 100),
            ("100", 100),
            ("1.5 Watts", 2),  # Rounded
            ("", None),
            ("No wattage here", None),
            ("Invalid format", None),
        ]
        
        for input_str, expected in test_cases:
            result = UnitConverter.parse_power_string(input_str)
            assert result == expected, f"Failed for '{input_str}': got {result}, expected {expected}"
    
    def test_unit_converter_scientific_notation(self):
        """Test scientific notation parsing."""
        test_cases = [
            ("8E+2 Watts", 800),
            ("8E+2W", 800),
            ("1.5E+3 Watts", 1500),
            ("2E+3W", 2000),
            ("1E+3 Watts", 1000),
            ("8e+2 Watts", 800),  # lowercase e
            ("1.5e+3W", 1500),
        ]
        
        for input_str, expected in test_cases:
            result = UnitConverter.parse_power_string(input_str)
            assert result == expected, f"Failed for '{input_str}': got {result}, expected {expected}"
    
    def test_unit_converter_kilowatt_formats(self):
        """Test kilowatt format parsing."""
        test_cases = [
            ("1.5kW", 1500),
            ("2 kilowatts", 2000),
            ("1 kilowatt", 1000),
            ("1.2kW", 1200),
            ("1.5 kilowatts", 1500),
        ]
        
        for input_str, expected in test_cases:
            result = UnitConverter.parse_power_string(input_str)
            assert result == expected, f"Failed for '{input_str}': got {result}, expected {expected}"
    
    def test_unit_converter_edge_cases(self):
        """Test edge cases and validation."""
        test_cases = [
            ("0 Watts", 0),
            ("2000 Watts", 2000),  # Maximum allowed
            ("2001 Watts", None),   # Too large (over 2kW)
            ("100 watts", 100),  # lowercase
            ("100WATT", 100),  # mixed case
            ("100 WATTS", 100),  # uppercase
            ("100w", 100),  # lowercase w
        ]
        
        for input_str, expected in test_cases:
            result = UnitConverter.parse_power_string(input_str)
            assert result == expected, f"Failed for '{input_str}': got {result}, expected {expected}"
    
    def test_product_filter_basic_formats(self):
        """Test ProductFilter with basic wattage formats."""
        product_filter = ProductFilter()
        
        test_cases = [
            ("Solar Panel 400W Monocrystalline", 400),
            ("100 Watt Solar Panel Kit", 100),
            ("Solar Panel 1000W High Efficiency", 1000),
            ("No wattage in this name", None),
        ]
        
        for name, expected in test_cases:
            result = product_filter.extract_wattage_from_name(name)
            assert result == expected, f"Failed for '{name}': got {result}, expected {expected}"
    
    def test_product_filter_scientific_notation(self):
        """Test ProductFilter with scientific notation."""
        product_filter = ProductFilter()
        
        test_cases = [
            ("8E+2 Watts Solar Panel", 800),
            ("2E+3W Premium Solar Panel", 2000),
            ("1.5E+3W Bifacial Solar Panel", 1500),
            ("Solar Panel 8E+2 Watts", 800),
        ]
        
        for name, expected in test_cases:
            result = product_filter.extract_wattage_from_name(name)
            assert result == expected, f"Failed for '{name}': got {result}, expected {expected}"
    
    def test_product_filter_kilowatt_formats(self):
        """Test ProductFilter with kilowatt formats."""
        product_filter = ProductFilter()
        
        test_cases = [
            ("1.5kW Bifacial Solar Panel", 1500),
            ("Solar Panel Kit 1 kilowatt", 1000),
            ("2kW Premium Solar Panel", 2000),
            ("1.2kW Solar Panel Kit", 1200),
        ]
        
        for name, expected in test_cases:
            result = product_filter.extract_wattage_from_name(name)
            assert result == expected, f"Failed for '{name}': got {result}, expected {expected}"
    
    def test_product_filter_mixed_cases(self):
        """Test ProductFilter with mixed case and spacing."""
        product_filter = ProductFilter()
        
        test_cases = [
            ("Solar Panel 100W", 100),
            ("Solar Panel 100w", 100),
            ("Solar Panel 100 W", 100),
            ("Solar Panel 100 watt", 100),
            ("Solar Panel 100 watts", 100),
        ]
        
        for name, expected in test_cases:
            result = product_filter.extract_wattage_from_name(name)
            assert result == expected, f"Failed for '{name}': got {result}, expected {expected}"
    
    def test_negative_values(self):
        """Test that negative values are handled appropriately."""
        # Negative values should be rejected
        result = UnitConverter.parse_power_string("-100 Watts")
        assert result is None, "Negative wattage should be rejected"
        
        result = UnitConverter.parse_power_string("-8E+2 Watts")
        assert result is None, "Negative scientific notation should be rejected"
    
    def test_very_large_values(self):
        """Test that very large values are rejected."""
        # Values over 2kW should be rejected for individual solar panels
        result = UnitConverter.parse_power_string("3000 Watts")  # 3kW
        assert result is None, "Values over 2kW should be rejected"
        
        result = UnitConverter.parse_power_string("2.5E+3 Watts")  # 2.5kW
        assert result is None, "Large scientific notation should be rejected"
    
    
    def test_decimal_handling(self):
        """Test decimal number handling."""
        test_cases = [
            ("100.5 Watts", 101),  # Rounded up
            ("100.4 Watts", 100),  # Rounded down
            ("100.0 Watts", 100),   # Exact
            ("1.5kW", 1500),       # Decimal with unit
        ]
        
        for input_str, expected in test_cases:
            result = UnitConverter.parse_power_string(input_str)
            assert result == expected, f"Failed for '{input_str}': got {result}, expected {expected}"


if __name__ == "__main__":
    pytest.main([__file__])
