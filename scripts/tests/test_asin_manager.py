"""
Integration tests for ASINManager using real test Supabase instance.
No mocking required - tests against actual database.

Run with: pytest scripts/tests/test_asin_manager.py --use-test-db -v

Test Database: https://plsboshlmokjtwxpmrit.supabase.co
"""

import pytest
import uuid

from scripts.asin_manager import ASINManager


# Mark all tests as integration tests
pytestmark = pytest.mark.integration


class TestIsASINInDatabase:
    """Test checking if ASIN exists in solar_panels table"""
    
    @pytest.mark.asyncio
    async def test_returns_false_when_asin_not_exists(self, asin_manager, clean_test_asins):
        """Test returns False when ASIN doesn't exist"""
        result = await asin_manager.is_asin_in_database('TEST_NOTEXIST')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_returns_true_when_asin_exists(self, asin_manager, clean_test_asins):
        """Test returns True when ASIN exists in solar_panels"""
        # Insert test panel
        asin_manager.db.client.table('solar_panels').insert({
            'asin': 'TEST_PANEL01',
            'name': 'Test Panel',
            'manufacturer': 'Test Mfg',
            'length_cm': 100,
            'width_cm': 50,
            'weight_kg': 10,
            'wattage': 100,
            'price_usd': 99.99
        }).execute()
        
        # Test
        result = await asin_manager.is_asin_in_database('TEST_PANEL01')
        
        assert result is True


class TestIsASINStaged:
    """Test checking if ASIN is in staging queue"""
    
    @pytest.mark.asyncio
    async def test_returns_false_when_not_staged(self, asin_manager, clean_test_asins):
        """Test returns False when ASIN not in staging"""
        result = await asin_manager.is_asin_staged('TEST_NOTSTAGED')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_returns_true_when_staged(self, asin_manager, clean_test_asins):
        """Test returns True when ASIN is in staging"""
        # Insert test staging record
        asin_manager.client.table('asin_staging').insert({
            'asin': 'TEST_STAGED01',
            'source': 'manual',
            'status': 'pending'
        }).execute()
        
        # Test
        result = await asin_manager.is_asin_staged('TEST_STAGED01')
        
        assert result is True


class TestStageASIN:
    """Test staging ASINs for ingestion"""
    
    @pytest.mark.asyncio
    async def test_stages_new_asin_successfully(self, asin_manager, clean_test_asins):
        """Test successfully staging a new ASIN"""
        result = await asin_manager.stage_asin(
            asin='TEST_NEW001',
            source='search',
            source_keyword='solar panel',
            priority=10
        )
        
        # Should return True (success)
        assert result is True
        
        # Verify in database
        db_result = asin_manager.client.table('asin_staging')\
            .select('*')\
            .eq('asin', 'TEST_NEW001')\
            .single()\
            .execute()
        
        assert db_result.data['status'] == 'pending'
        assert db_result.data['source'] == 'search'
        assert db_result.data['source_keyword'] == 'solar panel'
        assert db_result.data['priority'] == 10
    
    @pytest.mark.asyncio
    async def test_returns_false_when_already_in_database(self, asin_manager, clean_test_asins):
        """Test marks as duplicate when ASIN already in solar_panels"""
        # Insert panel first
        asin_manager.db.client.table('solar_panels').insert({
            'asin': 'TEST_EXISTING',
            'name': 'Existing Panel',
            'manufacturer': 'Test',
            'length_cm': 100,
            'width_cm': 50,
            'weight_kg': 10,
            'wattage': 100,
            'price_usd': 99.99
        }).execute()
        
        # Try to stage it
        result = await asin_manager.stage_asin('TEST_EXISTING', 'search')
        
        # Should return False (not staged for processing)
        assert result is False
        
        # Verify marked as duplicate
        db_result = asin_manager.client.table('asin_staging')\
            .select('*')\
            .eq('asin', 'TEST_EXISTING')\
            .single()\
            .execute()
        
        assert db_result.data['status'] == 'duplicate'
    
    @pytest.mark.asyncio
    async def test_returns_false_when_already_staged(self, asin_manager, clean_test_asins):
        """Test returns False when ASIN already in staging queue"""
        # Stage it first
        await asin_manager.stage_asin('TEST_DUPE01', 'search')
        
        # Try to stage again
        result = await asin_manager.stage_asin('TEST_DUPE01', 'manual')
        
        # Should return False
        assert result is False
        
        # Should still only have one record
        db_result = asin_manager.client.table('asin_staging')\
            .select('*')\
            .eq('asin', 'TEST_DUPE01')\
            .execute()
        
        assert len(db_result.data) == 1
    
    @pytest.mark.asyncio
    async def test_stages_with_all_parameters(self, asin_manager, clean_test_asins):
        """Test staging with all optional parameters"""
        result = await asin_manager.stage_asin(
            asin='TEST_FULL001',
            source='search',
            source_keyword='bifacial solar panel',
            search_id=None,  # UUID field - use None for tests
            priority=100
        )
        
        assert result is True
        
        record = asin_manager.client.table('asin_staging')\
            .select('*')\
            .eq('asin', 'TEST_FULL001')\
            .single()\
            .execute()
        
        assert record.data['source'] == 'search'
        assert record.data['source_keyword'] == 'bifacial solar panel'
        assert record.data['search_id'] is None
        assert record.data['priority'] == 100
        assert record.data['status'] == 'pending'


