#!/usr/bin/env python3
"""
Fetch solar panel data from Amazon via ScraperAPI and store in database.
This script demonstrates the complete workflow of scraping and storing panel data.
"""

import asyncio
import argparse
import sys
import os
import csv
from typing import List

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.logging_config import ScriptExecutionContext
from scripts.error_handling import RetryConfig, RetryHandler
from scripts.database import SolarPanelDB
from scripts.scraper import ScraperAPIClient
from scripts.utils import send_notification


def read_asins_from_file(filepath: str) -> List[str]:
    """
    Read ASINs from a file (CSV or text format).
    
    Args:
        filepath: Path to file containing ASINs
        
    Returns:
        List of ASINs
        
    Supported formats:
        - Text file: One ASIN per line
        - CSV file: Extracts ASINs from 'asin' column or first column
    """
    asins = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            # Try to detect if it's a CSV file
            first_line = f.readline().strip()
            f.seek(0)  # Reset to beginning
            
            if ',' in first_line or filepath.endswith('.csv'):
                # CSV format
                reader = csv.DictReader(f)
                
                # Look for 'asin' column (case-insensitive)
                fieldnames = [fn.lower() for fn in reader.fieldnames] if reader.fieldnames else []
                
                if 'asin' in fieldnames:
                    # Use 'asin' column
                    for row in reader:
                        asin = row.get('asin') or row.get('ASIN') or row.get('Asin')
                        if asin and asin.strip():
                            asins.append(asin.strip())
                else:
                    # Use first column
                    f.seek(0)
                    reader = csv.reader(f)
                    for row in reader:
                        if row and row[0].strip():
                            # Skip header if it looks like one
                            if row[0].strip().upper() not in ['ASIN', 'ID', 'PRODUCT_ID']:
                                asins.append(row[0].strip())
            else:
                # Text format: one ASIN per line
                for line in f:
                    line = line.strip()
                    # Skip empty lines and comments
                    if line and not line.startswith('#'):
                        asins.append(line)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_asins = []
        for asin in asins:
            if asin not in seen:
                seen.add(asin)
                unique_asins.append(asin)
        
        return unique_asins
        
    except FileNotFoundError:
        raise ValueError(f"File not found: {filepath}")
    except Exception as e:
        raise ValueError(f"Error reading file {filepath}: {str(e)}")


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
    parser = argparse.ArgumentParser(
        description='Fetch solar panel data from Amazon',
        epilog='''
Examples:
  # Fetch single ASIN
  python fetch_solar_panels.py B0C99GS958
  
  # Fetch multiple ASINs
  python fetch_solar_panels.py B0C99GS958 B0CB9X9XX1 B0D2RT4S3B
  
  # Read from text file (one ASIN per line)
  python fetch_solar_panels.py --file asins.txt
  
  # Read from CSV file
  python fetch_solar_panels.py --file asins.csv
  
  # Combine file and command-line ASINs
  python fetch_solar_panels.py B0C99GS958 --file asins.txt
        ''',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('asins', nargs='*', help='Amazon ASINs to fetch (optional if using --file)')
    parser.add_argument('--file', '-f', type=str, help='Read ASINs from file (CSV or text, one per line)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    parser.add_argument('--delay', type=float, default=2.0, help='Delay between requests (seconds)')
    parser.add_argument('--max-retries', type=int, default=3, help='Maximum retry attempts')
    parser.add_argument('--notify', action='store_true', help='Send email notification on completion')
    
    args = parser.parse_args()
    
    # Collect ASINs from command line and/or file
    all_asins = list(args.asins) if args.asins else []
    
    if args.file:
        try:
            file_asins = read_asins_from_file(args.file)
            all_asins.extend(file_asins)
            print(f"✓ Read {len(file_asins)} ASINs from {args.file}")
        except ValueError as e:
            print(f"Error: {e}")
            return 1
    
    # Validate we have ASINs to process
    if not all_asins:
        parser.error("No ASINs provided. Specify ASINs as arguments or use --file option.")
        return 1
    
    # Remove duplicates while preserving order
    seen = set()
    unique_asins = []
    for asin in all_asins:
        if asin not in seen:
            seen.add(asin)
            unique_asins.append(asin)
    
    if len(unique_asins) < len(all_asins):
        print(f"ℹ️  Removed {len(all_asins) - len(unique_asins)} duplicate ASINs")
    
    all_asins = unique_asins
    
    # Use context manager for automatic logging setup
    with ScriptExecutionContext('fetch_solar_panels', 'DEBUG' if args.verbose else 'INFO') as (logger, error_handler):
        
        logger.log_script_event("INFO", f"Starting to fetch {len(all_asins)} solar panels")
        
        # Initialize services
        db = SolarPanelDB()
        scraper = ScraperAPIClient(script_logger=logger)
        
        # Setup retry handler
        retry_config = RetryConfig(max_retries=args.max_retries, base_delay=2.0)
        retry_handler = RetryHandler(retry_config, logger)
        
        # Track results
        results = {
            'total': len(all_asins),
            'successful': 0,
            'failed': 0,
            'asins_failed': []
        }
        
        try:
            # Process each ASIN
            for i, asin in enumerate(all_asins):
                logger.log_script_event("INFO", f"Processing ASIN {i+1}/{len(all_asins)}: {asin}")
                
                success = await fetch_and_store_panel(
                    scraper, db, asin, retry_handler, logger
                )
                
                if success:
                    results['successful'] += 1
                else:
                    results['failed'] += 1
                    results['asins_failed'].append(asin)
                
                # Add delay between requests (except for last one)
                if i < len(all_asins) - 1:
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

