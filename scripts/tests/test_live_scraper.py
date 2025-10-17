"""
Pytest integration tests for ScraperAPI using mocked responses.
Tests the full integration flow without consuming API credits.

Run with: pytest scripts/tests/test_live_scraper.py -v
"""

import pytest
import sys
import os
from unittest.mock import Mock, MagicMock

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scripts.scraper import ScraperAPIClient
from scripts.logging_config import ScriptLogger
from scripts.tests.fixtures import (
    SAMPLE_PRODUCT_DETAIL_RESPONSE,
    SAMPLE_RENOGY_PRODUCT_RESPONSE,
    SAMPLE_SEARCH_RESPONSE,
    SAMPLE_ERROR_RESPONSE
)


class TestScraperAPIIntegration:
    """Integration tests using mocked ScraperAPI responses"""
    
    @pytest.fixture
    def scraper_client(self):
        """Create ScraperAPI client with logger"""
        logger = ScriptLogger("test_scraper_integration")
        return ScraperAPIClient(script_logger=logger)
    
    def test_fetch_product_with_mock(self, scraper_client, mocker):
        """Test fetching product with mocked ScraperAPI response"""
        # Mock the requests.get call
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_PRODUCT_DETAIL_RESPONSE
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        # Fetch product
        product_data = scraper_client.fetch_product("B0C99GS958")
        
        # Verify we got parsed data back
        assert product_data is not None
        
        # Verify required fields are present
        assert 'name' in product_data
        assert 'manufacturer' in product_data
        assert 'length_cm' in product_data
        assert 'width_cm' in product_data
        assert 'weight_kg' in product_data
        assert 'wattage' in product_data
        assert 'voltage' in product_data
        assert 'price_usd' in product_data
        
        # Verify values match expected conversions
        assert product_data['manufacturer'] == "FivstaSola"
        assert product_data['length_cm'] == 116.00
        assert product_data['width_cm'] == 44.98
        assert product_data['weight_kg'] == 7.20
        assert product_data['wattage'] == 100
        assert product_data['voltage'] == 12.0
        assert product_data['price_usd'] == 69.99
    
    def test_fetch_renogy_product_different_format(self, scraper_client, mocker):
        """Test fetching product with different dimension format (43 x 33.9 x 0.1 inches)"""
        # Mock the requests.get call
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_RENOGY_PRODUCT_RESPONSE
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        # Fetch product
        product_data = scraper_client.fetch_product("B07BMNGVV3")
        
        # Verify parsing succeeded
        assert product_data is not None
        
        # Verify dimension parsing worked (this was failing before)
        assert product_data['length_cm'] == 109.22  # 43 inches
        assert product_data['width_cm'] == 86.11    # 33.9 inches
        assert product_data['length_cm'] > product_data['width_cm']
        
        # Verify other fields
        assert product_data['manufacturer'] == "Renogy"
        assert product_data['weight_kg'] == 2.0  # 4.4 pounds
        assert product_data['wattage'] == 100
        assert product_data['voltage'] == 18.0
    
    def test_fetch_product_data_types(self, scraper_client, mocker):
        """Test that fetched data has correct types"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_PRODUCT_DETAIL_RESPONSE
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        product_data = scraper_client.fetch_product("B0C99GS958")
        
        assert product_data is not None
        
        # Verify data types
        assert isinstance(product_data['name'], str)
        assert isinstance(product_data['manufacturer'], str)
        assert isinstance(product_data['length_cm'], (int, float))
        assert isinstance(product_data['width_cm'], (int, float))
        assert isinstance(product_data['weight_kg'], (int, float))
        assert isinstance(product_data['wattage'], int)
        assert isinstance(product_data['price_usd'], (int, float))
        
        # Voltage can be None or numeric
        if product_data['voltage'] is not None:
            assert isinstance(product_data['voltage'], (int, float))
    
    def test_fetch_product_reasonable_values(self, scraper_client, mocker):
        """Test that fetched values are within reasonable ranges"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_PRODUCT_DETAIL_RESPONSE
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        product_data = scraper_client.fetch_product("B0C99GS958")
        
        assert product_data is not None
        
        # Dimensions should be positive and reasonable for solar panels
        assert 0 < product_data['length_cm'] < 500  # Up to 5 meters
        assert 0 < product_data['width_cm'] < 300   # Up to 3 meters
        assert product_data['length_cm'] >= product_data['width_cm']
        
        # Weight should be positive and reasonable
        assert 0 < product_data['weight_kg'] < 100  # Up to 100 kg
        
        # Wattage should be positive
        assert 0 < product_data['wattage'] < 10000  # Up to 10kW
        
        # Voltage should be reasonable if present
        if product_data['voltage']:
            assert 0 < product_data['voltage'] < 1000  # Up to 1000V
        
        # Price should be positive
        assert 0 < product_data['price_usd'] < 10000  # Up to $10k
    
    def test_fetch_product_web_url_format(self, scraper_client, mocker):
        """Test that web_url is properly formatted"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_PRODUCT_DETAIL_RESPONSE
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        test_asin = "B0C99GS958"
        product_data = scraper_client.fetch_product(test_asin)
        
        assert product_data is not None
        assert 'web_url' in product_data
        assert product_data['web_url'].startswith('https://www.amazon.com/dp/')
        assert test_asin in product_data['web_url']


class TestAmazonSearch:
    """Integration tests for Amazon search functionality using mocked responses"""
    
    @pytest.fixture
    def scraper_client(self):
        """Create ScraperAPI client with logger"""
        logger = ScriptLogger("test_search")
        return ScraperAPIClient(script_logger=logger)
    
    def test_search_amazon_with_mock(self, scraper_client, mocker):
        """Test Amazon search with mocked ScraperAPI response"""
        # Mock the requests.get call
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_SEARCH_RESPONSE
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        keyword = "solar panel 400w"
        results = scraper_client.search_amazon(keyword, page=1)
        
        assert results is not None
        assert 'products' in results
        assert len(results['products']) == 3
        assert results['keyword'] == keyword
        assert results['page'] == 1
    
    def test_extract_asins_from_search(self, scraper_client, mocker):
        """Test ASIN extraction from search results"""
        # Mock the requests.get call
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = SAMPLE_SEARCH_RESPONSE
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        keyword = "solar panel"
        results = scraper_client.search_amazon(keyword, page=1)
        
        assert results is not None
        
        asins = scraper_client.extract_asins_from_search(results)
        
        assert len(asins) == 3
        assert asins == ["B0C99GS958", "B0CB9X9XX1", "B0D2RT4S3B"]
        
        # ASINs should be 10 characters alphanumeric
        for asin in asins:
            assert len(asin) == 10
            assert asin.isalnum()
    
    def test_search_no_results(self, scraper_client, mocker):
        """Test search with no results returns None"""
        # Mock empty search results
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"products": []}
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        results = scraper_client.search_amazon("nonexistent product xyz123")
        
        # Should return None when no products found
        assert results is None


class TestErrorHandling:
    """Test error handling for API calls"""
    
    @pytest.fixture
    def scraper_client(self):
        """Create ScraperAPI client with logger"""
        logger = ScriptLogger("test_errors")
        return ScraperAPIClient(script_logger=logger)
    
    def test_fetch_with_network_error(self, scraper_client, mocker):
        """Test that network errors are handled gracefully"""
        import requests
        
        # Mock a network error
        mocker.patch('requests.get', side_effect=requests.exceptions.ConnectionError("Network error"))
        
        product_data = scraper_client.fetch_product("B0C99GS958")
        
        # Should return None, not crash
        assert product_data is None
    
    def test_fetch_with_timeout(self, scraper_client, mocker):
        """Test that timeout errors are handled gracefully"""
        import requests
        
        # Mock a timeout error
        mocker.patch('requests.get', side_effect=requests.exceptions.Timeout("Request timeout"))
        
        product_data = scraper_client.fetch_product("B0C99GS958")
        
        # Should return None, not crash
        assert product_data is None
    
    def test_fetch_with_http_error(self, scraper_client, mocker):
        """Test that HTTP errors are handled gracefully"""
        import requests
        
        # Mock an HTTP error
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("404 Not Found")
        
        mocker.patch('requests.get', return_value=mock_response)
        
        product_data = scraper_client.fetch_product("INVALIDASIN")
        
        # Should return None, not crash
        assert product_data is None
    
    def test_fetch_with_invalid_json(self, scraper_client, mocker):
        """Test that invalid JSON responses are handled"""
        # Mock invalid JSON response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        product_data = scraper_client.fetch_product("B0C99GS958")
        
        # Should return None, not crash
        assert product_data is None
    
    def test_fetch_with_missing_required_fields(self, scraper_client, mocker):
        """Test handling of incomplete product data"""
        # Mock response missing required fields
        incomplete_data = {
            "name": "Test Product",
            "product_information": {
                # Missing dimensions, weight, etc.
                "Brand": "TestBrand"
            }
        }
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = incomplete_data
        mock_response.raise_for_status.return_value = None
        
        mocker.patch('requests.get', return_value=mock_response)
        
        product_data = scraper_client.fetch_product("B0C99GS958")
        
        # Should return None when required fields are missing
        assert product_data is None


@pytest.mark.live_api
class TestRealAPIOptional:
    """Optional tests that make real API calls - marked for manual execution only"""
    
    @pytest.fixture
    def scraper_client(self):
        """Create ScraperAPI client with logger"""
        logger = ScriptLogger("test_real_api")
        return ScraperAPIClient(script_logger=logger)
    
    def test_real_api_call(self, scraper_client):
        """
        Test with real ScraperAPI call (OPTIONAL - uses API credits).
        
        Run manually with: pytest scripts/tests/test_live_scraper.py -v -m live_api
        """
        test_asin = "B0C99GS958"
        
        print(f"\n⚠️  Making REAL API call for ASIN: {test_asin}")
        print("This will use 1 ScraperAPI credit!")
        
        product_data = scraper_client.fetch_product(test_asin)
        
        # If this fails, check ScraperAPI key and credits
        assert product_data is not None, "Real API call should return data"
        assert 'name' in product_data
        assert 'wattage' in product_data
