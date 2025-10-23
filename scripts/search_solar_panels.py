#!/usr/bin/env python3
"""
Search Amazon for solar panels and stage ASINs for product detail ingestion.
This script discovers new products without fetching full details yet.
"""

import asyncio
import argparse
import sys
import os
from typing import List

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.logging_config import ScriptExecutionContext
from scripts.scraper import ScraperAPIClient
from scripts.asin_manager import ASINManager
from scripts.product_filter import ProductFilter
from scripts.config import config
from supabase import create_client


async def log_filtered_asin(asin: str, filter_stage: str, filter_reason: str, 
                           product_name: str = None, product_url: str = None, 
                           wattage: int = None, confidence: float = 0.0):
    """
    Log a filtered ASIN to the database.
    
    Args:
        asin: ASIN that was filtered
        filter_stage: 'search' or 'ingest'
        filter_reason: Reason for filtering
        product_name: Name of the product
        product_url: URL of the product
        wattage: Wattage if available
        confidence: Confidence level (0.0 to 1.0)
    """
    try:
        client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        
        result = client.table('filtered_asins').insert({
            'asin': asin,
            'filter_stage': filter_stage,
            'filter_reason': filter_reason,
            'product_name': product_name,
            'product_url': product_url,
            'wattage': wattage,
            'confidence': confidence,
            'created_by': 'search_solar_panels'
        }).execute()
        
        return result.data[0]['id'] if result.data else None
        
    except Exception as e:
        print(f"Warning: Failed to log filtered ASIN to database: {e}")
        return None


async def log_search_to_db(keyword: str, results_count: int, asins_found: List[str], script_name: str):
    """
    Log search results to search_keywords table.
    
    Args:
        keyword: Search keyword
        results_count: Number of results returned
        asins_found: List of ASINs discovered
        script_name: Name of the executing script
    """
    try:
        client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        
        result = client.table('search_keywords').insert({
            'keyword': keyword,
            'search_type': 'amazon',
            'results_count': results_count,
            'asins_found': asins_found,
            'script_name': script_name
        }).execute()
        
        return result.data[0]['id'] if result.data else None
        
    except Exception as e:
        print(f"Warning: Failed to log search to database: {e}")
        return None


async def search_and_stage(
    keyword: str,
    pages: int,
    scraper: ScraperAPIClient,
    asin_manager: ASINManager,
    logger,
    priority: int = 0,
    dump_response_file: str = None
) -> dict:
    """
    Search for a keyword and stage discovered ASINs.
    
    Returns:
        Dict with search statistics
    """
    stats = {
        'keyword': keyword,
        'total_found': 0,
        'filtered_out': 0,
        'already_in_db': 0,
        'already_staged': 0,
        'newly_staged': 0,
        'pages_searched': 0
    }
    
    all_asins = []
    
    # Search multiple pages if requested
    for page in range(1, pages + 1):
        logger.log_script_event("INFO", f"Searching page {page}/{pages} for '{keyword}'...")
        
        # Perform search
        search_results = scraper.search_amazon(keyword, page=page)
        
        # Save response for debugging if requested (only first page)
        if page == 1 and dump_response_file:
            import json
            dump_file = dump_response_file.replace('{keyword}', keyword.replace(' ', '_'))
            with open(dump_file, 'w') as f:
                json.dump(search_results if search_results else {}, f, indent=2)
            print(f"  [DEBUG] Response saved to: {dump_file}")
        
        if not search_results:
            logger.log_script_event("WARNING", f"No results for page {page}")
            break
        
        stats['pages_searched'] += 1
        
        # Extract ASINs
        asins = scraper.extract_asins_from_search(search_results)
        stats['total_found'] += len(asins)
        all_asins.extend(asins)
        
        logger.log_script_event("INFO", f"Found {len(asins)} ASINs on page {page}")
        
        # Stage each ASIN
        for asin in asins:
            # Find product data for filtering
            product_data = None
            product_name = None
            product_url = None
            
            # Try to find product data in search results
            if search_results and 'products' in search_results:
                for product in search_results['products']:
                    if product.get('asin') == asin:
                        product_data = product
                        product_name = product.get('name', '')
                        product_url = product.get('url', '')
                        break
            
            # Apply product filtering
            if product_name:
                filter_result = product_filter.should_reject_product(product_name, product_data)
                
                if filter_result.should_reject:
                    stats['filtered_out'] += 1
                    logger.log_script_event("DEBUG", f"Filtered ASIN {asin}: {filter_result.reason}")
                    
                    # Log filtered ASIN to database
                    await log_filtered_asin(
                        asin=asin,
                        filter_stage='search',
                        filter_reason=filter_result.reason,
                        product_name=product_name,
                        product_url=product_url,
                        wattage=product_filter.extract_wattage_from_name(product_name),
                        confidence=filter_result.confidence
                    )
                    continue
            
            # Check if already in database
            if await asin_manager.is_asin_in_database(asin):
                stats['already_in_db'] += 1
                logger.log_script_event("DEBUG", f"ASIN {asin} already in database")
                continue
            
            # Check if already staged
            if await asin_manager.is_asin_staged(asin):
                stats['already_staged'] += 1
                logger.log_script_event("DEBUG", f"ASIN {asin} already staged")
                continue
            
            # Stage the ASIN
            success = await asin_manager.stage_asin(
                asin=asin,
                source='search',
                source_keyword=keyword,
                priority=priority
            )
            
            if success:
                stats['newly_staged'] += 1
        
        # Add delay between pages to avoid rate limiting
        if page < pages:
            await asyncio.sleep(2.0)
    
    # Log search to database
    search_id = await log_search_to_db(
        keyword=keyword,
        results_count=stats['total_found'],
        asins_found=all_asins,
        script_name='search_solar_panels'
    )
    
    logger.log_script_event(
        "INFO",
        f"Search complete for '{keyword}': {stats['total_found']} found, "
        f"{stats['filtered_out']} filtered out, {stats['newly_staged']} newly staged, "
        f"{stats['already_in_db']} already in DB"
    )
    
    return stats


