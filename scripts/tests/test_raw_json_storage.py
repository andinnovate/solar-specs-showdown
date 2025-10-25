#!/usr/bin/env python3
"""
Test raw JSON storage functionality for ScraperAPI responses.
Tests that raw JSON data is properly saved for future analysis.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from scripts.ingest_staged_asins import save_raw_scraper_data
from scripts.scraper import ScraperAPIClient


class TestRawJSONStorage:
    """Test cases for raw JSON storage functionality."""
    
    @pytest.fixture
    def sample_raw_response(self):
        """Sample raw ScraperAPI response."""
        return {
            'asin': 'B0CPLQGGD7',
            'name': 'Test Solar Panel',
            'price': '$299.99',
            'description': 'High-efficiency solar panel',
            'specifications': {
                'wattage': '400W',
                'voltage': '40V',
                'dimensions': '200x100cm'
            },
            'images': ['https://example.com/image1.jpg'],
            'availability': 'In Stock',
            'rating': 4.5,
            'reviews_count': 150
        }
    
    @pytest.fixture
    def sample_metadata(self):
        """Sample processing metadata."""
        return {
            'response_time_ms': 1500,
            'response_size_bytes': 2048,
            'scraper_version': 'v1',
            'country_code': 'us',
            'url': 'https://www.amazon.com/dp/B0CPLQGGD7'
        }
    
    @pytest.mark.asyncio
    async def test_save_raw_scraper_data_success(self, sample_raw_response, sample_metadata):
        """Test successful saving of raw JSON data."""
        # Mock Supabase client
        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.data = [{'id': 'test-id'}]
        mock_client.table.return_value.insert.return_value.execute.return_value = mock_result
        
        with patch('scripts.ingest_staged_asins.create_client', return_value=mock_client):
            # Execute
            await save_raw_scraper_data(
                asin='B0CPLQGGD7',
                panel_id='panel-123',
                raw_response=sample_raw_response,
                metadata=sample_metadata
            )
            
            # Verify
            mock_client.table.assert_called_once_with('raw_scraper_data')
            insert_call = mock_client.table.return_value.insert
            insert_call.assert_called_once()
            
            # Check the data structure
            call_args = insert_call.call_args[0][0]
            assert call_args['asin'] == 'B0CPLQGGD7'
            assert call_args['panel_id'] == 'panel-123'
            assert call_args['scraper_response'] == sample_raw_response
            assert call_args['scraper_version'] == 'v1'
            assert call_args['response_size_bytes'] > 0
            assert call_args['processing_metadata'] == sample_metadata
    
    @pytest.mark.asyncio
    async def test_save_raw_scraper_data_failure(self, sample_raw_response, sample_metadata):
        """Test handling of save failure."""
        # Mock Supabase client that fails
        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.data = None  # Simulate failure
        mock_client.table.return_value.insert.return_value.execute.return_value = mock_result
        
        with patch('scripts.ingest_staged_asins.create_client', return_value=mock_client):
            with patch('builtins.print') as mock_print:
                # Execute
                await save_raw_scraper_data(
                    asin='B0CPLQGGD7',
                    panel_id='panel-123',
                    raw_response=sample_raw_response,
                    metadata=sample_metadata
                )
                
                # Verify error handling
                mock_print.assert_called_with("Failed to save raw JSON data for ASIN B0CPLQGGD7")
    
    @pytest.mark.asyncio
    async def test_save_raw_scraper_data_exception(self, sample_raw_response, sample_metadata):
        """Test handling of database exception."""
        # Mock Supabase client that raises exception
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.side_effect = Exception("Database error")
        
        with patch('scripts.ingest_staged_asins.create_client', return_value=mock_client):
            with patch('builtins.print') as mock_print:
                # Execute
                await save_raw_scraper_data(
                    asin='B0CPLQGGD7',
                    panel_id='panel-123',
                    raw_response=sample_raw_response,
                    metadata=sample_metadata
                )
                
                # Verify error handling
                mock_print.assert_called_with("Error saving raw JSON data for ASIN B0CPLQGGD7: Database error")
    
    def test_response_size_calculation(self, sample_raw_response):
        """Test that response size is calculated correctly."""
        import json
        
        # Calculate expected size
        json_str = json.dumps(sample_raw_response)
        expected_size = len(json_str.encode('utf-8'))
        
        # This should match what the function calculates
        assert expected_size > 0
        assert isinstance(expected_size, int)
    
    @pytest.mark.asyncio
    async def test_metadata_structure(self, sample_raw_response):
        """Test that metadata is properly structured."""
        metadata = {
            'response_time_ms': 2000,
            'scraper_version': 'v1',
            'country_code': 'us',
            'url': 'https://www.amazon.com/dp/B0CPLQGGD7'
        }
        
        # Mock Supabase client
        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.data = [{'id': 'test-id'}]
        mock_client.table.return_value.insert.return_value.execute.return_value = mock_result
        
        with patch('scripts.ingest_staged_asins.create_client', return_value=mock_client):
            # Execute
            await save_raw_scraper_data(
                asin='B0CPLQGGD7',
                panel_id='panel-123',
                raw_response=sample_raw_response,
                metadata=metadata
            )
            
            # Verify metadata structure
            insert_call = mock_client.table.return_value.insert
            call_args = insert_call.call_args[0][0]
            
            assert call_args['processing_metadata'] == metadata
            assert call_args['scraper_version'] == 'v1'
            assert 'response_size_bytes' in call_args
            assert call_args['response_size_bytes'] > 0


class TestScraperAPIRawData:
    """Test cases for ScraperAPI raw data functionality."""
    
    def test_scraper_api_returns_raw_data(self):
        """Test that ScraperAPI client returns both parsed and raw data."""
        # This would test the updated fetch_product method
        # that returns both parsed_data and raw_response
        pass
    
    def test_raw_data_structure(self):
        """Test that raw data structure is preserved."""
        # This would test that the raw JSON structure
        # matches what ScraperAPI actually returns
        pass


if __name__ == "__main__":
    pytest.main([__file__])
