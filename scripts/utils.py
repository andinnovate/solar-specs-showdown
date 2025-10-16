"""
Utility functions for solar panel management scripts.
"""

import os
import smtplib
import logging
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import config

def setup_logging(verbose: bool = False, log_file: str = None):
    """Setup logging configuration for scripts"""
    log_level = logging.DEBUG if verbose else logging.INFO
    
    # Create logs directory if it doesn't exist
    os.makedirs(config.LOG_DIR, exist_ok=True)
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(
                log_file or os.path.join(config.LOG_DIR, 'script.log'),
                mode='a'
            )
        ]
    )
    
    # Set specific loggers
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('requests').setLevel(logging.WARNING)

def send_notification(message: str, subject: str = "Solar Panel Script Notification"):
    """Send email notification"""
    if not all([config.SMTP_HOST, config.SMTP_USER, config.SMTP_PASSWORD]):
        logging.info(f"Notification: {subject} - {message}")
        return
    
    try:
        msg = MIMEMultipart()
        msg['From'] = config.SMTP_USER
        msg['To'] = config.ADMIN_EMAIL
        msg['Subject'] = subject
        
        msg.attach(MIMEText(message, 'plain'))
        
        server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT)
        server.starttls()
        server.login(config.SMTP_USER, config.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        logging.info(f"Notification sent: {subject}")
    except Exception as e:
        logging.error(f"Failed to send notification: {e}")

def validate_environment():
    """Validate required environment variables"""
    required_vars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'SCRAPERAPI_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not getattr(config, var, None):
            missing_vars.append(var)
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    return True

def format_duration(seconds: float) -> str:
    """Format duration in human-readable format"""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}h"

def format_file_size(bytes_size: int) -> str:
    """Format file size in human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.1f}{unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.1f}TB"

def safe_filename(filename: str) -> str:
    """Create a safe filename by removing invalid characters"""
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    return filename

def ensure_directory(path: str):
    """Ensure directory exists, create if it doesn't"""
    os.makedirs(path, exist_ok=True)

def get_script_name() -> str:
    """Get the name of the current script"""
    return os.path.basename(sys.argv[0]).replace('.py', '')
