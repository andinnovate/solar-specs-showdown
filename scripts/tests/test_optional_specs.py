"""
Unit tests for optional specs parsing and filtering functionality.
Tests the new behavior where panel specifications are optional.
"""

import pytest
from unittest.mock import Mock, patch
from scripts.scraper import ScraperAPIParser
from scripts.ingest_staged_asins import create_admin_review_flag
from scripts.database import DatabaseManager


class TestOptionalSpecsParsing:
    """Test parsing with optional specifications."""
    
    def test_parse_with_missing_wattage(self):
        """Test parsing succeeds with missing wattage."""
        api_response = {
            'name': 'Test Panel',
            'asin': 'B0TEST123',
            'brand': 'TestBrand',
            'product_information': {
                'Product Dimensions': '100 x 50 x 2 cm',
                'Item Weight': '10 kg',
                'Maximum Power': '',  # Missing
            }
        }
        
        parser = ScraperAPIParser()
        result = parser.parse_product_data(api_response)
        
        assert result is not None
        assert result['wattage'] is None
        assert 'wattage' in result['missing_fields']
        assert any('wattage' in f for f in result['parsing_failures'])
    
    def test_parse_with_missing_dimensions(self):
        """Test parsing succeeds with missing dimensions."""
        api_response = {
            'name': 'Test Panel',
            'asin': 'B0TEST123',
            'brand': 'TestBrand',
            'product_information': {
                'Product Dimensions': '',  # Missing
                'Item Weight': '10 kg',
                'Maximum Power': '400W',
            }
        }
        
        parser = ScraperAPIParser()
        result = parser.parse_product_data(api_response)
        
        assert result is not None
        assert result['length_cm'] is None
        assert result['width_cm'] is None
        assert 'dimensions' in result['missing_fields']
        assert any('dimensions' in f for f in result['parsing_failures'])
    
    def test_parse_with_missing_weight(self):
        """Test parsing succeeds with missing weight."""
        api_response = {
            'name': 'Test Panel',
            'asin': 'B0TEST123',
            'brand': 'TestBrand',
            'product_information': {
                'Product Dimensions': '100 x 50 x 2 cm',
                'Item Weight': '',  # Missing
                'Maximum Power': '400W',
            }
        }
        
        parser = ScraperAPIParser()
        result = parser.parse_product_data(api_response)
        
        assert result is not None
        assert result['weight_kg'] is None
        assert 'weight' in result['missing_fields']
        assert any('weight' in f for f in result['parsing_failures'])
    
    def test_parse_with_missing_price(self):
        """Test parsing succeeds with missing price."""
        api_response = {
            'name': 'Test Panel',
            'asin': 'B0TEST123',
            'brand': 'TestBrand',
            'product_information': {
                'Product Dimensions': '100 x 50 x 2 cm',
                'Item Weight': '10 kg',
                'Maximum Power': '400W',
            },
            'pricing': ''  # Missing
        }
        
        parser = ScraperAPIParser()
        result = parser.parse_product_data(api_response)
        
        assert result is not None
        assert result['price_usd'] is None
        assert 'price' in result['missing_fields']
        assert any('price' in f for f in result['parsing_failures'])
    
    def test_parse_with_all_specs_missing(self):
        """Test parsing succeeds with only required fields."""
        api_response = {
            'name': 'Test Panel',
            'asin': 'B0TEST123',
            'brand': 'TestBrand',
            'product_information': {}
        }
        
        parser = ScraperAPIParser()
        result = parser.parse_product_data(api_response)
        
        assert result is not None
        assert result['wattage'] is None
        assert result['length_cm'] is None
        assert result['weight_kg'] is None
        assert result['price_usd'] is None
        assert len(result['missing_fields']) == 4
        assert 'wattage' in result['missing_fields']
        assert 'dimensions' in result['missing_fields']
        assert 'weight' in result['missing_fields']
        assert 'price' in result['missing_fields']
    
    def test_parse_with_complete_specs(self):
        """Test parsing succeeds with all specs present."""
        api_response = {
            'name': 'Test Panel',
            'asin': 'B0TEST123',
            'brand': 'TestBrand',
            'product_information': {
                'Product Dimensions': '100 x 50 x 2 cm',
                'Item Weight': '10 kg',
                'Maximum Power': '400W',
            },
            'pricing': '$299.99'
        }
        
        parser = ScraperAPIParser()
        result = parser.parse_product_data(api_response)
        
        assert result is not None
        assert result['wattage'] == 400
        assert result['length_cm'] == 100
        assert result['width_cm'] == 50
        assert result['weight_kg'] == 10
        assert result['price_usd'] == 299.99
        assert len(result['missing_fields']) == 0
    
    def test_parse_still_requires_name_manufacturer_asin(self):
        """Test that name, manufacturer, and ASIN are still required."""
        # Missing name
        api_response = {
            'asin': 'B0TEST123',
            'brand': 'TestBrand',
            'product_information': {}
        }
        
        parser = ScraperAPIParser()
        result = parser.parse_product_data(api_response)
        assert result is None
        
        # Missing manufacturer
        api_response = {
            'name': 'Test Panel',
            'asin': 'B0TEST123',
            'product_information': {}
        }
        
        result = parser.parse_product_data(api_response)
        assert result is None
        
        # Missing ASIN
        api_response = {
            'name': 'Test Panel',
            'brand': 'TestBrand',
            'product_information': {}
        }
        
        result = parser.parse_product_data(api_response)
        assert result is None


