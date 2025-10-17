"""
Pytest tests for file reading and URL parsing functions.
Tests ASIN extraction from URLs and reading ASINs from files.

Run with: pytest scripts/tests/test_file_and_url.py -v
"""

import pytest
import sys
import os
import tempfile

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scripts.fetch_solar_panels import read_asins_from_file
from scripts.database import SolarPanelDB


class TestReadASINsFromFile:
    """Test reading ASINs from various file formats"""
    
    def test_read_from_text_file(self, tmp_path):
        """Test reading ASINs from simple text file (one per line)"""
        # Create temporary text file
        text_file = tmp_path / "asins.txt"
        text_file.write_text("""B0C99GS958
B0CB9X9XX1
B0D2RT4S3B
""")
        
        asins = read_asins_from_file(str(text_file))
        
        assert len(asins) == 3
        assert asins == ['B0C99GS958', 'B0CB9X9XX1', 'B0D2RT4S3B']
    
    def test_read_from_text_file_with_comments(self, tmp_path):
        """Test that comments are skipped in text files"""
        text_file = tmp_path / "asins.txt"
        text_file.write_text("""# This is a comment
B0C99GS958
# Another comment
B0CB9X9XX1

# Empty line above should be skipped
B0D2RT4S3B
""")
        
        asins = read_asins_from_file(str(text_file))
        
        assert len(asins) == 3
        assert asins == ['B0C99GS958', 'B0CB9X9XX1', 'B0D2RT4S3B']
    
    def test_read_from_csv_with_asin_column(self, tmp_path):
        """Test reading ASINs from CSV with 'asin' column"""
        csv_file = tmp_path / "asins.csv"
        csv_file.write_text("""asin,product_name,wattage
B0C99GS958,Panel 100W,100
B0CB9X9XX1,Panel 20W,20
B0D2RT4S3B,Panel 120W,120
""")
        
        asins = read_asins_from_file(str(csv_file))
        
        assert len(asins) == 3
        assert asins == ['B0C99GS958', 'B0CB9X9XX1', 'B0D2RT4S3B']
    
    def test_read_from_csv_case_insensitive_asin(self, tmp_path):
        """Test reading ASINs from CSV with 'ASIN' or 'Asin' column"""
        csv_file = tmp_path / "asins.csv"
        csv_file.write_text("""ASIN,Name
B0C99GS958,Panel 100W
B0CB9X9XX1,Panel 20W
""")
        
        asins = read_asins_from_file(str(csv_file))
        
        assert len(asins) == 2
        assert asins == ['B0C99GS958', 'B0CB9X9XX1']
    
    def test_read_from_csv_first_column_no_asin_header(self, tmp_path):
        """Test reading ASINs from CSV first column when no 'asin' header"""
        csv_file = tmp_path / "products.csv"
        csv_file.write_text("""product_id,name,price
B0C99GS958,Panel 100W,69.99
B0CB9X9XX1,Panel 20W,29.99
""")
        
        asins = read_asins_from_file(str(csv_file))
        
        # Should skip header row and use first column
        assert len(asins) == 2
        assert asins == ['B0C99GS958', 'B0CB9X9XX1']
    
    def test_deduplication(self, tmp_path):
        """Test that duplicate ASINs are removed"""
        text_file = tmp_path / "asins.txt"
        text_file.write_text("""B0C99GS958
B0CB9X9XX1
B0C99GS958
B0D2RT4S3B
B0CB9X9XX1
""")
        
        asins = read_asins_from_file(str(text_file))
        
        # Should have unique ASINs in original order
        assert len(asins) == 3
        assert asins == ['B0C99GS958', 'B0CB9X9XX1', 'B0D2RT4S3B']
    
    def test_whitespace_handling(self, tmp_path):
        """Test that whitespace is properly trimmed"""
        text_file = tmp_path / "asins.txt"
        text_file.write_text("""  B0C99GS958  
\tB0CB9X9XX1\t
B0D2RT4S3B   
""")
        
        asins = read_asins_from_file(str(text_file))
        
        assert len(asins) == 3
        assert asins == ['B0C99GS958', 'B0CB9X9XX1', 'B0D2RT4S3B']
    
    def test_empty_file(self, tmp_path):
        """Test reading from empty file"""
        text_file = tmp_path / "empty.txt"
        text_file.write_text("")
        
        asins = read_asins_from_file(str(text_file))
        
        assert asins == []
    
    def test_file_with_only_comments(self, tmp_path):
        """Test file with only comments and empty lines"""
        text_file = tmp_path / "comments.txt"
        text_file.write_text("""# Comment 1
# Comment 2

# Comment 3
""")
        
        asins = read_asins_from_file(str(text_file))
        
        assert asins == []
    
    def test_file_not_found(self):
        """Test that FileNotFoundError is raised for non-existent file"""
        with pytest.raises(ValueError, match="File not found"):
            read_asins_from_file('/nonexistent/file.txt')
    
    def test_csv_detection_by_extension(self, tmp_path):
        """Test that .csv extension triggers CSV parsing"""
        csv_file = tmp_path / "data.csv"
        csv_file.write_text("""B0C99GS958
B0CB9X9XX1
""")
        
        # Even without commas, .csv extension should trigger CSV mode
        asins = read_asins_from_file(str(csv_file))
        assert len(asins) >= 1
    
    def test_mixed_empty_lines_and_data(self, tmp_path):
        """Test file with mixed empty lines and data"""
        text_file = tmp_path / "mixed.txt"
        text_file.write_text("""

B0C99GS958

B0CB9X9XX1

""")
        
        asins = read_asins_from_file(str(text_file))
        
        assert len(asins) == 2
        assert asins == ['B0C99GS958', 'B0CB9X9XX1']


