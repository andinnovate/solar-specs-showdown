#!/usr/bin/env python3
"""
Unit tests for update_prices.py script.
Tests price update functionality, $0 price rejection, and timestamp updates.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from scripts.update_prices import update_panel_price, save_raw_scraper_data
from scripts.database import SolarPanelDB
from scripts.scraper import ScraperAPIClient, ScraperAPIForbiddenError
from scripts.error_handling import RetryHandler


class TestUpdatePanelPrice:
    """Test cases for update_panel_price function."""
    
    @pytest.fixture
    def mock_scraper(self):
        """Create a mock scraper."""
        scraper = MagicMock(spec=ScraperAPIClient)
        return scraper
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database."""
        db = MagicMock(spec=SolarPanelDB)
        db.update_panel_price = AsyncMock(return_value=True)
        db.update_panel_timestamp = AsyncMock(return_value=True)
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
    
    @pytest.fixture
    def sample_panel(self):
        """Create a sample panel dictionary."""
        return {
            'id': 'panel-123',
            'asin': 'B0TEST123',
            'name': 'Test Solar Panel',
            'price_usd': 99.99
        }
    
    @pytest.mark.asyncio
    async def test_update_panel_price_success(self, mock_scraper, mock_db, mock_retry_handler, 
                                              mock_logger, sample_panel):
        """Test successful price update when price changes."""
        # Setup: Mock fetch result with new price
        fetch_result = {
            'parsed_data': {
                'price_usd': 89.99,
                'asin': 'B0TEST123'
            },
            'raw_response': {'test': 'data'},
            'metadata': {'response_time_ms': 1000}
        }
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=fetch_result)
        
        # Execute
        result = await update_panel_price(
            mock_scraper, mock_db, sample_panel, mock_retry_handler, mock_logger
        )
        
        # Verify
        assert result['success'] is True
        assert result['old_price'] == 99.99
        assert result['new_price'] == 89.99
        assert result['error'] is None
        assert 'unchanged' not in result
        
        # Verify database update was called
        mock_db.update_panel_price.assert_called_once_with(
            'panel-123', 89.99, source='scraperapi'
        )
        
        # Verify scraper usage was tracked
        mock_db.track_scraper_usage.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_update_panel_price_unchanged(self, mock_scraper, mock_db, mock_retry_handler,
                                                 mock_logger, sample_panel):
        """Test price update when price is unchanged - should update timestamp."""
        # Setup: Mock fetch result with same price
        fetch_result = {
            'parsed_data': {
                'price_usd': 99.99,  # Same as current
                'asin': 'B0TEST123'
            },
            'raw_response': {'test': 'data'},
            'metadata': {'response_time_ms': 1000}
        }
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=fetch_result)
        
        # Execute
        result = await update_panel_price(
            mock_scraper, mock_db, sample_panel, mock_retry_handler, mock_logger
        )
        
        # Verify
        assert result['success'] is True
        assert result['old_price'] == 99.99
        assert result['new_price'] == 99.99
        assert result['error'] is None
        assert result['unchanged'] is True
        
        # Verify timestamp was updated (not price)
        mock_db.update_panel_timestamp.assert_called_once_with('panel-123')
        mock_db.update_panel_price.assert_not_called()
        
        # Verify log message mentions timestamp update
        log_calls = [str(call) for call in mock_logger.log_script_event.call_args_list]
        assert any('timestamp updated' in str(call).lower() for call in log_calls)
    
    @pytest.mark.asyncio
    async def test_update_panel_price_rejects_zero_price(self, mock_scraper, mock_db, 
                                                         mock_retry_handler, mock_logger, sample_panel):
        """Test that $0 prices are rejected with warning."""
        # Setup: Mock fetch result with $0 price
        fetch_result = {
            'parsed_data': {
                'price_usd': 0,  # $0 price
                'asin': 'B0TEST123'
            },
            'raw_response': {'test': 'data'},
            'metadata': {'response_time_ms': 1000}
        }
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=fetch_result)
        
        # Execute
        result = await update_panel_price(
            mock_scraper, mock_db, sample_panel, mock_retry_handler, mock_logger
        )
        
        # Verify
        assert result['success'] is False
        assert result['old_price'] == 99.99
        assert result['new_price'] == 0
        assert 'Price is $0' in result['error']
        
        # Verify price was NOT updated
        mock_db.update_panel_price.assert_not_called()
        mock_db.update_panel_timestamp.assert_not_called()
        
        # Verify warning was logged
        log_calls = [str(call) for call in mock_logger.log_script_event.call_args_list]
        assert any('warning' in str(call).lower() and 'rejected' in str(call).lower() 
                  for call in log_calls)
    
    @pytest.mark.asyncio
    async def test_update_panel_price_no_asin(self, mock_scraper, mock_db, mock_retry_handler,
                                             mock_logger):
        """Test update fails when panel has no ASIN."""
        panel_no_asin = {
            'id': 'panel-123',
            'name': 'Test Panel',
            'price_usd': 99.99
            # Missing 'asin'
        }
        
        # Execute
        result = await update_panel_price(
            mock_scraper, mock_db, panel_no_asin, mock_retry_handler, mock_logger
        )
        
        # Verify
        assert result['success'] is False
        assert result['error'] == 'No ASIN found for panel'
        assert result['old_price'] is None
        assert result['new_price'] is None
        
        # Verify no API calls were made
        mock_retry_handler.execute_with_retry.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_update_panel_price_fetch_fails(self, mock_scraper, mock_db, mock_retry_handler,
                                                  mock_logger, sample_panel):
        """Test update fails when fetch returns None."""
        # Setup: Mock fetch returns None
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=None)
        
        # Execute
        result = await update_panel_price(
            mock_scraper, mock_db, sample_panel, mock_retry_handler, mock_logger
        )
        
        # Verify
        assert result['success'] is False
        assert 'Failed to fetch product data' in result['error']
        assert result['old_price'] == 99.99
        
        # Verify no database updates
        mock_db.update_panel_price.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_update_panel_price_parsing_fails(self, mock_scraper, mock_db, mock_retry_handler,
                                                    mock_logger, sample_panel):
        """Test update fails when parsing fails."""
        # Setup: Mock fetch result without parsed_data
        fetch_result = {
            'raw_response': {'test': 'data'},
            'metadata': {'response_time_ms': 1000}
            # Missing 'parsed_data'
        }
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=fetch_result)
        
        # Execute
        result = await update_panel_price(
            mock_scraper, mock_db, sample_panel, mock_retry_handler, mock_logger
        )
        
        # Verify
        assert result['success'] is False
        assert 'Failed to parse product data' in result['error']
        assert result['old_price'] == 99.99
        
        # Verify no database updates
        mock_db.update_panel_price.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_update_panel_price_no_price_in_data(self, mock_scraper, mock_db, 
                                                       mock_retry_handler, mock_logger, sample_panel):
        """Test update fails when price is None in parsed data."""
        # Setup: Mock fetch result with None price
        fetch_result = {
            'parsed_data': {
                'price_usd': None,  # No price
                'asin': 'B0TEST123'
            },
            'raw_response': {'test': 'data'},
            'metadata': {'response_time_ms': 1000}
        }
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=fetch_result)
        
        # Execute
        result = await update_panel_price(
            mock_scraper, mock_db, sample_panel, mock_retry_handler, mock_logger
        )
        
        # Verify
        assert result['success'] is False
        assert 'Price not available' in result['error']
        assert result['old_price'] == 99.99
        assert result['new_price'] is None
    
    @pytest.mark.asyncio
    async def test_update_panel_price_scraperapi_forbidden(self, mock_scraper, mock_db,
                                                           mock_retry_handler, mock_logger, sample_panel):
        """Test update stops on ScraperAPI 403 Forbidden error."""
        # Setup: Mock retry handler raises ScraperAPIForbiddenError
        mock_retry_handler.execute_with_retry = AsyncMock(
            side_effect=ScraperAPIForbiddenError("403 Forbidden")
        )
        
        # Execute and verify exception is raised
        with pytest.raises(ScraperAPIForbiddenError):
            await update_panel_price(
                mock_scraper, mock_db, sample_panel, mock_retry_handler, mock_logger
            )
        
        # Verify critical error was logged
        log_calls = [str(call) for call in mock_logger.log_script_event.call_args_list]
        assert any('critical' in str(call).lower() or '403' in str(call) 
                  for call in log_calls)
    
    @pytest.mark.asyncio
    async def test_update_panel_price_database_update_fails(self, mock_scraper, mock_db,
                                                           mock_retry_handler, mock_logger, sample_panel):
        """Test update fails when database update fails."""
        # Setup: Mock fetch result with new price
        fetch_result = {
            'parsed_data': {
                'price_usd': 89.99,
                'asin': 'B0TEST123'
            },
            'raw_response': {'test': 'data'},
            'metadata': {'response_time_ms': 1000}
        }
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=fetch_result)
        
        # Setup: Database update fails
        mock_db.update_panel_price = AsyncMock(return_value=False)
        
        # Execute
        result = await update_panel_price(
            mock_scraper, mock_db, sample_panel, mock_retry_handler, mock_logger
        )
        
        # Verify
        assert result['success'] is False
        assert result['error'] == 'Database update failed'
        assert result['old_price'] == 99.99
        assert result['new_price'] == 89.99


