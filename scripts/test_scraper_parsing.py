#!/usr/bin/env python3
"""
Test script to verify ScraperAPI data parsing.
Tests the parsing functions with sample data from scraperapi_sample.py.
"""

import sys
import os
import json

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.scraper import UnitConverter, ScraperAPIParser


def test_unit_conversions():
    """Test unit conversion functions"""
    print("=" * 60)
    print("TESTING UNIT CONVERSIONS")
    print("=" * 60)
    
    # Test inches to cm
    inches = 45.67
    cm = UnitConverter.inches_to_cm(inches)
    print(f"\n✓ Inches to CM: {inches}\" = {cm} cm")
    assert cm == 116.00, f"Expected 116.00, got {cm}"
    
    # Test pounds to kg
    pounds = 15.87
    kg = UnitConverter.pounds_to_kg(pounds)
    print(f"✓ Pounds to KG: {pounds} lbs = {kg} kg")
    assert kg == 7.20, f"Expected 7.20, got {kg}"
    
    # Test dimension parsing
    dim_string = '45.67"L x 17.71"W x 1.18"H'
    dimensions = UnitConverter.parse_dimension_string(dim_string)
    print(f"✓ Dimension parsing: '{dim_string}'")
    print(f"  → Length: {dimensions[0]} cm, Width: {dimensions[1]} cm")
    assert dimensions[0] == 116.00, f"Expected length 116.00, got {dimensions[0]}"
    assert dimensions[1] == 44.98, f"Expected width 44.98, got {dimensions[1]}"
    
    # Test weight parsing
    weight_string = "15.87 pounds"
    weight = UnitConverter.parse_weight_string(weight_string)
    print(f"✓ Weight parsing: '{weight_string}' = {weight} kg")
    assert weight == 7.20, f"Expected 7.20, got {weight}"
    
    # Test power parsing
    power_string = "100 Watts"
    power = UnitConverter.parse_power_string(power_string)
    print(f"✓ Power parsing: '{power_string}' = {power} W")
    assert power == 100, f"Expected 100, got {power}"
    
    # Test voltage parsing
    voltage_string = "12 Volts"
    voltage = UnitConverter.parse_voltage_string(voltage_string)
    print(f"✓ Voltage parsing: '{voltage_string}' = {voltage} V")
    assert voltage == 12.0, f"Expected 12.0, got {voltage}"
    
    # Test price parsing
    price_string = "$69.99"
    price = UnitConverter.parse_price_string(price_string)
    print(f"✓ Price parsing: '{price_string}' = ${price}")
    assert price == 69.99, f"Expected 69.99, got {price}"
    
    print("\n✅ All unit conversion tests passed!")


def test_full_product_parsing():
    """Test full product data parsing with sample ScraperAPI response"""
    print("\n" + "=" * 60)
    print("TESTING FULL PRODUCT PARSING")
    print("=" * 60)
    
    # Sample data from scraperapi_sample.py output
    sample_data = {
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
    
    print("\nParsing sample product data...")
    parsed = ScraperAPIParser.parse_product_data(sample_data)
    
    if not parsed:
        print("❌ Failed to parse product data!")
        return False
    
    print("\n✓ Successfully parsed product data:")
    print(f"  Name: {parsed['name'][:60]}...")
    print(f"  Manufacturer: {parsed['manufacturer']}")
    print(f"  Length: {parsed['length_cm']} cm")
    print(f"  Width: {parsed['width_cm']} cm")
    print(f"  Weight: {parsed['weight_kg']} kg")
    print(f"  Wattage: {parsed['wattage']} W")
    print(f"  Voltage: {parsed['voltage']} V")
    print(f"  Price: ${parsed['price_usd']}")
    print(f"  Web URL: {parsed['web_url']}")
    print(f"  Image URL: {parsed['image_url'][:60]}...")
    
    # Verify expected values
    print("\nVerifying parsed values against expected:")
    
    checks = [
        ("manufacturer", parsed['manufacturer'], "FivstaSola"),
        ("length_cm", parsed['length_cm'], 116.00),
        ("width_cm", parsed['width_cm'], 44.98),
        ("weight_kg", parsed['weight_kg'], 7.20),
        ("wattage", parsed['wattage'], 100),
        ("voltage", parsed['voltage'], 12.0),
        ("price_usd", parsed['price_usd'], 69.99),
    ]
    
    all_passed = True
    for field, actual, expected in checks:
        if actual == expected:
            print(f"  ✓ {field}: {actual} (correct)")
        else:
            print(f"  ❌ {field}: {actual} (expected {expected})")
            all_passed = False
    
    if all_passed:
        print("\n✅ All product parsing tests passed!")
    else:
        print("\n❌ Some product parsing tests failed!")
    
    return all_passed


def test_edge_cases():
    """Test edge cases and various formats"""
    print("\n" + "=" * 60)
    print("TESTING EDGE CASES")
    print("=" * 60)
    
    test_cases = [
        ("Dimensions without quotes", "115L x 66W x 3H", (115.0, 66.0)),
        ("Dimensions in cm", "115 x 66 x 3 cm", (115.0, 66.0)),
        ("Weight in kg", "7.2 kg", 7.2),
        ("Price with comma", "$1,299.99", 1299.99),
        ("Voltage short form", "24V", 24.0),
        ("Power short form", "200W", 200),
    ]
    
    print("\nTesting various input formats:")
    
    for description, input_value, expected in test_cases:
        try:
            if "Dimension" in description:
                result = UnitConverter.parse_dimension_string(input_value)
                status = "✓" if result == expected else "❌"
                print(f"  {status} {description}: '{input_value}' → {result}")
            elif "Weight" in description:
                result = UnitConverter.parse_weight_string(input_value)
                status = "✓" if result == expected else "❌"
                print(f"  {status} {description}: '{input_value}' → {result}")
            elif "Price" in description:
                result = UnitConverter.parse_price_string(input_value)
                status = "✓" if result == expected else "❌"
                print(f"  {status} {description}: '{input_value}' → {result}")
            elif "Voltage" in description:
                result = UnitConverter.parse_voltage_string(input_value)
                status = "✓" if result == expected else "❌"
                print(f"  {status} {description}: '{input_value}' → {result}")
            elif "Power" in description:
                result = UnitConverter.parse_power_string(input_value)
                status = "✓" if result == expected else "❌"
                print(f"  {status} {description}: '{input_value}' → {result}")
        except Exception as e:
            print(f"  ❌ {description}: Error - {e}")
    
    print("\n✅ Edge case testing complete!")


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("SCRAPERAPI PARSER TEST SUITE")
    print("=" * 60)
    
    try:
        test_unit_conversions()
        test_full_product_parsing()
        test_edge_cases()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        return 0
        
    except Exception as e:
        print(f"\n❌ Test suite failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())