async def main():
    parser = argparse.ArgumentParser(
        description='Search Amazon for solar panels and stage ASINs for ingestion',
        epilog='Example: python search_solar_panels.py "solar panel 400w" "bifacial solar panel" --pages 2'
    )
    
    parser.add_argument(
        'keywords',
        nargs='+',
        help='Search keywords (can specify multiple)'
    )
    parser.add_argument(
        '--pages',
        type=int,
        default=1,
        help='Number of pages to search per keyword (default: 1)'
    )
    parser.add_argument(
        '--priority',
        type=int,
        default=0,
        help='Priority level for staged ASINs (higher = process sooner, default: 0)'
    )
    parser.add_argument(
        '--verbose',
        '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--stats-only',
        action='store_true',
        help='Show staging stats and exit (no search)'
    )
    parser.add_argument(
        '--dump-response',
        type=str,
        metavar='FILE',
        help='Save raw ScraperAPI response to JSON file for debugging'
    )
    
    args = parser.parse_args()
    
    # Use context manager for logging
    with ScriptExecutionContext('search_solar_panels', 'DEBUG' if args.verbose else 'INFO') as (logger, error_handler):
        
        # Initialize services
        scraper = ScraperAPIClient(script_logger=logger)
        asin_manager = ASINManager()
        product_filter = ProductFilter()
        
        # Show stats if requested
        if args.stats_only:
            logger.log_script_event("INFO", "Fetching staging statistics...")
            stats = await asin_manager.get_staging_stats()
            
            print("\n" + "=" * 60)
            print("ASIN STAGING STATISTICS")
            print("=" * 60)
            print(f"Total ASINs: {stats.get('total', 0)}")
            print(f"  Pending: {stats.get('pending', 0)}")
            print(f"  Processing: {stats.get('processing', 0)}")
            print(f"  Completed: {stats.get('completed', 0)}")
            print(f"  Failed: {stats.get('failed', 0)}")
            print(f"  Duplicate: {stats.get('duplicate', 0)}")
            print(f"  Skipped: {stats.get('skipped', 0)}")
            print("=" * 60)
            
            return 0
        
        logger.log_script_event("INFO", f"Starting search for {len(args.keywords)} keyword(s)")
        
        # Track overall stats
        overall_stats = {
            'total_keywords': len(args.keywords),
            'total_found': 0,
            'total_filtered': 0,
            'total_staged': 0,
            'already_in_db': 0,
            'already_staged': 0
        }
        
        try:
            # Search for each keyword
            for i, keyword in enumerate(args.keywords):
                logger.log_script_event(
                    "INFO",
                    f"Processing keyword {i+1}/{len(args.keywords)}: '{keyword}'"
                )
                
                # Search and stage
                stats = await search_and_stage(
                    keyword=keyword,
                    pages=args.pages,
                    scraper=scraper,
                    asin_manager=asin_manager,
                    logger=logger,
                    priority=args.priority,
                    dump_response_file=args.dump_response
                )
                
                # Update overall stats
                overall_stats['total_found'] += stats['total_found']
                overall_stats['total_filtered'] += stats['filtered_out']
                overall_stats['total_staged'] += stats['newly_staged']
                overall_stats['already_in_db'] += stats['already_in_db']
                overall_stats['already_staged'] += stats['already_staged']
                
                # Display keyword summary
                print(f"\n  Keyword: {keyword}")
                print(f"    Found: {stats['total_found']} ASINs")
                print(f"    Filtered Out: {stats['filtered_out']}")
                print(f"    Newly Staged: {stats['newly_staged']}")
                print(f"    Already in DB: {stats['already_in_db']}")
                print(f"    Already Staged: {stats['already_staged']}")
                
                # Add delay between keywords
                if i < len(args.keywords) - 1:
                    await asyncio.sleep(3.0)
            
            # Display final summary
            print("\n" + "=" * 60)
            print("SEARCH COMPLETE - SUMMARY")
            print("=" * 60)
            print(f"Keywords Searched: {overall_stats['total_keywords']}")
            print(f"Total ASINs Found: {overall_stats['total_found']}")
            print(f"Filtered Out: {overall_stats['total_filtered']}")
            print(f"Newly Staged: {overall_stats['total_staged']}")
            print(f"Already in Database: {overall_stats['already_in_db']}")
            print(f"Already Staged: {overall_stats['already_staged']}")
            print("=" * 60)
            
            if overall_stats['total_staged'] > 0:
                print(f"\n✅ {overall_stats['total_staged']} new ASINs staged for ingestion!")
                print(f"   Run: python scripts/ingest_staged_asins.py --batch-size 10")
            else:
                print("\nℹ️  No new ASINs to stage (all already known)")
            
            logger.log_script_event(
                "INFO",
                f"Search completed: {overall_stats['total_staged']} ASINs staged"
            )
            
            return 0
            
        except Exception as e:
            error_handler.handle_error(e, "Main execution", critical=True)
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)