class TestSaveRawScraperData:
    """Test cases for save_raw_scraper_data function."""
    
    @pytest.fixture
    def mock_logger(self):
        """Create a mock logger."""
        logger = MagicMock()
        logger.log_script_event = MagicMock()
        return logger
    
    @pytest.mark.asyncio
    @patch('scripts.update_prices.create_client')
    async def test_save_raw_scraper_data_new_record(self, mock_create_client, mock_logger):
        """Test saving raw data when no existing record exists."""
        # Setup: Mock Supabase client
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_insert = MagicMock()
        
        # Chain: table -> select -> eq -> execute (returns empty)
        mock_eq.execute.return_value.data = []
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        mock_table.insert.return_value.execute.return_value.data = [{'id': 'raw-123'}]
        mock_client.table.return_value = mock_table
        mock_create_client.return_value = mock_client
        
        # Execute
        await save_raw_scraper_data(
            asin='B0TEST123',
            panel_id='panel-123',
            raw_response={'test': 'data'},
            metadata={'response_time_ms': 1000},
            logger=mock_logger
        )
        
        # Verify insert was called
        mock_table.insert.assert_called_once()
        mock_logger.log_script_event.assert_called()
    
    @pytest.mark.asyncio
    @patch('scripts.update_prices.create_client')
    async def test_save_raw_scraper_data_update_existing(self, mock_create_client, mock_logger):
        """Test updating raw data when record exists."""
        # Setup: Mock Supabase client
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_update = MagicMock()
        
        # Chain: table -> select -> eq -> execute (returns existing record)
        mock_eq.execute.return_value.data = [{'id': 'raw-123'}]
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        mock_table.update.return_value.eq.return_value.execute.return_value.data = [{'id': 'raw-123'}]
        mock_client.table.return_value = mock_table
        mock_create_client.return_value = mock_client
        
        # Execute
        await save_raw_scraper_data(
            asin='B0TEST123',
            panel_id='panel-123',
            raw_response={'test': 'data'},
            metadata={'response_time_ms': 1000},
            logger=mock_logger
        )
        
        # Verify update was called (not insert)
        mock_table.update.assert_called_once()
        mock_table.insert.assert_not_called()
    
    @pytest.mark.asyncio
    @patch('scripts.update_prices.create_client')
    async def test_save_raw_scraper_data_handles_exception(self, mock_create_client, mock_logger):
        """Test that exceptions are handled gracefully."""
        # Setup: Mock client raises exception
        mock_create_client.side_effect = Exception("Database error")
        
        # Execute (should not raise)
        await save_raw_scraper_data(
            asin='B0TEST123',
            panel_id='panel-123',
            raw_response={'test': 'data'},
            metadata={'response_time_ms': 1000},
            logger=mock_logger
        )
        
        # Verify warning was logged
        mock_logger.log_script_event.assert_called()
        call_args = str(mock_logger.log_script_event.call_args)
        assert 'WARNING' in call_args or 'warning' in call_args.lower()


