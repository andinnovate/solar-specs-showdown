#!/usr/bin/env python3
"""
Process ASINs in the staging queue and fetch full product details.
This script fetches product details for ASINs discovered by search.
"""

import asyncio
import argparse
import sys
import os
from typing import Optional, Dict

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.logging_config import ScriptExecutionContext
from scripts.error_handling import RetryConfig, RetryHandler
from scripts.scraper import ScraperAPIClient, ScraperAPIForbiddenError
from scripts.asin_manager import ASINManager
from scripts.database import SolarPanelDB
from scripts.config import config
from supabase import create_client
import json


async def save_raw_scraper_data(asin: str, panel_id: Optional[str], raw_response: dict, metadata: dict, logger):
    """
    Save raw ScraperAPI JSON data to the database for future analysis.
    Handles existing records by updating them when appropriate.
    
    Args:
        asin: Amazon Standard Identification Number
        panel_id: UUID of the created panel (None for failed scrapes)
        raw_response: Raw JSON response from ScraperAPI
        metadata: Processing metadata (timing, size, etc.)
        logger: Logger instance for structured logging
    """
    try:
        client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        
        # Check if raw data already exists for this ASIN
        existing_result = client.table('raw_scraper_data').select('panel_id, created_at').eq('asin', asin).execute()
        
        if existing_result.data:
            existing_record = existing_result.data[0]
            existing_panel_id = existing_record.get('panel_id')
            existing_created_at = existing_record.get('created_at')
            
            # If we have a successful panel_id and existing record has NULL panel_id, update it
            if panel_id and existing_panel_id is None:
                logger.log_script_event("INFO", f"Updating existing raw data for ASIN {asin} with panel_id {panel_id}")
                
                # Calculate response size
                response_size = len(json.dumps(raw_response).encode('utf-8'))
                
                # Update existing record with panel_id
                update_data = {
                    'panel_id': panel_id,
                    'scraper_response': raw_response,
                    'scraper_version': metadata.get('scraper_version', 'v1'),
                    'response_size_bytes': response_size,
                    'processing_metadata': metadata
                }
                
                result = client.table('raw_scraper_data').update(update_data).eq('asin', asin).execute()
                
                if result.data:
                    logger.log_script_event("INFO", f"✓ Updated raw data for ASIN {asin}")
                else:
                    logger.log_script_event("ERROR", f"Failed to update raw data for ASIN {asin}")
                return
                
            # If existing record already has a panel_id, skip saving (avoid duplicates)
            elif existing_panel_id:
                logger.log_script_event("INFO", f"Raw data already exists for ASIN {asin} with panel_id {existing_panel_id}, skipping")
                return
                
            # If both are None (failed scrapes), skip saving duplicate failure data
            else:
                logger.log_script_event("INFO", f"Raw data already exists for failed ASIN {asin}, skipping duplicate")
                return
        
        # No existing record, proceed with insertion
        logger.log_script_event("INFO", f"Saving new raw data for ASIN {asin}")
        
        # Calculate response size
        response_size = len(json.dumps(raw_response).encode('utf-8'))
        
        # Prepare data for insertion
        raw_data = {
            'asin': asin,
            'panel_id': panel_id,  # Can be None for failed scrapes
            'scraper_response': raw_response,
            'scraper_version': metadata.get('scraper_version', 'v1'),
            'response_size_bytes': response_size,
            'processing_metadata': metadata
        }
        
        # Insert into raw_scraper_data table
        result = client.table('raw_scraper_data').insert(raw_data).execute()
        
        if result.data:
            logger.log_script_event("INFO", f"✓ Saved raw JSON data for ASIN {asin} ({response_size} bytes)")
        else:
            logger.log_script_event("ERROR", f"Failed to save raw JSON data for ASIN {asin}")
            
    except Exception as e:
        logger.log_script_event("ERROR", f"Error saving raw JSON data for ASIN {asin}: {e}")


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
            'created_by': 'ingest_staged_asins'
        }).execute()
        
        return result.data[0]['id'] if result.data else None
        
    except Exception as e:
        print(f"Warning: Failed to log filtered ASIN to database: {e}")
        return None


