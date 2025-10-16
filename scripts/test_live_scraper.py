#!/usr/bin/env python3
"""
Test script to verify ScraperAPI integration with live API call.
Tests fetching real data from Amazon via ScraperAPI.
"""

import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.scraper import ScraperAPIClient
from scripts.logging_config import ScriptLogger


def main():
    """Test live ScraperAPI call"""
    print("=" * 60)
    print("TESTING LIVE SCRAPERAPI INTEGRATION")
    print("=" * 60)
    
    # Initialize logger and client
    logger = ScriptLogger("test_live_scraper")
    client = ScraperAPIClient(script_logger=logger)
    
    # Test ASIN from scraperapi_sample.py
    test_asin = "B0C99GS958"
    
    print(f"\nFetching product data for ASIN: {test_asin}")
    print("This will use your ScraperAPI credits...")
    
    try:
        product_data = client.fetch_product(test_asin)
        
        if product_data:
            print("\n✅ Successfully fetched and parsed product data!")
            print("\nParsed Data:")
            print(f"  Name: {product_data['name'][:60]}...")
            print(f"  Manufacturer: {product_data['manufacturer']}")
            print(f"  Dimensions: {product_data['length_cm']} cm x {product_data['width_cm']} cm")
            print(f"  Weight: {product_data['weight_kg']} kg")
            print(f"  Wattage: {product_data['wattage']} W")
            print(f"  Voltage: {product_data['voltage']} V")
            print(f"  Price: ${product_data['price_usd']}")
            print(f"  URL: {product_data['web_url']}")
            
            print("\n✅ Data is ready for database insertion!")
            return 0
        else:
            print("\n❌ Failed to fetch or parse product data")
            return 1
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())

