"""
Test batch processing functionality for ASIN manager.
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock
from scripts.asin_manager import ASINManager


class TestBatchProcessing:
    """Test batch processing functionality"""
    
    @pytest.mark.asyncio
    async def test_mark_batch_processing_success(self):
        """Test successful batch processing"""
        # Mock the client and response
        mock_client = Mock()
        mock_result = Mock()
        mock_result.data = [{'asin': 'B0TEST001'}, {'asin': 'B0TEST002'}]
        mock_client.table.return_value.update.return_value.in_.return_value.execute.return_value = mock_result
        
        asin_manager = ASINManager()
        asin_manager.client = mock_client
        
        # Test batch processing
        asin_list = ['B0TEST001', 'B0TEST002', 'B0TEST003']
        result = await asin_manager.mark_batch_processing(asin_list)
        
        assert result is True
        mock_client.table.assert_called_with('asin_staging')
        mock_client.table.return_value.update.assert_called_with({
            'status': 'processing',
            'last_attempt_at': 'now()'
        })
        mock_client.table.return_value.update.return_value.in_.assert_called_with('asin', asin_list)
    
    @pytest.mark.asyncio
    async def test_mark_batch_processing_empty_list(self):
        """Test batch processing with empty list"""
        mock_client = Mock()
        asin_manager = ASINManager()
        asin_manager.client = mock_client
        
        # Test with empty list
        result = await asin_manager.mark_batch_processing([])
        
        assert result is True
        # Should not call database for empty list
        mock_client.table.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_mark_batch_processing_exception(self):
        """Test batch processing with exception"""
        mock_client = Mock()
        mock_client.table.return_value.update.return_value.in_.return_value.execute.side_effect = Exception("Database error")
        
        asin_manager = ASINManager()
        asin_manager.client = mock_client
        
        # Test batch processing with exception
        asin_list = ['B0TEST001', 'B0TEST002']
        result = await asin_manager.mark_batch_processing(asin_list)
        
        assert result is False
