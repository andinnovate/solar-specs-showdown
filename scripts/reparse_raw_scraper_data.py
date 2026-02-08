#!/usr/bin/env python3
"""
Reparse raw ScraperAPI responses with improved extractors and update panels.
Designed to refresh wattage, dimensions, weight, piece_count, and voltage
without running the scraper again.
"""

import argparse
import logging
import os
import sys
from typing import Any, Dict, List, Optional, Set
from datetime import datetime, timezone

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client
from scripts.config import config
from scripts.scraper import ScraperAPIParser
from scripts.logging_config import ScriptExecutionContext

TARGET_FIELDS = [
    'wattage',
    'length_cm',
    'width_cm',
    'weight_kg',
    'piece_count',
    'voltage',
]

FLAG_FIELD_ALIASES = {
    'length_cm': {'length_cm', 'width_cm', 'dimensions'},
    'width_cm': {'length_cm', 'width_cm', 'dimensions'},
    'weight_kg': {'weight_kg', 'weight'},
    'wattage': {'wattage'},
    'voltage': {'voltage'},
    'piece_count': {'piece_count'},
}

MISSING_FIELD_MAP = {
    'wattage': 'wattage',
    'weight_kg': 'weight',
    'length_cm': 'dimensions',
    'width_cm': 'dimensions',
}


def values_equal(old: Any, new: Any, tol: float = 0.01) -> bool:
    if old is None and new is None:
        return True
    if old is None or new is None:
        return False
    if isinstance(old, (int, float)) and isinstance(new, (int, float)):
        return abs(old - new) <= tol
    return old == new


def build_summary() -> Dict[str, Any]:
    return {
        'rows_processed': 0,
        'rows_skipped': 0,
        'rows_missing_panel': 0,
        'rows_missing_raw': 0,
        'parse_failed': 0,
        'parse_failed_missing_required': 0,
        'parse_failed_unknown': 0,
        'rows_with_override_mismatch': 0,
        'updates_planned': 0,
        'updates_applied': 0,
        'flags_resolved': 0,
        'field_updates': {field: 0 for field in TARGET_FIELDS},
        'override_confirmed': {field: 0 for field in TARGET_FIELDS},
        'override_mismatch': {field: 0 for field in TARGET_FIELDS},
        'override_unparsed': {field: 0 for field in TARGET_FIELDS},
        'missing_required': {
            'name': 0,
            'asin': 0,
            'brand': 0,
        },
        'missing_required_examples': {
            'name': [],
            'asin': [],
            'brand': [],
        },
    }


def fetch_raw_rows(client, limit: int, offset: int, asin: Optional[str]) -> List[Dict[str, Any]]:
    query = client.table('raw_scraper_data').select(
        'asin, panel_id, scraper_response, created_at'
    ).order('created_at', desc=True)

    if asin:
        query = query.eq('asin', asin)

    if limit is not None:
        query = query.range(offset, offset + limit - 1)

    result = query.execute()
    return result.data or []


def fetch_panel(client, panel_id: str) -> Optional[Dict[str, Any]]:
    result = client.table('solar_panels').select(
        'id, asin, wattage, length_cm, width_cm, weight_kg, piece_count, voltage, '
        'missing_fields, manual_overrides, user_verified_overrides'
    ).eq('id', panel_id).single().execute()
    return result.data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Reparse raw ScraperAPI data with improved extraction'
    )
    parser.add_argument('--limit', type=int, default=100, help='Max rows to process')
    parser.add_argument('--offset', type=int, default=0, help='Offset for pagination')
    parser.add_argument('--apply', action='store_true', help='Apply updates to database')
    parser.add_argument('--only-missing', action='store_true', help='Only process panels missing target fields')
    parser.add_argument('--asin', type=str, help='Limit to a specific ASIN')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Log extraction evidence for all fields, even when no updates are applied'
    )
    parser.add_argument(
        '--override-mismatch-only',
        action='store_true',
        help='Only show panels where parsed values differ from protected overrides'
    )
    parser.add_argument(
        '--check-overrides',
        action='store_true',
        help='Compare parsed values against protected overrides (manual/user-verified)'
    )
    return parser.parse_args()