class TestExtractASINFromURL:
    """Test ASIN extraction from Amazon URLs"""
    
    @pytest.fixture
    def db(self):
        """Create database instance (doesn't need real connection for this test)"""
        # We'll test the method directly without needing a real DB connection
        pass
    
    def test_extract_from_standard_url(self):
        """Test extraction from standard Amazon product URL"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        # Create a mock db just to call the method
        import asyncio
        url = "https://www.amazon.com/dp/B0C99GS958"
        asin = asyncio.run(db.extract_asin_from_url(url))
        
        assert asin == "B0C99GS958"
    
    def test_extract_from_url_with_params(self):
        """Test extraction from URL with query parameters"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        import asyncio
        url = "https://www.amazon.com/dp/B0C99GS958?ref=xyz&tag=abc"
        asin = asyncio.run(db.extract_asin_from_url(url))
        
        assert asin == "B0C99GS958"
    
    def test_extract_from_url_with_product_path(self):
        """Test extraction from URL with /product/dp/ path"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        import asyncio
        url = "https://www.amazon.com/product/dp/B0CB9X9XX1/ref=123"
        asin = asyncio.run(db.extract_asin_from_url(url))
        
        assert asin == "B0CB9X9XX1"
    
    def test_extract_from_url_with_title(self):
        """Test extraction from URL with product title in path"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        import asyncio
        url = "https://www.amazon.com/Bifacial-Solar-Panel/dp/B0D2RT4S3B"
        asin = asyncio.run(db.extract_asin_from_url(url))
        
        assert asin == "B0D2RT4S3B"
    
    def test_extract_returns_none_for_invalid_url(self):
        """Test that invalid URLs return None"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        import asyncio
        
        # No /dp/ in URL
        assert asyncio.run(db.extract_asin_from_url("https://www.amazon.com")) is None
        
        # Empty string
        assert asyncio.run(db.extract_asin_from_url("")) is None
        
        # None value
        assert asyncio.run(db.extract_asin_from_url(None)) is None
    
    def test_extract_returns_none_for_invalid_asin_format(self):
        """Test that URLs with invalid ASIN format return None"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        import asyncio
        
        # ASIN too short
        assert asyncio.run(db.extract_asin_from_url("https://www.amazon.com/dp/B0C99")) is None
        
        # ASIN too long
        assert asyncio.run(db.extract_asin_from_url("https://www.amazon.com/dp/B0C99GS958X")) is None
    
    @pytest.mark.parametrize("url,expected_asin", [
        ("https://www.amazon.com/dp/B0C99GS958", "B0C99GS958"),
        ("https://www.amazon.com/dp/B0CB9X9XX1?ref=123", "B0CB9X9XX1"),
        ("https://www.amazon.com/product/dp/B0D2RT4S3B", "B0D2RT4S3B"),
        ("https://www.amazon.com/Some-Product/dp/B07BMNGVV3/ref=xyz", "B07BMNGVV3"),
        ("https://www.amazon.com", None),
        ("", None),
        ("https://example.com/dp/B0C99GS958", "B0C99GS958"),  # Non-Amazon but has pattern
    ])
    def test_various_url_formats(self, url, expected_asin):
        """Parametrized test for various URL formats"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        import asyncio
        asin = asyncio.run(db.extract_asin_from_url(url))
        
        assert asin == expected_asin


class TestFileFormats:
    """Test various file format combinations"""
    
    def test_csv_with_mixed_case_columns(self, tmp_path):
        """Test CSV with mixed case column names"""
        csv_file = tmp_path / "data.csv"
        csv_file.write_text("""Asin,Name,Price