class TestGetPendingASINs:
    """Test retrieving pending ASINs from staging queue"""
    
    @pytest.mark.asyncio
    async def test_returns_empty_when_no_pending(self, asin_manager, clean_test_asins):
        """Test returns empty list when no pending ASINs"""
        result = await asin_manager.get_pending_asins()
        
        # Filter out non-test ASINs
        test_asins = [r for r in result if r['asin'].startswith('TEST_')]
        assert len(test_asins) == 0
    
    @pytest.mark.asyncio
    async def test_returns_pending_asins(self, asin_manager, clean_test_asins):
        """Test returns pending ASINs in correct order"""
        # Insert test ASINs with different priorities
        asin_manager.client.table('asin_staging').insert([
            {'asin': 'TEST_PEND01', 'source': 'manual', 'status': 'pending', 'priority': 5},
            {'asin': 'TEST_PEND02', 'source': 'manual', 'status': 'pending', 'priority': 10},
            {'asin': 'TEST_PEND03', 'source': 'manual', 'status': 'pending', 'priority': 0},
            {'asin': 'TEST_COMP01', 'source': 'manual', 'status': 'completed', 'priority': 0},  # Should not be included
        ]).execute()
        
        # Get pending ASINs
        result = await asin_manager.get_pending_asins(limit=10)
        
        # Filter to test ASINs
        test_asins = [r for r in result if r['asin'].startswith('TEST_')]
        
        assert len(test_asins) == 3
        # Should be ordered by priority DESC
        assert test_asins[0]['asin'] == 'TEST_PEND02'  # priority 10
        assert test_asins[1]['asin'] == 'TEST_PEND01'  # priority 5
        assert test_asins[2]['asin'] == 'TEST_PEND03'  # priority 0
    
    @pytest.mark.asyncio
    async def test_respects_limit_parameter(self, asin_manager, clean_test_asins):
        """Test that limit parameter works"""
        # Insert 5 pending ASINs
        asin_manager.client.table('asin_staging').insert([
            {'asin': f'TEST_LIM{i:02d}', 'source': 'manual', 'status': 'pending'}
            for i in range(5)
        ]).execute()
        
        # Get with limit=2
        result = await asin_manager.get_pending_asins(limit=2)
        
        test_asins = [r for r in result if r['asin'].startswith('TEST_')]
        assert len(test_asins) == 2
    
    @pytest.mark.asyncio
    async def test_priority_only_filter(self, asin_manager, clean_test_asins):
        """Test priority_only parameter filters correctly"""
        # Insert ASINs with different priorities
        asin_manager.client.table('asin_staging').insert([
            {'asin': 'TEST_PRIOR01', 'source': 'manual', 'status': 'pending', 'priority': 10},
            {'asin': 'TEST_PRIOR02', 'source': 'manual', 'status': 'pending', 'priority': 0},
            {'asin': 'TEST_PRIOR03', 'source': 'manual', 'status': 'pending', 'priority': 5},
        ]).execute()
        
        # Get only priority > 0
        result = await asin_manager.get_pending_asins(priority_only=True)
        
        test_asins = [r for r in result if r['asin'].startswith('TEST_')]
        
        assert len(test_asins) == 2
        assert all(r['priority'] > 0 for r in test_asins)