def update_missing_fields(current_missing: Any, remove_keys: Set[str]) -> Optional[List[str]]:
    if not remove_keys:
        return None
    if not isinstance(current_missing, list):
        current_missing = []
    updated = [field for field in current_missing if field not in remove_keys]
    if updated == current_missing:
        return None
    return updated


def build_flag_clear_fields(update_data: Dict[str, Any]) -> Set[str]:
    fields: Set[str] = set()
    for field in update_data.keys():
        if field == 'missing_fields':
            continue
        fields.update(FLAG_FIELD_ALIASES.get(field, {field}))
    return fields


def format_value(value: Any) -> str:
    if isinstance(value, float):
        return f"{value:.2f}".rstrip('0').rstrip('.')
    return str(value)


def is_minor_rounding(old: Any, new: Any, tolerance: float = 0.05) -> bool:
    if old is None or new is None:
        return False
    if not isinstance(old, (int, float)) or not isinstance(new, (int, float)):
        return False
    diff = abs(old - new)
    return 0 < diff <= tolerance


def is_dimension_swap(
    old_length: Any,
    old_width: Any,
    new_length: Any,
    new_width: Any,
    tolerance: float = 0.01,
) -> bool:
    if None in (old_length, old_width, new_length, new_width):
        return False
    if not all(isinstance(value, (int, float)) for value in [old_length, old_width, new_length, new_width]):
        return False
    return (abs(old_length - new_width) <= tolerance and abs(old_width - new_length) <= tolerance)


def format_field_value(field: str, value: Any) -> str:
    if value is None:
        return "None"
    if field in {'length_cm', 'width_cm'} and isinstance(value, (int, float)):
        inches = value / 2.54
        return f"{format_value(value)} cm ({inches:.2f} in)"
    if field == 'weight_kg' and isinstance(value, (int, float)):
        pounds = value / 0.453592
        return f"{format_value(value)} kg ({pounds:.2f} lb)"
    return format_value(value)


def format_changes(panel: Dict[str, Any], update_data: Dict[str, Any]) -> str:
    parts = []
    old_length = panel.get('length_cm')
    old_width = panel.get('width_cm')
    new_length = update_data.get('length_cm')
    new_width = update_data.get('width_cm')
    swap_dimensions = (
        new_length is not None
        and new_width is not None
        and is_dimension_swap(old_length, old_width, new_length, new_width)
    )
    for field in TARGET_FIELDS:
        if field in update_data:
            tags = []
            if field == 'length_cm' and swap_dimensions:
                tags.append('swap')
            if field in {'length_cm', 'width_cm'} and is_minor_rounding(panel.get(field), update_data[field]):
                tags.append('rounding')
            tag_suffix = f" [{' '.join(tags)}]" if tags else ""
            parts.append(
                f"{field}: {format_field_value(field, panel.get(field))} -> {format_field_value(field, update_data[field])}{tag_suffix}"
            )
    if 'missing_fields' in update_data:
        parts.append(
            f"missing_fields: {panel.get('missing_fields')} -> {update_data['missing_fields']}"
        )
    return "; ".join(parts)


def truncate_text(text: Any, limit: int = 160) -> str:
    if text is None:
        return "None"
    text_str = str(text)
    if len(text_str) <= limit:
        return text_str
    return text_str[:limit - 3] + "..."


def format_dimension_value(value: Any) -> str:
    if not value or not isinstance(value, tuple) or len(value) != 2:
        return "None"
    length_cm, width_cm = value
    length_in = length_cm / 2.54
    width_in = width_cm / 2.54
    return f"{format_value(length_cm)}x{format_value(width_cm)} cm ({length_in:.2f}x{width_in:.2f} in)"


def format_evidence_value(field_key: str, value: Any) -> str:
    if field_key == 'dimensions':
        return format_dimension_value(value)
    if field_key == 'weight':
        return format_field_value('weight_kg', value)
    if field_key == 'wattage':
        return format_value(value)
    if field_key == 'voltage':
        return format_value(value)
    if field_key == 'piece_count':
        return format_value(value)
    return format_value(value)


