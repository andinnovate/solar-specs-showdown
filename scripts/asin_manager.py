"""
ASIN staging and management for solar panel discovery workflow.
Handles queuing ASINs for product detail ingestion and tracks their status.
"""

import sys
import os
from typing import List, Dict, Optional
import logging

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import config
from scripts.database import SolarPanelDB
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class ASINManager:
    """Manage ASIN staging queue and deduplication"""
    
    def __init__(self):
        """Initialize ASIN manager with database connection"""
        self.client: Client = create_client(
            config.SUPABASE_URL,
            config.SUPABASE_SERVICE_KEY
        )
        self.db = SolarPanelDB()
    
    async def is_asin_in_database(self, asin: str) -> bool:
        """
        Check if ASIN already exists in solar_panels table.
        
        Args:
            asin: Amazon Standard Identification Number
            
        Returns:
            True if ASIN exists in main panels table
        """
        return await self.db.asin_exists(asin)
    
    async def is_asin_staged(self, asin: str) -> bool:
        """
        Check if ASIN is already in the staging queue.
        
        Args:
            asin: Amazon Standard Identification Number
            
        Returns:
            True if ASIN is in asin_staging table
        """
        try:
            result = self.client.table('asin_staging').select('id').eq('asin', asin).limit(1).execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Failed to check if ASIN is staged: {e}")
            return False
    
    async def stage_asin(
        self, 
        asin: str, 
        source: str, 
        source_keyword: str = None,
        search_id: str = None,
        priority: int = 0
    ) -> bool:
        """
        Stage an ASIN for product detail ingestion.
        
        Args:
            asin: Amazon Standard Identification Number
            source: Source of discovery ('search', 'manual', 'competitor', etc.)
            source_keyword: Search keyword that discovered this ASIN
            search_id: UUID of the search_keywords record
            priority: Priority level (higher = process sooner)
            
        Returns:
            True if successfully staged, False otherwise
        """
        try:
            # Check if already in database
            if await self.is_asin_in_database(asin):
                logger.info(f"ASIN {asin} already exists in solar_panels - marking as duplicate")
                
                # Still add to staging but mark as duplicate
                self.client.table('asin_staging').insert({
                    'asin': asin,
                    'source': source,
                    'source_keyword': source_keyword,
                    'search_id': search_id,
                    'priority': priority,
                    'status': 'duplicate'
                }).execute()
                
                return False  # Return False since we didn't stage it for processing
            
            # Check if already staged
            if await self.is_asin_staged(asin):
                logger.info(f"ASIN {asin} already in staging queue")
                return False
            
            # Stage the ASIN
            self.client.table('asin_staging').insert({
                'asin': asin,
                'source': source,
                'source_keyword': source_keyword,
                'search_id': search_id,
                'priority': priority,
                'status': 'pending'
            }).execute()
            
            logger.info(f"Staged ASIN {asin} from {source} (keyword: {source_keyword})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to stage ASIN {asin}: {e}")
            return False
    
    async def get_pending_asins(self, limit: int = 50, priority_only: bool = False) -> List[Dict]:
        """
        Get ASINs ready for ingestion.
        
        Args:
            limit: Maximum number of ASINs to return
            priority_only: If True, only return ASINs with priority > 0
            
        Returns:
            List of pending ASIN records with full details
        """
        try:
            query = self.client.table('asin_staging').select('*').eq('status', 'pending')
            
            if priority_only:
                query = query.gt('priority', 0)
            
            # Order by priority descending, then by created_at ascending (FIFO within priority)
            result = query.order('priority', desc=True).order('created_at', desc=False).limit(limit).execute()
            
            return result.data
            
        except Exception as e:
            logger.error(f"Failed to get pending ASINs: {e}")
            return []
    
    async def mark_asin_processing(self, asin: str) -> bool:
        """
        Mark ASIN as currently being processed.
        
        Args:
            asin: Amazon Standard Identification Number
            
        Returns:
            True if successfully updated
        """
        try:
            self.client.table('asin_staging').update({
                'status': 'processing',
                'last_attempt_at': 'now()',
                'attempts': self.client.rpc('increment_attempts', {'asin_value': asin})
            }).eq('asin', asin).execute()
            
            logger.debug(f"Marked ASIN {asin} as processing")
            return True
            
        except Exception as e:
            # Fallback without RPC
            try:
                current = self.client.table('asin_staging').select('attempts').eq('asin', asin).execute()
                if current.data:
                    attempts = current.data[0].get('attempts', 0) + 1
                else:
                    attempts = 1
                
                self.client.table('asin_staging').update({
                    'status': 'processing',
                    'last_attempt_at': 'now()',
                    'attempts': attempts
                }).eq('asin', asin).execute()
                
                return True
            except Exception as e2:
                logger.error(f"Failed to mark ASIN as processing: {e2}")
                return False
    
    async def mark_batch_processing(self, asin_list: list[str]) -> bool:
        """
        Mark multiple ASINs as processing in a single batch operation.
        This prevents race conditions when multiple ingest processes run simultaneously.
        
        Args:
            asin_list: List of ASINs to mark as processing
            
        Returns:
            True if successfully updated
        """
        try:
            if not asin_list:
                return True
                
            # Update all ASINs in the list to processing status
            # Use a single SQL update with IN clause for efficiency
            result = self.client.table('asin_staging').update({
                'status': 'processing',
                'last_attempt_at': 'now()'
            }).in_('asin', asin_list).execute()
            
            logger.info(f"Marked {len(asin_list)} ASINs as processing in batch")
            return True
            
        except Exception as e:
            logger.error(f"Failed to mark batch as processing: {e}")
            return False
    
    async def mark_asin_completed(self, asin: str, panel_id: str) -> bool:
        """
        Mark ASIN as successfully ingested.
        
        Args:
            asin: Amazon Standard Identification Number
            panel_id: UUID of the created panel in solar_panels
            
        Returns:
            True if successfully updated
        """
        try:
            self.client.table('asin_staging').update({
                'status': 'completed',
                'panel_id': panel_id,
                'ingested_at': 'now()'
            }).eq('asin', asin).execute()
            
            logger.info(f"Marked ASIN {asin} as completed (panel_id: {panel_id})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to mark ASIN as completed: {e}")
            return False
    
    async def mark_asin_failed(self, asin: str, error_message: str, is_permanent: bool = False) -> bool:
        """
        Mark ASIN ingestion as failed.
        
        Args:
            asin: Amazon Standard Identification Number
            error_message: Reason for failure
            is_permanent: If True, mark as failed permanently (no retry)
            
        Returns:
            True if successfully updated
        """
        try:
            # Get current attempts
            current = self.client.table('asin_staging').select('attempts, max_attempts').eq('asin', asin).execute()
            
            if current.data:
                attempts = current.data[0].get('attempts', 0)
                max_attempts = current.data[0].get('max_attempts', 3)
                
                # Determine status based on failure type and attempts
                if is_permanent:
                    # Permanent failures (parsing errors, data issues) should not be retried
                    status = 'failed'
                    logger.warning(f"Permanent failure for ASIN {asin}: {error_message}")
                elif attempts >= max_attempts:
                    # Exceeded max attempts, mark as failed permanently
                    status = 'failed'
                    logger.warning(f"Max attempts exceeded for ASIN {asin}: {error_message}")
                else:
                    # Temporary failure, reset to pending for retry
                    status = 'pending'
                    logger.info(f"Temporary failure for ASIN {asin}, will retry: {error_message}")
            else:
                status = 'failed'
            
            self.client.table('asin_staging').update({
                'status': status,
                'error_message': error_message
            }).eq('asin', asin).execute()
            
            logger.warning(f"Marked ASIN {asin} as {status}: {error_message}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to mark ASIN as failed: {e}")
            return False
    
    async def get_staging_stats(self) -> Dict:
        """
        Get statistics about the staging queue.
        
        Returns:
            Dict with counts by status
        """
        try:
            result = self.client.table('asin_staging').select('status').execute()
            
            stats = {
                'total': len(result.data),
                'pending': 0,
                'processing': 0,
                'completed': 0,
                'failed': 0,
                'skipped': 0,
                'duplicate': 0
            }
            
            for record in result.data:
                status = record.get('status', 'unknown')
                if status in stats:
                    stats[status] += 1
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get staging stats: {e}")
            return {}
    
    async def retry_failed_asins(self, limit: int = 10) -> int:
        """
        Reset failed ASINs to pending for retry.
        
        Args:
            limit: Maximum number of ASINs to retry
            
        Returns:
            Number of ASINs reset for retry
        """
        try:
            # Get failed ASINs that haven't exceeded max attempts
            failed = self.client.table('asin_staging').select('asin, attempts, max_attempts').eq('status', 'failed').limit(limit).execute()
            
            retried = 0
            for record in failed.data:
                attempts = record.get('attempts', 0)
                max_attempts = record.get('max_attempts', 3)
                
                if attempts < max_attempts:
                    self.client.table('asin_staging').update({
                        'status': 'pending',
                        'error_message': None
                    }).eq('asin', record['asin']).execute()
                    
                    retried += 1
            
            logger.info(f"Reset {retried} failed ASINs to pending for retry")
            return retried
            
        except Exception as e:
            logger.error(f"Failed to retry failed ASINs: {e}")
            return 0
    
    async def clear_duplicates(self) -> int:
        """
        Remove duplicate ASIN records from staging.
        
        Returns:
            Number of duplicate records removed
        """
        try:
            result = self.client.table('asin_staging').delete().eq('status', 'duplicate').execute()
            count = len(result.data) if result.data else 0
            
            logger.info(f"Cleared {count} duplicate ASIN records from staging")
            return count
            
        except Exception as e:
            logger.error(f"Failed to clear duplicates: {e}")
            return 0