class TestMarkASINProcessing:
    """Test marking ASIN as being processed"""
    
    @pytest.mark.asyncio
    async def test_marks_as_processing(self, asin_manager, clean_test_asins):
        """Test marking ASIN as processing"""
        # Insert pending ASIN
        asin_manager.client.table('asin_staging').insert({
            'asin': 'TEST_PROC01',
            'source': 'manual',
            'status': 'pending',
            'attempts': 0
        }).execute()
        
        # Mark as processing
        result = await asin_manager.mark_asin_processing('TEST_PROC01')
        
        assert result is True
        
        # Verify in database
        record = asin_manager.client.table('asin_staging')\
            .select('*')\
            .eq('asin', 'TEST_PROC01')\
            .single()\
            .execute()
        
        assert record.data['status'] == 'processing'
        assert record.data['attempts'] >= 1  # Should increment
        assert record.data['last_attempt_at'] is not None


class TestMarkASINCompleted:
    """Test marking ASIN as completed"""
    
    @pytest.mark.asyncio
    async def test_marks_as_completed(self, asin_manager, clean_test_asins):
        """Test marking ASIN as completed with panel_id"""
        # Insert processing ASIN
        asin_manager.client.table('asin_staging').insert({
            'asin': 'TEST_COMPL01',
            'source': 'manual',
            'status': 'processing'
        }).execute()
        
        # Mark as completed
        # First create a real panel to satisfy foreign key constraint
        panel_insert = asin_manager.db.client.table('solar_panels').insert({
            'asin': 'TEST_PANEL_COMPL',
            'name': 'Test Completed Panel',
            'manufacturer': 'Test',
            'length_cm': 100,
            'width_cm': 50,
            'weight_kg': 10,
            'wattage': 100,
            'price_usd': 99.99
        }).execute()
        panel_id = panel_insert.data[0]['id']
        
        result = await asin_manager.mark_asin_completed('TEST_COMPL01', panel_id)
        
        assert result is True
        
        # Verify in database
        record = asin_manager.client.table('asin_staging')\
            .select('*')\
            .eq('asin', 'TEST_COMPL01')\
            .single()\
            .execute()
        
        assert record.data['status'] == 'completed'
        assert record.data['panel_id'] == panel_id
        assert record.data['ingested_at'] is not None


class TestMarkASINFailed:
    """Test marking ASIN as failed with retry logic"""
    
    @pytest.mark.asyncio
    async def test_resets_to_pending_when_attempts_below_max(self, asin_manager, clean_test_asins):
        """Test resets to pending when attempts < max_attempts"""
        # Insert ASIN with 1 attempt (below max of 3)
        asin_manager.client.table('asin_staging').insert({
            'asin': 'TEST_FAIL01',
            'source': 'manual',
            'status': 'processing',
            'attempts': 1,
            'max_attempts': 3
        }).execute()
        
        # Mark as failed
        result = await asin_manager.mark_asin_failed('TEST_FAIL01', 'Test error')
        
        assert result is True
        
        # Verify reset to pending for retry
        record = asin_manager.client.table('asin_staging')\
            .select('*')\
            .eq('asin', 'TEST_FAIL01')\
            .single()\
            .execute()
        
        assert record.data['status'] == 'pending'  # Reset for retry
        assert record.data['error_message'] == 'Test error'
    
    @pytest.mark.asyncio
    async def test_marks_permanently_failed_when_max_attempts_reached(self, asin_manager, clean_test_asins):
        """Test marks as permanently failed when attempts >= max_attempts"""
        # Insert ASIN at max attempts
        asin_manager.client.table('asin_staging').insert({
            'asin': 'TEST_FAIL02',
            'source': 'manual',
            'status': 'processing',
            'attempts': 3,
            'max_attempts': 3
        }).execute()
        
        # Mark as failed
        result = await asin_manager.mark_asin_failed('TEST_FAIL02', 'Max retries exceeded')
        
        assert result is True
        
        # Verify permanently failed
        record = asin_manager.client.table('asin_staging')\
            .select('*')\
            .eq('asin', 'TEST_FAIL02')\
            .single()\
            .execute()
        
        assert record.data['status'] == 'failed'  # Permanently failed
        assert record.data['error_message'] == 'Max retries exceeded'


