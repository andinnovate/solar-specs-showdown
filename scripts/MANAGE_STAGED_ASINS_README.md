# Manage Staged ASINs Script

The `manage_staged_asins.py` script provides comprehensive functionality to view, filter, and remove staged ASINs from the database. This is particularly useful for cleaning up test data or removing ASINs from specific search sources.

## Features

- **View Statistics**: Get comprehensive staging statistics and breakdowns
- **List ASINs**: View staged ASINs with filtering options
- **Remove ASINs**: Remove ASINs by various criteria with safety features
- **Dry Run Mode**: Preview what would be removed without actually removing
- **Confirmation Prompts**: Safety prompts for destructive operations

## Usage

### Basic Commands

```bash
# Show comprehensive statistics
python scripts/manage_staged_asins.py --stats

# List recent ASINs
python scripts/manage_staged_asins.py --list

# List with custom limit
python scripts/manage_staged_asins.py --list --list-limit 50
```

### Filtering ASINs

```bash
# Filter by source type
python scripts/manage_staged_asins.py --list --filter-source search

# Filter by status
python scripts/manage_staged_asins.py --list --filter-status pending

# Filter by search string (partial match)
python scripts/manage_staged_asins.py --list --filter-search "solar panel test"
```

### Removing ASINs

**⚠️ IMPORTANT: All removal operations default to dry-run mode for safety.**

```bash
# Remove ASINs by search string (DRY RUN - shows what would be removed)
python scripts/manage_staged_asins.py --remove-by-search "solar panel test"

# Actually remove ASINs by search string (requires --confirm)
python scripts/manage_staged_asins.py --remove-by-search "solar panel test" --confirm

# Remove all failed ASINs
python scripts/manage_staged_asins.py --remove-by-status failed --confirm

# Remove all ASINs from manual source
python scripts/manage_staged_asins.py --remove-by-source manual --confirm

# Remove by exact keyword match
python scripts/manage_staged_asins.py --remove-by-keyword "solar panel test" --confirm

# Skip confirmation prompts (use with caution)
python scripts/manage_staged_asins.py --remove-by-search "test" --confirm --force
```

## Removal Criteria

You can remove ASINs based on:

- **Source Type**: `search`, `manual`, `competitor`, `csv`, `other`
- **Status**: `pending`, `processing`, `completed`, `failed`, `skipped`, `duplicate`
- **Search String**: Partial match in `source_keyword` field
- **Exact Keyword**: Exact match in `source_keyword` field

## Safety Features

1. **Dry Run Default**: All removal operations default to dry-run mode
2. **Confirmation Required**: Use `--confirm` to actually perform removals
3. **Preview**: Always shows what will be removed before doing it
4. **Force Override**: Use `--force` to skip confirmation prompts (use with caution)

## Examples

### Remove Test Data
```bash
# Preview removal of "solar panel test" ASINs
python scripts/manage_staged_asins.py --remove-by-search "solar panel test"

# Actually remove them
python scripts/manage_staged_asins.py --remove-by-search "solar panel test" --confirm
```

### Clean Up Failed ASINs
```bash
# Remove all failed ASINs
python scripts/manage_staged_asins.py --remove-by-status failed --confirm
```

### Remove Manual Entries
```bash
# Remove all manually added ASINs
python scripts/manage_staged_asins.py --remove-by-source manual --confirm
```

### View and Filter
```bash
# Show statistics
python scripts/manage_staged_asins.py --stats

# List only pending ASINs
python scripts/manage_staged_asins.py --list --filter-status pending

# List ASINs from search source
python scripts/manage_staged_asins.py --list --filter-source search
```

## Output Format

The script provides formatted output with:
- ASIN identifier
- Source type
- Source keyword
- Status
- Priority
- Creation timestamp

## Error Handling

The script includes comprehensive error handling and logging. Check the logs directory for detailed execution logs.

## Integration with Existing Workflow

This script complements the existing `ingest_staged_asins.py` script by providing management capabilities for the staging queue. Use it to:

1. Clean up test data before production
2. Remove unwanted ASINs from specific searches
3. Manage the staging queue efficiently
4. Get insights into staging statistics

## Requirements

- Virtual environment activated (`source dev/bin/activate`)
- Database connection configured
- Required Python packages installed
