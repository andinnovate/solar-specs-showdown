#!/usr/bin/env python3
"""
Product filtering logic for solar panel search results.

Filters out non-solar-panel products like testers, charge controllers,
mounts, security cameras, and low-wattage items.
"""

import re
from typing import Optional, Tuple, Dict, Any
from dataclasses import dataclass


@dataclass
class FilterResult:
    """Result of product filtering"""
    should_reject: bool
    reason: str
    confidence: float  # 0.0 to 1.0


class ProductFilter:
    """
    Filters search results to identify actual solar panels.
    
    Excludes:
    - Testers/meters
    - Charge controllers (standalone)
    - Mounting hardware
    - Security cameras
    - Low-wattage items (<30W)
    - Accessories
    """
    
    def __init__(self):
        # Patterns that indicate non-solar-panel products
        self.exclusion_patterns = [
            # Test equipment
            r'\btester\b',
            r'\bmeter\b', 
            r'\bmultimeter\b',
            r'\bvoltmeter\b',
            r'\bammeter\b',
            r'\bpower\s+meter\b',
            
            # Charge controllers (standalone)
            r'\bcharge\s+controller\b',
            r'\bcontroller\b(?!.*solar)',
            r'\bpwm\b(?!.*solar)',
            r'\bmppt\b(?!.*solar)',
            
            # Mounting hardware
            r'\bmount\b',
            r'\bbracket\b',
            r'\bstand\b',
            r'\bclamp\b',
            r'\bbolt\b',
            r'\bscrew\b',
            r'\bhardware\b',
            r'\bframe\b(?!.*solar)',
            
            # Security/cameras
            r'\bsecurity\b',
            r'\bcamera\b',
            r'\bsurveillance\b',
            
            # Wiring/connectors
            r'\bwire\b(?!.*solar)',
            r'\bcable\b(?!.*solar)',
            r'\bconnector\b',
            r'\bplug\b',
            r'\bsocket\b',
            
            # Other accessories
            r'\binverter\b(?!.*solar)',
            r'\bbattery\b(?!.*solar)',
            r'\bcharger\b(?!.*solar)',
            r'\bregulator\b',
            r'\bmonitor\b',
        ]
        
        # Compile patterns for efficiency
        self.exclusion_regex = [
            re.compile(pattern, re.IGNORECASE) 
            for pattern in self.exclusion_patterns
        ]
        
        # Patterns that indicate solar panel kits (allow these)
        self.kit_allowlist = [
            r'solar\s+panel.*kit',
            r'kit.*solar\s+panel',
            r'solar.*starter.*kit',
            r'off.*grid.*kit',
            r'rv.*solar.*kit',
            r'portable.*solar.*kit',
        ]
        
        self.kit_allowlist_regex = [
            re.compile(pattern, re.IGNORECASE)
            for pattern in self.kit_allowlist
        ]
        
        # Minimum wattage threshold
        self.min_wattage = 30
    
    def extract_wattage_from_name(self, name: str) -> Optional[int]:
        """
        Extract wattage from product name.
        
        Args:
            name: Product name
            
        Returns:
            Wattage in watts, or None if not found
        """
        # More comprehensive patterns to match wattage
        wattage_patterns = [
            # Scientific notation: 8E+2, 1.5E+3, etc.
            r'([\d.]+[Ee][+-]?\d+)\s*W\b',
            r'([\d.]+[Ee][+-]?\d+)\s*Watt\b',
            r'([\d.]+[Ee][+-]?\d+)\s*Watts\b',
            # Regular decimal numbers with units
            r'([\d.]+)\s*W\b',
            r'([\d.]+)\s*Watt\b', 
            r'([\d.]+)\s*Watts\b',
            r'([\d.]+)\s*W\s+',
            # Kilowatt patterns
            r'([\d.]+)\s*kW\b',
            r'([\d.]+)\s*kilowatt\b',
            r'([\d.]+)\s*kilowatts\b',
        ]
        
        for pattern in wattage_patterns:
            match = re.search(pattern, name, re.IGNORECASE)
            if match:
                try:
                    # Use the same robust parsing as UnitConverter
                    from scripts.scraper import UnitConverter
                    wattage_str = match.group(0)  # Get the full match including units
                    return UnitConverter.parse_power_string(wattage_str)
                except (ValueError, ImportError):
                    continue
        
        return None
    
    def is_likely_solar_panel(self, name: str, product_data: Dict[str, Any] = None) -> bool:
        """
        Check if product is likely a solar panel based on name and data.
        
        Args:
            name: Product name
            product_data: Additional product data (optional)
            
        Returns:
            True if likely a solar panel
        """
        name_lower = name.lower()
        
        # Must contain solar-related keywords
        solar_keywords = ['solar', 'pv', 'photovoltaic']
        has_solar_keyword = any(keyword in name_lower for keyword in solar_keywords)
        
        if not has_solar_keyword:
            return False
        
        # Check for exclusion patterns
        for regex in self.exclusion_regex:
            if regex.search(name):
                # Check if it's a kit (allowlist)
                is_kit = any(kit_regex.search(name) for kit_regex in self.kit_allowlist_regex)
                if not is_kit:
                    return False
        
        return True
    
    def should_reject_product(self, name: str, product_data: Dict[str, Any] = None) -> FilterResult:
        """
        Determine if a product should be rejected.
        
        Args:
            name: Product name
            product_data: Additional product data (optional)
            
        Returns:
            FilterResult with rejection decision and reason
        """
        # Check if it's likely a solar panel
        if not self.is_likely_solar_panel(name, product_data):
            return FilterResult(
                should_reject=True,
                reason="non_solar_panel",
                confidence=0.9
            )
        
        # Check wattage if available
        wattage = self.extract_wattage_from_name(name)
        if wattage is not None and wattage < self.min_wattage:
            return FilterResult(
                should_reject=True,
                reason="low_wattage",
                confidence=0.95
            )
        
        # Check for other exclusion patterns
        for i, regex in enumerate(self.exclusion_regex):
            if regex.search(name):
                # Check if it's a kit (allowlist)
                is_kit = any(kit_regex.search(name) for kit_regex in self.kit_allowlist_regex)
                if not is_kit:
                    return FilterResult(
                        should_reject=True,
                        reason="accessory",
                        confidence=0.8
                    )
        
        # Product passed all filters
        return FilterResult(
            should_reject=False,
            reason="",
            confidence=0.7
        )
    
    def get_filter_statistics(self, products: list) -> Dict[str, Any]:
        """
        Analyze a list of products and return filtering statistics.
        
        Args:
            products: List of product dictionaries
            
        Returns:
            Dictionary with filtering statistics
        """
        total = len(products)
        rejected = 0
        reasons = {}
        
        for product in products:
            name = product.get('name', '')
            result = self.should_reject_product(name, product)
            
            if result.should_reject:
                rejected += 1
                reason = result.reason
                reasons[reason] = reasons.get(reason, 0) + 1
        
        return {
            'total_products': total,
            'rejected_products': rejected,
            'accepted_products': total - rejected,
            'rejection_rate': rejected / total if total > 0 else 0,
            'rejection_reasons': reasons
        }


# Example usage and testing
if __name__ == "__main__":
    filter = ProductFilter()
    
    # Test cases
    test_products = [
        # Should pass
        ("ECO-WORTHY 400W Solar Panels", True),
        ("Renogy 100W Solar Panel", True),
        ("Solar Panel Kit 200W", True),
        ("Off-Grid Solar Panel Kit", True),
        
        # Should reject
        ("Solar Panel Tester", False),
        ("Charge Controller", False),
        ("Solar Panel Mount", False),
        ("10W Solar Panel", False),
        ("Security Camera Solar Panel", False),
        ("Solar Panel Wire", False),
        ("Solar Panel Connector", False),
    ]
    
    print("Product Filtering Test Results:")
    print("=" * 50)
    
    for name, expected_pass in test_products:
        result = filter.should_reject_product(name)
        actual_pass = not result.should_reject
        status = "✓" if actual_pass == expected_pass else "✗"
        
        print(f"{status} {name}")
        print(f"   Expected: {'PASS' if expected_pass else 'REJECT'}")
        print(f"   Actual: {'PASS' if actual_pass else 'REJECT'}")
        if result.should_reject:
            print(f"   Reason: {result.reason}")
        print()