def log_extraction_evidence(
    panel: Dict[str, Any],
    parsed: Dict[str, Any],
    logger: logging.Logger,
    candidate_limit: int = 3,
) -> None:
    evidence = parsed.get('extraction_evidence') or {}
    panel_id = panel.get('id')
    asin = panel.get('asin')

    field_map = [
        ('wattage', 'wattage', panel.get('wattage'), parsed.get('wattage')),
        ('dimensions', 'length_cm', (panel.get('length_cm'), panel.get('width_cm')), (parsed.get('length_cm'), parsed.get('width_cm'))),
        ('weight', 'weight_kg', panel.get('weight_kg'), parsed.get('weight_kg')),
        ('piece_count', 'piece_count', panel.get('piece_count'), parsed.get('piece_count')),
        ('voltage', 'voltage', panel.get('voltage'), parsed.get('voltage')),
    ]

    for evidence_key, field_label, current_value, proposed_value in field_map:
        entry = evidence.get(evidence_key) or {}
        selected = entry.get('selected') or {}
        candidates = entry.get('candidates') or []

        if evidence_key == 'dimensions':
            current_display = format_dimension_value(current_value)
            proposed_display = format_dimension_value(proposed_value)
        else:
            current_display = format_field_value(field_label, current_value)
            proposed_display = format_field_value(field_label, proposed_value)

        selected_value = selected.get('value')
        selected_display = format_evidence_value(evidence_key, selected_value)
        selected_confidence = selected.get('confidence')
        selected_source = selected.get('source')
        selected_raw = truncate_text(selected.get('raw'))

        candidate_texts = []
        for candidate in candidates[:candidate_limit]:
            candidate_value = format_evidence_value(evidence_key, candidate.get('value'))
            candidate_texts.append(
                f"{candidate_value} (conf={candidate.get('confidence')}, source={candidate.get('source')}, raw={truncate_text(candidate.get('raw'))})"
            )

        logger.info(
            "Evidence panel_id=%s asin=%s field=%s current=%s proposed=%s selected=%s conf=%s source=%s raw=%s candidates=[%s]",
            panel_id,
            asin,
            evidence_key,
            current_display,
            proposed_display,
            selected_display,
            selected_confidence,
            selected_source,
            selected_raw,
            "; ".join(candidate_texts) if candidate_texts else "None",
        )


def resolve_pending_flags(
    client,
    panel_id: str,
    fields_to_clear: Set[str],
    logger: logging.Logger,
) -> int:
    if not fields_to_clear:
        return 0

    result = client.table('user_flags').select(
        'id, flagged_fields, flag_type, status'
    ).eq('panel_id', panel_id).eq('status', 'pending').execute()

    if not result.data:
        return 0

    to_resolve: List[str] = []
    for flag in result.data:
        if flag.get('flag_type') == 'deletion_recommendation':
            continue
        flagged_fields = flag.get('flagged_fields') or []
        if isinstance(flagged_fields, list) and set(flagged_fields) & fields_to_clear:
            to_resolve.append(flag['id'])

    if not to_resolve:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    note = f"Auto-resolved by reparse (fields updated: {', '.join(sorted(fields_to_clear))})"
    for flag_id in to_resolve:
        client.table('user_flags').update({
            'status': 'resolved',
            'admin_note': note,
            'resolved_at': now,
            'updated_at': now,
        }).eq('id', flag_id).execute()

    logger.info(
        "Resolved %s pending flag(s) for panel_id=%s (fields: %s)",
        len(to_resolve),
        panel_id,
        ", ".join(sorted(fields_to_clear))
    )
    return len(to_resolve)


