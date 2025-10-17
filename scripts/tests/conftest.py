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


def pytest_collection_modifyitems(config, items):
    """Modify test collection based on command-line options"""
    if config.getoption("--live-api"):
        # If --live-api flag is provided, run all tests including live_api
        return
    
    # By default, skip tests marked with live_api
    skip_live = pytest.mark.skip(reason="Need --live-api option to run tests that use API credits")
    for item in items:
        if "live_api" in item.keywords:
            item.add_marker(skip_live)

