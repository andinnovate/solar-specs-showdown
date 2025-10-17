"""
Pytest configuration for scraper tests.
Adds project root to Python path and defines custom CLI options.
"""

import sys
import os
import pytest


# Add project root to Python path for all tests
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def pytest_addoption(parser):
    """Add custom command-line options"""
    parser.addoption(
        "--live-api",
        action="store_true",
        default=False,
        help="Run tests that make real ScraperAPI calls (uses API credits)"
    )
    parser.addoption(
        "--use-test-db",
        action="store_true",
        default=False,
        help="Run integration tests against test Supabase instance"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection based on command-line options"""
    if config.getoption("--live-api"):
        # If --live-api flag is provided, run all tests including live_api
        pass
    else:
        # By default, skip tests marked with live_api
        skip_live = pytest.mark.skip(reason="Need --live-api option to run tests that use API credits")
        for item in items:
            if "live_api" in item.keywords:
                item.add_marker(skip_live)
    
    if not config.getoption("--use-test-db"):
        # Skip integration tests unless --use-test-db flag is provided
        skip_integration = pytest.mark.skip(reason="Need --use-test-db option to run integration tests")
        for item in items:
            if "integration" in item.keywords:
                item.add_marker(skip_integration)


@pytest.fixture(scope='session')
def test_db_url():
    """Test Supabase instance URL"""
    return "https://plsboshlmokjtwxpmrit.supabase.co"


@pytest.fixture(scope='session')
def configure_test_db(test_db_url):
    """Configure environment to use test Supabase instance"""
    original_url = os.environ.get('SUPABASE_URL')
    
    # Set test database URL
    os.environ['SUPABASE_URL'] = test_db_url
    
    yield test_db_url
    
    # Restore original (if any)
    if original_url:
        os.environ['SUPABASE_URL'] = original_url
    else:
        os.environ.pop('SUPABASE_URL', None)


@pytest.fixture
async def asin_manager(configure_test_db):
    """Create ASINManager instance connected to test database"""
    from scripts.asin_manager import ASINManager
    
    # Reload config to pick up test database URL
    import importlib
    import scripts.config
    importlib.reload(scripts.config)
    
    manager = ASINManager()
    yield manager


@pytest.fixture
async def clean_test_asins(asin_manager):
    """Clean up test ASINs before and after each test"""
    # Cleanup before test
    try:
        asin_manager.client.table('asin_staging').delete().like('asin', 'TEST_%').execute()
    except:
        pass  # Table might be empty
    
    try:
        asin_manager.client.table('solar_panels').delete().like('asin', 'TEST_%').execute()
    except:
        pass  # Table might be empty
    
    yield
    
    # Cleanup after test
    try:
        asin_manager.client.table('asin_staging').delete().like('asin', 'TEST_%').execute()
    except:
        pass
    
    try:
        asin_manager.client.table('solar_panels').delete().like('asin', 'TEST_%').execute()
    except:
        pass

