#!/usr/bin/env python3
"""
Debug script to capture and analyze raw ScraperAPI search responses.
Saves full response to JSON file for inspection.
"""

import requests
import json
import sys
import os
from datetime import datetime

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import config


def debug_search(keyword: str, page: int = 1):
    """
    Execute ScraperAPI search and dump raw response.
    
    Args:
        keyword: Search term
        page: Page number
    """
    print("=" * 80)
    print("SCRAPERAPI SEARCH DEBUG")
    print("=" * 80)
    print(f"Keyword: {keyword}")
    print(f"Page: {page}")
    print()
    
    # Construct search URL
    search_url = f"https://www.amazon.com/s?k={keyword.replace(' ', '+')}"
    if page > 1:
        search_url += f"&page={page}"
    
    print(f"Search URL: {search_url}")
    print()
    
    # ScraperAPI request
    payload = {
        'api_key': config.SCRAPERAPI_KEY,
        'url': search_url,
        'output_format': 'json',
        'autoparse': 'true',
        'country_code': 'us'
    }
    
    print("Making ScraperAPI request...")
    print(f"Autoparse: {payload['autoparse']}")
    print()
    
    try:
        response = requests.get('https://api.scraperapi.com/', params=payload, timeout=60)
        response.raise_for_status()
        
        print(f"✓ Response received (status: {response.status_code})")
        print()
        
        # Parse JSON
        api_data = response.json()
        
        # Analyze structure
        print("=" * 80)
        print("RESPONSE STRUCTURE ANALYSIS")
        print("=" * 80)
        print(f"Type: {type(api_data)}")
        print()
        
        if isinstance(api_data, dict):
            print(f"Top-level keys ({len(api_data)} total):")
            for key in api_data.keys():
                value = api_data[key]
                print(f"  • {key}: {type(value).__name__}", end="")
                
                if isinstance(value, list):
                    print(f" (length: {len(value)})")
                    if len(value) > 0:
                        print(f"    First item type: {type(value[0]).__name__}")
                        if isinstance(value[0], dict):
                            print(f"    First item keys: {list(value[0].keys())[:5]}...")
                elif isinstance(value, dict):
                    print(f" (keys: {len(value)})")
                    print(f"    Keys: {list(value.keys())[:5]}...")
                else:
                    print()
        
        print()
        print("=" * 80)
        print("LOOKING FOR PRODUCTS")
        print("=" * 80)
        
        # Check for common product keys
        product_keys = ['products', 'results', 'organic_results', 'search_results', 'items']
        for key in product_keys:
            if key in api_data:
                products = api_data[key]
                print(f"✓ Found '{key}' with {len(products) if isinstance(products, list) else '?'} items")
                
                if isinstance(products, list) and len(products) > 0:
                    print(f"\nFirst product structure:")
                    print(json.dumps(products[0], indent=2)[:500])
            else:
                print(f"✗ No '{key}' key found")
        
        print()
        
        # Save to file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"scraperapi_search_debug_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(api_data, f, indent=2)
        
        print("=" * 80)
        print(f"✓ Full response saved to: {filename}")
        print("=" * 80)
        print()
        print("Next steps:")
        print("1. Review the JSON file to see actual structure")
        print("2. Update scraper.py::search_amazon() to handle this structure")
        print(f"3. Look for ASIN in the response (search for 'B0' pattern)")
        
        return filename
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Debug ScraperAPI search responses')
    parser.add_argument('keyword', nargs='?', default='solar panel monocrystalline', 
                       help='Search keyword (default: "solar panel monocrystalline")')
    parser.add_argument('--page', type=int, default=1, help='Page number')
    
    args = parser.parse_args()
    
    filename = debug_search(args.keyword, args.page)
    
    if filename:
        print(f"\n✓ Debug complete! Review {filename}")
        exit(0)
    else:
        print("\n✗ Debug failed")
        exit(1)