class TestGetStagingStats:
    """Test getting staging queue statistics"""
    
    @pytest.mark.asyncio
    async def test_returns_correct_counts_by_status(self, asin_manager, clean_test_asins):
        """Test counts ASINs by status correctly"""
        # Insert ASINs with various statuses
        asin_manager.client.table('asin_staging').insert([
            {'asin': 'TEST_STAT01', 'source': 'manual', 'status': 'pending'},
            {'asin': 'TEST_STAT02', 'source': 'manual', 'status': 'pending'},
            {'asin': 'TEST_STAT03', 'source': 'manual', 'status': 'processing'},
            {'asin': 'TEST_STAT04', 'source': 'manual', 'status': 'completed'},
            {'asin': 'TEST_STAT05', 'source': 'manual', 'status': 'failed'},
            {'asin': 'TEST_STAT06', 'source': 'manual', 'status': 'duplicate'},
        ]).execute()
        
        # Get stats
        stats = await asin_manager.get_staging_stats()
        
        # Note: Stats include ALL records, not just test ones
        # So we verify our test records contributed to the counts
        assert stats['total'] >= 6
        assert stats['pending'] >= 2
        assert stats['processing'] >= 1
        assert stats['completed'] >= 1
        assert stats['failed'] >= 1
        assert stats['duplicate'] >= 1
    
    @pytest.mark.asyncio
    async def test_handles_empty_staging_table(self, asin_manager, clean_test_asins):
        """Test stats work with empty table (just test ASINs cleaned)"""
        # Get stats (after cleanup, only non-test ASINs remain)
        stats = await asin_manager.get_staging_stats()
        
        # Should return valid dict structure
        assert isinstance(stats, dict)
        assert 'total' in stats
        assert 'pending' in stats
        assert stats['total'] >= 0  # At least 0


class TestRetryFailedASINs:
    """Test retrying failed ASINs"""
    
    @pytest.mark.asyncio
    async def test_retries_failed_asins_below_max_attempts(self, asin_manager, clean_test_asins):
        """Test retries ASINs that haven't exceeded max attempts"""
        # Insert failed ASINs
        asin_manager.client.table('asin_staging').insert([
            {'asin': 'TEST_RETRY01', 'source': 'manual', 'status': 'failed', 'attempts': 1, 'max_attempts': 3},
            {'asin': 'TEST_RETRY02', 'source': 'manual', 'status': 'failed', 'attempts': 2, 'max_attempts': 3},
            {'asin': 'TEST_RETRY03', 'source': 'manual', 'status': 'failed', 'attempts': 3, 'max_attempts': 3},  # At max
        ]).execute()
        
        # Retry failed ASINs
        count = await asin_manager.retry_failed_asins(limit=10)
        
        # Should retry 2 (RETRY01 and RETRY02), not RETRY03
        assert count >= 2
        
        # Verify RETRY01 and RETRY02 are pending
        retry01 = asin_manager.client.table('asin_staging')\
            .select('*').eq('asin', 'TEST_RETRY01').single().execute()
        assert retry01.data['status'] == 'pending'
        
        retry02 = asin_manager.client.table('asin_staging')\
            .select('*').eq('asin', 'TEST_RETRY02').single().execute()
        assert retry02.data['status'] == 'pending'
        
        # Verify RETRY03 still failed
        retry03 = asin_manager.client.table('asin_staging')\
            .select('*').eq('asin', 'TEST_RETRY03').single().execute()
        assert retry03.data['status'] == 'failed'


