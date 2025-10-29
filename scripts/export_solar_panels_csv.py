#!/usr/bin/env python3
"""
CSV Export Script for Solar Panels Database

This script exports the solar_panels table to CSV format for database migration
or backup purposes. It includes all columns and supports limiting the number of rows.

Usage:
    python scripts/export_solar_panels_csv.py --limit 100 --output solar_panels_export.csv
    python scripts/export_solar_panels_csv.py --all --output full_export.csv
    python scripts/export_solar_panels_csv.py --limit 5  # Test with 5 rows
"""

import sys
import os
import csv
import argparse
import logging
from datetime import datetime
from typing import List, Dict, Optional
import json

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import config
from scripts.database import SolarPanelDB
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SolarPanelCSVExporter:
    """Export solar panels data to CSV format"""
    
    def __init__(self):
        """Initialize exporter with database connection"""
        self.client: Client = create_client(
            config.SUPABASE_URL,
            config.SUPABASE_SERVICE_KEY
        )
        self.db = SolarPanelDB()
    
    def get_all_columns(self) -> List[str]:
        """Get all column names from the solar_panels table"""
        return [
            'id',
            'asin',
            'name',
            'manufacturer',
            'length_cm',
            'width_cm',
            'weight_kg',
            'wattage',
            'voltage',
            'price_usd',
            'description',
            'image_url',
            'web_url',
            'piece_count',
            'missing_fields',
            'pending_flags',
            'created_at',
            'updated_at'
        ]
    
    async def export_to_csv(
        self, 
        output_file: str, 
        limit: Optional[int] = None,
        include_headers: bool = True
    ) -> Dict[str, any]:
        """
        Export solar panels data to CSV file
        
        Args:
            output_file: Path to output CSV file
            limit: Maximum number of rows to export (None for all)
            include_headers: Whether to include column headers
            
        Returns:
            Dictionary with export statistics
        """
        try:
            logger.info(f"Starting CSV export to {output_file}")
            if limit:
                logger.info(f"Limiting export to {limit} rows")
            
            # Build query
            query = self.client.table('solar_panels').select('*')
            
            if limit:
                query = query.limit(limit)
            
            # Execute query
            logger.info("Fetching data from database...")
            result = query.execute()
            
            if not result.data:
                logger.warning("No data found in solar_panels table")
                return {
                    'success': False,
                    'rows_exported': 0,
                    'error': 'No data found'
                }
            
            logger.info(f"Retrieved {len(result.data)} rows from database")
            
            # Get column names
            columns = self.get_all_columns()
            
            # Write CSV file
            logger.info(f"Writing data to {output_file}...")
            with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=columns)
                
                if include_headers:
                    writer.writeheader()
                
                rows_written = 0
                for row in result.data:
                    # Convert JSON fields to strings for CSV compatibility
                    processed_row = {}
                    for col in columns:
                        value = row.get(col)
                        if col == 'missing_fields' and value is not None:
                            # Convert JSON to string
                            if isinstance(value, (list, dict)):
                                processed_row[col] = json.dumps(value)
                            else:
                                processed_row[col] = str(value)
                        else:
                            processed_row[col] = value
                    
                    writer.writerow(processed_row)
                    rows_written += 1
            
            logger.info(f"Successfully exported {rows_written} rows to {output_file}")
            
            return {
                'success': True,
                'rows_exported': rows_written,
                'output_file': output_file,
                'columns': columns
            }
            
        except Exception as e:
            logger.error(f"Error during CSV export: {e}")
            return {
                'success': False,
                'rows_exported': 0,
                'error': str(e)
            }
    
    async def get_table_stats(self) -> Dict[str, any]:
        """Get statistics about the solar_panels table"""
        try:
            # Get total count
            count_result = self.client.table('solar_panels').select('id', count='exact').execute()
            total_count = count_result.count
            
            # Get count of panels with missing data
            missing_data_result = self.client.table('solar_panels').select('id', count='exact').not_.is_('missing_fields', 'null').execute()
            missing_data_count = missing_data_result.count
            
            # Get count of panels with pending flags
            flagged_result = self.client.table('solar_panels').select('id', count='exact').gt('pending_flags', 0).execute()
            flagged_count = flagged_result.count
            
            return {
                'total_panels': total_count,
                'panels_with_missing_data': missing_data_count,
                'panels_with_pending_flags': flagged_count,
                'columns': self.get_all_columns()
            }
            
        except Exception as e:
            logger.error(f"Error getting table stats: {e}")
            return {'error': str(e)}


