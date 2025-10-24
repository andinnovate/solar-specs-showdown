# 403 Forbidden Error Handling Implementation

## Overview
Implemented comprehensive 403 Forbidden error detection and handling for ScraperAPI to prevent wasted processing and preserve ASINs for retry when API access issues are resolved.

## Problem
When ScraperAPI returns 403 Forbidden errors (due to API key issues, rate limiting, or account problems), the system was:
- ❌ Wasting processing time on failed API calls
- ❌ Marking ASINs as permanently failed
- ❌ Not distinguishing between temporary and permanent failures
- ❌ Continuing to process more ASINs despite API access issues

## Solution
Implemented intelligent 403 error detection that:
- ✅ **Detects 403 errors** in both product fetching and search operations
- ✅ **Stops processing immediately** when 403 is detected
- ✅ **Leaves ASINs as pending** instead of marking them as failed
- ✅ **Provides clear logging** about API access issues
- ✅ **Preserves ASINs for retry** when API access is restored

## Implementation Details

### 1. Custom Exception Class
```python
class ScraperAPIForbiddenError(Exception):
    """Custom exception for ScraperAPI 403 Forbidden errors"""
    pass
```

### 2. ScraperAPI Client Enhancement
**File: `scripts/scraper.py`**

Added 403 error detection in both `fetch_product()` and `search_amazon()` methods:

```python
except requests.exceptions.RequestException as e:
    # Check for 403 Forbidden error (API key issues, rate limits, etc.)
    if hasattr(e, 'response') and e.response is not None:
        if e.response.status_code == 403:
            logger.critical(f"ScraperAPI 403 Forbidden error detected...")
            raise ScraperAPIForbiddenError(f"ScraperAPI 403 Forbidden: {str(e)}")
```

### 3. Ingest Script Enhancement
**File: `scripts/ingest_staged_asins.py`**

Added special handling for 403 errors:

```python
except ScraperAPIForbiddenError as e:
    # 403 Forbidden error - stop processing and leave ASIN as pending
    logger.log_script_event("CRITICAL", f"ScraperAPI 403 Forbidden error: {str(e)}")
    logger.log_script_event("CRITICAL", "Stopping processing due to API access issues. ASINs will remain pending.")
    # Don't mark as failed - leave as pending for retry later
    return False
```

### 4. Search Script Enhancement
**File: `scripts/search_solar_panels.py`**

Added 403 error handling to search operations:

```python
try:
    search_results = scraper.search_amazon(keyword, page=page)
except ScraperAPIForbiddenError as e:
    logger.log_script_event("CRITICAL", f"ScraperAPI 403 Forbidden error: {str(e)}")
    logger.log_script_event("CRITICAL", "Stopping search due to API access issues.")
    return stats  # Return current stats without processing more pages
```

## Key Benefits

### 🛡️ **API Credit Protection**
- **Immediate detection** of API access issues
- **No wasted API calls** after 403 is detected
- **Preserves remaining credits** for when access is restored

### 🔄 **Smart Retry Logic**
- **ASINs remain pending** instead of being marked as failed
- **Automatic retry** when API access is restored
- **No manual intervention** required for recovery

### 📊 **Clear Monitoring**
- **Critical-level logging** for 403 errors
- **Specific error messages** about API access issues
- **Actionable guidance** for resolving problems

### ⚡ **Efficient Processing**
- **Stops processing immediately** when 403 detected
- **No unnecessary retries** for API access issues
- **Preserves system resources** for valid operations

## Error Handling Flow

### Before (Inefficient)
```
1. Make API call
2. Get 403 error
3. Mark ASIN as failed
4. Continue processing more ASINs
5. Repeat for each ASIN (wasting credits)
```

### After (Optimized)
```
1. Make API call
2. Get 403 error
3. Log critical error
4. Stop processing immediately
5. Leave ASINs as pending
6. Wait for API access to be restored
```

## Test Coverage

### Comprehensive Test Suite
**File: `scripts/tests/test_403_error_handling.py`**

- ✅ **6 test cases** covering all scenarios
- ✅ **403 error detection** in both fetch and search
- ✅ **Proper exception handling** in ingest and search scripts
- ✅ **ASIN preservation** (not marked as failed)
- ✅ **Error differentiation** (403 vs other HTTP errors)
- ✅ **Edge case handling** (errors without response objects)

### Test Scenarios
1. **ScraperAPI 403 Detection**: Verifies 403 errors are properly detected
2. **Search 403 Detection**: Verifies 403 errors in search operations
3. **Ingest 403 Handling**: Verifies ASINs are not marked as failed
4. **Search 403 Handling**: Verifies search stops gracefully
5. **Error Differentiation**: Verifies 403 vs other HTTP errors
6. **Edge Cases**: Verifies handling of errors without response objects

## Usage Impact

### For Ingest Operations
- **Immediate stop** when 403 detected
- **ASINs remain pending** for retry
- **Clear error messages** in logs
- **No wasted processing** on subsequent ASINs

### For Search Operations
- **Graceful termination** of search process
- **Partial results preserved** if some pages completed
- **Clear indication** of API access issues
- **Easy recovery** when access is restored

## Monitoring and Recovery

### Log Messages to Watch For
```
CRITICAL - ScraperAPI 403 Forbidden error: ScraperAPI 403 Forbidden: API key invalid
CRITICAL - Stopping processing due to API access issues. ASINs will remain pending.
CRITICAL - Please check ScraperAPI credentials and rate limits.
```

### Recovery Actions
1. **Check API key validity** in ScraperAPI dashboard
2. **Verify rate limits** and usage quotas
3. **Restart processing** - ASINs will be retried automatically
4. **Monitor logs** for successful API access restoration

## Backward Compatibility

✅ **No breaking changes**
- All existing functionality preserved
- Same CLI interface
- Same database operations
- Same error handling for non-403 errors

## Future Enhancements

Potential improvements:
1. **Automatic API key rotation** when 403 detected
2. **Rate limit detection** and adaptive delays
3. **API usage monitoring** and alerts
4. **Circuit breaker pattern** for extended 403 periods
5. **Fallback API providers** for critical operations

## Files Modified

### Core Implementation
- **`scripts/scraper.py`**: Added 403 error detection and custom exception
- **`scripts/ingest_staged_asins.py`**: Added 403 error handling in ingest
- **`scripts/search_solar_panels.py`**: Added 403 error handling in search

### Testing
- **`scripts/tests/test_403_error_handling.py`**: Comprehensive test suite

### Documentation
- **`403_ERROR_HANDLING_SUMMARY.md`**: This summary document

## Verification

The implementation has been thoroughly tested and verified:
- ✅ **All tests passing** (6/6 test cases)
- ✅ **No linting errors** in modified files
- ✅ **Proper exception handling** in all scenarios
- ✅ **ASIN preservation** confirmed
- ✅ **Clear error logging** implemented
- ✅ **Backward compatibility** maintained
