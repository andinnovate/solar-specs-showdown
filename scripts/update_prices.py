#!/usr/bin/env python3
"""
Update prices for existing solar panels by fetching current prices from Amazon via ScraperAPI.
Uses search-first strategy: run ScraperAPI search(es) to get ASIN->price, then fall back to
per-ASIN product detail for panels not found in search. Use --product-only to skip search.
"""

import asyncio
import argparse
import sys
import os
from typing import List, Dict, Tuple

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.logging_config import ScriptExecutionContext
from scripts.error_handling import RetryConfig, RetryHandler
from scripts.database import SolarPanelDB
from scripts.scraper import ScraperAPIClient, ScraperAPIForbiddenError
from scripts.utils import send_notification
from scripts.config import config
from supabase import create_client
import json


async def save_raw_scraper_data(asin: str, panel_id: str, raw_response: dict, metadata: dict, logger):
    """
    Save raw ScraperAPI JSON data to the database for future analysis.
    
    Args:
        asin: Amazon Standard Identification Number
        panel_id: UUID of the panel
        raw_response: Raw JSON response from ScraperAPI
        metadata: Processing metadata (timing, size, etc.)
        logger: Logger instance for structured logging
    """
    try:
        client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        
        # Calculate response size
        response_size = len(json.dumps(raw_response).encode('utf-8'))
        
        # Prepare data for insertion/update
        raw_data = {
            'asin': asin,
            'panel_id': panel_id,
            'scraper_response': raw_response,
            'scraper_version': metadata.get('scraper_version', 'v1'),
            'response_size_bytes': response_size,
            'processing_metadata': metadata
        }
        
        # Check if raw data already exists for this ASIN
        existing_result = client.table('raw_scraper_data').select('id').eq('asin', asin).execute()
        
        if existing_result.data:
            # Update existing record
            result = client.table('raw_scraper_data').update(raw_data).eq('asin', asin).execute()
            if result.data:
                logger.log_script_event("DEBUG", f"Updated raw data for ASIN {asin}")
        else:
            # Insert new record
            result = client.table('raw_scraper_data').insert(raw_data).execute()
            if result.data:
                logger.log_script_event("DEBUG", f"Saved raw JSON data for ASIN {asin} ({response_size} bytes)")
            
    except Exception as e:
        logger.log_script_event("WARNING", f"Error saving raw JSON data for ASIN {asin}: {e}")


async def update_panel_price_from_search(
    panel: Dict,
    asin_to_price: Dict[str, float],
    db: SolarPanelDB,
    logger
) -> Dict:
    """
    Update a single panel's price from the search-derived ASIN->price map (no API call).
    Applies same validation as product-detail path: reject $0, update timestamp if unchanged.
    """
    asin = panel.get('asin')
    panel_id = panel.get('id')
    panel_name = panel.get('name', 'Unknown')
    if not asin:
        return {
            'success': False,
            'old_price': None,
            'new_price': None,
            'error': 'No ASIN found for panel',
            'source': 'scraperapi_search'
        }
    new_price = asin_to_price.get(asin)
    old_price = panel.get('price_usd')
    if new_price is None:
        return {
            'success': False,
            'old_price': old_price,
            'new_price': None,
            'error': 'ASIN not in search results',
            'source': 'scraperapi_search'
        }
    if new_price == 0:
        logger.log_script_event(
            "WARNING",
            f"Rejected $0 search price for {panel_name} (ASIN: {asin}) - will fall back to product detail"
        )
        return {
            'success': False,
            'old_price': old_price,
            'new_price': 0,
            'error': 'Price is $0 (product unavailable)',
            'source': 'scraperapi_search'
        }
    if old_price == new_price:
        timestamp_updated = await db.update_panel_timestamp(panel_id)
        if timestamp_updated:
            logger.log_script_event("INFO", f"Price unchanged (search): {panel_name}: ${old_price} (timestamp updated)")
        else:
            logger.log_script_event("WARNING", f"Price unchanged (search): {panel_name}: ${old_price} (failed to update timestamp)")
        return {
            'success': True,
            'old_price': old_price,
            'new_price': new_price,
            'error': None,
            'unchanged': True,
            'source': 'scraperapi_search'
        }
    success = await db.update_panel_price(panel_id, new_price, source='scraperapi_search')
    if success:
        logger.log_script_event("INFO", f"Updated price (search) for {panel_name}: ${old_price} → ${new_price}")
        # No per-ASIN ScraperAPI call for search-sourced updates; usage was counted in search phase
        return {
            'success': True,
            'old_price': old_price,
            'new_price': new_price,
            'error': None,
            'source': 'scraperapi_search'
        }
    return {
        'success': False,
        'old_price': old_price,
        'new_price': new_price,
        'error': 'Database update failed',
        'source': 'scraperapi_search'
    }


