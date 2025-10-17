"""
Pytest tests for utility functions in scripts/utils.py.
Tests formatting, validation, and helper functions.

Run with: pytest scripts/tests/test_utils.py -v
"""

import pytest
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scripts.utils import (
    format_duration,
    format_file_size,
    safe_filename,
    get_script_name
)


class TestFormatDuration:
    """Test duration formatting function"""
    
    def test_seconds_less_than_minute(self):
        """Test formatting for durations under 60 seconds"""
        assert format_duration(0) == "0.0s"
        assert format_duration(1.5) == "1.5s"
        assert format_duration(30.7) == "30.7s"
        assert format_duration(59.9) == "59.9s"
    
    def test_minutes_less_than_hour(self):
        """Test formatting for durations under 60 minutes"""
        assert format_duration(60) == "1.0m"
        assert format_duration(90) == "1.5m"
        assert format_duration(150) == "2.5m"
        assert format_duration(3599) == "60.0m"
    
    def test_hours_and_above(self):
        """Test formatting for durations over 1 hour"""
        assert format_duration(3600) == "1.0h"
        assert format_duration(5400) == "1.5h"
        assert format_duration(7200) == "2.0h"
        assert format_duration(86400) == "24.0h"
    
    @pytest.mark.parametrize("seconds,expected", [
        (0, "0.0s"),
        (1, "1.0s"),
        (30, "30.0s"),
        (60, "1.0m"),
        (90, "1.5m"),
        (3600, "1.0h"),
        (7200, "2.0h"),
    ])
    def test_various_durations(self, seconds, expected):
        """Parametrized test for various durations"""
        assert format_duration(seconds) == expected


class TestFormatFileSize:
    """Test file size formatting function"""
    
    def test_bytes(self):
        """Test formatting for sizes in bytes"""
        assert format_file_size(0) == "0.0B"
        assert format_file_size(500) == "500.0B"
        assert format_file_size(1023) == "1023.0B"
    
    def test_kilobytes(self):
        """Test formatting for sizes in kilobytes"""
        assert format_file_size(1024) == "1.0KB"
        assert format_file_size(1536) == "1.5KB"
        assert format_file_size(10240) == "10.0KB"
    
    def test_megabytes(self):
        """Test formatting for sizes in megabytes"""
        assert format_file_size(1048576) == "1.0MB"
        assert format_file_size(5242880) == "5.0MB"
        assert format_file_size(10485760) == "10.0MB"
    
    def test_gigabytes(self):
        """Test formatting for sizes in gigabytes"""
        assert format_file_size(1073741824) == "1.0GB"
        assert format_file_size(5368709120) == "5.0GB"
    
    def test_terabytes(self):
        """Test formatting for sizes in terabytes"""
        assert format_file_size(1099511627776) == "1.0TB"
    
    @pytest.mark.parametrize("bytes_size,expected", [
        (0, "0.0B"),
        (100, "100.0B"),
        (1024, "1.0KB"),
        (1048576, "1.0MB"),
        (1073741824, "1.0GB"),
        (2048, "2.0KB"),
        (2097152, "2.0MB"),
    ])
    def test_various_sizes(self, bytes_size, expected):
        """Parametrized test for various file sizes"""
        assert format_file_size(bytes_size) == expected


class TestSafeFilename:
    """Test safe filename generation"""
    
    def test_removes_invalid_characters(self):
        """Test that invalid characters are removed"""
        assert safe_filename('file<name>.txt') == 'file_name_.txt'
        assert safe_filename('file>name.txt') == 'file_name.txt'
        assert safe_filename('file:name.txt') == 'file_name.txt'
        assert safe_filename('file"name.txt') == 'file_name.txt'
        assert safe_filename('file/name.txt') == 'file_name.txt'
        assert safe_filename('file\\name.txt') == 'file_name.txt'
        assert safe_filename('file|name.txt') == 'file_name.txt'
        assert safe_filename('file?name.txt') == 'file_name.txt'
        assert safe_filename('file*name.txt') == 'file_name.txt'
    
    def test_valid_filename_unchanged(self):
        """Test that valid filenames are not changed"""
        assert safe_filename('valid_file.txt') == 'valid_file.txt'
        assert safe_filename('file-name.csv') == 'file-name.csv'
        assert safe_filename('file_123.json') == 'file_123.json'
    
    def test_multiple_invalid_characters(self):
        """Test filename with multiple invalid characters"""
        assert safe_filename('file<>:"/\\|?*name.txt') == 'file_________name.txt'
    
    def test_empty_and_edge_cases(self):
        """Test edge cases"""
        assert safe_filename('') == ''
        assert safe_filename('   ') == '   '  # Whitespace preserved
        assert safe_filename('...') == '...'   # Dots preserved
    
    @pytest.mark.parametrize("input_name,expected", [
        ('normal_file.txt', 'normal_file.txt'),
        ('file<test>.txt', 'file_test_.txt'),
        ('path/to/file.txt', 'path_to_file.txt'),
        ('file:with:colons.txt', 'file_with_colons.txt'),
        ('file"with"quotes.txt', 'file_with_quotes.txt'),
    ])
    def test_various_filenames(self, input_name, expected):
        """Parametrized test for various filename patterns"""
        assert safe_filename(input_name) == expected


class TestGetScriptName:
    """Test get_script_name function"""
    
    def test_returns_script_name_without_extension(self):
        """Test that it returns the script name without .py extension"""
        # This function uses sys.argv[0], so the result depends on how pytest is run
        # We'll test that it returns a non-empty string
        result = get_script_name()
        assert isinstance(result, str)
        assert len(result) > 0
        assert not result.endswith('.py')  # Should strip .py extension
    
    def test_removes_py_extension(self, monkeypatch):
        """Test that .py extension is removed"""
        monkeypatch.setattr(sys, 'argv', ['test_script.py', 'arg1'])
        assert get_script_name() == 'test_script'
    
    def test_handles_path_in_argv(self, monkeypatch):
        """Test that it handles full paths"""
        monkeypatch.setattr(sys, 'argv', ['/path/to/my_script.py'])
        assert get_script_name() == 'my_script'
    
    @pytest.mark.parametrize("argv,expected", [
        (['script.py'], 'script'),
        (['my_script.py'], 'my_script'),
        (['/usr/bin/python', 'test.py'], 'python'),  # Takes argv[0]
        (['fetch_solar_panels.py'], 'fetch_solar_panels'),
    ])
    def test_various_argv_formats(self, monkeypatch, argv, expected):
        """Parametrized test for various sys.argv formats"""
        monkeypatch.setattr(sys, 'argv', argv)
        assert get_script_name() == expected


class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_format_duration_zero(self):
        """Test formatting zero duration"""
        assert format_duration(0) == "0.0s"
    
    def test_format_duration_very_large(self):
        """Test formatting very large duration"""
        # 1 week = 604800 seconds
        result = format_duration(604800)
        assert result == "168.0h"  # 7 days in hours
    
    def test_format_file_size_zero(self):
        """Test formatting zero bytes"""
        assert format_file_size(0) == "0.0B"
    
    def test_format_file_size_exactly_1024(self):
        """Test formatting exactly 1024 bytes (boundary)"""
        assert format_file_size(1024) == "1.0KB"
    
    def test_safe_filename_unicode(self):
        """Test that unicode characters are preserved"""
        assert safe_filename('file_名前.txt') == 'file_名前.txt'
        assert safe_filename('résumé.pdf') == 'résumé.pdf'
    
    def test_safe_filename_only_invalid_chars(self):
        """Test filename with only invalid characters"""
        assert safe_filename('<>:"/\\|?*') == '_________'


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

