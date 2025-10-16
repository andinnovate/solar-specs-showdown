"""
Advanced error handling and retry logic for solar panel management scripts.
Provides exponential backoff, circuit breaker patterns, and graceful degradation.
"""

import asyncio
import time
import random
import sys
import os
from typing import Callable, Any, Optional, Dict, List
from functools import wraps
import logging

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.logging_config import ScriptLogger

class RetryConfig:
    """Configuration for retry behavior"""
    
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0, 
                 max_delay: float = 60.0, exponential_base: float = 2.0,
                 jitter: bool = True):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter

class CircuitBreaker:
    """Circuit breaker pattern for external service calls"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def can_execute(self) -> bool:
        """Check if circuit breaker allows execution"""
        if self.state == "CLOSED":
            return True
        
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
                return True
            return False
        
        if self.state == "HALF_OPEN":
            return True
        
        return False
    
    def record_success(self):
        """Record successful execution"""
        self.failure_count = 0
        self.state = "CLOSED"
    
    def record_failure(self):
        """Record failed execution"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"

class RetryHandler:
    """Handles retry logic with exponential backoff"""
    
    def __init__(self, config: RetryConfig, logger: ScriptLogger):
        self.config = config
        self.logger = logger
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
    
    def get_circuit_breaker(self, service_name: str) -> CircuitBreaker:
        """Get or create circuit breaker for a service"""
        if service_name not in self.circuit_breakers:
            self.circuit_breakers[service_name] = CircuitBreaker()
        return self.circuit_breakers[service_name]
    
    async def execute_with_retry(self, func: Callable, *args, service_name: str = "unknown", 
                               **kwargs) -> Any:
        """Execute function with retry logic and circuit breaker"""
        
        # Check circuit breaker
        circuit_breaker = self.get_circuit_breaker(service_name)
        if not circuit_breaker.can_execute():
            raise Exception(f"Circuit breaker OPEN for {service_name}")
        
        last_exception = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                
                # Success - reset circuit breaker
                circuit_breaker.record_success()
                return result
                
            except Exception as e:
                last_exception = e
                circuit_breaker.record_failure()
                
                if attempt == self.config.max_retries:
                    self.logger.log_script_event(
                        "ERROR", 
                        f"Max retries exceeded for {service_name}: {str(e)}"
                    )
                    break
                
                # Calculate delay with exponential backoff
                delay = min(
                    self.config.base_delay * (self.config.exponential_base ** attempt),
                    self.config.max_delay
                )
                
                # Add jitter to prevent thundering herd
                if self.config.jitter:
                    delay *= (0.5 + random.random() * 0.5)
                
                self.logger.log_script_event(
                    "WARNING", 
                    f"Retry {attempt + 1}/{self.config.max_retries} for {service_name} in {delay:.2f}s: {str(e)}"
                )
                
                await asyncio.sleep(delay)
        
        raise last_exception

def retry_on_failure(config: RetryConfig = None, service_name: str = "unknown"):
    """Decorator for retry logic"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get logger from args if available
            logger = None
            for arg in args:
                if isinstance(arg, ScriptLogger):
                    logger = arg
                    break
            
            if not logger:
                logger = ScriptLogger("retry_decorator")
            
            retry_handler = RetryHandler(config or RetryConfig(), logger)
            return await retry_handler.execute_with_retry(func, *args, service_name=service_name, **kwargs)
        
        return wrapper
    return decorator

class GracefulDegradation:
    """Handles graceful degradation when services are unavailable"""
    
    def __init__(self, logger: ScriptLogger):
        self.logger = logger
        self.fallback_data = {}
        self.service_status = {}
    
    def set_fallback_data(self, service: str, data: Any):
        """Set fallback data for a service"""
        self.fallback_data[service] = data
        self.logger.log_script_event("INFO", f"Fallback data set for {service}")
    
    def get_fallback_data(self, service: str) -> Any:
        """Get fallback data for a service"""
        return self.fallback_data.get(service)
    
    def mark_service_down(self, service: str):
        """Mark a service as down"""
        self.service_status[service] = "DOWN"
        self.logger.log_script_event("WARNING", f"Service {service} marked as DOWN")
    
    def mark_service_up(self, service: str):
        """Mark a service as up"""
        self.service_status[service] = "UP"
        self.logger.log_script_event("INFO", f"Service {service} marked as UP")
    
    def is_service_available(self, service: str) -> bool:
        """Check if service is available"""
        return self.service_status.get(service, "UP") == "UP"
    
    async def execute_with_fallback(self, func: Callable, fallback_func: Callable = None, 
                                  service_name: str = "unknown", *args, **kwargs) -> Any:
        """Execute function with fallback if service is down"""
        
        if not self.is_service_available(service_name):
            self.logger.log_script_event("WARNING", f"Using fallback for {service_name}")
            
            if fallback_func:
                return await fallback_func(*args, **kwargs)
            else:
                return self.get_fallback_data(service_name)
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            self.mark_service_up(service_name)
            return result
            
        except Exception as e:
            self.logger.log_script_event("ERROR", f"Service {service_name} failed: {str(e)}")
            self.mark_service_down(service_name)
            
            if fallback_func:
                return await fallback_func(*args, **kwargs)
            else:
                return self.get_fallback_data(service_name)

class ErrorRecovery:
    """Handles error recovery strategies"""
    
    def __init__(self, logger: ScriptLogger):
        self.logger = logger
        self.recovery_strategies = {}
    
    def register_recovery_strategy(self, error_type: type, strategy: Callable):
        """Register a recovery strategy for a specific error type"""
        self.recovery_strategies[error_type] = strategy
        self.logger.log_script_event("DEBUG", f"Recovery strategy registered for {error_type.__name__}")
    
    async def attempt_recovery(self, error: Exception, context: str = None) -> bool:
        """Attempt to recover from an error"""
        error_type = type(error)
        
        if error_type in self.recovery_strategies:
            try:
                strategy = self.recovery_strategies[error_type]
                if asyncio.iscoroutinefunction(strategy):
                    result = await strategy(error, context)
                else:
                    result = strategy(error, context)
                
                if result:
                    self.logger.log_script_event("INFO", f"Recovery successful for {error_type.__name__}")
                    return True
                else:
                    self.logger.log_script_event("WARNING", f"Recovery failed for {error_type.__name__}")
                    return False
                    
            except Exception as recovery_error:
                self.logger.log_script_event("ERROR", f"Recovery strategy failed: {str(recovery_error)}")
                return False
        
        return False

# Common recovery strategies
async def database_connection_recovery(error: Exception, context: str = None) -> bool:
    """Recovery strategy for database connection errors"""
    # Could implement connection pool reset, reconnection logic, etc.
    await asyncio.sleep(1)  # Simple delay
    return True

async def scraper_api_recovery(error: Exception, context: str = None) -> bool:
    """Recovery strategy for ScraperAPI errors"""
    # Could implement API key rotation, rate limit handling, etc.
    await asyncio.sleep(5)  # Longer delay for API issues
    return True

def setup_error_recovery(logger: ScriptLogger) -> ErrorRecovery:
    """Setup common error recovery strategies"""
    recovery = ErrorRecovery(logger)
    
    # Register common recovery strategies
    recovery.register_recovery_strategy(ConnectionError, database_connection_recovery)
    recovery.register_recovery_strategy(TimeoutError, scraper_api_recovery)
    
    return recovery