async def run_search_phase(
    scraper: ScraperAPIClient,
    retry_handler: RetryHandler,
    keywords: List[str],
    pages_per_keyword: int,
    delay: float,
    logger
) -> Dict[str, float]:
    """
    Run search requests for each (keyword, page), merge into a single ASIN -> price map.
    """
    asin_to_price: Dict[str, float] = {}
    total_searches = len(keywords) * pages_per_keyword
    idx = 0
    for keyword in keywords:
        for page in range(1, pages_per_keyword + 1):
            idx += 1
            logger.log_script_event("INFO", f"Search phase {idx}/{total_searches}: '{keyword}' page {page}")
            try:
                search_result = await retry_handler.execute_with_retry(
                    scraper.search_amazon,
                    keyword,
                    page,
                    service_name="scraperapi"
                )
                if search_result:
                    chunk = scraper.extract_prices_from_search(search_result)
                    asin_to_price.update(chunk)
                    logger.log_script_event("DEBUG", f"Got {len(chunk)} ASINs with prices from this page; total map size {len(asin_to_price)}")
            except ScraperAPIForbiddenError:
                raise
            except Exception as e:
                logger.log_script_event("WARNING", f"Search failed for '{keyword}' page {page}: {e}")
            if idx < total_searches:
                await asyncio.sleep(delay)
    return asin_to_price


