"""
Comprehensive logging configuration for solar panel management scripts.
Provides structured logging with file rotation, database logging, and email notifications.
"""

import logging
import logging.handlers
import os
import sys
from datetime import datetime
from typing import Optional, Dict, Any
import json

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import config

class ScriptLogger:
    """Enhanced logger for solar panel management scripts"""
    
    def __init__(self, script_name: str, log_level: str = None):
        self.script_name = script_name
        self.log_level = log_level or config.LOG_LEVEL
        self.logger = self._setup_logger()
        self.execution_id = None
        self.start_time = None
        
    def _setup_logger(self) -> logging.Logger:
        """Setup logger with file rotation and console output"""
        logger = logging.getLogger(f"solar_scripts.{self.script_name}")
        logger.setLevel(getattr(logging, self.log_level.upper()))
        
        # Clear existing handlers
        logger.handlers.clear()
        
        # Create logs directory if it doesn't exist
        os.makedirs(config.LOG_DIR, exist_ok=True)
        
        # File handler with rotation
        log_file = os.path.join(config.LOG_DIR, f"{self.script_name}.log")
        file_handler = logging.handlers.RotatingFileHandler(
            log_file, 
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        
        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        return logger
    
    def start_execution(self, execution_id: str = None):
        """Start a new script execution session"""
        if execution_id:
            self.execution_id = execution_id
        else:
            self.execution_id = f"{self.script_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        self.start_time = datetime.now()
        self.logger.info(f"Starting execution: {self.execution_id}")
        
    def end_execution(self, success: bool = True, summary: Dict[str, Any] = None):
        """End script execution with summary"""
        if self.start_time:
            duration = datetime.now() - self.start_time
            status = "SUCCESS" if success else "FAILED"
            
            self.logger.info(f"Execution {status}: {self.execution_id}")
            self.logger.info(f"Duration: {duration.total_seconds():.2f} seconds")
            
            if summary:
                self.logger.info(f"Summary: {json.dumps(summary, indent=2)}")
    
    def log_script_event(self, level: str, message: str, metadata: Dict[str, Any] = None):
        """Log script event with metadata"""
        log_level = getattr(logging, level.upper())
        self.logger.log(log_level, message)
        
        # Add metadata to log message if provided
        if metadata:
            self.logger.debug(f"Metadata: {json.dumps(metadata)}")
    
    def log_database_operation(self, operation: str, table: str, success: bool, 
                             record_count: int = None, error: str = None):
        """Log database operations with consistent format"""
        status = "SUCCESS" if success else "FAILED"
        message = f"DB {operation} on {table}: {status}"
        
        if record_count is not None:
            message += f" ({record_count} records)"
        
        if error:
            message += f" - Error: {error}"
        
        level = "INFO" if success else "ERROR"
        self.log_script_event(level, message)
    
    def log_scraper_request(self, url: str, success: bool, response_time_ms: int = None, 
                          error: str = None, asin: str = None):
        """Log ScraperAPI requests with consistent format"""
        status = "SUCCESS" if success else "FAILED"
        message = f"ScraperAPI request: {status}"
        
        if asin:
            message += f" (ASIN: {asin})"
        
        if response_time_ms:
            message += f" ({response_time_ms}ms)"
        
        if error:
            message += f" - Error: {error}"
        
        level = "INFO" if success else "WARNING"
        self.log_script_event(level, message, {"url": url, "asin": asin})
    
    def log_performance_metric(self, metric_name: str, value: float, unit: str = None):
        """Log performance metrics"""
        message = f"Performance: {metric_name} = {value}"
        if unit:
            message += f" {unit}"
        
        self.log_script_event("INFO", message)
    
    def log_error_with_context(self, error: Exception, context: str = None):
        """Log errors with full context and stack trace"""
        error_msg = f"Error in {context}: {str(error)}" if context else str(error)
        self.logger.error(error_msg, exc_info=True)
    
    def get_logger(self) -> logging.Logger:
        """Get the underlying logger for custom logging"""
        return self.logger

class ErrorHandler:
    """Centralized error handling for scripts"""
    
    def __init__(self, logger: ScriptLogger):
        self.logger = logger
        self.error_count = 0
        self.critical_errors = []
    
    def handle_error(self, error: Exception, context: str = None, 
                    critical: bool = False, retry: bool = False) -> bool:
        """Handle errors with logging and optional retry logic"""
        self.error_count += 1
        
        if critical:
            self.critical_errors.append({
                'error': str(error),
                'context': context,
                'timestamp': datetime.now().isoformat()
            })
        
        self.logger.log_error_with_context(error, context)
        
        if critical:
            self.logger.log_script_event("CRITICAL", f"Critical error: {str(error)}")
            return False
        
        return not retry  # Return True if we should continue, False if we should stop
    
    def should_continue(self, max_errors: int = 10) -> bool:
        """Check if script should continue based on error count"""
        if self.error_count >= max_errors:
            self.logger.log_script_event("ERROR", f"Too many errors ({self.error_count}), stopping execution")
            return False
        
        if self.critical_errors:
            self.logger.log_script_event("ERROR", f"Critical errors detected, stopping execution")
            return False
        
        return True
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get summary of errors encountered"""
        return {
            'total_errors': self.error_count,
            'critical_errors': len(self.critical_errors),
            'critical_error_details': self.critical_errors
        }

def setup_script_logging(script_name: str, log_level: str = None) -> tuple[ScriptLogger, ErrorHandler]:
    """Setup logging for a script"""
    logger = ScriptLogger(script_name, log_level)
    error_handler = ErrorHandler(logger)
    
    return logger, error_handler

def log_script_start(logger: ScriptLogger, script_name: str, args: Dict[str, Any] = None):
    """Log script start with arguments"""
    logger.start_execution()
    logger.log_script_event("INFO", f"Starting {script_name}")
    
    if args:
        logger.log_script_event("DEBUG", f"Script arguments: {json.dumps(args)}")

def log_script_end(logger: ScriptLogger, success: bool, summary: Dict[str, Any] = None):
    """Log script end with summary"""
    logger.end_execution(success, summary)
    
    if not success:
        logger.log_script_event("ERROR", "Script execution failed")

# Context manager for script execution
class ScriptExecutionContext:
    """Context manager for script execution with automatic logging"""
    
    def __init__(self, script_name: str, log_level: str = None):
        self.script_name = script_name
        self.logger, self.error_handler = setup_script_logging(script_name, log_level)
        self.success = True
        self.summary = {}
    
    def __enter__(self):
        self.logger.start_execution()
        return self.logger, self.error_handler
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.success = False
            self.error_handler.handle_error(exc_val, "Script execution", critical=True)
        
        self.logger.end_execution(self.success, self.summary)
        return False  # Don't suppress exceptions
