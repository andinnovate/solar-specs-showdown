#!/usr/bin/env python3
"""
Example script demonstrating comprehensive logging and error handling.
This shows how to use the logging and error handling systems in practice.
"""

import asyncio
import argparse
import time
import sys
import os
from typing import Dict, Any

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.logging_config import ScriptExecutionContext, log_script_start, log_script_end
from scripts.error_handling import RetryConfig, RetryHandler, GracefulDegradation, setup_error_recovery
from scripts.database import SolarPanelDB
# from scripts.scraper import AdvancedScraperAPIClient  # Not implemented yet
from scripts.utils import send_notification

async def simulate_database_operation(logger, error_handler, success: bool = True):
    """Simulate a database operation that might fail"""
    if not success:
        raise ConnectionError("Database connection failed")
    
    logger.log_script_event("INFO", "Database operation completed successfully")
    return {"records_processed": 42}

async def simulate_api_request(logger, error_handler, success: bool = True):
    """Simulate an API request that might fail"""
    if not success:
        raise TimeoutError("API request timed out")
    
    logger.log_script_event("INFO", "API request completed successfully")
    return {"products_found": 15}

async def main():
    parser = argparse.ArgumentParser(description='Example script with comprehensive logging')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    parser.add_argument('--simulate-errors', action='store_true', help='Simulate errors for testing')
    parser.add_argument('--max-retries', type=int, default=3, help='Maximum retry attempts')
    
    args = parser.parse_args()
    
    # Use context manager for automatic logging setup
    with ScriptExecutionContext('example_script', 'DEBUG' if args.verbose else 'INFO') as (logger, error_handler):
        
        # Validate environment
        try:
            validate_environment()
            logger.log_script_event("INFO", "Environment validation passed")
        except ValueError as e:
            logger.log_script_event("ERROR", f"Environment validation failed: {e}")
            return 1
        
        # Setup error recovery
        error_recovery = setup_error_recovery(logger)
        
        # Setup retry handler
        retry_config = RetryConfig(max_retries=args.max_retries)
        retry_handler = RetryHandler(retry_config, logger)
        
        # Setup graceful degradation
        graceful_degradation = GracefulDegradation(logger)
        graceful_degradation.set_fallback_data("database", {"records_processed": 0})
        graceful_degradation.set_fallback_data("api", {"products_found": 0})
        
        # Initialize services
        db = SolarPanelDB()
        # scraper = AdvancedScraperAPIClient()  # Not implemented yet
        
        summary = {
            'database_operations': 0,
            'scraper_requests': 0,
            'errors_handled': 0,
            'retries_attempted': 0
        }
        
        try:
            # Simulate database operations with retry
            logger.log_script_event("INFO", "Starting database operations")
            
            for i in range(3):
                try:
                    result = await retry_handler.execute_with_retry(
                        simulate_database_operation,
                        logger, error_handler,
                        success=not (args.simulate_errors and i == 1),
                        service_name="database"
                    )
                    summary['database_operations'] += 1
                    logger.log_script_event("INFO", f"Database operation {i+1} completed")
                    
                except Exception as e:
                    error_handler.handle_error(e, f"Database operation {i+1}")
                    summary['errors_handled'] += 1
                    
                    # Attempt recovery
                    if await error_recovery.attempt_recovery(e, f"Database operation {i+1}"):
                        logger.log_script_event("INFO", "Recovery successful, continuing")
                    else:
                        logger.log_script_event("WARNING", "Recovery failed, using fallback")
                        fallback_result = graceful_degradation.get_fallback_data("database")
                        logger.log_script_event("INFO", f"Using fallback data: {fallback_result}")
                
                # Check if we should continue
                if not error_handler.should_continue():
                    logger.log_script_event("ERROR", "Too many errors, stopping execution")
                    break
            
            # Simulate API requests with graceful degradation
            logger.log_script_event("INFO", "Starting API requests")
            
            for i in range(2):
                try:
                    result = await graceful_degradation.execute_with_fallback(
                        simulate_api_request,
                        service_name="api",
                        logger=logger,
                        error_handler=error_handler,
                        success=not (args.simulate_errors and i == 0)
                    )
                    summary['scraper_requests'] += 1
                    logger.log_script_event("INFO", f"API request {i+1} completed")
                    
                except Exception as e:
                    error_handler.handle_error(e, f"API request {i+1}")
                    summary['errors_handled'] += 1
            
            # Log performance metrics
            logger.log_performance_metric("database_operations", summary['database_operations'])
            logger.log_performance_metric("api_requests", summary['scraper_requests'])
            logger.log_performance_metric("errors_handled", summary['errors_handled'])
            
            # Log error summary
            error_summary = error_handler.get_error_summary()
            if error_summary['total_errors'] > 0:
                logger.log_script_event("WARNING", f"Error summary: {error_summary}")
            
            # Send notification if there were errors
            if error_summary['total_errors'] > 0:
                await send_notification(
                    f"Script completed with {error_summary['total_errors']} errors. "
                    f"Database operations: {summary['database_operations']}, "
                    f"API requests: {summary['scraper_requests']}",
                    "Script Execution Report"
                )
            
            logger.log_script_event("INFO", "Script execution completed successfully")
            return 0
            
        except Exception as e:
            error_handler.handle_error(e, "Main execution", critical=True)
            await send_notification(f"Script failed: {str(e)}", "Script Failure Alert")
            return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