def run_reparse(args: argparse.Namespace, logger: logging.Logger) -> Dict[str, Any]:
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    summary = build_summary()

    rows = fetch_raw_rows(client, args.limit, args.offset, args.asin)
    if not rows:
        logger.info('No raw_scraper_data rows found for given criteria.')
        return summary

    for row in rows:
        summary['rows_processed'] += 1
        panel_id = row.get('panel_id')
        if not panel_id:
            summary['rows_missing_panel'] += 1
            continue

        raw_response = row.get('scraper_response')
        if not raw_response:
            summary['rows_missing_raw'] += 1
            continue

        panel = fetch_panel(client, panel_id)
        if not panel:
            summary['rows_missing_panel'] += 1
            continue

        if args.only_missing:
            missing_fields = panel.get('missing_fields')
            if not isinstance(missing_fields, list):
                missing_fields = []
            if not set(missing_fields) & {'wattage', 'weight', 'dimensions'}:
                summary['rows_skipped'] += 1
                continue

        raw_product_info = raw_response.get('product_information') or {}
        raw_asin = raw_response.get('asin') or raw_product_info.get('ASIN')
        raw_name = raw_response.get('name')
        raw_brand = raw_response.get('brand') or raw_product_info.get('Brand')

        if not raw_name or not raw_asin or not raw_brand:
            if not raw_name:
                summary['missing_required']['name'] += 1
                if len(summary['missing_required_examples']['name']) < 5:
                    summary['missing_required_examples']['name'].append(raw_asin or panel_id)
            if not raw_asin:
                summary['missing_required']['asin'] += 1
                if len(summary['missing_required_examples']['asin']) < 5:
                    summary['missing_required_examples']['asin'].append(panel_id)
            if not raw_brand:
                summary['missing_required']['brand'] += 1
                if len(summary['missing_required_examples']['brand']) < 5:
                    summary['missing_required_examples']['brand'].append(raw_asin or panel_id)
            summary['parse_failed'] += 1
            summary['parse_failed_missing_required'] += 1
            continue

        parsed = ScraperAPIParser.parse_product_data(raw_response)
        if not parsed:
            summary['parse_failed'] += 1
            summary['parse_failed_unknown'] += 1
            continue

        if args.debug:
            log_extraction_evidence(panel, parsed, logger)

        manual_overrides = panel.get('manual_overrides') or []
        user_verified_overrides = panel.get('user_verified_overrides') or []
        protected_fields = set(manual_overrides) | set(user_verified_overrides)

        update_data: Dict[str, Any] = {}
        remove_missing: Set[str] = set()
        override_mismatches: List[Dict[str, Any]] = []
        extraction_evidence = parsed.get('extraction_evidence') or {}
        check_overrides = args.check_overrides or args.override_mismatch_only

        def register_override_check(field: str, new_value: Any, current_value: Any, evidence_key: str) -> None:
            if not check_overrides:
                return
            if field not in protected_fields:
                return
            if new_value is None:
                summary['override_unparsed'][field] += 1
                return
            if values_equal(current_value, new_value):
                summary['override_confirmed'][field] += 1
                return

            summary['override_mismatch'][field] += 1
            evidence = extraction_evidence.get(evidence_key) or {}
            selected = evidence.get('selected') or {}
            tags: List[str] = []
            if field in {'length_cm', 'width_cm'} and is_minor_rounding(current_value, new_value):
                tags.append('rounding')
            override_mismatches.append({
                'field': field,
                'current': current_value,
                'proposed': new_value,
                'confidence': selected.get('confidence'),
                'source': selected.get('source'),
                'raw': selected.get('raw'),
                'tags': tags,
            })

        # Wattage
        new_wattage = parsed.get('wattage')
        register_override_check('wattage', new_wattage, panel.get('wattage'), 'wattage')
        if new_wattage is not None and 'wattage' not in protected_fields:
            if not values_equal(panel.get('wattage'), new_wattage):
                update_data['wattage'] = new_wattage
                summary['field_updates']['wattage'] += 1
                remove_missing.add(MISSING_FIELD_MAP['wattage'])

        # Weight
        new_weight = parsed.get('weight_kg')
        register_override_check('weight_kg', new_weight, panel.get('weight_kg'), 'weight')
        if new_weight is not None and 'weight_kg' not in protected_fields:
            if not values_equal(panel.get('weight_kg'), new_weight):
                update_data['weight_kg'] = new_weight
                summary['field_updates']['weight_kg'] += 1
                remove_missing.add(MISSING_FIELD_MAP['weight_kg'])

        # Dimensions (update as a pair)
        new_length = parsed.get('length_cm')
        new_width = parsed.get('width_cm')
        register_override_check('length_cm', new_length, panel.get('length_cm'), 'dimensions')
        register_override_check('width_cm', new_width, panel.get('width_cm'), 'dimensions')
        if new_length is not None and new_width is not None:
            if 'length_cm' not in protected_fields and 'width_cm' not in protected_fields:
                if (not values_equal(panel.get('length_cm'), new_length)
                        or not values_equal(panel.get('width_cm'), new_width)):
                    update_data['length_cm'] = new_length
                    update_data['width_cm'] = new_width
                    summary['field_updates']['length_cm'] += 1
                    summary['field_updates']['width_cm'] += 1
                    remove_missing.add(MISSING_FIELD_MAP['length_cm'])

        # Piece count
        new_piece_count = parsed.get('piece_count')
        register_override_check('piece_count', new_piece_count, panel.get('piece_count'), 'piece_count')
        if new_piece_count is not None and 'piece_count' not in protected_fields:
            if not values_equal(panel.get('piece_count'), new_piece_count):
                update_data['piece_count'] = new_piece_count
                summary['field_updates']['piece_count'] += 1

        # Voltage
        new_voltage = parsed.get('voltage')
        register_override_check('voltage', new_voltage, panel.get('voltage'), 'voltage')
        if new_voltage is not None and 'voltage' not in protected_fields:
            if not values_equal(panel.get('voltage'), new_voltage):
                update_data['voltage'] = new_voltage
                summary['field_updates']['voltage'] += 1

        if override_mismatches and check_overrides:
            if new_length is not None and new_width is not None:
                if is_dimension_swap(panel.get('length_cm'), panel.get('width_cm'), new_length, new_width):
                    for mismatch in override_mismatches:
                        if mismatch['field'] in {'length_cm', 'width_cm'}:
                            mismatch['tags'] = list(set(mismatch['tags'] + ['swap']))
            summary['rows_with_override_mismatch'] += 1
            if args.verbose or args.override_mismatch_only:
                for mismatch in override_mismatches:
                    tag_suffix = f" [{' '.join(mismatch['tags'])}]" if mismatch.get('tags') else ""
                    logger.info(
                        "Override mismatch panel_id=%s asin=%s field=%s current=%s proposed=%s%s confidence=%s source=%s raw=%s",
                        panel_id,
                        panel.get('asin'),
                        mismatch['field'],
                        format_field_value(mismatch['field'], mismatch['current']),
                        format_field_value(mismatch['field'], mismatch['proposed']),
                        tag_suffix,
                        mismatch['confidence'],
                        mismatch['source'],
                        mismatch['raw'],
                    )

        if args.override_mismatch_only and not override_mismatches:
            summary['rows_skipped'] += 1
            continue

        updated_missing = update_missing_fields(panel.get('missing_fields'), remove_missing)
        if updated_missing is not None:
            update_data['missing_fields'] = updated_missing

        if not update_data:
            summary['rows_skipped'] += 1
            continue

        summary['updates_planned'] += 1

        if args.verbose and not args.override_mismatch_only:
            change_summary = format_changes(panel, update_data)
            logger.info(
                f"Plan update panel_id={panel_id} asin={panel.get('asin')} changes: {change_summary}"
            )

        if args.apply:
            client.table('solar_panels').update(update_data).eq('id', panel_id).execute()
            summary['updates_applied'] += 1
            cleared = resolve_pending_flags(
                client,
                panel_id,
                build_flag_clear_fields(update_data),
                logger,
            )
            summary['flags_resolved'] += cleared

    return summary


def main() -> int:
    args = parse_args()
    log_level = 'DEBUG' if args.verbose else 'INFO'

    with ScriptExecutionContext('reparse_raw_scraper_data', log_level) as (logger, error_handler):
        try:
            summary = run_reparse(args, logger.get_logger())
            logger.log_script_event('INFO', f"Reparse summary: {summary}")
            return 0
        except Exception as exc:
            error_handler.handle_error(exc, 'Reparsing raw scraper data', critical=True)
            return 1


if __name__ == '__main__':
    raise SystemExit(main())
