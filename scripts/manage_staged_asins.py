#!/usr/bin/env python3
"""
Manage staged ASINs in the database.
This script provides functionality to view, filter, and remove staged ASINs
based on various criteria like search string, source, status, etc.
"""

import asyncio
import argparse
import sys
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.logging_config import ScriptExecutionContext
from scripts.database import SolarPanelDB
from scripts.config import config
from supabase import create_client


class StagedASINManager:
    """Manager for staged ASINs with filtering and removal capabilities."""
    
    def __init__(self, logger):
        self.logger = logger
        self.client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    
    async def get_staging_stats(self) -> Dict[str, int]:
        """Get comprehensive staging statistics."""
        try:
            # Get overall stats
            result = self.client.table('asin_staging').select('status').execute()
            
            stats = {
                'total': len(result.data),
                'pending': 0,
                'processing': 0,
                'completed': 0,
                'failed': 0,
                'skipped': 0,
                'duplicate': 0
            }
            
            for item in result.data:
                status = item.get('status', 'unknown')
                if status in stats:
                    stats[status] += 1
            
            return stats
            
        except Exception as e:
            self.logger.log_script_event("ERROR", f"Failed to get staging stats: {e}")
            return {}
    
    async def get_asins_by_criteria(
        self,
        source: Optional[str] = None,
        source_keyword: Optional[str] = None,
        status: Optional[str] = None,
        search_string: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get ASINs matching specific criteria.
        
        Args:
            source: Filter by source type ('search', 'manual', 'competitor', 'csv', 'other')
            source_keyword: Filter by exact source keyword match
            status: Filter by status ('pending', 'processing', 'completed', 'failed', 'skipped', 'duplicate')
            search_string: Filter by partial match in source_keyword (case-insensitive)
            limit: Maximum number of results to return
        """
        try:
            query = self.client.table('asin_staging').select('*')
            
            # Apply filters
            if source:
                query = query.eq('source', source)
            
            if source_keyword:
                query = query.eq('source_keyword', source_keyword)
            
            if status:
                query = query.eq('status', status)
            
            if search_string:
                # Use ilike for case-insensitive partial matching
                query = query.ilike('source_keyword', f'%{search_string}%')
            
            # Order by created_at descending and limit results
            query = query.order('created_at', desc=True).limit(limit)
            
            result = query.execute()
            return result.data or []
            
        except Exception as e:
            self.logger.log_script_event("ERROR", f"Failed to get ASINs by criteria: {e}")
            return []
    
    async def remove_asins_by_criteria(
        self,
        source: Optional[str] = None,
        source_keyword: Optional[str] = None,
        status: Optional[str] = None,
        search_string: Optional[str] = None,
        dry_run: bool = True
    ) -> Dict[str, Any]:
        """
        Remove ASINs matching specific criteria.
        
        Returns:
            Dict with 'removed_count', 'asins_removed', and 'errors'
        """
        try:
            # First, get the ASINs that would be affected
            asins_to_remove = await self.get_asins_by_criteria(
                source=source,
                source_keyword=source_keyword,
                status=status,
                search_string=search_string,
                limit=1000  # Large limit for removal operations
            )
            
            if not asins_to_remove:
                return {
                    'removed_count': 0,
                    'asins_removed': [],
                    'errors': []
                }
            
            if dry_run:
                return {
                    'removed_count': len(asins_to_remove),
                    'asins_removed': [asin['asin'] for asin in asins_to_remove],
                    'errors': [],
                    'dry_run': True
                }
            
            # Build delete query
            delete_query = self.client.table('asin_staging').delete()
            
            # Apply same filters for deletion
            if source:
                delete_query = delete_query.eq('source', source)
            
            if source_keyword:
                delete_query = delete_query.eq('source_keyword', source_keyword)
            
            if status:
                delete_query = delete_query.eq('status', status)
            
            if search_string:
                delete_query = delete_query.ilike('source_keyword', f'%{search_string}%')
            
            # Execute deletion
            result = delete_query.execute()
            
            return {
                'removed_count': len(result.data) if result.data else 0,
                'asins_removed': [asin['asin'] for asin in asins_to_remove],
                'errors': []
            }
            
        except Exception as e:
            error_msg = f"Failed to remove ASINs: {e}"
            self.logger.log_script_event("ERROR", error_msg)
            return {
                'removed_count': 0,
                'asins_removed': [],
                'errors': [error_msg]
            }
    
    async def get_source_breakdown(self) -> Dict[str, int]:
        """Get breakdown of ASINs by source."""
        try:
            result = self.client.table('asin_staging').select('source').execute()
            
            breakdown = {}
            for item in result.data:
                source = item.get('source', 'unknown')
                breakdown[source] = breakdown.get(source, 0) + 1
            
            return breakdown
            
        except Exception as e:
            self.logger.log_script_event("ERROR", f"Failed to get source breakdown: {e}")
            return {}
    
    async def get_keyword_breakdown(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get breakdown of ASINs by source keyword."""
        try:
            result = self.client.table('asin_staging').select('source_keyword').execute()
            
            keyword_counts = {}
            for item in result.data:
                keyword = item.get('source_keyword', 'N/A')
                keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1
            
            # Sort by count and limit results
            sorted_keywords = sorted(
                keyword_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:limit]
            
            return [{'keyword': k, 'count': v} for k, v in sorted_keywords]
            
        except Exception as e:
            self.logger.log_script_event("ERROR", f"Failed to get keyword breakdown: {e}")
            return []
    
    async def get_recent_asins(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recently added ASINs with details."""
        try:
            result = self.client.table('asin_staging').select('*').order('created_at', desc=True).limit(limit).execute()
            return result.data or []
            
        except Exception as e:
            self.logger.log_script_event("ERROR", f"Failed to get recent ASINs: {e}")
            return []


def format_timestamp(timestamp_str: str) -> str:
    """Format timestamp for display."""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return timestamp_str


def print_asins_table(asins: List[Dict[str, Any]], title: str = "ASINs"):
    """Print ASINs in a formatted table."""
    if not asins:
        print(f"\n{title}: None found")
        return
    
    print(f"\n{title} ({len(asins)} found):")
    print("=" * 100)
    print(f"{'ASIN':<12} {'Source':<10} {'Keyword':<25} {'Status':<12} {'Priority':<8} {'Created':<20}")
    print("-" * 100)
    
    for asin_info in asins:
        asin = asin_info.get('asin', 'N/A')
        source = asin_info.get('source', 'N/A')
        keyword = asin_info.get('source_keyword', 'N/A')[:25]
        status = asin_info.get('status', 'N/A')
        priority = asin_info.get('priority', 0)
        created_at = format_timestamp(asin_info.get('created_at', 'N/A'))
        
        print(f"{asin:<12} {source:<10} {keyword:<25} {status:<12} {priority:<8} {created_at:<20}")


def print_section(title: str, data: Dict[str, Any] = None):
    """Print a formatted section"""
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    
    if data:
        for key, value in data.items():
            if value is None or value == '':
                value = 'N/A'
            print(f"{key:<20}: {value}")


async def inspect_asin(asin: str) -> Dict[str, Any]:
    """
    Inspect an ASIN across all database tables
    
    Returns:
        Dictionary with inspection results
    """
    results = {
        'asin': asin,
        'staging_status': None,
        'panel_status': None,
        'raw_data_status': None,
        'staging_details': {},
        'panel_details': {},
        'raw_data_details': {}
    }
    
    # Initialize database connections
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    db = SolarPanelDB()
    
    # 1. Check staging table
    try:
        staging_result = client.table('asin_staging').select('*').eq('asin', asin).execute()
        if staging_result.data:
            staging_info = staging_result.data[0]
            results['staging_status'] = 'exists'
            results['staging_details'] = {
                'Status': staging_info.get('status', 'unknown'),
                'Source': staging_info.get('source', 'unknown'),
                'Keyword': staging_info.get('source_keyword', 'N/A'),
                'Priority': staging_info.get('priority', 0),
                'Attempts': f"{staging_info.get('attempts', 0)}/{staging_info.get('max_attempts', 3)}",
                'Created': format_timestamp(staging_info.get('created_at')),
                'Last Attempt': format_timestamp(staging_info.get('last_attempt_at')),
                'Error Message': staging_info.get('error_message', 'None'),
                'Panel ID': staging_info.get('panel_id', 'None')
            }
        else:
            results['staging_status'] = 'not_found'
    except Exception as e:
        results['staging_status'] = 'error'
        results['staging_details'] = {'Error': str(e)}
    
    # 2. Check panels table
    try:
        panel = await db.get_panel_by_asin(asin)
        if panel:
            results['panel_status'] = 'exists'
            results['panel_details'] = {
                'Panel ID': panel.get('id', 'N/A'),
                'Name': panel.get('name', 'N/A')[:50] + '...' if len(panel.get('name', '')) > 50 else panel.get('name', 'N/A'),
                'Wattage': f"{panel.get('wattage', 'N/A')}W",
                'Voltage': f"{panel.get('voltage', 'N/A')}V",
                'Dimensions': f"{panel.get('length_cm', 'N/A')}x{panel.get('width_cm', 'N/A')}x{panel.get('height_cm', 'N/A')} cm",
                'Weight': f"{panel.get('weight_kg', 'N/A')} kg",
                'Price': f"${panel.get('price_usd', 'N/A')}",
                'Created': format_timestamp(panel.get('created_at')),
                'Updated': format_timestamp(panel.get('updated_at'))
            }
        else:
            results['panel_status'] = 'not_found'
    except Exception as e:
        results['panel_status'] = 'error'
        results['panel_details'] = {'Error': str(e)}
    
    # 3. Check raw scraper data table
    try:
        raw_data_result = client.table('raw_scraper_data').select('*').eq('asin', asin).execute()
        if raw_data_result.data:
            raw_data_info = raw_data_result.data[0]
            results['raw_data_status'] = 'exists'
            results['raw_data_details'] = {
                'Panel ID': raw_data_info.get('panel_id', 'NULL'),
                'Scraper Version': raw_data_info.get('scraper_version', 'N/A'),
                'Response Size': f"{raw_data_info.get('response_size_bytes', 0)} bytes",
                'Created': format_timestamp(raw_data_info.get('created_at')),
                'Parsing Failed': raw_data_info.get('processing_metadata', {}).get('parsing_failed', False),
                'Failure Reason': raw_data_info.get('processing_metadata', {}).get('failure_reason', 'N/A'),
                'Parsing Failures': ', '.join(raw_data_info.get('processing_metadata', {}).get('parsing_failures', [])),
                'Filtered': raw_data_info.get('processing_metadata', {}).get('filtered', False),
                'Filter Reason': raw_data_info.get('processing_metadata', {}).get('filter_reason', 'N/A')
            }
        else:
            results['raw_data_status'] = 'not_found'
    except Exception as e:
        results['raw_data_status'] = 'error'
        results['raw_data_details'] = {'Error': str(e)}
    
    return results


def print_inspection_summary(results: Dict[str, Any]):
    """Print a summary of the ASIN status"""
    asin = results['asin']
    
    print(f"\n{'='*80}")
    print(f"ASIN INSPECTION SUMMARY: {asin}")
    print(f"{'='*80}")
    
    # Summary table
    print(f"{'Location':<20} {'Status':<15} {'Details':<30}")
    print(f"{'-'*65}")
    
    staging_status = results['staging_status']
    if staging_status == 'exists':
        status = results['staging_details'].get('Status', 'unknown')
        details = f"Source: {results['staging_details'].get('Source', 'N/A')}"
    elif staging_status == 'not_found':
        status = 'Not Found'
        details = 'Not in staging table'
    else:
        status = 'Error'
        details = 'Database error'
    
    print(f"{'Staging Table':<20} {status:<15} {details:<30}")
    
    panel_status = results['panel_status']
    if panel_status == 'exists':
        status = 'Exists'
        details = f"Name: {results['panel_details'].get('Name', 'N/A')[:20]}..."
    elif panel_status == 'not_found':
        status = 'Not Found'
        details = 'Not in panels table'
    else:
        status = 'Error'
        details = 'Database error'
    
    print(f"{'Panels Table':<20} {status:<15} {details:<30}")
    
    raw_status = results['raw_data_status']
    if raw_status == 'exists':
        status = 'Exists'
        panel_id = results['raw_data_details'].get('Panel ID', 'NULL')
        details = f"Panel ID: {panel_id}"
    elif raw_status == 'not_found':
        status = 'Not Found'
        details = 'No raw data saved'
    else:
        status = 'Error'
        details = 'Database error'
    
    print(f"{'Raw Data Table':<20} {status:<15} {details:<30}")
    
    # Determine overall status
    staging_exists = results['staging_status'] == 'exists'
    panel_exists = results['panel_status'] == 'exists'
    raw_exists = results['raw_data_status'] == 'exists'
    
    print(f"\n{'='*80}")
    print("OVERALL STATUS:")
    
    if panel_exists:
        print("✓ ASIN is successfully processed and in the panels database")
    elif staging_exists:
        staging_status = results['staging_details'].get('Status', 'unknown')
        if staging_status == 'failed':
            print("✗ ASIN failed processing and is marked as failed in staging")
        elif staging_status == 'pending':
            print("⏳ ASIN is pending processing in staging queue")
        elif staging_status == 'processing':
            print("🔄 ASIN is currently being processed")
        else:
            print(f"? ASIN has unknown status: {staging_status}")
    else:
        print("? ASIN not found in staging or panels database")
    
    if raw_exists:
        print("✓ Raw scraper data is available for analysis")
    else:
        print("⚠ Raw scraper data not found")


async def main():
    parser = argparse.ArgumentParser(
        description='Manage staged ASINs in the database',
        epilog='''
Examples:
  # Show statistics
  python manage_staged_asins.py --stats
  
  # Inspect a specific ASIN
  python manage_staged_asins.py --inspect B0CPLQGGD7
  
  # Remove ASINs from "solar panel test" searches (dry run)
  python manage_staged_asins.py --remove-by-search "solar panel test" --dry-run
  
  # Remove all failed ASINs
  python manage_staged_asins.py --remove-by-status failed --confirm
  
  # Remove all ASINs from manual source
  python manage_staged_asins.py --remove-by-source manual --confirm
        ''',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    # Action arguments
    parser.add_argument(
        '--stats',
        action='store_true',
        help='Show comprehensive staging statistics'
    )
    parser.add_argument(
        '--list',
        action='store_true',
        help='List recent ASINs with details'
    )
    parser.add_argument(
        '--list-limit',
        type=int,
        default=20,
        help='Limit for --list command (default: 20)'
    )
    parser.add_argument(
        '--inspect',
        type=str,
        help='Inspect a specific ASIN across all database tables'
    )
    
    # Filter arguments for viewing
    parser.add_argument(
        '--filter-source',
        choices=['search', 'manual', 'competitor', 'csv', 'other'],
        help='Filter by source type'
    )
    parser.add_argument(
        '--filter-status',
        choices=['pending', 'processing', 'completed', 'failed', 'skipped', 'duplicate'],
        help='Filter by status'
    )
    parser.add_argument(
        '--filter-search',
        type=str,
        help='Filter by partial search string in source_keyword'
    )
    
    # Removal arguments
    parser.add_argument(
        '--remove-by-source',
        choices=['search', 'manual', 'competitor', 'csv', 'other'],
        help='Remove ASINs by source type'
    )
    parser.add_argument(
        '--remove-by-status',
        choices=['pending', 'processing', 'completed', 'failed', 'skipped', 'duplicate'],
        help='Remove ASINs by status'
    )
    parser.add_argument(
        '--remove-by-search',
        type=str,
        help='Remove ASINs by partial search string in source_keyword'
    )
    parser.add_argument(
        '--remove-by-keyword',
        type=str,
        help='Remove ASINs by exact source_keyword match'
    )
    
    # Confirmation arguments
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be removed without actually removing (default for removal operations)'
    )
    parser.add_argument(
        '--confirm',
        action='store_true',
        help='Actually perform the removal (overrides --dry-run)'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Skip confirmation prompts'
    )
    
    # Other arguments
    parser.add_argument(
        '--verbose',
        '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Handle inspection command
    if args.inspect:
        try:
            results = await inspect_asin(args.inspect)
            print_inspection_summary(results)
            
            # Show detailed information
            if results['staging_status'] == 'exists':
                print_section("STAGING TABLE DETAILS", results['staging_details'])
            
            if results['panel_status'] == 'exists':
                print_section("PANELS TABLE DETAILS", results['panel_details'])
            
            if results['raw_data_status'] == 'exists':
                print_section("RAW DATA TABLE DETAILS", results['raw_data_details'])
            
            return 0
        except Exception as e:
            print(f"Error inspecting ASIN {args.inspect}: {str(e)}")
            return 1
    
    # Validate arguments
    removal_args = [args.remove_by_source, args.remove_by_status, args.remove_by_search, args.remove_by_keyword]
    if any(removal_args) and not args.dry_run and not args.confirm:
        print("ERROR: Removal operations require either --dry-run or --confirm")
        return 1
    
    # Use context manager for logging
    with ScriptExecutionContext('manage_staged_asins', 'DEBUG' if args.verbose else 'INFO') as (logger, error_handler):
        
        # Initialize manager
        manager = StagedASINManager(logger)
        
        try:
            # Handle stats command
            if args.stats:
                logger.log_script_event("INFO", "Fetching staging statistics...")
                
                stats = await manager.get_staging_stats()
                source_breakdown = await manager.get_source_breakdown()
                keyword_breakdown = await manager.get_keyword_breakdown(10)
                
                print("\n" + "=" * 60)
                print("STAGING STATISTICS")
                print("=" * 60)
                print(f"Total ASINs: {stats.get('total', 0)}")
                print(f"  Pending: {stats.get('pending', 0)}")
                print(f"  Processing: {stats.get('processing', 0)}")
                print(f"  Completed: {stats.get('completed', 0)}")
                print(f"  Failed: {stats.get('failed', 0)}")
                print(f"  Skipped: {stats.get('skipped', 0)}")
                print(f"  Duplicate: {stats.get('duplicate', 0)}")
                
                print(f"\nSource Breakdown:")
                for source, count in sorted(source_breakdown.items(), key=lambda x: x[1], reverse=True):
                    print(f"  {source}: {count}")
                
                print(f"\nTop Keywords:")
                for item in keyword_breakdown:
                    print(f"  {item['keyword']}: {item['count']}")
                
                print("=" * 60)
                return 0
            
            # Handle list command
            if args.list:
                logger.log_script_event("INFO", f"Fetching recent ASINs (limit: {args.list_limit})...")
                
                # Apply filters if specified
                asins = await manager.get_asins_by_criteria(
                    source=args.filter_source,
                    status=args.filter_status,
                    search_string=args.filter_search,
                    limit=args.list_limit
                )
                
                print_asins_table(asins, f"Recent ASINs (filtered)")
                return 0
            
            # Handle removal operations
            removal_operations = []
            if args.remove_by_source:
                removal_operations.append(f"source='{args.remove_by_source}'")
            if args.remove_by_status:
                removal_operations.append(f"status='{args.remove_by_status}'")
            if args.remove_by_search:
                removal_operations.append(f"source_keyword contains '{args.remove_by_search}'")
            if args.remove_by_keyword:
                removal_operations.append(f"source_keyword='{args.remove_by_keyword}'")
            
            if removal_operations:
                logger.log_script_event("INFO", f"Preparing removal operation: {' AND '.join(removal_operations)}")
                
                # Get ASINs that would be affected
                asins_to_remove = await manager.get_asins_by_criteria(
                    source=args.remove_by_source,
                    source_keyword=args.remove_by_keyword,
                    status=args.remove_by_status,
                    search_string=args.remove_by_search,
                    limit=1000
                )
                
                if not asins_to_remove:
                    print("No ASINs found matching the specified criteria.")
                    return 0
                
                print(f"\nFound {len(asins_to_remove)} ASIN(s) matching criteria:")
                print_asins_table(asins_to_remove[:20], "ASINs to be removed")
                
                if len(asins_to_remove) > 20:
                    print(f"... and {len(asins_to_remove) - 20} more")
                
                # Check if this is a dry run
                if args.dry_run and not args.confirm:
                    print(f"\nDRY RUN: Would remove {len(asins_to_remove)} ASIN(s)")
                    print("Use --confirm to actually perform the removal")
                    return 0
                
                # Confirmation prompt
                if not args.force and not args.dry_run:
                    response = input(f"\nAre you sure you want to remove {len(asins_to_remove)} ASIN(s)? (yes/no): ")
                    if response.lower() not in ['yes', 'y']:
                        print("Operation cancelled.")
                        return 0
                
                # Perform removal
                logger.log_script_event("INFO", f"Removing {len(asins_to_remove)} ASIN(s)...")
                result = await manager.remove_asins_by_criteria(
                    source=args.remove_by_source,
                    source_keyword=args.remove_by_keyword,
                    status=args.remove_by_status,
                    search_string=args.remove_by_search,
                    dry_run=args.dry_run and not args.confirm
                )
                
                if result.get('dry_run'):
                    print(f"\nDRY RUN: Would remove {result['removed_count']} ASIN(s)")
                else:
                    print(f"\n✓ Successfully removed {result['removed_count']} ASIN(s)")
                
                if result.get('errors'):
                    print(f"\nErrors encountered:")
                    for error in result['errors']:
                        print(f"  - {error}")
                
                return 0
            
            # If no specific command, show help
            print("No action specified. Use --help for usage information.")
            return 0
            
        except Exception as e:
            error_handler.handle_error(e, "Main execution", critical=True)
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