class TestClearDuplicates:
    """Test clearing duplicate records"""
    
    @pytest.mark.asyncio
    async def test_clears_duplicate_records(self, asin_manager, clean_test_asins):
        """Test clears all records with status='duplicate'"""
        # Insert duplicate records
        asin_manager.client.table('asin_staging').insert([
            {'asin': 'TEST_DUP01', 'source': 'manual', 'status': 'duplicate'},
            {'asin': 'TEST_DUP02', 'source': 'manual', 'status': 'duplicate'},
            {'asin': 'TEST_KEEP01', 'source': 'manual', 'status': 'pending'},
        ]).execute()
        
        # Clear duplicates
        count = await asin_manager.clear_duplicates()
        
        # Should delete at least 2 (our test duplicates)
        assert count >= 2
        
        # Verify duplicates are gone
        duplicates = asin_manager.client.table('asin_staging')\
            .select('*')\
            .like('asin', 'TEST_DUP%')\
            .execute()
        
        assert len(duplicates.data) == 0
        
        # Verify pending record still exists
        pending = asin_manager.client.table('asin_staging')\
            .select('*')\
            .eq('asin', 'TEST_KEEP01')\
            .execute()
        
        assert len(pending.data) == 1


class TestCompleteWorkflow:
    """Test complete ASIN staging workflow"""
    
    @pytest.mark.asyncio
    async def test_full_workflow_new_to_completed(self, asin_manager, clean_test_asins):
        """Test complete workflow: stage → processing → completed"""
        asin = 'TEST_WORKFLOW'
        
        # Step 1: Stage new ASIN
        stage_result = await asin_manager.stage_asin(asin, 'manual', 'test keyword')
        assert stage_result is True
        
        record = asin_manager.client.table('asin_staging')\
            .select('*').eq('asin', asin).single().execute()
        assert record.data['status'] == 'pending'
        
        # Step 2: Mark as processing
        process_result = await asin_manager.mark_asin_processing(asin)
        assert process_result is True
        
        record = asin_manager.client.table('asin_staging')\
            .select('*').eq('asin', asin).single().execute()
        assert record.data['status'] == 'processing'
        
        # Step 3: Mark as completed
        # Create a real panel first
        panel_insert = asin_manager.db.client.table('solar_panels').insert({
            'asin': 'TEST_PANEL_WF1',
            'name': 'Test Workflow Panel',
            'manufacturer': 'Test',
            'length_cm': 100,
            'width_cm': 50,
            'weight_kg': 10,
            'wattage': 100,
            'price_usd': 99.99
        }).execute()
        panel_id = panel_insert.data[0]['id']
        
        complete_result = await asin_manager.mark_asin_completed(asin, panel_id)
        assert complete_result is True
        
        record = asin_manager.client.table('asin_staging')\
            .select('*').eq('asin', asin).single().execute()
        assert record.data['status'] == 'completed'
        assert record.data['panel_id'] == panel_id
    
    @pytest.mark.asyncio
    async def test_full_workflow_with_retry(self, asin_manager, clean_test_asins):
        """Test workflow with failure and retry"""
        asin = 'TEST_RETRY_WF'
        
        # Stage ASIN
        await asin_manager.stage_asin(asin, 'manual')
        
        # Mark as processing
        await asin_manager.mark_asin_processing(asin)
        
        # Mark as failed (first attempt)
        await asin_manager.mark_asin_failed(asin, 'First failure')
        
        # Should be reset to pending
        record = asin_manager.client.table('asin_staging')\
            .select('*').eq('asin', asin).single().execute()
        assert record.data['status'] == 'pending'
        assert record.data['attempts'] >= 1
        
        # Try again - mark processing
        await asin_manager.mark_asin_processing(asin)
        
        # This time succeed - create panel first
        panel_insert = asin_manager.db.client.table('solar_panels').insert({
            'asin': 'TEST_PANEL_WF2',
            'name': 'Test Retry Workflow Panel',
            'manufacturer': 'Test',
            'length_cm': 100,
            'width_cm': 50,
            'weight_kg': 10,
            'wattage': 100,
            'price_usd': 99.99
        }).execute()
        panel_id = panel_insert.data[0]['id']
        
        await asin_manager.mark_asin_completed(asin, panel_id)
        
        # Should be completed
        record = asin_manager.client.table('asin_staging')\
            .select('*').eq('asin', asin).single().execute()
        assert record.data['status'] == 'completed'


if __name__ == "__main__":
    pytest.main([__file__, "--use-test-db", "-v"])

