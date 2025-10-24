# Ingest Staged ASINs Improvements Summary

## Overview
Enhanced the `ingest_staged_asins.py` script to better handle parsing failures, improve retry logic, and add debugging capabilities.

## Key Improvements

### 1. CLI Support for Specific ASINs
- **New `--asin` argument**: Process a specific ASIN regardless of status
- **Usage**: `python scripts/ingest_staged_asins.py --asin B0CPLQGGD7`
- **Features**:
  - Shows current ASIN status and details
  - Processes the ASIN even if it's failed or completed
  - Provides detailed output for debugging

### 2. Enhanced Error Handling and Retry Logic
- **Permanent vs Temporary Failures**: Distinguishes between parsing failures (permanent) and network issues (temporary)
- **Improved `mark_asin_failed()` method**: Added `is_permanent` parameter
- **Smart Retry Logic**:
  - Parsing failures → Mark as `failed` (no retry)
  - Network timeouts → Mark as `pending` (retry up to max attempts)
  - Max attempts exceeded → Mark as `failed` (no more retries)

### 3. Enhanced Logging for Debugging
- **Parsing Failure Details**: When price parsing fails, logs:
  - ASIN, product name, manufacturer
  - Available pricing data
  - Product info keys
- **ASIN Processing Details**: Shows:
  - Current status, source, keyword
  - Attempt count and error messages
  - Processing timeline

### 4. Better Exception Handling
- **Wrapped API calls**: Added try-catch around product fetching
- **Detailed error messages**: More specific error reporting
- **Graceful degradation**: Continues processing other ASINs if one fails

## Code Changes

### Files Modified:
1. **`scripts/ingest_staged_asins.py`**:
   - Added `--asin` CLI argument
   - Enhanced `ingest_single_asin()` with better error handling
   - Added specific ASIN processing logic
   - Improved logging for debugging

2. **`scripts/asin_manager.py`**:
   - Updated `mark_asin_failed()` to accept `is_permanent` parameter
   - Improved retry logic to distinguish failure types
   - Enhanced logging for retry decisions

3. **`scripts/scraper.py`**:
   - Enhanced error logging for parsing failures
   - Added debugging information for failed price parsing
   - More detailed error context

### Files Added:
1. **`scripts/tests/test_asin_retry_logic.py`**:
   - Tests for retry logic improvements
   - Tests for permanent vs temporary failure handling
   - Tests for enhanced logging

2. **`scripts/tests/test_ingest_cli.py`**:
   - Tests for CLI functionality
   - Tests for specific ASIN processing
   - Tests for error handling

## Usage Examples

### Process a Specific ASIN
```bash
# Process a specific ASIN with verbose output
python scripts/ingest_staged_asins.py --asin B0CPLQGGD7 --verbose

# Process a specific ASIN (basic)
python scripts/ingest_staged_asins.py --asin B0CPLQGGD7
```

### Enhanced Logging Output
```
Processing ASIN: B0CPLQGGD7
  Current Status: pending
  Source: search
  Keyword: solar panel monocrystalline
  Attempts: 1/3
  Error: Failed to fetch product data for ASIN: B0CPLQGGD7
============================================================
```

### Parsing Failure Debug Info
```
Failed to parse price: ''
ASIN: B0CPLQGGD7, Name: Test Panel, Manufacturer: Test Corp
Available pricing data: N/A
Product info keys: ['name', 'manufacturer', 'wattage']
```

## Benefits

1. **No More Infinite Retry Loops**: Parsing failures are now marked as permanent
2. **Better Debugging**: Enhanced logging provides context for failures
3. **Targeted Processing**: Can process specific ASINs for testing/debugging
4. **Improved Reliability**: Better distinction between temporary and permanent failures
5. **Enhanced Monitoring**: More detailed status information for ASINs

## Testing

All improvements are covered by comprehensive tests:
- ✅ Retry logic tests
- ✅ CLI functionality tests  
- ✅ Error handling tests
- ✅ Logging enhancement tests

## Backward Compatibility

All existing functionality is preserved:
- ✅ Normal batch processing still works
- ✅ All existing CLI arguments still work
- ✅ Database schema unchanged
- ✅ No breaking changes to existing workflows

## Future Enhancements

Potential future improvements:
1. **Retry Strategy Configuration**: Allow different retry strategies per failure type
2. **Bulk ASIN Processing**: Process multiple specific ASINs
3. **Failure Analysis**: Automatic analysis of common failure patterns
4. **Recovery Suggestions**: Suggest fixes for common parsing failures