B0C99GS958,Panel 100W,69.99
B0CB9X9XX1,Panel 20W,29.99
""")
        
        asins = read_asins_from_file(str(csv_file))
        assert len(asins) == 2
        assert 'B0C99GS958' in asins
    
    def test_text_file_windows_line_endings(self, tmp_path):
        """Test text file with Windows line endings (CRLF)"""
        text_file = tmp_path / "asins_windows.txt"
        text_file.write_text("B0C99GS958\r\nB0CB9X9XX1\r\nB0D2RT4S3B\r\n")
        
        asins = read_asins_from_file(str(text_file))
        
        assert len(asins) == 3
        assert asins == ['B0C99GS958', 'B0CB9X9XX1', 'B0D2RT4S3B']
    
    def test_csv_with_quotes(self, tmp_path):
        """Test CSV with quoted fields"""
        csv_file = tmp_path / "quoted.csv"
        csv_file.write_text("""asin,"product_name","notes"
B0C99GS958,"Panel 100W","Good reviews"
B0CB9X9XX1,"Panel 20W","Compact"
""")
        
        asins = read_asins_from_file(str(csv_file))
        
        assert len(asins) == 2
        assert asins == ['B0C99GS958', 'B0CB9X9XX1']
    
    def test_text_file_with_extra_data(self, tmp_path):
        """Test text file where each line might have extra data"""
        text_file = tmp_path / "asins_extra.txt"
        text_file.write_text("""B0C99GS958 - Panel 100W
B0CB9X9XX1 - Panel 20W
""")
        
        asins = read_asins_from_file(str(text_file))
        
        # Should extract the full line (including extra data)
        # This is expected behavior - it takes the whole line
        assert len(asins) == 2
        assert 'B0C99GS958 - Panel 100W' in asins[0]
    
    def test_csv_empty_asin_fields(self, tmp_path):
        """Test CSV with some empty ASIN fields"""
        csv_file = tmp_path / "sparse.csv"
        csv_file.write_text("""asin,name
B0C99GS958,Panel 100W
,No ASIN Panel
B0CB9X9XX1,Panel 20W
,Another no ASIN
""")
        
        asins = read_asins_from_file(str(csv_file))
        
        # Should skip rows with empty ASIN
        assert len(asins) == 2
        assert asins == ['B0C99GS958', 'B0CB9X9XX1']
    
    def test_large_file_preserves_order(self, tmp_path):
        """Test that large files preserve insertion order"""
        text_file = tmp_path / "many_asins.txt"
        
        # Create 100 unique ASINs
        asins_list = [f"B{i:09d}X" for i in range(100)]
        text_file.write_text("\n".join(asins_list))
        
        asins = read_asins_from_file(str(text_file))
        
        assert len(asins) == 100
        assert asins == asins_list  # Order preserved
    
    def test_deduplication_preserves_first_occurrence(self, tmp_path):
        """Test that deduplication keeps first occurrence"""
        text_file = tmp_path / "duplicates.txt"
        text_file.write_text("""B0C99GS958
