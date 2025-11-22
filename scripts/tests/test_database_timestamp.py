#!/usr/bin/env python3
"""
Unit tests for database.py timestamp update functionality.
Tests the update_panel_timestamp method.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from scripts.database import SolarPanelDB


class TestUpdatePanelTimestamp:
    """Test cases for update_panel_timestamp method."""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database with Supabase client."""
        db = SolarPanelDB()
        db.client = MagicMock()
        db.log_script_execution = AsyncMock()
        return db
    
    @pytest.mark.asyncio
    async def test_update_panel_timestamp_success(self, mock_db):
        """Test successful timestamp update."""
        # Setup: Mock Supabase table chain
        mock_table = MagicMock()
        mock_update_result = MagicMock()
        mock_eq_result = MagicMock()
        
        # Chain: table -> update -> eq -> execute
        # The update() method returns an object that has eq() method
        # The eq() method returns an object that has execute() method
        mock_eq_result.execute.return_value = MagicMock()  # Execute returns a result object
        mock_update_result.eq.return_value = mock_eq_result
        mock_table.update.return_value = mock_update_result
        mock_db.client.table.return_value = mock_table
        
        # Execute
        result = await mock_db.update_panel_timestamp('panel-123')
        
        # Verify
        assert result is True
        mock_table.update.assert_called_once_with({'updated_at': 'now()'})
        mock_update_result.eq.assert_called_once_with('id', 'panel-123')
        
        # Verify logging
        mock_db.log_script_execution.assert_called_once()
        call_args = mock_db.log_script_execution.call_args
        assert call_args[0][0] == 'database'
        assert call_args[0][1] == 'INFO'
        assert 'Updated timestamp' in call_args[0][2]
    
    @pytest.mark.asyncio
    async def test_update_panel_timestamp_failure(self, mock_db):
        """Test timestamp update failure handling."""
        # Setup: Mock Supabase raises exception
        mock_table = MagicMock()
        mock_update_result = MagicMock()
        mock_eq_result = MagicMock()
        
        # Chain: table -> update -> eq -> execute (raises exception)
        mock_eq_result.execute.side_effect = Exception("Database error")
        mock_update_result.eq.return_value = mock_eq_result
        mock_table.update.return_value = mock_update_result
        mock_db.client.table.return_value = mock_table
        
        # Execute
        result = await mock_db.update_panel_timestamp('panel-123')
        
        # Verify
        assert result is False
        
        # Verify error logging
        mock_db.log_script_execution.assert_called()
        call_args = mock_db.log_script_execution.call_args
        assert call_args[0][1] == 'ERROR'
        assert 'Failed to update panel timestamp' in call_args[0][2]
    
    @pytest.mark.asyncio
    async def test_update_panel_timestamp_only_updates_timestamp(self, mock_db):
        """Test that only updated_at field is updated, not price."""
        # Setup: Mock Supabase table chain
        mock_table = MagicMock()
        mock_update_result = MagicMock()
        mock_eq_result = MagicMock()
        
        mock_eq_result.execute.return_value = MagicMock()
        mock_update_result.eq.return_value = mock_eq_result
        mock_table.update.return_value = mock_update_result
        mock_db.client.table.return_value = mock_table
        
        # Execute
        await mock_db.update_panel_timestamp('panel-123')
        
        # Verify only updated_at is in the update call
        update_call = mock_table.update.call_args[0][0]
        assert 'updated_at' in update_call
        assert 'price_usd' not in update_call
        assert 'price' not in update_call
        assert len(update_call) == 1  # Only one field updated


