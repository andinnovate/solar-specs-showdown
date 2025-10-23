#!/usr/bin/env python3
"""
Report on filtered ASINs to monitor filtering effectiveness.

Shows statistics about what was filtered and why.
"""

import argparse
import sys
import os
from datetime import datetime, timedelta

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import config
from supabase import create_client


def format_number(num):
    """Format number with commas"""
    return f"{num:,}"


def get_filtered_stats(client, days=7):
    """Get filtering statistics for the last N days"""
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Get overall stats
    result = client.table('filtered_asins').select('*').gte('created_at', cutoff_date.isoformat()).execute()
    all_filtered = result.data
    
    # Get stats by stage
    search_filtered = [f for f in all_filtered if f['filter_stage'] == 'search']
    ingest_filtered = [f for f in all_filtered if f['filter_stage'] == 'ingest']
    
    # Get stats by reason
    reasons = {}
    for item in all_filtered:
        reason = item['filter_reason']
        reasons[reason] = reasons.get(reason, 0) + 1
    
    return {
        'total': len(all_filtered),
        'search_stage': len(search_filtered),
        'ingest_stage': len(ingest_filtered),
        'reasons': reasons,
        'days': days
    }


def print_summary(stats):
    """Print summary statistics"""
    print("=" * 60)
    print("FILTERED ASINS REPORT")
    print("=" * 60)
    print(f"Period: Last {stats['days']} days")
    print(f"Total Filtered: {format_number(stats['total'])}")
    print()
    
    print("By Stage:")
    print(f"  Search Stage: {format_number(stats['search_stage'])}")
    print(f"  Ingest Stage: {format_number(stats['ingest_stage'])}")
    print()
    
    print("By Reason:")
    for reason, count in sorted(stats['reasons'].items(), key=lambda x: x[1], reverse=True):
        percentage = (count / stats['total'] * 100) if stats['total'] > 0 else 0
        print(f"  {reason}: {format_number(count)} ({percentage:.1f}%)")
    print()


def print_recent_filtered(client, limit=20):
    """Print recent filtered ASINs"""
    result = client.table('filtered_asins').select('*').order('created_at', desc=True).limit(limit).execute()
    
    print("=" * 60)
    print(f"RECENT FILTERED ASINS (Last {limit})")
    print("=" * 60)
    
    for item in result.data:
        created_at = item['created_at'][:19]  # Remove timezone info
        print(f"{item['asin']} | {item['filter_stage']} | {item['filter_reason']} | {created_at}")
        if item['product_name']:
            name = item['product_name'][:60] + "..." if len(item['product_name']) > 60 else item['product_name']
            print(f"  {name}")
        print()


def print_reason_details(client, reason, limit=10):
    """Print details for a specific filter reason"""
    result = client.table('filtered_asins').select('*').eq('filter_reason', reason).order('created_at', desc=True).limit(limit).execute()
    
    print("=" * 60)
    print(f"FILTER REASON: {reason.upper()}")
    print("=" * 60)
    
    for item in result.data:
        created_at = item['created_at'][:19]
        print(f"ASIN: {item['asin']}")
        print(f"Stage: {item['filter_stage']}")
        print(f"Date: {created_at}")
        if item['wattage']:
            print(f"Wattage: {item['wattage']}W")
        if item['product_name']:
            print(f"Product: {item['product_name']}")
        print()


def main():
    parser = argparse.ArgumentParser(description='Report on filtered ASINs')
    parser.add_argument('--summary', action='store_true', help='Show summary statistics')
    parser.add_argument('--recent', type=int, metavar='N', help='Show N most recent filtered ASINs')
    parser.add_argument('--reason', type=str, help='Show details for specific filter reason')
    parser.add_argument('--days', type=int, default=7, help='Number of days to look back (default: 7)')
    
    args = parser.parse_args()
    
    # Initialize Supabase client
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    
    try:
        if args.summary or (not args.recent and not args.reason):
            # Default: show summary
            stats = get_filtered_stats(client, args.days)
            print_summary(stats)
        
        if args.recent:
            print_recent_filtered(client, args.recent)
        
        if args.reason:
            print_reason_details(client, args.reason)
            
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = main()
    exit(exit_code)