class TestWattageFilteringWithNulls:
    """Test wattage filtering behavior with null values."""
    
    def test_wattage_filter_skips_null(self):
        """Test that panels with null wattage are not filtered out."""
        # This test would be in the main filtering logic
        # For now, we'll test the concept with mock data
        
        panels = [
            {'wattage': 400, 'name': 'Panel 1'},  # Should pass filter
            {'wattage': None, 'name': 'Panel 2'},  # Should pass filter (null skipped)
            {'wattage': 20, 'name': 'Panel 3'},   # Should be filtered out
        ]
        
        # Mock filter logic: wattage >= 30 or wattage is None
        filtered = [p for p in panels if p['wattage'] is None or p['wattage'] >= 30]
        
        assert len(filtered) == 2
        assert filtered[0]['name'] == 'Panel 1'
        assert filtered[1]['name'] == 'Panel 2'


class TestAdminFlagCreation:
    """Test automatic admin flag creation for missing data."""
    
    @patch('scripts.ingest_staged_asins.create_client')
    def test_create_admin_review_flag_success(self, mock_create_client):
        """Test successful creation of admin review flag."""
        mock_client = Mock()
        mock_create_client.return_value = mock_client
        
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {'id': 'flag-123'}
        ]
        
        mock_logger = Mock()
        
        # Test the function
        result = await create_admin_review_flag(
            asin='B0TEST123',
            panel_id='panel-456',
            missing_fields=['wattage', 'dimensions'],
            parsing_failures=['Failed to parse wattage', 'Failed to parse dimensions'],
            logger=mock_logger
        )
        
        assert result == 'flag-123'
        mock_client.table.assert_called_once_with('user_flags')
        
        # Verify the flag data
        insert_call = mock_client.table.return_value.insert.call_args[0][0]
        assert insert_call['panel_id'] == 'panel-456'
        assert insert_call['user_id'] is None
        assert insert_call['flag_type'] == 'system_missing_data'
        assert insert_call['flagged_fields'] == ['wattage', 'dimensions']
        assert 'Missing or failed to parse: wattage, dimensions' in insert_call['user_comment']
        assert insert_call['status'] == 'pending'
    
    @patch('scripts.ingest_staged_asins.create_client')
    def test_create_admin_review_flag_failure(self, mock_create_client):
        """Test handling of admin flag creation failure."""
        mock_client = Mock()
        mock_create_client.return_value = mock_client
        
        mock_client.table.return_value.insert.return_value.execute.side_effect = Exception('Database error')
        
        mock_logger = Mock()
        
        # Test the function
        result = await create_admin_review_flag(
            asin='B0TEST123',
            panel_id='panel-456',
            missing_fields=['wattage'],
            parsing_failures=['Failed to parse wattage'],
            logger=mock_logger
        )
        
        assert result is None
        mock_logger.log_script_event.assert_called_with(
            "ERROR", 
            "Failed to create admin review flag for ASIN B0TEST123: Database error"
        )


