#!/usr/bin/env python3
"""
Test CLI functionality for ingest_staged_asins.py.
Tests the new --asin argument for processing specific ASINs.
"""

import pytest
import sys
import os
from unittest.mock import patch, MagicMock, AsyncMock
from io import StringIO

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scripts.ingest_staged_asins import main


class TestIngestCLI:
    """Test CLI functionality for the ingest script."""
    
    @pytest.fixture
    def mock_supabase_client(self):
        """Mock Supabase client."""
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                'asin': 'B0CPLQGGD7',
                'status': 'pending',
                'source': 'search',
                'source_keyword': 'solar panel test',
                'attempts': 0,
                'max_attempts': 3,
                'error_message': None
            }
        ]
        return client
    
    @pytest.fixture
    def mock_services(self):
        """Mock all required services."""
        services = {
            'scraper': MagicMock(),
            'db': MagicMock(),
            'asin_manager': MagicMock(),
            'retry_handler': MagicMock(),
            'logger': MagicMock()
        }
        
        # Setup async mocks
        for service in ['scraper', 'db', 'asin_manager', 'retry_handler']:
            if hasattr(services[service], 'mark_asin_processing'):
                services[service].mark_asin_processing = AsyncMock(return_value=True)
            if hasattr(services[service], 'mark_asin_failed'):
                services[service].mark_asin_failed = AsyncMock(return_value=True)
            if hasattr(services[service], 'mark_asin_completed'):
                services[service].mark_asin_completed = AsyncMock(return_value=True)
            if hasattr(services[service], 'get_panel_by_asin'):
                services[service].get_panel_by_asin = AsyncMock(return_value=None)
            if hasattr(services[service], 'add_new_panel'):
                services[service].add_new_panel = AsyncMock(return_value="panel-123")
            if hasattr(services[service], 'track_scraper_usage'):
                services[service].track_scraper_usage = AsyncMock(return_value=True)
            if hasattr(services[service], 'execute_with_retry'):
                services[service].execute_with_retry = AsyncMock(return_value={
                    'name': 'Test Panel',
                    'manufacturer': 'Test Corp',
                    'wattage': 400,
                    'price_usd': 299.99,
                    'length_cm': 200.0,
                    'width_cm': 100.0,
                    'weight_kg': 25.0
                })
        
        return services
    
    @patch('scripts.ingest_staged_asins.ScriptExecutionContext')
    @patch('scripts.ingest_staged_asins.create_client')
    @patch('scripts.ingest_staged_asins.ScraperAPIClient')
    @patch('scripts.ingest_staged_asins.SolarPanelDB')
    @patch('scripts.ingest_staged_asins.ASINManager')
    @patch('scripts.ingest_staged_asins.RetryHandler')
    @patch('scripts.ingest_staged_asins.RetryConfig')
    @pytest.mark.asyncio
    async def test_asin_cli_success(self, mock_retry_config, mock_retry_handler, 
                                   mock_asin_manager, mock_db, mock_scraper, 
                                   mock_create_client, mock_context_manager, 
                                   mock_supabase_client, mock_services):
        """Test successful processing of specific ASIN via CLI."""
        # Setup mocks
        mock_create_client.return_value = mock_supabase_client
        mock_context_manager.return_value.__enter__.return_value = (mock_services['logger'], MagicMock())
        mock_context_manager.return_value.__exit__.return_value = None
        
        # Setup service mocks
        mock_scraper.return_value = mock_services['scraper']
        mock_db.return_value = mock_services['db']
        mock_asin_manager.return_value = mock_services['asin_manager']
        mock_retry_handler.return_value = mock_services['retry_handler']
        mock_retry_config.return_value = MagicMock()
        
        # Mock the ingest_single_asin function to return success
        with patch('scripts.ingest_staged_asins.ingest_single_asin', new_callable=AsyncMock) as mock_ingest:
            mock_ingest.return_value = True
            
            # Test CLI with --asin argument
            with patch('sys.argv', ['ingest_staged_asins.py', '--asin', 'B0CPLQGGD7']):
                result = await main()
            
            # Verify
            assert result == 0
            mock_ingest.assert_called_once()
    
    @patch('scripts.ingest_staged_asins.ScriptExecutionContext')
    @patch('scripts.ingest_staged_asins.create_client')
    @pytest.mark.asyncio
    async def test_asin_cli_not_found(self, mock_create_client, mock_context_manager, mock_supabase_client):
        """Test CLI when ASIN is not found in database."""
        # Setup: ASIN not found
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        mock_create_client.return_value = mock_supabase_client
        mock_context_manager.return_value.__enter__.return_value = (MagicMock(), MagicMock())
        mock_context_manager.return_value.__exit__.return_value = None
        
        # Test CLI with non-existent ASIN
        with patch('sys.argv', ['ingest_staged_asins.py', '--asin', 'NONEXISTENT']):
            result = await main()
        
        # Verify
        assert result == 1
    
    @patch('scripts.ingest_staged_asins.ScriptExecutionContext')
    @patch('scripts.ingest_staged_asins.create_client')
    @pytest.mark.asyncio
    async def test_asin_cli_processing_error(self, mock_create_client, mock_context_manager, mock_supabase_client):
        """Test CLI when processing the ASIN fails."""
        # Setup: ASIN found but processing fails
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {
                'asin': 'B0CPLQGGD7',
                'status': 'pending',
                'source': 'search',
                'source_keyword': 'solar panel test',
                'attempts': 0,
                'max_attempts': 3,
                'error_message': None
            }
        ]
        mock_create_client.return_value = mock_supabase_client
        mock_context_manager.return_value.__enter__.return_value = (MagicMock(), MagicMock())
        mock_context_manager.return_value.__exit__.return_value = None
        
        # Mock the ingest_single_asin function to return failure
        with patch('scripts.ingest_staged_asins.ingest_single_asin', new_callable=AsyncMock) as mock_ingest:
            mock_ingest.return_value = False
            
            # Test CLI with --asin argument
            with patch('sys.argv', ['ingest_staged_asins.py', '--asin', 'B0CPLQGGD7']):
                result = await main()
            
            # Verify
            assert result == 1
            mock_ingest.assert_called_once()
    
    def test_cli_help_includes_asin_option(self):
        """Test that CLI help includes the new --asin option."""
        # This would test that the argument parser includes the --asin option
        # by checking the help output
        pass
    
    def test_cli_validation(self):
        """Test CLI argument validation."""
        # This would test various invalid combinations of arguments
        # For example, --asin with --batch-size should work (asin takes precedence)
        pass


class TestEnhancedLogging:
    """Test enhanced logging functionality."""
    
    def test_parsing_failure_logs_include_debug_info(self):
        """Test that parsing failures include relevant debugging information."""
        # This would test the enhanced logging in the scraper
        # when price parsing fails, ensuring it logs:
        # - ASIN
        # - Product name
        # - Manufacturer
        # - Available pricing data
        # - Product info keys
        pass
    
    def test_asin_processing_logs_include_status(self):
        """Test that ASIN processing logs include detailed status information."""
        # This would test the enhanced logging in the ingest function
        # ensuring it logs:
        # - Current status
        # - Source
        # - Keyword
        # - Attempts
        # - Error messages
        pass


if __name__ == "__main__":
    pytest.main([__file__])