B0CB9X9XX1
B0C99GS958
B0D2RT4S3B
B0CB9X9XX1
B0C99GS958
""")
        
        asins = read_asins_from_file(str(text_file))
        
        # Should preserve order of first occurrence
        assert asins == ['B0C99GS958', 'B0CB9X9XX1', 'B0D2RT4S3B']


class TestExtractASINFromURL:
    """Test ASIN extraction from Amazon URLs using regex"""
    
    @pytest.mark.asyncio
    async def test_standard_amazon_url(self):
        """Test standard Amazon product URL"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        asin = await db.extract_asin_from_url("https://www.amazon.com/dp/B0C99GS958")
        assert asin == "B0C99GS958"
    
    @pytest.mark.asyncio
    async def test_url_with_query_params(self):
        """Test URL with query parameters"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        asin = await db.extract_asin_from_url("https://www.amazon.com/dp/B0C99GS958?tag=test-20&ref=abc")
        assert asin == "B0C99GS958"
    
    @pytest.mark.asyncio
    async def test_url_with_product_title(self):
        """Test URL with product title in path"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        asin = await db.extract_asin_from_url("https://www.amazon.com/Bifacial-Solar-Panel-100W/dp/B0CB9X9XX1")
        assert asin == "B0CB9X9XX1"
    
    @pytest.mark.asyncio
    async def test_url_with_ref_parameter(self):
        """Test URL with ref parameter after ASIN"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        asin = await db.extract_asin_from_url("https://www.amazon.com/dp/B0D2RT4S3B/ref=sr_1_1")
        assert asin == "B0D2RT4S3B"
    
    @pytest.mark.asyncio
    async def test_invalid_urls_return_none(self):
        """Test that invalid URLs return None"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        assert await db.extract_asin_from_url("https://www.amazon.com") is None
        assert await db.extract_asin_from_url("https://www.google.com") is None
        assert await db.extract_asin_from_url("") is None
        assert await db.extract_asin_from_url(None) is None
    
    @pytest.mark.asyncio
    async def test_asin_format_validation(self):
        """Test that only valid ASIN format (10 chars) is extracted"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        # Valid ASIN (10 alphanumeric characters)
        assert await db.extract_asin_from_url("https://www.amazon.com/dp/B0C99GS958") == "B0C99GS958"
        
        # Invalid ASIN (too short) - regex won't match
        assert await db.extract_asin_from_url("https://www.amazon.com/dp/B0C99") is None
        
        # Invalid ASIN (too long) - regex extracts first 10 chars
        result = await db.extract_asin_from_url("https://www.amazon.com/dp/B0C99GS958EXTRA")
        # Should extract only the 10-character ASIN
        assert result == "B0C99GS958" or result == "B0C99GS958"
    
    @pytest.mark.asyncio
    @pytest.mark.parametrize("url,expected", [
        ("https://www.amazon.com/dp/B0C99GS958", "B0C99GS958"),
        ("https://www.amazon.com/dp/B0CB9X9XX1?ref=test", "B0CB9X9XX1"),
        ("https://www.amazon.com/product/dp/B0D2RT4S3B", "B0D2RT4S3B"),
        ("https://www.amazon.com/dp/B07BMNGVV3/ref=sr_1_1", "B07BMNGVV3"),
        ("https://www.amazon.co.uk/dp/B0DMP9V9XS", "B0DMP9V9XS"),  # UK site
        ("https://example.com/dp/B0C99GS958", "B0C99GS958"),  # Non-Amazon but has pattern
        ("https://www.amazon.com", None),
        ("https://www.amazon.com/s?k=solar+panel", None),
        ("", None),
    ])
    async def test_various_url_patterns(self, url, expected):
        """Parametrized test for various URL patterns"""
        from scripts.database import SolarPanelDB
        db = SolarPanelDB()
        
        asin = await db.extract_asin_from_url(url)
        assert asin == expected


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