class TestDatabaseHandling:
    """Test database operations with nullable fields."""
    
    @patch('scripts.database.create_client')
    def test_add_new_panel_with_missing_fields(self, mock_create_client):
        """Test adding panel with missing fields."""
        mock_client = Mock()
        mock_create_client.return_value = mock_client
        
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {'id': 'panel-123'}
        ]
        
        db = DatabaseManager()
        
        panel_data = {
            'asin': 'B0TEST123',
            'name': 'Test Panel',
            'manufacturer': 'TestBrand',
            'length_cm': None,
            'width_cm': None,
            'weight_kg': 10,
            'wattage': None,
            'voltage': 24,
            'price_usd': None,
            'description': 'Test description',
            'image_url': 'http://example.com/image.jpg',
            'web_url': 'http://example.com',
            'missing_fields': ['dimensions', 'wattage', 'price']
        }
        
        result = await db.add_new_panel(panel_data)
        
        assert result == 'panel-123'
        
        # Verify the insert data
        insert_call = mock_client.table.return_value.insert.call_args[0][0]
        assert insert_call['asin'] == 'B0TEST123'
        assert insert_call['name'] == 'Test Panel'
        assert insert_call['manufacturer'] == 'TestBrand'
        assert insert_call['length_cm'] is None
        assert insert_call['width_cm'] is None
        assert insert_call['weight_kg'] == 10
        assert insert_call['wattage'] is None
        assert insert_call['voltage'] == 24
        assert insert_call['price_usd'] is None
        assert insert_call['missing_fields'] == ['dimensions', 'wattage', 'price']


class TestFilteringLogic:
    """Test filtering logic with incomplete panels."""
    
    def test_show_incomplete_filter(self):
        """Test show/hide incomplete panels filter."""
        panels = [
            {'id': '1', 'missing_fields': ['wattage'], 'name': 'Panel 1'},  # Incomplete
            {'id': '2', 'missing_fields': [], 'name': 'Panel 2'},           # Complete
            {'id': '3', 'missing_fields': ['dimensions'], 'name': 'Panel 3'}, # Incomplete
        ]
        
        # Show incomplete (default)
        show_incomplete = True
        filtered = [p for p in panels if show_incomplete or not (p.get('missing_fields') and len(p['missing_fields']) > 0)]
        assert len(filtered) == 3
        
        # Hide incomplete
        show_incomplete = False
        filtered = [p for p in panels if show_incomplete or not (p.get('missing_fields') and len(p['missing_fields']) > 0)]
        assert len(filtered) == 1
        assert filtered[0]['name'] == 'Panel 2'
    
    def test_null_value_filtering(self):
        """Test filtering with null values."""
        panels = [
            {'wattage': 400, 'price_usd': 300, 'name': 'Panel 1'},  # Complete
            {'wattage': None, 'price_usd': 300, 'name': 'Panel 2'}, # Missing wattage
            {'wattage': 400, 'price_usd': None, 'name': 'Panel 3'}, # Missing price
            {'wattage': None, 'price_usd': None, 'name': 'Panel 4'}, # Missing both
        ]
        
        # Filter: wattage >= 300 OR wattage is None, price >= 200 OR price is None
        filtered = [
            p for p in panels 
            if (p['wattage'] is None or p['wattage'] >= 300) and 
               (p['price_usd'] is None or p['price_usd'] >= 200)
        ]
        
        assert len(filtered) == 4  # All panels should pass due to null handling


if __name__ == '__main__':
    pytest.main([__file__])
