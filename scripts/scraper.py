"""
ScraperAPI client for fetching and parsing Amazon solar panel data.
Handles unit conversions and data normalization for database storage.
"""

import re
import requests
import sys
import os
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple, List, Any
import logging

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import config
from scripts.logging_config import ScriptLogger

logger = logging.getLogger(__name__)


class ScraperAPIForbiddenError(Exception):
    """Custom exception for ScraperAPI 403 Forbidden errors"""
    pass


class UnitConverter:
    """Handles unit conversions for solar panel specifications"""
    
    @staticmethod
    def inches_to_cm(inches: float) -> float:
        """Convert inches to centimeters"""
        from decimal import Decimal, ROUND_HALF_UP
        result = Decimal(str(inches)) * Decimal('2.54')
        return float(result.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
    
    @staticmethod
    def pounds_to_kg(pounds: float) -> float:
        """Convert pounds to kilograms"""
        from decimal import Decimal, ROUND_HALF_UP
        result = Decimal(str(pounds)) * Decimal('0.453592')
        return float(result.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
    
    @staticmethod
    def parse_dimension_string(dim_string: str) -> Optional[Tuple[float, float]]:
        """
        Parse Amazon product dimensions string into length and width in cm.
        Flexible parsing that handles multiple formats and ensures length > width.
        
        Examples:
            "45.67\"L x 17.71\"W x 1.18\"H" -> (116.00, 44.98)
            "43 x 33.9 x 0.1 inches" -> (109.22, 86.11)
            "115 x 66 x 3 cm" -> (115.0, 66.0)
            "17.71 x 45.67 x 1.18 inches" -> (116.00, 44.98)  # auto-swaps to length > width
        
        Returns:
            Tuple of (length_cm, width_cm) where length >= width, or None if parsing fails
        """
        try:
            if not dim_string or not str(dim_string).strip():
                return None

            normalized = str(dim_string).lower()
            normalized = normalized.replace('×', 'x')
            normalized = re.sub(r'[,\u00a0]', ' ', normalized)
            normalized = re.sub(r'\s+', ' ', normalized).strip()

            def normalize_unit(unit: Optional[str]) -> Optional[str]:
                if not unit:
                    return None
                unit = unit.strip().lower()
                if unit in ['"', 'in', 'inch', 'inches']:
                    return 'in'
                if unit in ['cm', 'centimeter', 'centimeters']:
                    return 'cm'
                if unit in ['mm', 'millimeter', 'millimeters']:
                    return 'mm'
                if unit in ['m', 'meter', 'meters']:
                    return 'm'
                return None

            def to_cm(value: float, unit: Optional[str]) -> float:
                if unit == 'in':
                    return UnitConverter.inches_to_cm(value)
                if unit == 'mm':
                    return round(value / 10.0, 2)
                if unit == 'm':
                    return round(value * 100.0, 2)
                return round(value, 2)

            def guess_unit_from_text(text: str) -> Optional[str]:
                if '"' in text or 'inch' in text:
                    return 'in'
                if 'mm' in text or 'millimeter' in text:
                    return 'mm'
                if 'cm' in text or 'centimeter' in text:
                    return 'cm'
                if re.search(r'\bmeters?\b', text) or re.search(r'\bm\b', text):
                    return 'm'
                return None

            def guess_unit_from_values(values: List[float]) -> Optional[str]:
                if not values:
                    return None
                if max(values) <= 20:
                    return 'in'
                return 'cm'

            def select_length_width(values_cm: List[float]) -> Optional[Tuple[float, float]]:
                cleaned = [value for value in values_cm if value and value > 0]
                if len(cleaned) < 2:
                    return None
                cleaned.sort(reverse=True)
                return (round(cleaned[0], 2), round(cleaned[1], 2))

            # Pattern A/B: labeled dimensions in any order (L/W/H or Length/Width/Height)
            labeled_values: List[Tuple[float, Optional[str]]] = []
            for match in re.finditer(
                r'(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches|\")?\s*([lwh])\b',
                normalized,
            ):
                labeled_values.append((float(match.group(1)), match.group(2)))

            for match in re.finditer(
                r'(?:length|width|height|l|w|h)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches|\")?',
                normalized,
            ):
                labeled_values.append((float(match.group(1)), match.group(2)))

            if len(labeled_values) >= 2:
                fallback_unit = guess_unit_from_text(normalized)
                values_only = [value for value, _ in labeled_values]
                if not fallback_unit:
                    fallback_unit = guess_unit_from_values(values_only)
                converted = [
                    to_cm(value, normalize_unit(unit) or fallback_unit)
                    for value, unit in labeled_values
                ]
                selected = select_length_width(converted)
                if selected:
                    return selected

            # Pattern C: three dimensions with trailing unit
            pattern_three = r'([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*(mm|cm|m|in|inch|inches)'
            match = re.search(pattern_three, normalized, re.IGNORECASE)
            if match:
                dims = [float(match.group(1)), float(match.group(2)), float(match.group(3))]
                unit = normalize_unit(match.group(4))
                converted = [to_cm(dim, unit) for dim in dims]
                selected = select_length_width(converted)
                if selected:
                    return selected

            # Pattern D: three numbers, no explicit units
            pattern_numbers = r'([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)'
            match = re.search(pattern_numbers, normalized, re.IGNORECASE)
            if match:
                dims = [float(match.group(1)), float(match.group(2)), float(match.group(3))]
                unit = guess_unit_from_values(dims)
                converted = [to_cm(dim, unit) for dim in dims]
                selected = select_length_width(converted)
                if selected:
                    return selected

            # Pattern E: two dimensions with explicit unit nearby
            pattern_two = r'([\d.]+)\s*x\s*([\d.]+)\s*(mm|cm|m|in|inch|inches)'
            match = re.search(pattern_two, normalized, re.IGNORECASE)
            if match:
                dims = [float(match.group(1)), float(match.group(2))]
                unit = normalize_unit(match.group(3))
                converted = [to_cm(dim, unit) for dim in dims]
                selected = select_length_width(converted)
                if selected:
                    return selected

            return None

        except (ValueError, AttributeError) as e:
            logger.warning(f"Failed to parse dimensions '{dim_string}': {e}")
            return None
    
    @staticmethod
    def parse_weight_string(weight_string: str) -> Optional[float]:
        """
        Parse weight string into kilograms.
        
        Examples:
            "15.87 pounds" -> 7.20
            "7.2 kg" -> 7.2
            "15.87" -> 7.20 (assumes pounds if no unit)
        
        Returns:
            Weight in kg or None if parsing fails
        """
        try:
            if not weight_string or not str(weight_string).strip():
                return None
            # Extract numeric value
            numeric_match = re.search(r'([\d.]+)', weight_string)
            if not numeric_match:
                return None
            
            value = float(numeric_match.group(1))
            
            # Check unit
            weight_lower = weight_string.lower()
            if 'kg' in weight_lower or 'kilogram' in weight_lower:
                return round(value, 2)
            elif 'g' in weight_lower and 'kg' not in weight_lower:
                return round(value / 1000.0, 2)
            elif 'oz' in weight_lower or 'ounce' in weight_lower:
                return round(value * 0.0283495, 2)
            elif 'lb' in weight_lower or 'pound' in weight_lower or 'lbs' in weight_lower:
                return UnitConverter.pounds_to_kg(value)
            else:
                # Assume pounds if no unit specified (Amazon default)
                return UnitConverter.pounds_to_kg(value)
                
        except ValueError as e:
            logger.warning(f"Failed to parse weight '{weight_string}': {e}")
            return None
    
    @staticmethod
    def parse_power_string(power_string: str, context: str = None) -> Optional[int]:
        """
        Parse power/wattage string into integer watts.
        
        Examples:
            "100 Watts" -> 100
            "100W" -> 100
            "100" -> 100
            "8E+2 Watts" -> 800
            "1.5kW" -> 1500
            "2.5E+3W" -> 2500
        
        Returns:
            Wattage as integer or None if parsing fails
        """
        try:
            if not power_string or not power_string.strip():
                return None
            
            # Clean the string
            power_string = power_string.strip()
            
            # Handle scientific notation and various formats
            # Pattern to match: optional negative sign, number (with optional decimal), optional E notation, optional units
            patterns = [
                # Scientific notation: 8E+2, 1.5E+3, -8E+2, etc.
                r'(-?[\d.]+[Ee][+-]?\d+)',
                # Regular decimal numbers: 100, 1.5, -100, etc.
                r'(-?[\d.]+)',
            ]
            
            numeric_value = None
            for pattern in patterns:
                match = re.search(pattern, power_string)
                if match:
                    try:
                        numeric_value = float(match.group(1))
                        break
                    except ValueError:
                        continue
            
            if numeric_value is None:
                return None
            
            # Check for unit multipliers (only kW for individual solar panels)
            power_string_lower = power_string.lower()
            if 'kw' in power_string_lower or 'kilowatt' in power_string_lower:
                numeric_value *= 1000
            
            # Convert to integer and validate reasonable range
            # Use standard rounding: 0.5 and above rounds up
            result = int(numeric_value + 0.5) if numeric_value >= 0 else int(numeric_value - 0.5)
            
            # Sanity check: wattage should be between 0W and 2kW for individual solar panels
            # Most individual solar panels are under 2kW, but some large panels can be up to 2kW
            if result < 0 or result > 2000:
                context_info = f" for {context}" if context else ""
                logger.warning(f"Wattage {result}W seems unreasonable for individual solar panel{context_info}")
                return None
            
            return result
            
        except (ValueError, OverflowError) as e:
            logger.warning(f"Failed to parse power '{power_string}': {e}")
            return None
    
    @staticmethod
    def parse_voltage_string(voltage_string: str) -> Optional[float]:
        """
        Parse voltage string into decimal volts.
        
        Examples:
            "12 Volts" -> 12.0
            "12V" -> 12.0
            "12" -> 12.0
        
        Returns:
            Voltage as float or None if parsing fails
        """
        try:
            # Extract numeric value
            numeric_match = re.search(r'([\d.]+)', voltage_string)
            if not numeric_match:
                return None
            
            value = float(numeric_match.group(1))
            return round(value, 2)
            
        except ValueError as e:
            logger.warning(f"Failed to parse voltage '{voltage_string}': {e}")
            return None
    
    @staticmethod
    def parse_price_string(price_string: str) -> Optional[float]:
        """
        Parse price string into decimal USD.
        
        Examples:
            "$69.99" -> 69.99
            "69.99" -> 69.99
            "$1,299.99" -> 1299.99
        
        Returns:
            Price as float or None if parsing fails
        """
        try:
            # Remove currency symbols and commas
            cleaned = re.sub(r'[$,]', '', price_string)
            # Extract numeric value
            numeric_match = re.search(r'([\d.]+)', cleaned)
            if not numeric_match:
                return None
            
            value = float(numeric_match.group(1))
            return round(value, 2)
            
        except ValueError as e:
            logger.warning(f"Failed to parse price '{price_string}': {e}")
            return None


@dataclass
class ExtractionCandidate:
    field: str
    value: Any
    confidence: float
    source: str
    raw: Optional[str] = None
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'field': self.field,
            'value': self.value,
            'confidence': round(self.confidence, 3),
            'source': self.source,
            'raw': self.raw,
            'meta': self.meta,
        }


class SpecExtractor:
    """
    Evidence-based extraction for problematic fields (wattage, dimensions, weight, piece_count, voltage).
    Collects candidates from multiple sources and ranks by confidence.
    """

    WATTAGE_KEYS = {
        'maximum power': 0.9,
        'maximum power output': 0.9,
        'rated power': 0.85,
        'wattage': 0.85,
        'output power': 0.8,
        'power': 0.7,
    }

    WATTAGE_NOISE_PATTERNS = [
        r'\b(inverter|battery|lifepo4|controller|charge controller|charger|generator|capacity|storage)\b',
        r'\bpower\s+station\b',
        r'\b\d+(?:\.\d+)?\s*(?:kwh|wh|ah|mah)\b',
    ]

    DIMENSION_KEYS = {
        'product dimensions': 0.9,
        'item dimensions': 0.85,
        'item dimensions l x w x h': 0.85,
        'package dimensions': 0.6,
        'dimensions': 0.7,
    }

    WEIGHT_KEYS = {
        'item weight': 0.9,
        'weight': 0.7,
        'package weight': 0.6,
    }

    PIECE_KEYS = {
        'item package quantity': 0.9,
        'number of pieces': 0.9,
        'number of items': 0.85,
        'piece count': 0.85,
        'pieces': 0.7,
        'pack': 0.6,
        'package quantity': 0.75,
    }

    VOLTAGE_KEYS = {
        'output voltage': 0.9,
        'operating voltage': 0.85,
        'rated voltage': 0.85,
        'maximum voltage': 0.8,
        'max voltage': 0.8,
        'voltage': 0.7,
    }

    def __init__(self, api_response: Dict[str, Any]):
        self.api_response = api_response
        self.product_info = api_response.get('product_information', {}) or {}
        self.asin = api_response.get('asin') or self.product_info.get('ASIN')
        self.title = self._normalize_text(api_response.get('name') or '')
        features = api_response.get('feature_bullets') or api_response.get('features') or []
        if isinstance(features, str):
            features = [features]
        self.features = [self._normalize_text(f) for f in features if f]
        self.description = self._normalize_text(
            api_response.get('full_description') or api_response.get('description') or ''
        )
        self.attributes = api_response.get('attributes') or {}
        self.technical_details = api_response.get('technical_details') or {}
        self.spec_strings = self._build_spec_strings()

    @staticmethod
    def _normalize_text(text: str) -> str:
        return re.sub(r'\s+', ' ', str(text)).strip()

    def _build_spec_strings(self) -> List[str]:
        blocks = []
        for key, value in {**self.product_info, **self.attributes, **self.technical_details}.items():
            if value is None or value == '':
                continue
            blocks.append(f"{key}: {value}")
        return blocks

    def _find_product_info(self, patterns: Dict[str, float]) -> List[Tuple[str, Any, float]]:
        matches = []
        for key, value in self.product_info.items():
            if value is None or value == '':
                continue
            key_lower = str(key).lower()
            for pattern, confidence in patterns.items():
                if pattern in key_lower:
                    matches.append((key, value, confidence))
                    break
        return matches

    @staticmethod
    def _boost_consensus(candidates: List[ExtractionCandidate], tolerance: float = 0.01) -> None:
        if not candidates:
            return
        groups: List[List[ExtractionCandidate]] = []
        for candidate in candidates:
            placed = False
            for group in groups:
                ref = group[0].value
                if isinstance(ref, tuple) and isinstance(candidate.value, tuple):
                    if abs(ref[0] - candidate.value[0]) <= tolerance and abs(ref[1] - candidate.value[1]) <= tolerance:
                        group.append(candidate)
                        placed = True
                        break
                elif isinstance(ref, (int, float)) and isinstance(candidate.value, (int, float)):
                    if abs(ref - candidate.value) <= tolerance:
                        group.append(candidate)
                        placed = True
                        break
                else:
                    if ref == candidate.value:
                        group.append(candidate)
                        placed = True
                        break
            if not placed:
                groups.append([candidate])

        for group in groups:
            if len(group) > 1:
                bonus = min(0.15, 0.05 * (len(group) - 1))
                for candidate in group:
                    candidate.confidence = min(0.99, candidate.confidence + bonus)

    @staticmethod
    def _select_best(candidates: List[ExtractionCandidate], validator=None) -> Optional[ExtractionCandidate]:
        for candidate in sorted(candidates, key=lambda c: (-c.confidence, c.source)):
            if validator and not validator(candidate.value):
                continue
            return candidate
        return None

    def _add_wattage_candidates_from_text(
        self,
        text: str,
        source: str,
        base_confidence: float,
    ) -> List[ExtractionCandidate]:
        candidates: List[ExtractionCandidate] = []
        if not text:
            return candidates

        normalized = text.replace('×', 'x')
        context = f"ASIN {self.asin}" if self.asin else None

        def is_noise_context(match_start: int, match_end: int) -> bool:
            window_start = max(0, match_start - 30)
            window_end = min(len(normalized), match_end + 30)
            window = normalized[window_start:window_end]
            for pattern in self.WATTAGE_NOISE_PATTERNS:
                if re.search(pattern, window):
                    return True
            return False

        # Pattern: 2x100W or 2 x 100 W (optional pcs/panels)
        match = re.search(
            r'(\d+)\s*(?:pcs?|pieces|panels?)?\s*[x]\s*(\d+(?:\.\d+)?)\s*(?:w|watt|watts)\b',
            normalized,
            re.IGNORECASE,
        )
        if match:
            if is_noise_context(match.start(), match.end()):
                return candidates
            count = int(match.group(1))
            watts = UnitConverter.parse_power_string(match.group(2), context=context)
            if watts:
                candidates.append(ExtractionCandidate(
                    field='wattage',
                    value=watts,
                    confidence=base_confidence + 0.1,
                    source=source,
                    raw=match.group(0),
                    meta={'piece_count': count, 'pattern': 'count_x_wattage'}
                ))

        # Pattern: 100W x2 (optional pcs/panels)
        match = re.search(
            r'(\d+(?:\.\d+)?)\s*(?:w|watt|watts)\s*[x]\s*(\d+)\s*(?:pcs?|pieces|panels?)?\b',
            normalized,
            re.IGNORECASE,
        )
        if match:
            if is_noise_context(match.start(), match.end()):
                return candidates
            watts = UnitConverter.parse_power_string(match.group(1), context=context)
            count = int(match.group(2))
            if watts:
                candidates.append(ExtractionCandidate(
                    field='wattage',
                    value=watts,
                    confidence=base_confidence + 0.1,
                    source=source,
                    raw=match.group(0),
                    meta={'piece_count': count, 'pattern': 'wattage_x_count'}
                ))

        # Pattern: 2PCS 100W (count + pcs + wattage, no x)
        match = re.search(
            r'(\d+)\s*(?:pcs?|pieces|panels?)\s*(\d+(?:\.\d+)?)\s*(?:w|watt|watts)\b',
            normalized,
            re.IGNORECASE,
        )
        if match:
            if is_noise_context(match.start(), match.end()):
                return candidates
            count = int(match.group(1))
            watts = UnitConverter.parse_power_string(match.group(2), context=context)
            if watts:
                candidates.append(ExtractionCandidate(
                    field='wattage',
                    value=watts,
                    confidence=base_confidence + 0.1,
                    source=source,
                    raw=match.group(0),
                    meta={'piece_count': count, 'pattern': 'count_pcs_wattage'}
                ))

        # Simple wattage mentions
        for match in re.finditer(r'(\d+(?:\.\d+)?)\s*(?:k?w|watt|watts)\b', normalized, re.IGNORECASE):
            if is_noise_context(match.start(), match.end()):
                continue
            watts = UnitConverter.parse_power_string(match.group(0), context=context)
            if watts:
                candidates.append(ExtractionCandidate(
                    field='wattage',
                    value=watts,
                    confidence=base_confidence,
                    source=source,
                    raw=match.group(0),
                ))

        return candidates

    def extract_wattage(self) -> List[ExtractionCandidate]:
        candidates: List[ExtractionCandidate] = []
        for key, value, confidence in self._find_product_info(self.WATTAGE_KEYS):
            candidates.extend(
                self._add_wattage_candidates_from_text(
                    str(value),
                    source=f"product_information.{key}",
                    base_confidence=confidence,
                )
            )

        for feature in self.features:
            candidates.extend(
                self._add_wattage_candidates_from_text(
                    feature, source="feature_bullets", base_confidence=0.75
                )
            )

        if self.title:
            candidates.extend(
                self._add_wattage_candidates_from_text(
                    self.title, source="title", base_confidence=0.6
                )
            )

        if self.description:
            candidates.extend(
                self._add_wattage_candidates_from_text(
                    self.description, source="description", base_confidence=0.45
                )
            )

        self._boost_consensus(candidates)
        return candidates

    def extract_dimensions(self) -> List[ExtractionCandidate]:
        candidates: List[ExtractionCandidate] = []
        for key, value, confidence in self._find_product_info(self.DIMENSION_KEYS):
            dims = UnitConverter.parse_dimension_string(str(value))
            if dims:
                candidates.append(ExtractionCandidate(
                    field='dimensions',
                    value=dims,
                    confidence=confidence,
                    source=f"product_information.{key}",
                    raw=str(value),
                ))

        for text, source, confidence in [
            (self.title, "title", 0.45),
            (self.description, "description", 0.35),
        ]:
            if not text:
                continue
            dims = UnitConverter.parse_dimension_string(text)
            if dims:
                candidates.append(ExtractionCandidate(
                    field='dimensions',
                    value=dims,
                    confidence=confidence,
                    source=source,
                    raw=text,
                ))

        self._boost_consensus(candidates)
        return candidates

    def extract_weight(self) -> List[ExtractionCandidate]:
        candidates: List[ExtractionCandidate] = []
        for key, value, confidence in self._find_product_info(self.WEIGHT_KEYS):
            weight = UnitConverter.parse_weight_string(str(value))
            if weight:
                candidates.append(ExtractionCandidate(
                    field='weight_kg',
                    value=weight,
                    confidence=confidence,
                    source=f"product_information.{key}",
                    raw=str(value),
                ))

        self._boost_consensus(candidates)
        return candidates

    def extract_piece_count(self, wattage_candidates: List[ExtractionCandidate]) -> List[ExtractionCandidate]:
        candidates: List[ExtractionCandidate] = []

        # From explicit product info keys
        for key, value, confidence in self._find_product_info(self.PIECE_KEYS):
            count_match = re.search(r'(\d+)', str(value))
            if count_match:
                count = int(count_match.group(1))
                candidates.append(ExtractionCandidate(
                    field='piece_count',
                    value=count,
                    confidence=confidence,
                    source=f"product_information.{key}",
                    raw=str(value),
                ))

        # From wattage multipliers
        for candidate in wattage_candidates:
            piece_count = candidate.meta.get('piece_count')
            if piece_count:
                candidates.append(ExtractionCandidate(
                    field='piece_count',
                    value=int(piece_count),
                    confidence=min(0.95, candidate.confidence + 0.1),
                    source=f"{candidate.source}.piece_count",
                    raw=candidate.raw,
                ))

        # From title/features
        pack_patterns = [
            r'(\d+)\s*(?:pack|pk|pcs|pieces|panels?|set)\b',
            r'(?:pack of|set of)\s*(\d+)',
        ]
        for text, source, confidence in [
            (self.title, "title", 0.55),
            (' '.join(self.features), "feature_bullets", 0.5),
        ]:
            if not text:
                continue
            for pattern in pack_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    count = int(match.group(1))
                    candidates.append(ExtractionCandidate(
                        field='piece_count',
                        value=count,
                        confidence=confidence,
                        source=source,
                        raw=match.group(0),
                    ))

        self._boost_consensus(candidates)
        return candidates

    @staticmethod
    def build_math_confirmed_piece_count(
        wattage_candidates: List[ExtractionCandidate],
        tolerance: float = 1.0,
    ) -> List[ExtractionCandidate]:
        confirmed: Dict[int, ExtractionCandidate] = {}

        def base_source(source: str) -> str:
            return source.split('.')[0]

        for per_panel in wattage_candidates:
            piece_count = per_panel.meta.get('piece_count')
            if not piece_count or not isinstance(per_panel.value, int):
                continue
            for total in wattage_candidates:
                if total is per_panel or not isinstance(total.value, int):
                    continue
                if base_source(total.source) != base_source(per_panel.source):
                    continue
                expected = int(piece_count) * per_panel.value
                if abs(total.value - expected) > tolerance:
                    continue

                confidence = min(0.99, max(per_panel.confidence, total.confidence) + 0.2)
                candidate = ExtractionCandidate(
                    field='piece_count',
                    value=int(piece_count),
                    confidence=confidence,
                    source=f"math_confirmed.{per_panel.source}",
                    raw=per_panel.raw or total.raw,
                    meta={
                        'per_panel_wattage': per_panel.value,
                        'total_wattage': total.value,
                        'pattern': 'count_x_wattage_math',
                    },
                )
                existing = confirmed.get(int(piece_count))
                if not existing or candidate.confidence > existing.confidence:
                    confirmed[int(piece_count)] = candidate

        return list(confirmed.values())

    def extract_voltage(self) -> List[ExtractionCandidate]:
        candidates: List[ExtractionCandidate] = []

        def parse_voltage_candidates(value: str) -> List[float]:
            numeric_parts = re.findall(r'\d+(?:\.\d+)?', value)
            return [float(v) for v in numeric_parts]

        def choose_voltage(values: List[float]) -> Tuple[Optional[float], float, Dict[str, Any]]:
            if not values:
                return None, 0.0, {}
            typical = {6, 12, 18, 24, 36, 48, 60}
            for v in values:
                if round(v) in typical:
                    return round(v, 2), 0.85, {'pattern': 'typical_voltage'}
            # Prefer lowest reasonable voltage
            values_sorted = sorted(values)
            for v in values_sorted:
                if 1 <= v <= 200:
                    return round(v, 2), 0.7, {'pattern': 'reasonable_voltage'}
            # Fallback to high voltage (system)
            return round(values_sorted[0], 2), 0.4, {'pattern': 'system_voltage'}

        for key, value, confidence in self._find_product_info(self.VOLTAGE_KEYS):
            values = parse_voltage_candidates(str(value))
            chosen, bonus, meta = choose_voltage(values)
            if chosen is not None:
                candidates.append(ExtractionCandidate(
                    field='voltage',
                    value=chosen,
                    confidence=min(0.99, confidence + bonus - 0.5),
                    source=f"product_information.{key}",
                    raw=str(value),
                    meta=meta,
                ))

        # Title/feature voltage hints (lower confidence)
        for text, source, confidence in [
            (self.title, "title", 0.5),
            (' '.join(self.features), "feature_bullets", 0.45),
        ]:
            if not text:
                continue
            values = parse_voltage_candidates(text)
            chosen, bonus, meta = choose_voltage(values)
            if chosen is not None:
                candidates.append(ExtractionCandidate(
                    field='voltage',
                    value=chosen,
                    confidence=min(0.9, confidence + bonus - 0.5),
                    source=source,
                    raw=text,
                    meta=meta,
                ))

        self._boost_consensus(candidates)
        return candidates



class ScraperAPIParser:
    """Parses ScraperAPI response data into database format"""
    
    @staticmethod
    def parse_product_data(api_response: Dict) -> Optional[Dict]:
        """
        Parse ScraperAPI JSON response into database-ready format.
        Only name, manufacturer, and ASIN are required. All specs are optional.
        
        Args:
            api_response: Raw JSON response from ScraperAPI
            
        Returns:
            Dictionary with database fields or None if parsing fails
        """
        try:
            # Initialize failure tracking
            parsing_failures = []
            missing_fields = []
            
            product_info = api_response.get('product_information', {})
            
            # Get ASIN early for error logging
            asin = api_response.get('asin') or product_info.get('ASIN')
            
            # REQUIRED: Name
            name = api_response.get('name')
            if not name:
                parsing_failures.append("Missing product name")
                logger.error("Product name is missing")
                return None
            
            # REQUIRED: Manufacturer
            manufacturer = api_response.get('brand', '').replace('Visit the ', '').replace(' Store', '').strip()
            if not manufacturer:
                # Try to get from product_information
                manufacturer = product_info.get('Brand', 'Unknown')
            if not manufacturer or manufacturer == 'Unknown':
                parsing_failures.append("Missing manufacturer")
                logger.error("Manufacturer is missing")
                return None
            
            # REQUIRED: ASIN
            if not asin:
                parsing_failures.append("Missing ASIN")
                logger.error("ASIN is missing")
                return None
            
            extractor = SpecExtractor(api_response)
            extraction_evidence: Dict[str, Any] = {}

            def validate_dimensions(value: Any) -> bool:
                if not value or not isinstance(value, tuple) or len(value) != 2:
                    return False
                length_val, width_val = value
                if length_val <= 0 or width_val <= 0:
                    return False
                if length_val < width_val:
                    return False
                if length_val > 400 or width_val > 400:
                    return False
                return True

            def validate_weight(value: Any) -> bool:
                return isinstance(value, (int, float)) and 0.1 <= value <= 100

            def validate_wattage(value: Any) -> bool:
                return isinstance(value, int) and 5 <= value <= 2000

            def validate_piece_count(value: Any) -> bool:
                return isinstance(value, int) and 1 <= value <= 50

            def validate_voltage(value: Any) -> bool:
                return isinstance(value, (int, float)) and 1 <= value <= 200

            def select_field(
                field_label: str,
                candidates: List[ExtractionCandidate],
                threshold: float,
                validator=None,
                missing_key: Optional[str] = None,
                track_missing: bool = True,
                log_failures: bool = True,
            ) -> Any:
                sorted_candidates = sorted(candidates, key=lambda c: (-c.confidence, c.source))
                evidence = {
                    'candidates': [c.to_dict() for c in sorted_candidates[:3]]
                }
                best = SpecExtractor._select_best(sorted_candidates, validator)
                if best:
                    evidence['selected'] = best.to_dict()
                extraction_evidence[field_label] = evidence

                if not best:
                    if track_missing and missing_key:
                        missing_fields.append(missing_key)
                    if log_failures:
                        parsing_failures.append(f"No {field_label} candidates")
                    return None

                if best.confidence < threshold:
                    if track_missing and missing_key:
                        missing_fields.append(missing_key)
                    if log_failures:
                        parsing_failures.append(
                            f"Low confidence {field_label} ({best.confidence:.2f}) from {best.source}"
                        )
                    return None

                return best.value

            wattage_candidates = extractor.extract_wattage()
            dimensions_candidates = extractor.extract_dimensions()
            weight_candidates = extractor.extract_weight()
            voltage_candidates = extractor.extract_voltage()
            piece_count_candidates = extractor.extract_piece_count(wattage_candidates)
            piece_count_candidates.extend(
                SpecExtractor.build_math_confirmed_piece_count(wattage_candidates)
            )

            wattage = select_field(
                "wattage",
                wattage_candidates,
                threshold=0.6,
                validator=validate_wattage,
                missing_key='wattage',
            )
            dimensions = select_field(
                "dimensions",
                dimensions_candidates,
                threshold=0.6,
                validator=validate_dimensions,
                missing_key='dimensions',
            )
            if dimensions:
                length_cm, width_cm = dimensions
            else:
                length_cm, width_cm = None, None

            weight_kg = select_field(
                "weight",
                weight_candidates,
                threshold=0.65,
                validator=validate_weight,
                missing_key='weight',
            )
            piece_count = select_field(
                "piece_count",
                piece_count_candidates,
                threshold=0.6,
                validator=validate_piece_count,
                track_missing=False,
                log_failures=False,
            )
            voltage = select_field(
                "voltage",
                voltage_candidates,
                threshold=0.55,
                validator=validate_voltage,
                track_missing=False,
                log_failures=False,
            )
            
            # Optional: Flag suspiciously high voltages (likely system specs, not panel voltage)
            # Typical panel voltages are 12V, 24V, 36V, 48V
            # System voltages can be 600V, 1000V, 1500V
            # We'll store them but they should be interpreted carefully
            
            # OPTIONAL: Price
            # Check if product is unavailable
            availability_status = api_response.get('availability_status', '').lower()
            is_unavailable = 'unavailable' in availability_status or 'out of stock' in availability_status
            
            if is_unavailable:
                # Set price to 0 to indicate unavailable status
                price_usd = 0
                logger.info(f"Product unavailable (ASIN: {asin}): Setting price to 0")
            else:
                price_str = api_response.get('pricing', '')
                price_usd = UnitConverter.parse_price_string(price_str)
                if not price_usd:
                    parsing_failures.append(f"Failed to parse price: '{price_str}'")
                    missing_fields.append('price')
                    # Enhanced error logging with relevant fields for debugging
                    logger.error(f"Failed to parse price: '{price_str}'")
                    logger.error(f"ASIN: {asin}, Name: {name}, Manufacturer: {manufacturer}")
                    logger.error(f"Available pricing data: {api_response.get('pricing', 'N/A')}")
                    logger.error(f"Product info keys: {list(product_info.keys()) if product_info else 'None'}")
                    price_usd = None
            
            # Optional fields
            description = api_response.get('full_description', '')[:1000] if api_response.get('full_description') else None
            image_url = api_response.get('images', [None])[0]
            
            # Sanitize ASIN to remove any invisible characters (zero-width spaces, etc.)
            if asin:
                import re
                asin = re.sub(r'[\u200B-\u200D\uFEFF\u200E\u200F]', '', asin).strip()
            
            # Construct Amazon URL from ASIN
            web_url = f"https://www.amazon.com/dp/{asin}" if asin else None
            
            # Build database-ready dictionary
            panel_data = {
                'asin': asin,
                'name': name,
                'manufacturer': manufacturer,
                'length_cm': length_cm,
                'width_cm': width_cm,
                'weight_kg': weight_kg,
                'wattage': wattage,
                'voltage': voltage,
                'piece_count': piece_count,
                'price_usd': price_usd,
                'description': description,
                'image_url': image_url,
                'web_url': web_url,
                'parsing_failures': parsing_failures,
                'missing_fields': missing_fields,  # NEW: Track missing fields
                'extraction_evidence': extraction_evidence
            }
            
            return panel_data
            
        except Exception as e:
            logger.error(f"Error parsing product data: {e}")
            return None


class ScraperAPIClient:
    """Client for interacting with ScraperAPI"""
    
    def __init__(self, api_key: Optional[str] = None, script_logger: Optional[ScriptLogger] = None):
        """
        Initialize ScraperAPI client.
        
        Args:
            api_key: ScraperAPI key (uses config if not provided)
            script_logger: Optional ScriptLogger instance for structured logging
        """
        self.api_key = api_key or config.SCRAPERAPI_KEY
        self.base_url = config.SCRAPERAPI_BASE_URL
        self.logger = script_logger
        
        if not self.api_key:
            raise ValueError("ScraperAPI key is required")
    
    def fetch_product(self, asin: str, country_code: str = 'us') -> Optional[Dict]:
        """
        Fetch product data from Amazon via ScraperAPI.
        
        Args:
            asin: Amazon Standard Identification Number
            country_code: Amazon marketplace (default: 'us')
            
        Returns:
            Dict containing:
            - 'parsed_data': Parsed product data ready for database insertion
            - 'raw_response': Raw JSON response from ScraperAPI
            - 'metadata': Processing metadata (size, timing, etc.)
            Or None if failed
        """
        url = f"https://www.amazon.com/dp/{asin}"
        
        payload = {
            'api_key': self.api_key,
            'url': url,
            'output_format': 'json',
            'autoparse': 'true',
            'country_code': country_code
        }
        
        try:
            if self.logger:
                self.logger.log_script_event("INFO", f"Fetching product data for ASIN: {asin}")
            
            import time
            start_time = time.time()
            
            response = requests.get(self.base_url, params=payload, timeout=30)
            response.raise_for_status()
            
            response_time_ms = int((time.time() - start_time) * 1000)
            
            api_data = response.json()
            
            if self.logger:
                self.logger.log_scraper_request(url, True, response_time_ms, asin=asin)
            
            # Parse the API response into database format
            parsed_data = ScraperAPIParser.parse_product_data(api_data)
            
            if parsed_data:
                if self.logger:
                    self.logger.log_script_event(
                        "INFO", 
                        f"Successfully parsed product: {parsed_data['name']}"
                    )
                
                # Calculate response size
                import json
                response_size = len(json.dumps(api_data).encode('utf-8'))
                
                # Create metadata
                metadata = {
                    'response_time_ms': response_time_ms,
                    'response_size_bytes': response_size,
                    'scraper_version': 'v1',
                    'country_code': country_code,
                    'url': url
                }
                
                # Return both parsed data and raw response
                return {
                    'parsed_data': parsed_data,
                    'raw_response': api_data,
                    'metadata': metadata
                }
            else:
                if self.logger:
                    self.logger.log_script_event("ERROR", f"Failed to parse product data for ASIN: {asin}")
                
                # Even when parsing fails, return raw data for analysis
                # Calculate response size
                import json
                response_size = len(json.dumps(api_data).encode('utf-8'))
                
                # Create metadata
                metadata = {
                    'response_time_ms': response_time_ms,
                    'response_size_bytes': response_size,
                    'scraper_version': 'v1',
                    'country_code': country_code,
                    'url': url,
                    'parsing_failed': True,
                    'failure_reason': 'parsing_error'
                }
                
                return {
                    'parsed_data': None,
                    'raw_response': api_data,
                    'metadata': metadata
                }
                
        except requests.exceptions.RequestException as e:
            if self.logger:
                self.logger.log_scraper_request(url, False, error=str(e), asin=asin)
            logger.error(f"ScraperAPI request failed for ASIN {asin}: {e}")
            
            # Check for 403 Forbidden error (API key issues, rate limits, etc.)
            if hasattr(e, 'response') and e.response is not None:
                if e.response.status_code == 403:
                    logger.critical(f"ScraperAPI 403 Forbidden error detected for ASIN {asin}. This indicates API key issues or rate limiting. Stopping processing.")
                    # Raise a special exception that will be caught by the ingest script
                    raise ScraperAPIForbiddenError(f"ScraperAPI 403 Forbidden: {str(e)}")
            
            return None
        except Exception as e:
            if self.logger:
                self.logger.log_script_event("ERROR", f"Unexpected error fetching ASIN {asin}: {e}")
            logger.error(f"Unexpected error for ASIN {asin}: {e}")
            return None
    
    def fetch_multiple_products(self, asins: list[str], delay: float = 1.0) -> Dict[str, Optional[Dict]]:
        """
        Fetch multiple products with delay between requests.
        
        Args:
            asins: List of ASINs to fetch
            delay: Delay in seconds between requests (default: 1.0)
            
        Returns:
            Dictionary mapping ASIN to parsed product data
        """
        import time
        
        results = {}
        
        for i, asin in enumerate(asins):
            if self.logger:
                self.logger.log_script_event(
                    "INFO", 
                    f"Fetching product {i+1}/{len(asins)}: {asin}"
                )
            
            results[asin] = self.fetch_product(asin)
            
            # Add delay between requests (except for last one)
            if i < len(asins) - 1:
                time.sleep(delay)
        
        return results
    
    def search_amazon(self, keyword: str, page: int = 1, country_code: str = 'us') -> Optional[Dict]:
        """
        Search Amazon for products via ScraperAPI with autoparse.
        
        ScraperAPI's autoparse feature automatically parses Amazon search results
        and returns structured JSON with product information.
        
        Args:
            keyword: Search term (e.g., "solar panel 400w")
            page: Page number (default: 1)
            country_code: Amazon marketplace (default: 'us')
            
        Returns:
            ScraperAPI autoparsed search results, or None if failed
            
        Example return (from ScraperAPI autoparse):
        {
            'search_parameters': {...},
            'search_information': {...},
            'products': [
                {
                    'asin': 'B0C99GS958',
                    'title': 'Bifacial 100 Watt Solar Panel...',
                    'link': 'https://www.amazon.com/dp/B0C99GS958',
                    'price': {'value': 69.99, 'currency': 'USD', 'raw': '$69.99'},
                    'rating': 3.8,
                    'ratings_total': 99,
                    ...
                },
                ...
            ]
        }
        """
        # Construct Amazon search URL
        search_url = f"https://www.amazon.com/s?k={keyword.replace(' ', '+')}"
        if page > 1:
            search_url += f"&page={page}"
        
        payload = {
            'api_key': self.api_key,
            'url': search_url,
            'output_format': 'json',
            'autoparse': 'true',  # ScraperAPI autoparse handles search result parsing
            'country_code': country_code
        }
        
        try:
            if self.logger:
                self.logger.log_script_event("INFO", f"Searching Amazon via ScraperAPI: {keyword} (page {page})")
            
            import time
            start_time = time.time()
            
            response = requests.get(self.base_url, params=payload, timeout=60)
            response.raise_for_status()
            
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # ScraperAPI autoparse returns structured JSON
            api_data = response.json()
            
            if self.logger:
                self.logger.log_scraper_request(search_url, True, response_time_ms)
                
                # Enhanced debug logging for search responses
                self.logger.log_script_event(
                    "DEBUG",
                    f"Search response keys: {list(api_data.keys()) if isinstance(api_data, dict) else 'Not a dict'}"
                )
                
                # Log if we can find products under different keys
                if isinstance(api_data, dict):
                    for possible_key in ['products', 'results', 'organic_results', 'search_results', 'items']:
                        if possible_key in api_data:
                            count = len(api_data[possible_key]) if isinstance(api_data[possible_key], list) else '?'
                            self.logger.log_script_event(
                                "DEBUG",
                                f"Found '{possible_key}' key with {count} items"
                            )
            
            # ScraperAPI autoparse provides products in various keys depending on response type
            # Search results use 'results', product details use 'products'
            # Try multiple possible keys and normalize to 'products' for consistency
            products_data = None
            products_key = None
            
            for key in ['results', 'products', 'organic_results', 'search_results', 'items']:
                if key in api_data and isinstance(api_data[key], list) and len(api_data[key]) > 0:
                    products_data = api_data[key]
                    products_key = key
                    break
            
            if products_data:
                # Normalize to 'products' key for downstream compatibility
                api_data['products'] = products_data
                
                if self.logger:
                    self.logger.log_script_event(
                        "INFO", 
                        f"ScraperAPI returned {len(products_data)} products for '{keyword}' (from '{products_key}' key)"
                    )
                
                # Add our metadata for convenience
                api_data['keyword'] = keyword
                api_data['page'] = page
                
                return api_data
            else:
                if self.logger:
                    self.logger.log_script_event("WARNING", f"No products found for keyword: {keyword}")
                return None
                
        except requests.exceptions.RequestException as e:
            if self.logger:
                self.logger.log_scraper_request(search_url, False, error=str(e))
            logger.error(f"ScraperAPI search request failed for keyword '{keyword}': {e}")
            
            # Check for 403 Forbidden error (API key issues, rate limits, etc.)
            if hasattr(e, 'response') and e.response is not None:
                if e.response.status_code == 403:
                    logger.critical(f"ScraperAPI 403 Forbidden error detected for search '{keyword}'. This indicates API key issues or rate limiting. Stopping processing.")
                    # Raise a special exception that will be caught by the search script
                    raise ScraperAPIForbiddenError(f"ScraperAPI 403 Forbidden: {str(e)}")
            
            return None
        except Exception as e:
            if self.logger:
                self.logger.log_script_event("ERROR", f"Unexpected error searching for '{keyword}': {e}")
            logger.error(f"Unexpected error searching for '{keyword}': {e}")
            return None
    
    def extract_asins_from_search(self, search_results: Dict) -> List[str]:
        """
        Extract list of ASINs from ScraperAPI autoparsed search results.
        
        Args:
            search_results: Autoparsed search results from search_amazon()
            
        Returns:
            List of ASINs
            
        Example:
            results = scraper.search_amazon("solar panel 400w")
            asins = scraper.extract_asins_from_search(results)
            # Returns: ['B0C99GS958', 'B0CB9X9XX1', ...]
        """
        if not search_results or 'products' not in search_results:
            return []
        
        asins = []
        for product in search_results['products']:
            # ScraperAPI autoparse provides 'asin' field directly
            asin = product.get('asin')
            
            # Fallback: extract from link/url if asin field missing
            if not asin and 'link' in product:
                import re
                match = re.search(r'/dp/([A-Z0-9]{10})', product['link'])
                if match:
                    asin = match.group(1)
            
            if asin:
                asins.append(asin)
        
        return asins
    
    def extract_prices_from_search(self, search_results: Dict) -> Dict[str, float]:
        """
        Extract ASIN -> price (USD) from ScraperAPI autoparsed search results.
        Used for search-first price updates to avoid a product-detail API call per panel.
        If the same ASIN appears in multiple products, the last seen price wins.
        
        Args:
            search_results: Autoparsed search results from search_amazon() (dict with 'products' list).
            
        Returns:
            Dict mapping ASIN to price_float (USD). Products without valid ASIN or price are skipped.
            
        Price handling:
            - If product['price'] is a dict with 'value', use it (prefer USD).
            - If product['price'] is a string, use UnitConverter.parse_price_string().
        """
        if not search_results or 'products' not in search_results:
            return {}
        
        asin_to_price: Dict[str, float] = {}
        for product in search_results['products']:
            asin = product.get('asin')
            if not asin and 'link' in product:
                match = re.search(r'/dp/([A-Z0-9]{10})', product['link'])
                if match:
                    asin = match.group(1)
            if not asin:
                continue
            
            price_raw = product.get('price')
            price_usd: Optional[float] = None
            
            if isinstance(price_raw, dict):
                if 'value' in price_raw:
                    try:
                        price_usd = float(price_raw['value'])
                        if price_usd is not None:
                            price_usd = round(price_usd, 2)
                    except (TypeError, ValueError):
                        pass
                if price_usd is None and price_raw.get('raw'):
                    price_usd = UnitConverter.parse_price_string(str(price_raw['raw']))
            elif isinstance(price_raw, (str, int, float)):
                price_usd = UnitConverter.parse_price_string(str(price_raw))
            
            if price_usd is not None and price_usd > 0:
                asin_to_price[asin] = price_usd
        
        return asin_to_price