async def check_recent_raw_data(asin: str, hours_threshold: int = 24) -> Optional[Dict]:
    """
    Check if we have recent raw response data for an ASIN.
    
    Args:
        asin: Amazon Standard Identification Number
        hours_threshold: Maximum age in hours for data to be considered recent
        
    Returns:
        Dictionary with raw data if recent, None otherwise
    """
    try:
        from datetime import datetime, timedelta, timezone
        client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        
        # Calculate timestamp threshold in Python
        threshold_time = datetime.now(timezone.utc) - timedelta(hours=hours_threshold)
        threshold_iso = threshold_time.isoformat()
        
        # Query for recent raw data (within threshold hours)
        result = client.table('raw_scraper_data').select('*').eq('asin', asin).gte(
            'created_at', 
            threshold_iso
        ).order('created_at', desc=True).limit(1).execute()
        
        if result.data:
            raw_data = result.data[0]
            print(f"Found recent raw data for ASIN {asin} (created: {raw_data.get('created_at')})")
            return raw_data
        else:
            print(f"No recent raw data found for ASIN {asin} (within {hours_threshold} hours)")
            return None
            
    except Exception as e:
        print(f"Error checking recent raw data for ASIN {asin}: {str(e)}")
        return None


async def ingest_single_asin(
    asin: str,
    scraper: ScraperAPIClient,
    db: SolarPanelDB,
    asin_manager: ASINManager,
    retry_handler: RetryHandler,
    logger
) -> bool:
    """
    Ingest a single ASIN: fetch details and store in database.
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Check for duplicates BEFORE making API calls to save credits
        existing_panel = await db.get_panel_by_asin(asin)
        
        if existing_panel:
            logger.log_script_event(
                "INFO",
                f"ASIN {asin} already exists in database. Skipping API call to save credits."
            )
            await asin_manager.mark_asin_failed(asin, "Already exists in database", is_permanent=True)
            return False
        
        # Check for recent raw data before making API calls
        logger.log_script_event("INFO", f"Checking for recent raw data for ASIN: {asin}")
        recent_raw_data = await check_recent_raw_data(asin, hours_threshold=24)
        
        if recent_raw_data:
            # Use existing raw data instead of making API call
            logger.log_script_event(
                "INFO", 
                f"Using existing raw data for ASIN {asin} (saved within 24 hours). Skipping API call."
            )
            
            # Reconstruct the product_data format from stored raw data
            raw_response = recent_raw_data.get('raw_response', {})
            metadata = recent_raw_data.get('processing_metadata', {})
            
            # Try to parse the stored raw data
            from scripts.scraper import ScraperAPIParser
            parser = ScraperAPIParser()
            parsed_data = parser.parse_product_data(raw_response)
            
            if parsed_data:
                # Successfully parsed stored data
                product_data = {
                    'parsed_data': parsed_data,
                    'raw_response': raw_response,
                    'metadata': metadata
                }
                logger.log_script_event("INFO", f"Successfully parsed stored raw data for ASIN: {asin}")
            else:
                # Parsing failed on stored data
                product_data = {
                    'parsed_data': None,
                    'raw_response': raw_response,
                    'metadata': metadata
                }
                logger.log_script_event("WARNING", f"Failed to parse stored raw data for ASIN: {asin}")
        else:
            # No recent data found, proceed with API call
            logger.log_script_event("INFO", f"No recent raw data found for ASIN: {asin}. Making API call.")
            
            # Fetch product data with retry logic
            logger.log_script_event("INFO", f"Fetching product details for ASIN: {asin}")
            
            try:
                product_data = await retry_handler.execute_with_retry(
                    scraper.fetch_product,
                    asin,
                    service_name="scraperapi"
                )
            except ScraperAPIForbiddenError as e:
                # 403 Forbidden error - stop processing and leave ASIN as pending
                logger.log_script_event("CRITICAL", f"ScraperAPI 403 Forbidden error: {str(e)}")
                logger.log_script_event("CRITICAL", "Stopping processing due to API access issues. ASINs will remain pending.")
                logger.log_script_event("CRITICAL", "Please check ScraperAPI credentials and rate limits.")
                # Don't mark as failed - leave as pending for retry later
                return False
            except Exception as e:
                error_msg = f"Exception during product fetch for ASIN {asin}: {str(e)}"
                logger.log_script_event("ERROR", error_msg)
                await asin_manager.mark_asin_failed(asin, error_msg, is_permanent=True)
                return False
        
        if not product_data:
            # Check if this is a parsing failure by looking at recent logs
            error_msg = f"Failed to fetch product data for ASIN: {asin}"
            logger.log_script_event("ERROR", error_msg)
            
            # Enhanced logging for debugging
            logger.log_script_event("ERROR", f"Product data was None for ASIN: {asin}")
            logger.log_script_event("ERROR", f"This typically indicates a parsing failure in the scraper")
            
            await asin_manager.mark_asin_failed(asin, error_msg, is_permanent=True)
            return False
        
        # Extract parsed data and raw response from the new format
        parsed_data = product_data.get('parsed_data')
        raw_response = product_data.get('raw_response')
        metadata = product_data.get('metadata', {})
        
        if not parsed_data:
            # Parsing failed, but we still have raw data to save
            error_msg = f"Failed to parse product data for ASIN: {asin}"
            logger.log_script_event("ERROR", error_msg)
            
            # Save raw data for failure analysis
            if raw_response:
                logger.log_script_event("INFO", f"Saving raw response data for failed ASIN: {asin}")
                await save_raw_scraper_data(asin, None, raw_response, metadata, logger)
            
            await asin_manager.mark_asin_failed(asin, error_msg, is_permanent=True)
            return False
        
        # Extract parsing failures from parsed data and add to metadata
        parsing_failures = parsed_data.get('parsing_failures', [])
        if parsing_failures:
            metadata['parsing_failures'] = parsing_failures
            logger.log_script_event("INFO", f"ASIN {asin} had parsing failures: {', '.join(parsing_failures)}")
        
        # Apply wattage filtering
        wattage = parsed_data.get('wattage')
        if wattage is not None and wattage < 30:
            filter_reason = f"wattage_too_low_{wattage}W"
            logger.log_script_event("INFO", f"Filtering ASIN {asin}: {filter_reason}")
            
            # Log filtered ASIN to database
            await log_filtered_asin(
                asin=asin,
                filter_stage='ingest',
                filter_reason=filter_reason,
                product_name=parsed_data.get('name', ''),
                product_url=parsed_data.get('web_url', ''),
                wattage=wattage,
                confidence=0.95
            )
            
            # Save raw data for filtered ASINs too (for analysis)
            if raw_response:
                logger.log_script_event("INFO", f"Saving raw response data for filtered ASIN: {asin}")
                # Update metadata to indicate filtering reason
                metadata['filtered'] = True
                metadata['filter_reason'] = filter_reason
                await save_raw_scraper_data(asin, None, raw_response, metadata, logger)
            
            # Mark as permanently failed with filter reason (filtering criteria won't change)
            await asin_manager.mark_asin_failed(asin, f"Filtered: {filter_reason}", is_permanent=True)
            return False
        
        # Add ASIN to parsed data
        parsed_data['asin'] = asin
        
        # Insert into database
        panel_id = await db.add_new_panel(parsed_data)
        
        if panel_id:
            logger.log_script_event(
                "INFO",
                f"✓ Successfully ingested {parsed_data['name'][:60]}... (panel_id: {panel_id})"
            )
            
            # Mark as completed
            await asin_manager.mark_asin_completed(asin, panel_id)
            
            # Save raw JSON data for future analysis
            await save_raw_scraper_data(asin, panel_id, raw_response, metadata, logger)
            
            # Track scraper usage
            await db.track_scraper_usage(
                script_name='ingest_staged_asins',
                asin=asin,
                url=f"https://www.amazon.com/dp/{asin}",
                success=True
            )
            
            return True
        else:
            error_msg = "Failed to insert panel into database"
            logger.log_script_event("ERROR", f"{error_msg}: {parsed_data['name'][:60]}")
            await asin_manager.mark_asin_failed(asin, error_msg, is_permanent=True)
            return False
            
    except Exception as e:
        error_msg = f"Error processing ASIN {asin}: {str(e)}"
        logger.log_script_event("ERROR", error_msg)
        
        # Mark as permanently failed (general exceptions are unlikely to succeed on retry)
        await asin_manager.mark_asin_failed(asin, str(e), is_permanent=True)
        
        # Track failed scraper usage
        await db.track_scraper_usage(
            script_name='ingest_staged_asins',
            asin=asin,
            url=f"https://www.amazon.com/dp/{asin}",
            success=False,
            error_message=str(e)
        )
        
        return False


async def main():
    parser = argparse.ArgumentParser(
        description='Process ASINs in staging queue and fetch product details',
        epilog='Example: python ingest_staged_asins.py --batch-size 10 --delay 2'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=10,
        help='Number of ASINs to process (default: 10)'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=2.0,
        help='Delay between requests in seconds (default: 2.0)'
    )
    parser.add_argument(
        '--priority-only',
        action='store_true',
        help='Only process high-priority ASINs (priority > 0)'
    )
    parser.add_argument(
        '--max-retries',
        type=int,
        default=3,
        help='Maximum retry attempts per ASIN (default: 3)'
    )
    parser.add_argument(
        '--verbose',
        '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--retry-failed',
        action='store_true',
        help='Retry previously failed ASINs'
    )
    parser.add_argument(
        '--stats-only',
        action='store_true',
        help='Show staging stats and exit (no ingestion)'
    )
    parser.add_argument(
        '--asin',
        type=str,
        help='Process a specific ASIN (ignores status and batch size)'
    )
    
    args = parser.parse_args()
    
    # Use context manager for logging
    with ScriptExecutionContext('ingest_staged_asins', 'DEBUG' if args.verbose else 'INFO') as (logger, error_handler):
        
        # Initialize services
        scraper = ScraperAPIClient(script_logger=logger)
        db = SolarPanelDB()
        asin_manager = ASINManager()
        
        # Setup retry handler
        retry_config = RetryConfig(max_retries=args.max_retries, base_delay=2.0)
        retry_handler = RetryHandler(retry_config, logger)
        
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
            
            # Show detailed breakdown if verbose
            if args.verbose:
                print("\n" + "=" * 60)
                print("DETAILED BREAKDOWN")
                print("=" * 60)
                
                # Get pending ASINs with details
                pending_asins = await asin_manager.get_pending_asins(limit=50)
                if pending_asins:
                    print(f"\nPending ASINs (showing up to 50):")
                    for i, asin_info in enumerate(pending_asins[:20], 1):  # Show first 20
                        asin = asin_info['asin']
                        source = asin_info.get('source', 'unknown')
                        keyword = asin_info.get('source_keyword', 'N/A')
                        priority = asin_info.get('priority', 0)
                        created_at = asin_info.get('created_at', 'N/A')
                        
                        print(f"  {i:2d}. {asin} | {source} | {keyword} | Priority: {priority}")
                        if created_at != 'N/A':
                            # Format timestamp for readability
                            try:
                                from datetime import datetime
                                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                                formatted_time = dt.strftime('%Y-%m-%d %H:%M')
                                print(f"      Created: {formatted_time}")
                            except:
                                print(f"      Created: {created_at}")
                    
                    if len(pending_asins) > 20:
                        print(f"  ... and {len(pending_asins) - 20} more")
                
                # Get failed ASINs with details
                try:
                    # Query failed ASINs directly from database
                    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
                    failed_result = client.table('asin_staging').select('*').eq('status', 'failed').order('created_at', desc=True).limit(10).execute()
                    
                    if failed_result.data:
                        print(f"\nRecent Failed ASINs (last 10):")
                        for i, asin_info in enumerate(failed_result.data, 1):
                            asin = asin_info['asin']
                            source = asin_info.get('source', 'unknown')
                            keyword = asin_info.get('source_keyword', 'N/A')
                            error_msg = asin_info.get('error_message', 'No error message')
                            failed_at = asin_info.get('updated_at', asin_info.get('created_at', 'N/A'))
                            
                            print(f"  {i:2d}. {asin} | {source} | {keyword}")
                            print(f"      Error: {error_msg[:60]}{'...' if len(error_msg) > 60 else ''}")
                            if failed_at != 'N/A':
                                try:
                                    from datetime import datetime
                                    dt = datetime.fromisoformat(failed_at.replace('Z', '+00:00'))
                                    formatted_time = dt.strftime('%Y-%m-%d %H:%M')
                                    print(f"      Failed: {formatted_time}")
                                except:
                                    print(f"      Failed: {failed_at}")
                except Exception as e:
                    print(f"\nCould not fetch failed ASIN details: {e}")
                
                # Show source breakdown
                try:
                    source_result = client.table('asin_staging').select('source').execute()
                    if source_result.data:
                        sources = {}
                        for item in source_result.data:
                            source = item.get('source', 'unknown')
                            sources[source] = sources.get(source, 0) + 1
                        
                        print(f"\nSource Breakdown:")
                        for source, count in sorted(sources.items(), key=lambda x: x[1], reverse=True):
                            print(f"  {source}: {count}")
                except Exception as e:
                    print(f"\nCould not fetch source breakdown: {e}")
                
                print("=" * 60)
            
            return 0
        
        # Handle specific ASIN processing
        if args.asin:
            logger.log_script_event("INFO", f"Processing specific ASIN: {args.asin}")
            
            # Get ASIN details from database
            try:
                client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
                asin_result = client.table('asin_staging').select('*').eq('asin', args.asin).execute()
                
                if not asin_result.data:
                    print(f"ASIN {args.asin} not found in staging table")
                    return 1
                
                asin_info = asin_result.data[0]
                print(f"\nProcessing ASIN: {args.asin}")
                print(f"  Current Status: {asin_info.get('status', 'unknown')}")
                print(f"  Source: {asin_info.get('source', 'unknown')}")
                print(f"  Keyword: {asin_info.get('source_keyword', 'N/A')}")
                print(f"  Attempts: {asin_info.get('attempts', 0)}/{asin_info.get('max_attempts', 3)}")
                print(f"  Error: {asin_info.get('error_message', 'None')}")
                print("=" * 60)
                
                # Process the specific ASIN
                success = await ingest_single_asin(
                    asin=args.asin,
                    scraper=scraper,
                    db=db,
                    asin_manager=asin_manager,
                    retry_handler=retry_handler,
                    logger=logger
                )
                
                if success:
                    print(f"\n✓ Successfully processed ASIN: {args.asin}")
                else:
                    print(f"\n✗ Failed to process ASIN: {args.asin}")
                
                return 0 if success else 1
                
            except Exception as e:
                logger.log_script_event("ERROR", f"Error processing specific ASIN {args.asin}: {e}")
                return 1
        
        # Retry failed ASINs if requested
        if args.retry_failed:
            logger.log_script_event("INFO", "Retrying failed ASINs...")
            retried = await asin_manager.retry_failed_asins(limit=args.batch_size)
            print(f"✓ Reset {retried} failed ASINs to pending for retry")
            
            if retried == 0:
                print("No failed ASINs to retry")
                return 0
        
        logger.log_script_event("INFO", f"Starting ingestion (batch size: {args.batch_size})")
        
        # Get pending ASINs
        pending_asins = await asin_manager.get_pending_asins(
            limit=args.batch_size,
            priority_only=args.priority_only
        )
        
        if not pending_asins:
            print("\n✓ No pending ASINs in staging queue")
            print("   Run search_solar_panels.py to discover new products")
            return 0
        
        print(f"\nProcessing {len(pending_asins)} ASIN(s)...")
        
        # Mark all ASINs in batch as processing immediately to prevent race conditions
        asin_list = [asin_info['asin'] for asin_info in pending_asins]
        logger.log_script_event("INFO", f"Marking {len(asin_list)} ASINs as processing to prevent race conditions")
        
        # Mark all ASINs as processing in a single batch operation
        await asin_manager.mark_batch_processing(asin_list)
        
        # Track results
        results = {
            'total': len(pending_asins),
            'successful': 0,
            'failed': 0,
            'asins_failed': []
        }
        
        try:
            # Process each ASIN
            for i, staged_asin in enumerate(pending_asins):
                asin = staged_asin['asin']
                source = staged_asin.get('source', 'unknown')
                keyword = staged_asin.get('source_keyword', 'N/A')
                
                print(f"\n[{i+1}/{len(pending_asins)}] Processing ASIN: {asin}")
                print(f"    Source: {source} (keyword: {keyword})")
                
                # Ingest the ASIN
                success = await ingest_single_asin(
                    asin=asin,
                    scraper=scraper,
                    db=db,
                    asin_manager=asin_manager,
                    retry_handler=retry_handler,
                    logger=logger
                )
                
                if success:
                    results['successful'] += 1
                    print(f"    ✓ Success!")
                else:
                    results['failed'] += 1
                    results['asins_failed'].append(asin)
                    print(f"    ✗ Failed")
                
                # Add delay between requests (except for last one)
                if i < len(pending_asins) - 1:
                    logger.log_script_event("DEBUG", f"Waiting {args.delay}s before next request...")
                    await asyncio.sleep(args.delay)
            
            # Display summary
            print("\n" + "=" * 60)
            print("INGESTION COMPLETE - SUMMARY")
            print("=" * 60)
            print(f"Total Processed: {results['total']}")
            print(f"Successful: {results['successful']}")
            print(f"Failed: {results['failed']}")
            
            if results['asins_failed']:
                print(f"\nFailed ASINs: {', '.join(results['asins_failed'])}")
            
            print("=" * 60)
            
            # Get updated staging stats
            stats = await asin_manager.get_staging_stats()
            print(f"\nStaging Queue Status:")
            print(f"  Pending: {stats.get('pending', 0)}")
            print(f"  Completed: {stats.get('completed', 0)}")
            print(f"  Failed: {stats.get('failed', 0)}")
            
            if stats.get('pending', 0) > 0:
                print(f"\n💡 Run again to process more ASINs:")
                print(f"   python scripts/ingest_staged_asins.py --batch-size {args.batch_size}")
            
            logger.log_script_event(
                "INFO",
                f"Ingestion completed: {results['successful']} successful, {results['failed']} failed"
            )
            
            return 0 if results['failed'] == 0 else 1
            
        except Exception as e:
            error_handler.handle_error(e, "Main execution", critical=True)
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)