async def update_panel_price(
    scraper: ScraperAPIClient,
    db: SolarPanelDB,
    panel: Dict,
    retry_handler: RetryHandler,
    logger
) -> Dict:
    """
    Update price for a single panel by fetching current data from Amazon.
    
    Args:
        scraper: ScraperAPI client
        db: Database client
        panel: Panel dictionary with at least 'id' and 'asin'
        retry_handler: Retry handler for API calls
        logger: Logger instance
        
    Returns:
        Dict with update results: {'success': bool, 'old_price': float, 'new_price': float, 'error': str}
    """
    asin = panel.get('asin')
    panel_id = panel.get('id')
    panel_name = panel.get('name', 'Unknown')
    
    if not asin:
        return {
            'success': False,
            'old_price': None,
            'new_price': None,
            'error': 'No ASIN found for panel'
        }
    
    try:
        # Fetch current product data
        fetch_result = await retry_handler.execute_with_retry(
            scraper.fetch_product,
            asin,
            service_name="scraperapi"
        )
        
        if not fetch_result:
            return {
                'success': False,
                'old_price': panel.get('price_usd'),
                'new_price': None,
                'error': 'Failed to fetch product data'
            }
        
        # Save raw JSON data to database (even if parsing failed)
        raw_response = fetch_result.get('raw_response')
        metadata = fetch_result.get('metadata', {})
        if raw_response:
            await save_raw_scraper_data(asin, panel_id, raw_response, metadata, logger)
        
        # Check if parsing succeeded
        if not fetch_result.get('parsed_data'):
            return {
                'success': False,
                'old_price': panel.get('price_usd'),
                'new_price': None,
                'error': 'Failed to parse product data'
            }
        
        parsed_data = fetch_result['parsed_data']
        new_price = parsed_data.get('price_usd')
        old_price = panel.get('price_usd')
        
        # Check if price is available
        if new_price is None:
            return {
                'success': False,
                'old_price': old_price,
                'new_price': None,
                'error': 'Price not available in fetched data'
            }
        
        # Reject $0 prices (typically indicates unavailable product)
        if new_price == 0:
            logger.log_script_event(
                "WARNING",
                f"Rejected $0 price update for {panel_name} (ASIN: {asin}) - product appears unavailable"
            )
            return {
                'success': False,
                'old_price': old_price,
                'new_price': 0,
                'error': 'Price is $0 (product unavailable)'
            }
        
        # Check if price changed
        if old_price == new_price:
            # Update timestamp even when price is unchanged
            timestamp_updated = await db.update_panel_timestamp(panel_id)
            if timestamp_updated:
                logger.log_script_event(
                    "INFO",
                    f"Price unchanged for {panel_name}: ${old_price} (timestamp updated)"
                )
            else:
                logger.log_script_event(
                    "WARNING",
                    f"Price unchanged for {panel_name}: ${old_price} (failed to update timestamp)"
                )
            
            return {
                'success': True,
                'old_price': old_price,
                'new_price': new_price,
                'error': None,
                'unchanged': True
            }
        
        # Update price in database
        success = await db.update_panel_price(
            panel_id,
            new_price,
            source='scraperapi'
        )
        
        if success:
            logger.log_script_event(
                "INFO",
                f"Updated price for {panel_name}: ${old_price} → ${new_price}"
            )
            
            # Track scraper usage
            await db.track_scraper_usage(
                script_name='update_prices',
                asin=asin,
                url=f"https://www.amazon.com/dp/{asin}",
                success=True
            )
            
            return {
                'success': True,
                'old_price': old_price,
                'new_price': new_price,
                'error': None
            }
        else:
            return {
                'success': False,
                'old_price': old_price,
                'new_price': new_price,
                'error': 'Database update failed'
            }
            
    except ScraperAPIForbiddenError as e:
        logger.log_script_event(
            "CRITICAL",
            f"ScraperAPI 403 Forbidden error for ASIN {asin}. Stopping price updates."
        )
        raise  # Re-raise to stop processing
    except Exception as e:
        logger.log_script_event(
            "ERROR",
            f"Error updating price for {panel_name} (ASIN: {asin}): {str(e)}"
        )
        
        # Track failed scraper usage
        await db.track_scraper_usage(
            script_name='update_prices',
            asin=asin,
            url=f"https://www.amazon.com/dp/{asin}",
            success=False,
            error_message=str(e)
        )
        
        return {
            'success': False,
            'old_price': panel.get('price_usd'),
            'new_price': None,
            'error': str(e)
        }


