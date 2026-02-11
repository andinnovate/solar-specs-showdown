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
        """Get panels that need price updates (only panels with ASIN, updated more than days_old days ago)"""
        try:
            from datetime import datetime, timedelta, timezone
            
            # Calculate cutoff date (panels updated before this date need updates)
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
            cutoff_iso = cutoff_date.isoformat()
            
            # Only select panels that have an ASIN (not null and not empty)
            # and were updated more than days_old days ago
            result = self.client.table('solar_panels').select('*').not_.is_('asin', 'null').neq('asin', '').lt('updated_at', cutoff_iso).order('updated_at', desc=False).limit(limit).execute()
            
            await self.log_script_execution(
                'database', 'INFO', 
                f'Retrieved {len(result.data)} panels with ASINs needing price update (updated >{days_old} days ago)'
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
            current = self.client.table('solar_panels').select('price_usd').eq('id', panel_id).execute()
            if not current.data:
                return False
            
            old_price = current.data[0].get('price_usd')
            
            # Update panel price
            self.client.table('solar_panels').update({
                'price_usd': new_price,
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
    
    async def update_panel_timestamp(self, panel_id: str) -> bool:
        """Update panel updated_at timestamp without changing price"""
        try:
            self.client.table('solar_panels').update({
                'updated_at': 'now()'
            }).eq('id', panel_id).execute()
            
            await self.log_script_execution(
                'database', 'INFO', 
                f'Updated timestamp for panel {panel_id}'
            )
            return True
        except Exception as e:
            await self.log_script_execution(
                'database', 'ERROR', 
                f'Failed to update panel timestamp: {str(e)}'
            )
            return False
    
    async def add_new_panel(self, panel_data: Dict) -> Optional[str]:
        """Add new panel to database with optional specs"""
        try:
            # Extract missing_fields before insertion
            missing_fields = panel_data.pop('missing_fields', [])
            
            # Prepare data with explicit None for missing fields
            insert_data = {
                'asin': panel_data['asin'],
                'name': panel_data['name'],
                'manufacturer': panel_data['manufacturer'],
                'length_cm': panel_data.get('length_cm'),  # May be None
                'width_cm': panel_data.get('width_cm'),    # May be None
                'weight_kg': panel_data.get('weight_kg'),  # May be None
                'wattage': panel_data.get('wattage'),      # May be None
                'voltage': panel_data.get('voltage'),
                'price_usd': panel_data.get('price_usd'),  # May be None
                'description': panel_data.get('description'),
                'image_url': panel_data.get('image_url'),
                'web_url': panel_data.get('web_url'),
                'missing_fields': missing_fields
            }

            piece_count = panel_data.get('piece_count')
            if piece_count is not None:
                insert_data['piece_count'] = piece_count
            
            result = self.client.table('solar_panels').insert(insert_data).execute()
            if result.data:
                panel_id = result.data[0]['id']
                await self.log_script_execution(
                    'database', 'INFO', 
                    f'Added new panel: {panel_id} (missing fields: {missing_fields})'
                )
                return panel_id
            return None
        except Exception as e:
            error_msg = f'Failed to add new panel: {str(e)}'
            logger.error(error_msg)  # Log to console as well
            await self.log_script_execution(
                'database', 'ERROR', 
                error_msg
            )
            return None
    
    async def update_panel_from_scraper(self, panel_id: str, panel_data: Dict, respect_manual_overrides: bool = True) -> Tuple[bool, List[str]]:
        """
        Update panel from scraper data, respecting manual overrides.
        
        Args:
            panel_id: ID of panel to update
            panel_data: New data from scraper
            respect_manual_overrides: If True, skip fields that have been manually edited
        
        Returns:
            Tuple of (success: bool, skipped_fields: List[str])
        """
        try:
            skipped_fields = []
            
            if respect_manual_overrides:
                # Get current panel to check manual_overrides
                current_result = self.client.table('solar_panels').select(
                    'manual_overrides, user_verified_overrides'
                ).eq('id', panel_id).execute()
                
                if current_result.data:
                    manual_overrides = current_result.data[0].get('manual_overrides', [])
                    user_verified_overrides = current_result.data[0].get('user_verified_overrides', [])
                    protected_fields = set(manual_overrides or []) | set(user_verified_overrides or [])
                    
                    # Filter out fields that have been manually edited
                    update_data = {}
                    for key, value in panel_data.items():
                        if key in protected_fields:
                            skipped_fields.append(key)
                            logger.info(f"Skipping protected field '{key}' for panel {panel_id}")
                        else:
                            update_data[key] = value
                    
                    if not update_data:
                        await self.log_script_execution(
                            'database', 'INFO', 
                            f'No fields to update for panel {panel_id} - all manually overridden'
                        )
                        return True, skipped_fields
                else:
                    update_data = panel_data
            else:
                update_data = panel_data
            
            # Update panel
            self.client.table('solar_panels').update(update_data).eq('id', panel_id).execute()
            
            await self.log_script_execution(
                'database', 'INFO', 
                f'Updated panel {panel_id} from scraper. Skipped {len(skipped_fields)} manually edited field(s).',
                metadata={'skipped_fields': skipped_fields}
            )
            return True, skipped_fields
            
        except Exception as e:
            error_msg = f'Failed to update panel from scraper: {str(e)}'
            logger.error(error_msg)
            await self.log_script_execution(
                'database', 'ERROR', 
                error_msg
            )
            return False, []
    
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

    async def get_price_update_stats(self, days_old: int = 7, recent_limit: int = 10, max_needing: int = 10000) -> Dict:
        """
        Get stats for update_prices report: panels with ASIN, needing update, recent price history.
        """
        try:
            from datetime import datetime, timedelta, timezone
            # Panels needing update (updated more than days_old ago, have ASIN)
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days_old)).isoformat()
            needing = self.client.table('solar_panels').select('id').not_.is_('asin', 'null').neq('asin', '').lt('updated_at', cutoff).limit(max_needing).execute()
            panels_needing_update = len(needing.data)
            capped_needing = panels_needing_update >= max_needing

            # Total panels with ASIN (cap for performance)
            with_asin = self.client.table('solar_panels').select('id').not_.is_('asin', 'null').neq('asin', '').limit(max_needing).execute()
            total_with_asin = len(with_asin.data)
            capped_total = total_with_asin >= max_needing

            # Recent price history (last N rows)
            hist = self.client.table('price_history').select('panel_id, old_price, new_price, source, created_at').order('created_at', desc=True).limit(recent_limit).execute()
            recent = list(hist.data or [])
            panel_ids = [r['panel_id'] for r in recent]
            names_by_id = {}
            if panel_ids:
                panels = self.client.table('solar_panels').select('id, name, asin').in_('id', panel_ids).execute()
                for p in (panels.data or []):
                    names_by_id[p['id']] = {'name': p.get('name', '—'), 'asin': p.get('asin', '—')}
            recent_with_names = []
            for r in recent:
                info = names_by_id.get(r['panel_id'], {'name': '—', 'asin': '—'})
                recent_with_names.append({
                    'name': info['name'],
                    'asin': info['asin'],
                    'old_price': r.get('old_price'),
                    'new_price': r.get('new_price'),
                    'source': r.get('source', '—'),
                    'created_at': r.get('created_at'),
                })

            # Scraper usage for update_prices in last 7 days
            seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            usage = self.client.table('scraper_usage').select('*').eq('script_name', 'update_prices').gte('created_at', seven_days_ago).execute()
            usage_data = usage.data or []
            usage_total = len(usage_data)
            usage_success = len([u for u in usage_data if u.get('success')])

            return {
                'total_panels_with_asin': total_with_asin,
                'total_capped': capped_total,
                'panels_needing_update': panels_needing_update,
                'needing_capped': capped_needing,
                'days_old': days_old,
                'recent_updates': recent_with_names,
                'scraper_requests_7d': usage_total,
                'scraper_success_7d': usage_success,
            }
        except Exception as e:
            logger.error(f"Failed to get price update stats: {e}")
            return {}
    
    # ==================== ASIN Management Methods ====================
    
    async def asin_exists(self, asin: str) -> bool:
        """
        Check if ASIN already exists in solar_panels table.
        
        Args:
            asin: Amazon Standard Identification Number
            
        Returns:
            True if ASIN exists in database
        """
        try:
            result = self.client.table('solar_panels').select('id').eq('asin', asin).limit(1).execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Failed to check ASIN existence: {e}")
            return False
    
    async def extract_asin_from_url(self, web_url: str) -> Optional[str]:
        """
        Extract ASIN from Amazon URL.
        
        Args:
            web_url: Amazon product URL
            
        Returns:
            ASIN string or None if not found
            
        Examples:
            "https://www.amazon.com/dp/B0C99GS958" -> "B0C99GS958"
            "https://www.amazon.com/product/dp/B0C99GS958/ref=..." -> "B0C99GS958"
        """
        import re
        if not web_url:
            return None
        match = re.search(r'/dp/([A-Z0-9]{10})', web_url)
        return match.group(1) if match else None
    
    async def get_panels_with_asins(self) -> List[Dict]:
        """
        Get all panels with their ASINs (for revalidation).
        
        Returns:
            List of panels with id, asin, web_url, updated_at
        """
        try:
            result = self.client.table('solar_panels').select('id, asin, web_url, updated_at').execute()
            return result.data
        except Exception as e:
            logger.error(f"Failed to get panels with ASINs: {e}")
            return []
    
    async def get_panel_by_asin(self, asin: str) -> Optional[Dict]:
        """
        Get panel by ASIN.
        
        Args:
            asin: Amazon Standard Identification Number
            
        Returns:
            Panel data dict or None if not found
        """
        try:
            result = self.client.table('solar_panels').select('*').eq('asin', asin).limit(1).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to get panel by ASIN: {e}")
            return None

    async def get_panels_by_asins(self, asins: List[str]) -> List[Dict]:
        """
        Get all panels whose asin is in the given list (single query).
        Used by --search-only price updates to resolve which search-result ASINs exist in DB.
        """
        if not asins:
            return []
        try:
            # Supabase .in_() for list; avoid overly large IN lists
            result = self.client.table('solar_panels').select('*').in_('asin', list(asins)).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get panels by ASINs: {e}")
            return []