class TestUpdatePanelPrice:
    """Test cases for update_panel_price method (existing functionality)."""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database with Supabase client."""
        db = SolarPanelDB()
        db.client = MagicMock()
        db.log_script_execution = AsyncMock()
        return db
    
    @pytest.mark.asyncio
    async def test_update_panel_price_updates_timestamp(self, mock_db):
        """Test that update_panel_price also updates timestamp."""
        # Setup: Mock Supabase table chains
        mock_table = MagicMock()
        
        # Mock select for getting current price
        mock_select = MagicMock()
        mock_select_eq = MagicMock()
        mock_select_eq.execute.return_value.data = [{'price_usd': 99.99}]
        mock_select.eq.return_value = mock_select_eq
        mock_table.select.return_value = mock_select
        
        # Mock update for price update
        mock_update = MagicMock()
        mock_update_eq = MagicMock()
        mock_update_eq.execute.return_value = MagicMock()
        mock_update.eq.return_value = mock_update_eq
        mock_table.update.return_value = mock_update
        
        # Mock insert for price history
        mock_insert = MagicMock()
        mock_insert.execute.return_value = MagicMock()
        mock_table.insert.return_value = mock_insert
        
        mock_db.client.table.return_value = mock_table
        
        # Execute
        result = await mock_db.update_panel_price('panel-123', 89.99, source='scraperapi')
        
        # Verify
        assert result is True
        
        # Verify update was called with both price_usd and updated_at
        update_call = mock_table.update.call_args[0][0]
        assert 'price_usd' in update_call
        assert update_call['price_usd'] == 89.99
        assert 'updated_at' in update_call
        assert update_call['updated_at'] == 'now()'
        
        # Verify price history was recorded
        mock_table.insert.assert_called_once()
        insert_call = mock_table.insert.call_args[0][0]
        assert insert_call['old_price'] == 99.99
        assert insert_call['new_price'] == 89.99
        assert insert_call['source'] == 'scraperapi'
    
    @pytest.mark.asyncio
    async def test_update_panel_price_handles_missing_panel(self, mock_db):
        """Test update_panel_price handles missing panel gracefully."""
        # Setup: Mock select returns no data
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_select_eq = MagicMock()
        mock_select_eq.execute.return_value.data = []  # No panel found
        mock_select.eq.return_value = mock_select_eq
        mock_table.select.return_value = mock_select
        mock_db.client.table.return_value = mock_table
        
        # Execute
        result = await mock_db.update_panel_price('panel-123', 89.99)
        
        # Verify
        assert result is False
        mock_table.update.assert_not_called()
        mock_table.insert.assert_not_called()


class TestGetPanelsNeedingPriceUpdate:
    """Test cases for get_panels_needing_price_update method."""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database with Supabase client."""
        db = SolarPanelDB()
        db.client = MagicMock()
        db.log_script_execution = AsyncMock()
        return db
    
    @pytest.mark.asyncio
    async def test_get_panels_filters_for_asin(self, mock_db):
        """Test that get_panels_needing_price_update filters for ASINs only."""
        # Setup: Mock Supabase table chain
        test_data = [
            {'id': 'panel-1', 'asin': 'B0TEST1', 'price_usd': 99.99},
            {'id': 'panel-2', 'asin': 'B0TEST2', 'price_usd': 89.99}
        ]
        
        # Create a simple result object with data attribute
        # Use a real object, not a MagicMock, so .data access works correctly
        from types import SimpleNamespace
        mock_execute_result = SimpleNamespace()
        mock_execute_result.data = test_data
        
        # Build the chain backwards: execute -> limit -> order -> lt -> neq -> not_.is_ -> select
        # The chain is: table().select('*').not_.is_().neq().lt().order().limit().execute()
        
        # Create execute result with data
        mock_execute_result = SimpleNamespace()
        mock_execute_result.data = test_data
        
        # limit() returns self for chaining, then execute() returns the result
        mock_limit_result = MagicMock()
        mock_limit_result.limit = MagicMock(return_value=mock_limit_result)  # limit() returns self
        mock_limit_result.execute = MagicMock(return_value=mock_execute_result)
        
        # order() returns the limit result
        mock_order_result = MagicMock()
        mock_order_result.order = MagicMock(return_value=mock_limit_result)
        
        # lt() returns the order result
        mock_lt_result = MagicMock()
        mock_lt_result.lt = MagicMock(return_value=mock_order_result)
        
        # neq() returns the lt result
        mock_neq_result = MagicMock()
        mock_neq_result.neq = MagicMock(return_value=mock_lt_result)
        
        # not_ is an attribute, not a method, so we need to set it up specially
        mock_not_attr = MagicMock()
        mock_not_attr.is_ = MagicMock(return_value=mock_neq_result)
        
        # select('*') returns an object that has a 'not_' attribute
        mock_select_result = MagicMock()
        mock_select_result.not_ = mock_not_attr
        
        mock_table = MagicMock()
        # table().select('*') returns mock_select_result (which has .not_ attribute)
        mock_table.select = MagicMock(return_value=mock_select_result)
        
        mock_db.client.table = MagicMock(return_value=mock_table)
        
        # Execute
        result = await mock_db.get_panels_needing_price_update(days_old=7, limit=100)
        
        # Verify
        assert len(result) == 2
        assert all('asin' in panel for panel in result)
        assert result[0]['asin'] == 'B0TEST1'
        assert result[1]['asin'] == 'B0TEST2'
        
        # Verify filters were applied
        mock_not_attr.is_.assert_called_once_with('asin', 'null')
        mock_neq_result.neq.assert_called_once_with('asin', '')
        mock_lt_result.lt.assert_called_once()  # Date filter
        mock_order_result.order.assert_called_once()
        mock_limit_result.limit.assert_called_once_with(100)
    
    @pytest.mark.asyncio
    async def test_get_panels_handles_exception(self, mock_db):
        """Test that get_panels_needing_price_update handles exceptions."""
        # Setup: Mock Supabase raises exception
        mock_table = MagicMock()
        mock_table.select.side_effect = Exception("Database error")
        mock_db.client.table.return_value = mock_table
        
        # Execute
        result = await mock_db.get_panels_needing_price_update()
        
        # Verify
        assert result == []
        
        # Verify error logging
        mock_db.log_script_execution.assert_called()
        call_args = mock_db.log_script_execution.call_args
        assert call_args[0][1] == 'ERROR'