async def main():
    parser = argparse.ArgumentParser(
        description='Update prices for existing solar panels',
        epilog='''
Examples:
  # Update prices for panels updated more than 7 days ago (default)
  python update_prices.py
  
  # Update prices for panels updated more than 30 days ago, limit to 50 panels
  python update_prices.py --days-old 30 --limit 50
  
  # Update prices with verbose logging
  python update_prices.py --verbose
  
  # Update prices for specific ASINs
  python update_prices.py --asins B0C99GS958 B0CB9X9XX1
  
  # Search-first (default): run searches then fall back to product detail for missing ASINs
  python update_prices.py
  
  # Product-only: skip search, use one product-detail call per panel (legacy behavior)
  python update_prices.py --product-only
  
  # Custom search keywords and pages
  python update_prices.py --search-keywords "solar panel" "400w solar" --search-pages 3
  
  # Search-only: update every panel in DB that appears in search results (no --limit)
  python update_prices.py --search-only
  
  # Stats/report only: show how many need update, recent updates, scraper usage (no API calls)
  python scripts/update_prices.py --stats-only
        ''',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--days-old', type=int, default=7, 
                       help='Update panels last updated more than N days ago (default: 7)')
    parser.add_argument('--limit', type=int, default=100,
                       help='Maximum number of panels to update (default: 100)')
    parser.add_argument('--asins', nargs='+', 
                       help='Specific ASINs to update (overrides --days-old and --limit)')
    parser.add_argument('--delay', type=float, default=2.0,
                       help='Delay between requests in seconds (default: 2.0)')
    parser.add_argument('--max-retries', type=int, default=3,
                       help='Maximum retry attempts (default: 3)')
    parser.add_argument('--search-keywords', nargs='*', default=['solar panel', 'solar panel 400w'],
                       metavar='K',
                       help='Keywords for search phase (default: solar panel, solar panel 400w)')
    parser.add_argument('--search-pages', type=int, default=2,
                       help='Number of pages per search keyword (default: 2)')
    parser.add_argument('--product-only', action='store_true',
                       help='Skip search phase; use only per-ASIN product detail (legacy behavior)')
    parser.add_argument('--search-only', action='store_true',
                       help='Search-driven: run search(es), then update every panel in DB whose ASIN appears in search results (ignores --limit, --days-old, --asins)')
    parser.add_argument('--stats-only', action='store_true',
                       help='Show price-update stats and recent updates, then exit (no API calls). Use --days-old to vary "needing update" threshold.')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    parser.add_argument('--notify', action='store_true',
                       help='Send email notification on completion')
    
    args = parser.parse_args()
    
    # Use context manager for automatic logging setup
    with ScriptExecutionContext('update_prices', 'DEBUG' if args.verbose else 'INFO') as (logger, error_handler):
        
        # Initialize services
        db = SolarPanelDB()
        scraper = ScraperAPIClient(script_logger=logger)
        
        # Setup retry handler
        retry_config = RetryConfig(max_retries=args.max_retries, base_delay=2.0)
        retry_handler = RetryHandler(retry_config, logger)
        
        try:
            # --- Stats-only: report and exit (no API calls) ---
            if args.stats_only:
                logger.log_script_event("INFO", "Fetching price-update statistics...")
                report = await db.get_price_update_stats(days_old=args.days_old, recent_limit=10)
                if not report:
                    logger.log_script_event("WARNING", "Failed to fetch stats")
                    return 1
                total = report.get('total_panels_with_asin', 0)
                total_suffix = "+" if report.get('total_capped') else ""
                needing = report.get('panels_needing_update', 0)
                needing_suffix = "+" if report.get('needing_capped') else ""
                print("\n" + "=" * 60)
                print("PRICE UPDATE STATISTICS")
                print("=" * 60)
                print(f"Panels with ASIN (price-updatable): {total:,}{total_suffix}")
                print(f"Panels needing update (updated >{report.get('days_old', 7)} days ago): {needing:,}{needing_suffix}")
                print(f"ScraperAPI (update_prices) last 7 days: {report.get('scraper_requests_7d', 0)} requests, {report.get('scraper_success_7d', 0)} success")
                recent = report.get('recent_updates', [])
                if recent:
                    print("\nRecent price updates (latest 10):")
                    for r in recent:
                        ts = r.get('created_at', '')[:19] if r.get('created_at') else '—'
                        old_p = r.get('old_price') if r.get('old_price') is not None else '—'
                        new_p = r.get('new_price') if r.get('new_price') is not None else '—'
                        print(f"  {ts}  {(r.get('name') or '—')[:40]:40}  ${old_p} → ${new_p}  ({r.get('source', '—')})")
                else:
                    print("\nRecent price updates: none")
                print("=" * 60 + "\n")
                return 0

            # --- Search-only mode: driven by search results, update every matching panel in DB ---
            if args.search_only:
                logger.log_script_event("INFO", "Search-only mode: running search(es), then updating all panels in DB that appear in results")
                asin_to_price = await run_search_phase(
                    scraper, retry_handler,
                    args.search_keywords,
                    args.search_pages,
                    args.delay,
                    logger
                )
                if not asin_to_price:
                    logger.log_script_event("WARNING", "No ASINs with prices from search; nothing to update")
                    print("\n" + "=" * 60 + "\nSUMMARY\n" + "=" * 60 + "\nSearch-only: 0 panels updated (no prices from search)\n" + "=" * 60 + "\n")
                    return 0
                logger.log_script_event("INFO", f"Search returned {len(asin_to_price)} ASINs with prices; resolving panels in DB")
                panels_from_search = await db.get_panels_by_asins(list(asin_to_price.keys()))
                # Only panels we can update (valid price in map)
                panels_from_search = [p for p in panels_from_search if p.get('asin') and asin_to_price.get(p['asin']) and asin_to_price[p['asin']] > 0]
                logger.log_script_event("INFO", f"Found {len(panels_from_search)} panels in DB to update from search")
                results = {'total': len(panels_from_search), 'successful': 0, 'unchanged': 0, 'failed': 0, 'from_search': 0, 'from_product': 0, 'price_changes': [], 'errors': []}
                for i, panel in enumerate(panels_from_search):
                    asin = panel.get('asin')
                    logger.log_script_event("INFO", f"Updating from search ({i+1}/{len(panels_from_search)}): {panel.get('name', 'Unknown')} (ASIN: {asin})")
                    result = await update_panel_price_from_search(panel, asin_to_price, db, logger)
                    if result['success']:
                        if result.get('unchanged'):
                            results['unchanged'] += 1
                        else:
                            results['successful'] += 1
                            results['from_search'] += 1
                            results['price_changes'].append({
                                'name': panel.get('name'), 'asin': asin,
                                'old_price': result['old_price'], 'new_price': result['new_price']
                            })
                    else:
                        results['failed'] += 1
                        results['errors'].append({'name': panel.get('name'), 'asin': asin, 'error': result.get('error', 'Unknown')})
                logger.log_script_event("INFO", f"Search-only complete: {results['successful']} updated, {results['unchanged']} unchanged, {results['failed']} failed")
                print("\n" + "=" * 60 + "\nSUMMARY (search-only)\n" + "=" * 60)
                print(f"Updated: {results['successful']}, Unchanged: {results['unchanged']}, Failed: {results['failed']}")
                print(f"Total panels in DB from search: {results['total']}")
                print("=" * 60 + "\n")
                if args.notify:
                    await send_notification(
                        f"Search-only price update: {results['successful']} updated, {results['unchanged']} unchanged, {results['failed']} failed (total {results['total']} panels from search)",
                        "Price Update (search-only)"
                    )
                return 0 if results['failed'] == 0 else 1

            # Get panels to update (batch mode: by --asins or --days-old/--limit)
            if args.asins:
                # Update specific ASINs
                panels_to_update = []
                for asin in args.asins:
                    panel = await db.get_panel_by_asin(asin)
                    if panel:
                        panels_to_update.append(panel)
                    else:
                        logger.log_script_event(
                            "WARNING",
                            f"Panel with ASIN {asin} not found in database"
                        )
                
                logger.log_script_event(
                    "INFO",
                    f"Updating prices for {len(panels_to_update)} specified panels"
                )
            else:
                # Get panels needing price update (database method already filters for ASINs)
                all_panels = await db.get_panels_needing_price_update(
                    days_old=args.days_old,
                    limit=args.limit
                )
                
                # Filter to only include panels with ASINs (safety check)
                # This ensures we skip any panels without ASINs that might have slipped through
                panels_to_update = [p for p in all_panels if p.get('asin')]
                
                skipped_count = len(all_panels) - len(panels_to_update)
                if skipped_count > 0:
                    logger.log_script_event(
                        "INFO",
                        f"Skipped {skipped_count} panels without ASINs"
                    )
                
                logger.log_script_event(
                    "INFO",
                    f"Found {len(panels_to_update)} panels with ASINs needing price update (last updated >{args.days_old} days ago)"
                )
            
            if not panels_to_update:
                logger.log_script_event("INFO", "No panels with ASINs need price updates")
                # Output summary even when no panels processed
                print("\n" + "=" * 60)
                print("SUMMARY")
                print("=" * 60)
                print("INFO - Price update completed: 0 updated, 0 unchanged, 0 failed")
                print("Total panels processed: 0")
                print("=" * 60 + "\n")
                return 0
            
            # Track results (including search vs product source)
            results = {
                'total': len(panels_to_update),
                'successful': 0,
                'unchanged': 0,
                'failed': 0,
                'from_search': 0,
                'from_product': 0,
                'price_changes': [],
                'errors': []
            }
            
            # Search phase: build ASIN -> price map (unless product-only)
            asin_to_price: Dict[str, float] = {}
            if not args.product_only and args.search_keywords:
                logger.log_script_event(
                    "INFO",
                    f"Search phase: {len(args.search_keywords)} keyword(s), {args.search_pages} page(s) each"
                )
                try:
                    asin_to_price = await run_search_phase(
                        scraper, retry_handler,
                        args.search_keywords,
                        args.search_pages,
                        args.delay,
                        logger
                    )
                    logger.log_script_event(
                        "INFO",
                        f"Search phase complete: {len(asin_to_price)} ASINs with prices"
                    )
                except ScraperAPIForbiddenError:
                    raise
                except Exception as e:
                    logger.log_script_event("WARNING", f"Search phase had errors; continuing with product fallback: {e}")
            else:
                if args.product_only:
                    logger.log_script_event("INFO", "Product-only mode: skipping search phase")
            
            # Split panels: those we can update from search vs fallback to product detail
            panels_from_search: List[Dict] = []
            panels_fallback: List[Dict] = []
            for panel in panels_to_update:
                asin = panel.get('asin')
                if not asin:
                    continue
                price = asin_to_price.get(asin)
                if price is not None and price > 0:
                    panels_from_search.append(panel)
                else:
                    panels_fallback.append(panel)
            
            logger.log_script_event(
                "INFO",
                f"Panels from search: {len(panels_from_search)}; fallback to product detail: {len(panels_fallback)}"
            )
            
            # Process panels from search (no API call per panel)
            for i, panel in enumerate(panels_from_search):
                asin = panel.get('asin')
                logger.log_script_event(
                    "INFO",
                    f"Updating from search ({i+1}/{len(panels_from_search)}): {panel.get('name', 'Unknown')} (ASIN: {asin})"
                )
                result = await update_panel_price_from_search(panel, asin_to_price, db, logger)
                if result['success']:
                    if result.get('unchanged'):
                        results['unchanged'] += 1
                    else:
                        results['successful'] += 1
                        results['from_search'] += 1
                        results['price_changes'].append({
                            'name': panel.get('name'),
                            'asin': asin,
                            'old_price': result['old_price'],
                            'new_price': result['new_price']
                        })
                else:
                    # Search said we had price but validation failed or DB failed -> count as failed
                    results['failed'] += 1
                    results['errors'].append({
                        'name': panel.get('name'),
                        'asin': asin,
                        'error': result.get('error', 'Unknown')
                    })
            
            # Process fallback panels via product-detail API
            for i, panel in enumerate(panels_fallback):
                asin = panel.get('asin')
                if not asin:
                    logger.log_script_event(
                        "WARNING",
                        f"Skipping panel {panel.get('name', 'Unknown')} (ID: {panel.get('id')}) - no ASIN"
                    )
                    results['failed'] += 1
                    results['errors'].append({
                        'name': panel.get('name'),
                        'asin': None,
                        'error': 'No ASIN found'
                    })
                    continue
                logger.log_script_event(
                    "INFO",
                    f"Processing product detail ({i+1}/{len(panels_fallback)}): {panel.get('name', 'Unknown')} (ASIN: {asin})"
                )
                result = await update_panel_price(
                    scraper, db, panel, retry_handler, logger
                )
                if result['success']:
                    if result.get('unchanged'):
                        results['unchanged'] += 1
                    else:
                        results['successful'] += 1
                        results['from_product'] += 1
                        results['price_changes'].append({
                            'name': panel.get('name'),
                            'asin': asin,
                            'old_price': result['old_price'],
                            'new_price': result['new_price']
                        })
                else:
                    results['failed'] += 1
                    results['errors'].append({
                        'name': panel.get('name'),
                        'asin': asin,
                        'error': result['error']
                    })
                if i < len(panels_fallback) - 1:
                    logger.log_script_event("DEBUG", f"Waiting {args.delay}s before next request...")
                    await asyncio.sleep(args.delay)
            
            # Log summary
            logger.log_script_event(
                "INFO",
                f"Price update completed: {results['successful']} updated "
                f"({results['from_search']} from search, {results['from_product']} from product), "
                f"{results['unchanged']} unchanged, {results['failed']} failed"
            )
            
            if results['price_changes']:
                logger.log_script_event(
                    "INFO",
                    f"Price changes: {len(results['price_changes'])} panels"
                )
                for change in results['price_changes'][:10]:  # Log first 10
                    logger.log_script_event(
                        "INFO",
                        f"  {change['name']}: ${change['old_price']} → ${change['new_price']}"
                    )
            
            if results['errors']:
                logger.log_script_event(
                    "WARNING",
                    f"Failed updates: {len(results['errors'])} panels"
                )
                for error in results['errors'][:10]:  # Log first 10
                    logger.log_script_event(
                        "WARNING",
                        f"  {error['name']} (ASIN: {error['asin']}): {error['error']}"
                    )
            
            # Get scraper usage stats
            stats = await db.get_scraper_usage_stats(days=1)
            logger.log_script_event("INFO", f"Today's ScraperAPI stats: {stats}")
            
            # Output summary to stdout
            print("\n" + "=" * 60)
            print("SUMMARY")
            print("=" * 60)
            print(f"INFO - Price update completed: {results['successful']} updated "
                  f"({results['from_search']} from search, {results['from_product']} from product), "
                  f"{results['unchanged']} unchanged, {results['failed']} failed")
            print(f"Total panels processed: {results['total']}")
            if stats.get('total_requests', 0) > 0:
                print(f"ScraperAPI requests: {stats.get('total_requests', 0)} "
                      f"(Success rate: {stats.get('success_rate', 0):.1f}%)")
            print("=" * 60 + "\n")
            
            # Send notification if requested
            if args.notify:
                message = f"""
Price Update Completed

Total Panels: {results['total']}
Updated: {results['successful']} (from search: {results['from_search']}, from product: {results['from_product']})
Unchanged: {results['unchanged']}
Failed: {results['failed']}

ScraperAPI Usage:
- Total Requests: {stats.get('total_requests', 0)}
- Success Rate: {stats.get('success_rate', 0):.1f}%
"""
                if results['price_changes']:
                    message += f"\nPrice Changes: {len(results['price_changes'])} panels\n"
                    for change in results['price_changes'][:5]:
                        message += f"- {change['name']}: ${change['old_price']} → ${change['new_price']}\n"
                
                if results['errors']:
                    message += f"\nErrors: {len(results['errors'])} panels\n"
                    for error in results['errors'][:5]:
                        message += f"- {error['name']}: {error['error']}\n"
                
                await send_notification(message, "Price Update Report")
            
            return 0 if results['failed'] == 0 else 1
            
        except ScraperAPIForbiddenError as e:
            error_handler.handle_error(e, "ScraperAPI 403 Forbidden", critical=True)
            await send_notification(
                f"Price update script stopped due to ScraperAPI 403 Forbidden error: {str(e)}",
                "Price Update Failure"
            )
            return 1
        except Exception as e:
            error_handler.handle_error(e, "Main execution", critical=True)
            await send_notification(f"Price update script failed: {str(e)}", "Price Update Failure")
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)