class TestUpdatePricesIntegration:
    """Integration tests for update_prices functionality."""
    
    @pytest.fixture
    def mock_scraper(self):
        """Create a mock scraper."""
        scraper = MagicMock(spec=ScraperAPIClient)
        return scraper
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database."""
        db = MagicMock(spec=SolarPanelDB)
        db.update_panel_price = AsyncMock(return_value=True)
        db.update_panel_timestamp = AsyncMock(return_value=True)
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
    async def test_price_update_flow_with_raw_data_saving(self, mock_scraper, mock_db,
                                                          mock_retry_handler, mock_logger):
        """Test that raw data is saved even when price update succeeds."""
        panel = {
            'id': 'panel-123',
            'asin': 'B0TEST123',
            'name': 'Test Panel',
            'price_usd': 99.99
        }
        
        fetch_result = {
            'parsed_data': {
                'price_usd': 89.99,
                'asin': 'B0TEST123'
            },
            'raw_response': {'test': 'raw data'},
            'metadata': {'response_time_ms': 1000, 'scraper_version': 'v1'}
        }
        mock_retry_handler.execute_with_retry = AsyncMock(return_value=fetch_result)
        
        # Mock save_raw_scraper_data
        with patch('scripts.update_prices.save_raw_scraper_data') as mock_save_raw:
            mock_save_raw.return_value = None
            
            result = await update_panel_price(
                mock_scraper, mock_db, panel, mock_retry_handler, mock_logger
            )
            
            # Verify raw data was saved
            mock_save_raw.assert_called_once_with(
                'B0TEST123',
                'panel-123',
                {'test': 'raw data'},
                {'response_time_ms': 1000, 'scraper_version': 'v1'},
                mock_logger
            )
            
            assert result['success'] is True

