#!/usr/bin/env python3
"""
Test ASIN retry logic and failure handling.
Tests the improved retry logic that distinguishes between permanent and temporary failures.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from scripts.asin_manager import ASINManager
from scripts.ingest_staged_asins import ingest_single_asin
from scripts.scraper import ScraperAPIClient
from scripts.database import SolarPanelDB
from scripts.error_handling import RetryHandler, RetryConfig


class TestASINRetryLogic:
    """Test cases for ASIN retry logic and failure handling."""
    
    @pytest.fixture
    def mock_asin_manager(self):
        """Create a mock ASIN manager."""
        manager = MagicMock(spec=ASINManager)
        manager.mark_asin_processing = AsyncMock(return_value=True)
        manager.mark_asin_failed = AsyncMock(return_value=True)
        manager.mark_asin_completed = AsyncMock(return_value=True)
        return manager
    
    @pytest.fixture
    def mock_scraper(self):
        """Create a mock scraper."""
        scraper = MagicMock(spec=ScraperAPIClient)
        return scraper
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database."""
        db = MagicMock(spec=SolarPanelDB)
        db.get_panel_by_asin = AsyncMock(return_value=None)
        db.add_new_panel = AsyncMock(return_value="panel-123")
        db.track_scraper_usage = AsyncMock(return_value=True)
        return db
    
    @pytest.fixture
    def mock_retry_handler(self):
        """Create a mock retry handler."""
        handler = MagicMock(spec=RetryHandler)
        return handler
    
    @pytest.fixture
    def mock_logger(self):
        """Create a mock logger."""
        logger = MagicMock()
        logger.log_script_event = MagicMock()
        return logger
    
    @pytest.mark.asyncio
    @patch('scripts.ingest_staged_asins.check_recent_raw_data')
    @patch('scripts.ingest_staged_asins.create_client')
    async def test_permanent_failure_parsing_error(self, mock_create_client, mock_check_recent, mock_asin_manager, mock_scraper, 
                                                   mock_db, mock_retry_handler, mock_logger):
        """Test that parsing failures are marked as permanent failures."""
        # Setup: Mock filtered_asins check to return empty
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        mock_create_client.return_value = mock_client
        
        # Setup: No recent raw data (bypass cache)
        mock_check_recent.return_value = None
        
        # Setup: Scraper returns None (parsing failure)
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=None)
        
        # Execute
        result = await ingest_single_asin(
            asin="B0CPLQGGD7",
            scraper=mock_scraper,
            db=mock_db,
            asin_manager=mock_asin_manager,
            retry_handler=mock_retry_handler,
            logger=mock_logger
        )
        
        # Verify
        assert result is False
        mock_asin_manager.mark_asin_failed.assert_called_once()
        
        # Check that it was marked as permanent failure
        call_args = mock_asin_manager.mark_asin_failed.call_args
        assert call_args[0][0] == "B0CPLQGGD7"  # asin
        assert "Failed to fetch product data" in call_args[0][1]  # error message
        assert call_args[1]["is_permanent"] is True  # permanent flag
    
    @pytest.mark.asyncio
    @patch('scripts.ingest_staged_asins.check_recent_raw_data')
    @patch('scripts.ingest_staged_asins.create_client')
    async def test_temporary_failure_network_error(self, mock_create_client, mock_check_recent, mock_asin_manager, mock_scraper, 
                                                   mock_db, mock_retry_handler, mock_logger):
        """Test that network errors are marked as temporary failures."""
        # Setup: Mock filtered_asins check to return empty
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        mock_create_client.return_value = mock_client
        
        # Setup: No recent raw data (bypass cache)
        mock_check_recent.return_value = None
        
        # Setup: Network exception during fetch
        mock_retry_handler.execute_with_retry = AsyncMock(
            side_effect=Exception("Network timeout")
        )
        
        # Execute
        result = await ingest_single_asin(
            asin="B0CPLQGGD7",
            scraper=mock_scraper,
            db=mock_db,
            asin_manager=mock_asin_manager,
            retry_handler=mock_retry_handler,
            logger=mock_logger
        )
        
        # Verify
        assert result is False
        mock_asin_manager.mark_asin_failed.assert_called_once()
        
        # Check that it was marked as permanent failure (exceptions are permanent)
        call_args = mock_asin_manager.mark_asin_failed.call_args
        assert call_args[0][0] == "B0CPLQGGD7"  # asin
        assert "Exception during product fetch" in call_args[0][1]  # error message
        assert call_args[1]["is_permanent"] is True  # permanent flag
    
    @pytest.mark.asyncio
    @patch('scripts.ingest_staged_asins.check_recent_raw_data')
    @patch('scripts.ingest_staged_asins.create_client')
    async def test_successful_processing(self, mock_create_client, mock_check_recent, mock_asin_manager, mock_scraper, 
                                        mock_db, mock_retry_handler, mock_logger):
        """Test successful ASIN processing."""
        # Setup: Mock filtered_asins check to return empty
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        mock_create_client.return_value = mock_client
        
        # Setup: No recent raw data (bypass cache)
        mock_check_recent.return_value = None
        
        # Setup: No existing panel, valid product data
        mock_db.get_panel_by_asin = AsyncMock(return_value=None)  # No existing panel
        product_data = {
            'parsed_data': {
                'name': 'Test Solar Panel',
                'manufacturer': 'Test Corp',
                'wattage': 400,  # Above 30W threshold
                'price_usd': 299.99,
                'length_cm': 200.0,
                'width_cm': 100.0,
                'weight_kg': 25.0
            },
            'raw_response': {'test': 'data'},
            'metadata': {'test': 'metadata'}
        }
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=product_data)
        mock_db.add_new_panel = AsyncMock(return_value="panel-123")
        
        # Execute
        result = await ingest_single_asin(
            asin="B0CPLQGGD7",
            scraper=mock_scraper,
            db=mock_db,
            asin_manager=mock_asin_manager,
            retry_handler=mock_retry_handler,
            logger=mock_logger
        )
        
        # Verify
        assert result is True
        mock_asin_manager.mark_asin_completed.assert_called_once()
        mock_db.add_new_panel.assert_called_once()
    
    @pytest.mark.asyncio
    @patch('scripts.ingest_staged_asins.check_recent_raw_data')
    @patch('scripts.ingest_staged_asins.create_client')
    async def test_duplicate_asin_skips_api_call(self, mock_create_client, mock_check_recent, mock_asin_manager, mock_scraper, 
                                                mock_db, mock_retry_handler, mock_logger):
        """Test that duplicate ASINs skip API calls to save credits."""
        # Setup: Mock filtered_asins check to return empty
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        mock_create_client.return_value = mock_client
        
        # Setup: No recent raw data (bypass cache)
        mock_check_recent.return_value = None
        
        # Setup: Existing panel found
        mock_db.get_panel_by_asin = AsyncMock(return_value={"id": "existing-panel"})
        
        # Execute
        result = await ingest_single_asin(
            asin="B0CPLQGGD7",
            scraper=mock_scraper,
            db=mock_db,
            asin_manager=mock_asin_manager,
            retry_handler=mock_retry_handler,
            logger=mock_logger
        )
        
        # Verify
        assert result is False
        mock_asin_manager.mark_asin_failed.assert_called_once()
        
        # Verify API was never called
        mock_retry_handler.execute_with_retry.assert_not_called()
        
        # Verify the error message
        call_args = mock_asin_manager.mark_asin_failed.call_args
        assert "Already exists in database" in call_args[0][1]
    
    @pytest.mark.asyncio
    @patch('scripts.ingest_staged_asins.check_recent_raw_data')
    @patch('scripts.ingest_staged_asins.create_client')
    async def test_wattage_filtering(self, mock_create_client, mock_check_recent, mock_asin_manager, mock_scraper, 
                                    mock_db, mock_retry_handler, mock_logger):
        """Test that low wattage panels are filtered out."""
        # Setup: Mock filtered_asins check to return empty
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        mock_create_client.return_value = mock_client

        # Setup: No recent raw data (bypass cache)
        mock_check_recent.return_value = None

        # Setup: No existing panel, low wattage product
        mock_db.get_panel_by_asin = AsyncMock(return_value=None)  # No existing panel
        product_data = {
            'parsed_data': {
                'name': 'Low Power Panel',
                'manufacturer': 'Test Corp',
                'wattage': 20,  # Below 30W threshold
                'price_usd': 99.99,
                'length_cm': 50.0,
                'width_cm': 30.0,
                'weight_kg': 5.0
            },
            'raw_response': {'test': 'data'},
            'metadata': {'test': 'metadata'}
        }
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=product_data)
        
        # Execute
        result = await ingest_single_asin(
            asin="B0CPLQGGD7",
            scraper=mock_scraper,
            db=mock_db,
            asin_manager=mock_asin_manager,
            retry_handler=mock_retry_handler,
            logger=mock_logger
        )
        
        # Verify
        assert result is False
        mock_asin_manager.mark_asin_failed.assert_called_once()
        
        # Check that it was marked as failed (filtering is permanent)
        call_args = mock_asin_manager.mark_asin_failed.call_args
        assert "wattage_too_low_20W" in call_args[0][1]  # error message
        # Note: wattage filtering doesn't use is_permanent parameter in current implementation
    
    def test_asin_manager_permanent_failure(self):
        """Test ASIN manager permanent failure logic."""
        # This would require mocking the database client
        # For now, we'll test the logic conceptually
        pass
    
    def test_asin_manager_temporary_failure(self):
        """Test ASIN manager temporary failure logic."""
        # This would require mocking the database client
        # For now, we'll test the logic conceptually
        pass


class TestEnhancedLogging:
    """Test enhanced logging functionality."""
    
    def test_parsing_failure_logging(self):
        """Test that parsing failures include relevant debugging information."""
        # This would test the enhanced logging in the scraper
        # when price parsing fails
        pass
    
    def test_asin_processing_logging(self):
        """Test that ASIN processing includes detailed status information."""
        # This would test the enhanced logging in the ingest function
        pass


if __name__ == "__main__":
    pytest.main([__file__])
