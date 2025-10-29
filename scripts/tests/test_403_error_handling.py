#!/usr/bin/env python3
"""
Test 403 Forbidden error handling for ScraperAPI.
Tests that 403 errors are properly detected and handled without marking ASINs as failed.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import requests
from scripts.scraper import ScraperAPIClient, ScraperAPIForbiddenError
from scripts.ingest_staged_asins import ingest_single_asin
from scripts.search_solar_panels import search_and_stage
from scripts.database import SolarPanelDB
from scripts.asin_manager import ASINManager
from scripts.error_handling import RetryHandler, RetryConfig


class Test403ErrorHandling:
    """Test cases for 403 Forbidden error handling."""
    
    @pytest.fixture
    def mock_asin_manager(self):
        """Create a mock ASIN manager."""
        manager = MagicMock(spec=ASINManager)
        manager.mark_asin_processing = AsyncMock(return_value=True)
        manager.mark_asin_failed = AsyncMock(return_value=True)
        manager.mark_asin_completed = AsyncMock(return_value=True)
        return manager
    
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
    
    def test_scraper_api_403_error_detection(self):
        """Test that ScraperAPI client detects 403 errors."""
        # Create a mock 403 response
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("403 Forbidden")
        mock_response.json.return_value = {"error": "Forbidden"}
        
        # Create a mock request exception with response
        mock_exception = requests.exceptions.HTTPError("403 Forbidden")
        mock_exception.response = mock_response
        
        # Mock the requests.get call to raise the exception
        with patch('requests.get') as mock_get:
            mock_get.side_effect = mock_exception
            
            scraper = ScraperAPIClient()
            
            # This should raise ScraperAPIForbiddenError
            with pytest.raises(ScraperAPIForbiddenError):
                scraper.fetch_product("B0CPLQGGD7")
    
    def test_scraper_api_403_error_detection_search(self):
        """Test that ScraperAPI client detects 403 errors in search."""
        # Create a mock 403 response
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("403 Forbidden")
        mock_response.json.return_value = {"error": "Forbidden"}
        
        # Create a mock request exception with response
        mock_exception = requests.exceptions.HTTPError("403 Forbidden")
        mock_exception.response = mock_response
        
        # Mock the requests.get call to raise the exception
        with patch('requests.get') as mock_get:
            mock_get.side_effect = mock_exception
            
            scraper = ScraperAPIClient()
            
            # This should raise ScraperAPIForbiddenError
            with pytest.raises(ScraperAPIForbiddenError):
                scraper.search_amazon("solar panel")
    
    @pytest.mark.asyncio
    @patch('scripts.ingest_staged_asins.check_recent_raw_data')
    @patch('scripts.ingest_staged_asins.create_client')
    async def test_ingest_403_error_handling(self, mock_create_client, mock_check_recent, mock_asin_manager, mock_db, 
                                             mock_retry_handler, mock_logger):
        """Test that ingest script handles 403 errors without marking ASIN as failed."""
        # Setup: Mock filtered_asins check to return empty
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        mock_create_client.return_value = mock_client
        
        # Setup: No recent raw data (bypass cache)
        mock_check_recent.return_value = None
        
        # Setup: Mock retry handler to raise 403 error
        mock_retry_handler.execute_with_retry = AsyncMock(
            side_effect=ScraperAPIForbiddenError("ScraperAPI 403 Forbidden: API key invalid")
        )
        
        # Execute
        result = await ingest_single_asin(
            asin="B0CPLQGGD7",
            scraper=MagicMock(),
            db=mock_db,
            asin_manager=mock_asin_manager,
            retry_handler=mock_retry_handler,
            logger=mock_logger
        )
        
        # Verify
        assert result is False
        
        # Verify that ASIN was NOT marked as failed
        mock_asin_manager.mark_asin_failed.assert_not_called()
        
        # Verify that critical error was logged
        critical_calls = [call for call in mock_logger.log_script_event.call_args_list 
                          if 'CRITICAL' in str(call)]
        assert len(critical_calls) > 0
        
        # Verify the error message contains 403 information
        error_messages = [str(call) for call in mock_logger.log_script_event.call_args_list]
        assert any("403 Forbidden" in msg for msg in error_messages)
        assert any("API access issues" in msg for msg in error_messages)
    
    @pytest.mark.asyncio
    async def test_search_403_error_handling(self, mock_asin_manager, mock_logger):
        """Test that search script handles 403 errors gracefully."""
        # Setup: Mock scraper to raise 403 error
        mock_scraper = MagicMock()
        mock_scraper.search_amazon.side_effect = ScraperAPIForbiddenError("ScraperAPI 403 Forbidden: API key invalid")
        mock_scraper.extract_asins_from_search = MagicMock(return_value=[])
        
        # Execute
        result = await search_and_stage(
            keyword="solar panel",
            pages=1,
            scraper=mock_scraper,
            asin_manager=mock_asin_manager,
            product_filter=MagicMock(),
            logger=mock_logger
        )
        
        # Verify
        assert result is not None
        assert result['total_found'] == 0  # No ASINs found due to 403 error
        
        # Verify that critical error was logged
        critical_calls = [call for call in mock_logger.log_script_event.call_args_list 
                          if 'CRITICAL' in str(call)]
        assert len(critical_calls) > 0
        
        # Verify the error message contains 403 information
        error_messages = [str(call) for call in mock_logger.log_script_event.call_args_list]
        assert any("403 Forbidden" in msg for msg in error_messages)
        assert any("API access issues" in msg for msg in error_messages)
    
    def test_403_error_vs_other_errors(self):
        """Test that 403 errors are handled differently from other HTTP errors."""
        # Test 404 error (should not raise ScraperAPIForbiddenError)
        mock_response_404 = MagicMock()
        mock_response_404.status_code = 404
        mock_response_404.raise_for_status.side_effect = requests.exceptions.HTTPError("404 Not Found")
        
        mock_exception_404 = requests.exceptions.HTTPError("404 Not Found")
        mock_exception_404.response = mock_response_404
        
        with patch('requests.get') as mock_get:
            mock_get.side_effect = mock_exception_404
            
            scraper = ScraperAPIClient()
            
            # This should NOT raise ScraperAPIForbiddenError
            result = scraper.fetch_product("B0CPLQGGD7")
            assert result is None  # Should return None for 404
        
        # Test 403 error (should raise ScraperAPIForbiddenError)
        mock_response_403 = MagicMock()
        mock_response_403.status_code = 403
        mock_response_403.raise_for_status.side_effect = requests.exceptions.HTTPError("403 Forbidden")
        
        mock_exception_403 = requests.exceptions.HTTPError("403 Forbidden")
        mock_exception_403.response = mock_response_403
        
        with patch('requests.get') as mock_get:
            mock_get.side_effect = mock_exception_403
            
            scraper = ScraperAPIClient()
            
            # This SHOULD raise ScraperAPIForbiddenError
            with pytest.raises(ScraperAPIForbiddenError):
                scraper.fetch_product("B0CPLQGGD7")
    
    def test_403_error_without_response(self):
        """Test that 403 errors without response object are handled gracefully."""
        # Create a request exception without response
        mock_exception = requests.exceptions.RequestException("Connection error")
        # No response attribute
        
        with patch('requests.get') as mock_get:
            mock_get.side_effect = mock_exception
            
            scraper = ScraperAPIClient()
            
            # This should NOT raise ScraperAPIForbiddenError
            result = scraper.fetch_product("B0CPLQGGD7")
            assert result is None  # Should return None for connection error


if __name__ == "__main__":
    pytest.main([__file__])
