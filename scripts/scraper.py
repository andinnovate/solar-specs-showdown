"""
ScraperAPI client for fetching and parsing Amazon solar panel data.
Handles unit conversions and data normalization for database storage.
"""

import re
import requests
import sys
import os
from typing import Dict, Optional, Tuple, List
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
            dim1 = None
            dim2 = None
            has_labels = False
            unit_is_inches = False
            
            # Pattern 1: With L/W labels: "45.67\"L x 17.71\"W" or "45.67L x 17.71W"
            pattern_labeled = r'([\d.]+)\s*["\']?\s*L\s*x\s*([\d.]+)\s*["\']?\s*W'
            match = re.search(pattern_labeled, dim_string, re.IGNORECASE)
            
            if match:
                dim1 = float(match.group(1))  # Length (as labeled)
                dim2 = float(match.group(2))  # Width (as labeled)
                has_labels = True
                # Check if inches (has quotes) or cm
                unit_is_inches = '"' in dim_string or "'" in dim_string
            else:
                # Pattern 2: Three dimensions with unit: "43 x 33.9 x 0.1 inches" or "115 x 66 x 3 cm"
                pattern_three = r'([\d.]+)\s*x\s*([\d.]+)\s*x\s*[\d.]+\s*(inch|cm)'
                match = re.search(pattern_three, dim_string, re.IGNORECASE)
                
                if match:
                    dim1 = float(match.group(1))
                    dim2 = float(match.group(2))
                    unit_is_inches = 'inch' in match.group(3).lower()
                else:
                    # Pattern 3: Just three numbers: "43 x 33.9 x 0.1"
                    pattern_numbers = r'([\d.]+)\s*x\s*([\d.]+)\s*x\s*[\d.]+'
                    match = re.search(pattern_numbers, dim_string, re.IGNORECASE)
                    
                    if match:
                        dim1 = float(match.group(1))
                        dim2 = float(match.group(2))
                        # Guess unit: if values > 20, likely cm; otherwise inches
                        unit_is_inches = dim1 <= 20 and dim2 <= 20
            
            if dim1 is None or dim2 is None:
                return None
            
            # Convert to cm if in inches
            if unit_is_inches:
                dim1_cm = UnitConverter.inches_to_cm(dim1)
                dim2_cm = UnitConverter.inches_to_cm(dim2)
            else:
                dim1_cm = round(dim1, 2)
                dim2_cm = round(dim2, 2)
            
            # Ensure length >= width (unless explicitly labeled with L/W)
            if has_labels:
                # Trust the labels, but still ensure length > width makes sense
                length_cm = dim1_cm
                width_cm = dim2_cm
            else:
                # No labels: put larger dimension as length
                if dim1_cm >= dim2_cm:
                    length_cm = dim1_cm
                    width_cm = dim2_cm
                else:
                    length_cm = dim2_cm
                    width_cm = dim1_cm
            
            return (length_cm, width_cm)
            
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
            # Extract numeric value
            numeric_match = re.search(r'([\d.]+)', weight_string)
            if not numeric_match:
                return None
            
            value = float(numeric_match.group(1))
            
            # Check unit
            weight_lower = weight_string.lower()
            if 'kg' in weight_lower or 'kilogram' in weight_lower:
                return round(value, 2)
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


class ScraperAPIParser:
    """Parses ScraperAPI response data into database format"""
    
    @staticmethod
    def parse_product_data(api_response: Dict) -> Optional[Dict]:
        """
        Parse ScraperAPI JSON response into database-ready format.
        
        Args:
            api_response: Raw JSON response from ScraperAPI
            
        Returns:
            Dictionary with database fields or None if parsing fails
        """
        try:
            # Initialize failure tracking
            parsing_failures = []
            
            product_info = api_response.get('product_information', {})
            
            # Get ASIN early for error logging
            asin = api_response.get('asin') or product_info.get('ASIN')
            
            # Required fields
            name = api_response.get('name')
            if not name:
                parsing_failures.append("Missing product name")
                logger.error("Product name is missing")
                return None
            
            # Extract manufacturer from brand
            manufacturer = api_response.get('brand', '').replace('Visit the ', '').replace(' Store', '').strip()
            if not manufacturer:
                # Try to get from product_information
                manufacturer = product_info.get('Brand', 'Unknown')
            
            # Parse dimensions
            dimensions_str = product_info.get('Product Dimensions', '')
            dimensions = UnitConverter.parse_dimension_string(dimensions_str)
            if not dimensions:
                parsing_failures.append(f"Failed to parse dimensions: '{dimensions_str}'")
                logger.error(f"Failed to parse dimensions: {dimensions_str}")
                return None
            length_cm, width_cm = dimensions
            
            # Parse weight
            weight_str = product_info.get('Item Weight', '')
            weight_kg = UnitConverter.parse_weight_string(weight_str)
            if not weight_kg:
                parsing_failures.append(f"Failed to parse weight: '{weight_str}'")
                logger.error(f"Failed to parse weight: {weight_str}")
                return None
            
            # Parse wattage
            wattage_str = product_info.get('Maximum Power', '')
            wattage = UnitConverter.parse_power_string(wattage_str, context=f"ASIN {asin}")
            if not wattage:
                parsing_failures.append(f"Failed to parse wattage: '{wattage_str}'")
                logger.error(f"Failed to parse wattage: {wattage_str}")
                return None
            
            # Parse voltage (optional)
            # Note: Some products list "Maximum Voltage" as system voltage (e.g. 1000V)
            # rather than panel operating voltage (12V-48V). We store it anyway for now.
            voltage_str = product_info.get('Maximum Voltage', '')
            voltage = UnitConverter.parse_voltage_string(voltage_str) if voltage_str else None
            
            # Optional: Flag suspiciously high voltages (likely system specs, not panel voltage)
            # Typical panel voltages are 12V, 24V, 36V, 48V
            # System voltages can be 600V, 1000V, 1500V
            # We'll store them but they should be interpreted carefully
            
            # Parse price
            price_str = api_response.get('pricing', '')
            price_usd = UnitConverter.parse_price_string(price_str)
            if not price_usd:
                parsing_failures.append(f"Failed to parse price: '{price_str}'")
                # Enhanced error logging with relevant fields for debugging
                logger.error(f"Failed to parse price: '{price_str}'")
                logger.error(f"ASIN: {asin}, Name: {name}, Manufacturer: {manufacturer}")
                logger.error(f"Available pricing data: {api_response.get('pricing', 'N/A')}")
                logger.error(f"Product info keys: {list(product_info.keys()) if product_info else 'None'}")
                # Don't return None for price - it's optional
                price_usd = None
            
            # Optional fields
            description = api_response.get('full_description', '')[:1000] if api_response.get('full_description') else None
            image_url = api_response.get('images', [None])[0]
            
            # Construct Amazon URL from ASIN
            web_url = f"https://www.amazon.com/dp/{asin}" if asin else None
            
            # Build database-ready dictionary
            panel_data = {
                'name': name,
                'manufacturer': manufacturer,
                'length_cm': length_cm,
                'width_cm': width_cm,
                'weight_kg': weight_kg,
                'wattage': wattage,
                'voltage': voltage,
                'price_usd': price_usd,
                'description': description,
                'image_url': image_url,
                'web_url': web_url,
                'parsing_failures': parsing_failures  # Add failure details
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

