import os
import sys
from dotenv import load_dotenv
from typing import Optional
import logging

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables with .env.local override support
# This follows the same pattern as Vite/React: .env.local overrides .env
load_dotenv()  # Load .env first
load_dotenv('.env.local', override=True)  # Override with .env.local if it exists

class Config:
    SUPABASE_URL: str = os.getenv('SUPABASE_URL', '')
    SUPABASE_SERVICE_KEY: str = os.getenv('SUPABASE_SERVICE_KEY', '')
    SCRAPERAPI_KEY: str = os.getenv('SCRAPERAPI_KEY', '')
    SCRAPERAPI_BASE_URL: str = 'https://api.scraperapi.com/'
    MAX_CONCURRENT_REQUESTS: int = int(os.getenv('MAX_CONCURRENT_REQUESTS', '5'))
    REQUEST_DELAY: float = float(os.getenv('REQUEST_DELAY', '1.0'))
    MAX_RETRIES: int = int(os.getenv('MAX_RETRIES', '3'))
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    LOG_DIR: str = os.getenv('LOG_DIR', './logs')
    DATA_DIR: str = os.getenv('DATA_DIR', './data')
    SMTP_HOST: Optional[str] = os.getenv('SMTP_HOST')
    SMTP_PORT: int = int(os.getenv('SMTP_PORT', '587'))
    SMTP_USER: Optional[str] = os.getenv('SMTP_USER')
    SMTP_PASSWORD: Optional[str] = os.getenv('SMTP_PASSWORD')
    ADMIN_EMAIL: str = os.getenv('ADMIN_EMAIL', '***REMOVED***')
    
    def __post_init__(self):
        """Validate required configuration after initialization"""
        self._validate_config()
    
    def _validate_config(self):
        """Validate that required configuration is present"""
        errors = []
        
        # Check Supabase configuration
        if not self.SUPABASE_URL:
            errors.append("SUPABASE_URL is required")
        elif not self.SUPABASE_URL.startswith('http'):
            errors.append("SUPABASE_URL must be a valid URL")
        
        if not self.SUPABASE_SERVICE_KEY:
            errors.append("SUPABASE_SERVICE_KEY is required")
        elif len(self.SUPABASE_SERVICE_KEY) < 20:
            errors.append("SUPABASE_SERVICE_KEY appears to be invalid (too short)")
        elif not self.SUPABASE_SERVICE_KEY.startswith('eyJ'):
            if self.SUPABASE_SERVICE_KEY.startswith('sb_secret_'):
                errors.append("SUPABASE_SERVICE_KEY should be the service_role key (JWT), not the CLI secret key")
            else:
                errors.append("SUPABASE_SERVICE_KEY should be a JWT token starting with 'eyJ'")
        
        # Check ScraperAPI configuration
        if not self.SCRAPERAPI_KEY:
            errors.append("SCRAPERAPI_KEY is required")
        elif len(self.SCRAPERAPI_KEY) < 10:
            errors.append("SCRAPERAPI_KEY appears to be invalid (too short)")
        
        # Raise error if any validation failed
        if errors:
            error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {error}" for error in errors)
            error_msg += "\n\nTo fix this:"
            error_msg += "\n  1. Set SUPABASE_SERVICE_KEY in your shell: export SUPABASE_SERVICE_KEY='your-key'"
            error_msg += "\n  2. Or create a .env.python file with your service key"
            error_msg += "\n  3. Or set it inline: SUPABASE_SERVICE_KEY='your-key' python scripts/script.py"
            raise ValueError(error_msg)

config = Config()
config._validate_config()  # Validate immediately when config is created