async def main():
    """Main function to handle command line arguments and execute export"""
    parser = argparse.ArgumentParser(
        description='Export solar panels data to CSV format',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Export first 10 rows for testing
  python scripts/export_solar_panels_csv.py --limit 10 --output test_export.csv
  
  # Export all data
  python scripts/export_solar_panels_csv.py --all --output full_export.csv
  
  # Export with custom filename (includes timestamp)
  python scripts/export_solar_panels_csv.py --limit 100 --output solar_panels_$(date +%Y%m%d_%H%M%S).csv
  
  # Show table statistics
  python scripts/export_solar_panels_csv.py --stats
        """
    )
    
    parser.add_argument(
        '--limit', 
        type=int, 
        help='Maximum number of rows to export (for testing)'
    )
    
    parser.add_argument(
        '--all', 
        action='store_true', 
        help='Export all rows (overrides --limit)'
    )
    
    parser.add_argument(
        '--output', 
        type=str, 
        help='Output CSV file path (default: auto-generated with timestamp)'
    )
    
    parser.add_argument(
        '--stats', 
        action='store_true', 
        help='Show table statistics and exit'
    )
    
    parser.add_argument(
        '--verbose', 
        action='store_true', 
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize exporter
    exporter = SolarPanelCSVExporter()
    
    # Handle stats request
    if args.stats:
        logger.info("Fetching table statistics...")
        stats = await exporter.get_table_stats()
        
        if 'error' in stats:
            logger.error(f"Failed to get stats: {stats['error']}")
            sys.exit(1)
        
        print("\n" + "="*50)
        print("SOLAR PANELS TABLE STATISTICS")
        print("="*50)
        print(f"Total panels: {stats['total_panels']:,}")
        print(f"Panels with missing data: {stats['panels_with_missing_data']:,}")
        print(f"Panels with pending flags: {stats['panels_with_pending_flags']:,}")
        print(f"Total columns: {len(stats['columns'])}")
        print("\nColumns:")
        for i, col in enumerate(stats['columns'], 1):
            print(f"  {i:2d}. {col}")
        print("="*50)
        return
    
    # Validate arguments
    if not args.all and not args.limit:
        logger.error("Must specify either --limit or --all")
        parser.print_help()
        sys.exit(1)
    
    # Determine output file
    if args.output:
        output_file = args.output
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        limit_suffix = f"_limit{args.limit}" if args.limit else "_all"
        output_file = f"solar_panels_export{limit_suffix}_{timestamp}.csv"
    
    # Determine limit
    limit = None if args.all else args.limit
    
    # Execute export
    logger.info("Starting solar panels CSV export...")
    result = await exporter.export_to_csv(output_file, limit)
    
    if result['success']:
        print(f"\n✅ Export completed successfully!")
        print(f"📁 Output file: {result['output_file']}")
        print(f"📊 Rows exported: {result['rows_exported']:,}")
        print(f"📋 Columns: {len(result['columns'])}")
        
        # Show file size
        try:
            file_size = os.path.getsize(output_file)
            if file_size > 1024 * 1024:
                size_str = f"{file_size / (1024 * 1024):.1f} MB"
            elif file_size > 1024:
                size_str = f"{file_size / 1024:.1f} KB"
            else:
                size_str = f"{file_size} bytes"
            print(f"💾 File size: {size_str}")
        except Exception as e:
            logger.warning(f"Could not determine file size: {e}")
        
        print(f"\n🚀 Ready for import! You can now upload this CSV file to your target database.")
        
    else:
        logger.error(f"Export failed: {result.get('error', 'Unknown error')}")
        sys.exit(1)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
