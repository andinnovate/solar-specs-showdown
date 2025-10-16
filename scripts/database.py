"""
Database operations for solar panel management scripts.
Simplified version focusing on core functionality.
"""

import asyncio
import uuid
import sys
import os
from supabase import create_client, Client
from typing import List, Dict, Optional, Tuple
import logging
import json

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import config

logger = logging.getLogger(__name__)

class SolarPanelDB:
    def __init__(self):
        self.client: Client = create_client(
            config.SUPABASE_URL,
            config.SUPABASE_SERVICE_KEY
        )
        self.current_execution_id = str(uuid.uuid4())
    
    async def log_script_execution(self, script_name: str, level: str, message: str, metadata: Dict = None):
        """Log script execution to database"""
        try:
            self.client.table('script_logs').insert({
                'script_name': script_name,
                'execution_id': self.current_execution_id,
                'level': level,
                'message': message,
                'metadata': metadata or {}
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log to database: {e}")
    
    async def track_scraper_usage(self, script_name: str, asin: str = None, url: str = None, 
                                success: bool = True, response_time_ms: int = None, 
                                error_message: str = None):
        """Track ScraperAPI usage for monitoring"""
        try:
            self.client.table('scraper_usage').insert({
                'script_name': script_name,
                'asin': asin,
                'url': url,
                'success': success,
                'response_time_ms': response_time_ms,
                'error_message': error_message
            }).execute()
        except Exception as e:
            logger.error(f"Failed to track scraper usage: {e}")
    
    async def get_panels_needing_price_update(self, days_old: int = 7, limit: int = 100) -> List[Dict]:
        """Get panels that need price updates"""
        try:
            result = self.client.table('solar_panels').select('*').order('updated_at', desc=False).limit(limit).execute()
            
            await self.log_script_execution(
                'database', 'INFO', 
                f'Retrieved {len(result.data)} panels for price update check'
            )
            return result.data
        except Exception as e:
            await self.log_script_execution(
                'database', 'ERROR', 
                f'Failed to get panels for price update: {str(e)}'
            )
            return []
    
    async def update_panel_price(self, panel_id: str, new_price: float, source: str = 'scraperapi') -> bool:
        """Update panel price with history tracking"""
        try:
            # Get current price
            current = self.client.table('solar_panels').select('price').eq('id', panel_id).execute()
            if not current.data:
                return False
            
            old_price = current.data[0].get('price')
            
            # Update panel price
            self.client.table('solar_panels').update({
                'price': new_price,
                'updated_at': 'now()'
            }).eq('id', panel_id).execute()
            
            # Record price history
            self.client.table('price_history').insert({
                'panel_id': panel_id,
                'old_price': old_price,
                'new_price': new_price,
                'source': source
            }).execute()
            
            await self.log_script_execution(
                'database', 'INFO', 
                f'Updated panel {panel_id} price from {old_price} to {new_price}'
            )
            return True
        except Exception as e:
            await self.log_script_execution(
                'database', 'ERROR', 
                f'Failed to update panel price: {str(e)}'
            )
            return False
    
    async def add_new_panel(self, panel_data: Dict) -> Optional[str]:
        """Add new panel to database"""
        try:
            result = self.client.table('solar_panels').insert(panel_data).execute()
            if result.data:
                panel_id = result.data[0]['id']
                await self.log_script_execution(
                    'database', 'INFO', 
                    f'Added new panel: {panel_id}'
                )
                return panel_id
            return None
        except Exception as e:
            await self.log_script_execution(
                'database', 'ERROR', 
                f'Failed to add new panel: {str(e)}'
            )
            return None
    
    async def get_flagged_panels(self, status: str = 'needs_review') -> List[Dict]:
        """Get flagged panels with panel details"""
        try:
            result = self.client.table('flagged_panels').select(
                '*, solar_panels(*)'
            ).eq('status', status).order('created_at', desc=True).execute()
            
            await self.log_script_execution(
                'database', 'INFO', 
                f'Retrieved {len(result.data)} flagged panels with status: {status}'
            )
            return result.data
        except Exception as e:
            await self.log_script_execution(
                'database', 'ERROR', 
                f'Failed to get flagged panels: {str(e)}'
            )
            return []
    
    async def resolve_flag(self, flag_id: str, action: str, admin_note: str = None) -> bool:
        """Resolve a flagged panel"""
        try:
            status = 'resolved' if action == 'resolve' else 'dismissed'
            
            self.client.table('flagged_panels').update({
                'status': status,
                'admin_note': admin_note,
                'resolved_at': 'now()'
            }).eq('id', flag_id).execute()
            
            await self.log_script_execution(
                'database', 'INFO', 
                f'Resolved flag {flag_id} with action: {action}'
            )
            return True
        except Exception as e:
            await self.log_script_execution(
                'database', 'ERROR', 
                f'Failed to resolve flag: {str(e)}'
            )
            return False
    
    async def create_flag(self, panel_id: str, reason: str, details: str = None) -> bool:
        """Create a new flag for a panel"""
        try:
            self.client.table('flagged_panels').insert({
                'panel_id': panel_id,
                'reason': reason,
                'details': details,
                'status': 'needs_review'
            }).execute()
            
            await self.log_script_execution(
                'database', 'INFO', 
                f'Created flag for panel {panel_id}: {reason}'
            )
            return True
        except Exception as e:
            await self.log_script_execution(
                'database', 'ERROR', 
                f'Failed to create flag: {str(e)}'
            )
            return False
    
    async def get_scraper_usage_stats(self, days: int = 7) -> Dict:
        """Get ScraperAPI usage statistics"""
        try:
            result = self.client.table('scraper_usage').select('*').gte('created_at', f'now() - interval \'{days} days\'').execute()
            
            total_requests = len(result.data)
            successful_requests = len([r for r in result.data if r['success']])
            failed_requests = total_requests - successful_requests
            
            stats = {
                'total_requests': total_requests,
                'successful_requests': successful_requests,
                'failed_requests': failed_requests,
                'success_rate': (successful_requests / total_requests * 100) if total_requests > 0 else 0
            }
            
            await self.log_script_execution(
                'database', 'INFO', 
                f'ScraperAPI stats: {stats}'
            )
            return stats
        except Exception as e:
            await self.log_script_execution(
                'database', 'ERROR', 
                f'Failed to get scraper stats: {str(e)}'
            )
            return {}
