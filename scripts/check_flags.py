#!/usr/bin/env python3
"""
Check and process flagged solar panels.
Simple script to review panels that need attention.
"""

import asyncio
import argparse
import logging
import sys
import os
from typing import List, Dict

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.database import SolarPanelDB
from scripts.config import config
from scripts.utils import setup_logging, send_notification
from scripts.logging_config import ScriptExecutionContext, log_script_start, log_script_end
from scripts.error_handling import RetryConfig, RetryHandler, setup_error_recovery

async def review_flagged_panels(db: SolarPanelDB, auto_resolve: bool = False) -> Dict:
    """Review flagged panels and optionally auto-resolve simple cases"""
    
    # Get all panels that need review
    flagged_panels = await db.get_flagged_panels('needs_review')
    
    if not flagged_panels:
        logging.info("No flagged panels found")
        return {'reviewed': 0, 'resolved': 0, 'dismissed': 0}
    
    logging.info(f"Found {len(flagged_panels)} flagged panels to review")
    
    reviewed = 0
    resolved = 0
    dismissed = 0
    
    for flag in flagged_panels:
        reviewed += 1
        panel = flag.get('solar_panels', {})
        
        logging.info(f"Reviewing flag {flag['id']} for panel {panel.get('name', 'Unknown')}")
        logging.info(f"Reason: {flag['reason']}")
        logging.info(f"Details: {flag.get('details', 'None')}")
        
        # Simple auto-resolution logic
        if auto_resolve:
            action = determine_action(flag, panel)
            if action:
                success = await db.resolve_flag(flag['id'], action, f"Auto-resolved: {action}")
                if success:
                    if action == 'resolve':
                        resolved += 1
                    else:
                        dismissed += 1
                    logging.info(f"Auto-{action}d flag {flag['id']}")
                else:
                    logging.error(f"Failed to {action} flag {flag['id']}")
        else:
            # Manual review mode - just log the details
            logging.info(f"Flag {flag['id']} requires manual review")
    
    return {
        'reviewed': reviewed,
        'resolved': resolved,
        'dismissed': dismissed
    }

def determine_action(flag: Dict, panel: Dict) -> str:
    """Determine if a flag can be auto-resolved"""
    reason = flag.get('reason', '').lower()
    details = flag.get('details', '').lower()
    
    # Auto-resolve obvious false positives
    if 'test' in reason or 'test' in details:
        return 'dismiss'
    
    # Auto-resolve if panel has been updated recently
    if 'outdated' in reason and panel.get('updated_at'):
        # Could add logic to check if panel was updated after flag was created
        pass
    
    # For now, require manual review for most cases
    return None

async def main():
    parser = argparse.ArgumentParser(description='Check and process flagged solar panels')
    parser.add_argument('--auto-resolve', action='store_true', 
                       help='Automatically resolve simple flags')
    parser.add_argument('--verbose', '-v', action='store_true', 
                       help='Enable verbose logging')
    parser.add_argument('--max-retries', type=int, default=3, 
                       help='Maximum retry attempts for database operations')
    
    args = parser.parse_args()
    
    # Use context manager for automatic logging setup
    with ScriptExecutionContext('check_flags', 'DEBUG' if args.verbose else 'INFO') as (logger, error_handler):
        
        # Setup error recovery and retry handler
        error_recovery = setup_error_recovery(logger)
        retry_config = RetryConfig(max_retries=args.max_retries)
        retry_handler = RetryHandler(retry_config, logger)
        
        # Initialize database
        db = SolarPanelDB()
        
        try:
            logger.log_script_event("INFO", "Starting flagged panel review")
            
            # Review flagged panels with retry logic
            results = await retry_handler.execute_with_retry(
                review_flagged_panels,
                db, args.auto_resolve,
                service_name="database"
            )
            
            # Log results
            logger.log_script_event("INFO", f"Review complete: {results}")
            
            # Send notification if there are unresolved flags
            if results['reviewed'] > 0 and not args.auto_resolve:
                await send_notification(
                    f"Flagged Panel Review: {results['reviewed']} panels need manual review"
                )
            
            logger.log_script_event("INFO", "Flag review completed successfully")
            return 0
            
        except Exception as e:
            error_handler.handle_error(e, "Flag review", critical=True)
            await send_notification(f"Flag review failed: {str(e)}")
            return 1

if __name__ == "__main__":
    asyncio.run(main())
