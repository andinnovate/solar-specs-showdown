#!/usr/bin/env python3
"""
Fetch solar panel data from Amazon via ScraperAPI and store in database.
This script demonstrates the complete workflow of scraping and storing panel data.
"""

import asyncio
import argparse
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.logging_config import ScriptExecutionContext
from scripts.error_handling import RetryConfig, RetryHandler
from scripts.database import SolarPanelDB
from scripts.scraper import ScraperAPIClient
from scripts.utils import send_notification


async def fetch_and_store_panel(
    scraper: ScraperAPIClient,
    db: SolarPanelDB,
    asin: str,
    retry_handler: RetryHandler,
    logger
) -> bool:
    """
    Fetch a single panel and store it in the database.
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Fetch product data with retry logic
        panel_data = await retry_handler.execute_with_retry(
            scraper.fetch_product,
            asin,
            service_name="scraperapi"
        )
        
        if not panel_data:
            logger.log_script_event("WARNING", f"Failed to fetch data for ASIN: {asin}")
            return False
        
        # Check if panel already exists
        panels = await db.get_panels_needing_price_update(limit=1000)
        existing_panel = None
        
        for panel in panels:
            if panel.get('name') == panel_data['name'] and panel.get('manufacturer') == panel_data['manufacturer']:
                existing_panel = panel
                break
        
        if existing_panel:
            # Update existing panel
            logger.log_script_event(
                "INFO", 
                f"Panel already exists: {panel_data['name']}. Updating price..."
            )
            
            old_price = existing_panel.get('price_usd')
            new_price = panel_data['price_usd']
            
            if old_price != new_price:
                success = await db.update_panel_price(
                    existing_panel['id'],
                    new_price,
                    source='scraperapi'
                )
                
                if success:
                    logger.log_script_event(
                        "INFO",
                        f"Updated price for {panel_data['name']}: ${old_price} → ${new_price}"
                    )
                else:
                    logger.log_script_event("ERROR", f"Failed to update price for {panel_data['name']}")
                    return False
            else:
                logger.log_script_event("INFO", f"Price unchanged for {panel_data['name']}")
        else:
            # Add new panel
            panel_id = await db.add_new_panel(panel_data)
            
            if panel_id:
                logger.log_script_event(
                    "INFO",
                    f"Added new panel: {panel_data['name']} (${panel_data['price_usd']})"
                )
            else:
                logger.log_script_event("ERROR", f"Failed to add panel: {panel_data['name']}")
                return False
        
        # Track scraper usage
        await db.track_scraper_usage(
            script_name='fetch_solar_panels',
            asin=asin,
            url=f"https://www.amazon.com/dp/{asin}",
            success=True
        )
        
        return True
        
    except Exception as e:
        logger.log_script_event("ERROR", f"Error processing ASIN {asin}: {str(e)}")
        
        # Track failed scraper usage
        await db.track_scraper_usage(
            script_name='fetch_solar_panels',
            asin=asin,
            url=f"https://www.amazon.com/dp/{asin}",
            success=False,
            error_message=str(e)
        )
        
        return False


async def main():
    parser = argparse.ArgumentParser(description='Fetch solar panel data from Amazon')
    parser.add_argument('asins', nargs='+', help='Amazon ASINs to fetch')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    parser.add_argument('--delay', type=float, default=2.0, help='Delay between requests (seconds)')
    parser.add_argument('--max-retries', type=int, default=3, help='Maximum retry attempts')
    parser.add_argument('--notify', action='store_true', help='Send email notification on completion')
    
    args = parser.parse_args()
    
    # Use context manager for automatic logging setup
    with ScriptExecutionContext('fetch_solar_panels', 'DEBUG' if args.verbose else 'INFO') as (logger, error_handler):
        
        logger.log_script_event("INFO", f"Starting to fetch {len(args.asins)} solar panels")
        
        # Initialize services
        db = SolarPanelDB()
        scraper = ScraperAPIClient(script_logger=logger)
        
        # Setup retry handler
        retry_config = RetryConfig(max_retries=args.max_retries, base_delay=2.0)
        retry_handler = RetryHandler(retry_config, logger)
        
        # Track results
        results = {
            'total': len(args.asins),
            'successful': 0,
            'failed': 0,
            'asins_failed': []
        }
        
        try:
            # Process each ASIN
            for i, asin in enumerate(args.asins):
                logger.log_script_event("INFO", f"Processing ASIN {i+1}/{len(args.asins)}: {asin}")
                
                success = await fetch_and_store_panel(
                    scraper, db, asin, retry_handler, logger
                )
                
                if success:
                    results['successful'] += 1
                else:
                    results['failed'] += 1
                    results['asins_failed'].append(asin)
                
                # Add delay between requests (except for last one)
                if i < len(args.asins) - 1:
                    logger.log_script_event("DEBUG", f"Waiting {args.delay}s before next request...")
                    await asyncio.sleep(args.delay)
            
            # Log summary
            logger.log_script_event(
                "INFO",
                f"Completed: {results['successful']} successful, {results['failed']} failed"
            )
            
            if results['asins_failed']:
                logger.log_script_event(
                    "WARNING",
                    f"Failed ASINs: {', '.join(results['asins_failed'])}"
                )
            
            # Get scraper usage stats
            stats = await db.get_scraper_usage_stats(days=1)
            logger.log_script_event("INFO", f"Today's ScraperAPI stats: {stats}")
            
            # Send notification if requested
            if args.notify:
                message = f"""
Solar Panel Fetch Completed

Total ASINs: {results['total']}
Successful: {results['successful']}
Failed: {results['failed']}

ScraperAPI Usage:
- Total Requests: {stats.get('total_requests', 0)}
- Success Rate: {stats.get('success_rate', 0):.1f}%
"""
                if results['asins_failed']:
                    message += f"\nFailed ASINs: {', '.join(results['asins_failed'])}"
                
                await send_notification(message, "Solar Panel Fetch Report")
            
            return 0 if results['failed'] == 0 else 1
            
        except Exception as e:
            error_handler.handle_error(e, "Main execution", critical=True)
            await send_notification(f"Script failed: {str(e)}", "Solar Panel Fetch Failure")
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)

