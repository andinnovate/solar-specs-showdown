"""
Test fixtures with sample ScraperAPI response data.
Based on real ScraperAPI responses for testing without API calls.
"""

# Sample product detail response from ScraperAPI (ASIN: B0C99GS958)
SAMPLE_PRODUCT_DETAIL_RESPONSE = {
    "name": "Bifacial 100 Watt Solar Panel, 12V 100W Monocrystalline Solar Panel Panel High Efficiency Module Monocrystalline Technology Work with Charger for RV Camping Home Boat Marine Off-Grid",
    "product_information": {
        "Brand": "FivstaSola",
        "Material": "Monocrystalline Silicon",
        "Product Dimensions": "45.67\"L x 17.71\"W x 1.18\"H",
        "Efficiency": "High Efficiency",
        "Included Components": "solar panel",
        "Maximum Voltage": "12 Volts",
        "Maximum Power": "100 Watts",
        "Special Feature": "Bifacial technology, 10BB Upgraded Design",
        "Manufacturer": "FivstaSola",
        "Item Weight": "15.87 pounds",
        "Item model number": "FS-100-36M-D",
        "Size": "Bifacial 100W",
        "Special Features": "Bifacial technology, 10BB Upgraded Design",
        "Batteries Included?": "No",
        "Batteries Required?": "No",
        "ASIN": "B0C99GS958",
        "Customer Reviews": {
            "ratings_count": 99,
            "stars": 3.8
        },
        "Best Sellers Rank": [
            "#84,000 in Patio, Lawn & Garden",
            "#415 in Solar Panels"
        ],
        "Date First Available": "June 25, 2023"
    },
    "brand": "Visit the FivstaSola Store",
    "brand_url": "https://www.amazon.com/stores/FivstaSola/page/...",
    "full_description": "Product description FivstaSola is a young new energy company...",
    "pricing": "$69.99",
    "list_price": "$69.99",
    "shipping_price": "FREE",
    "availability_status": "In Stock",
    "images": [
        "https://m.media-amazon.com/images/I/41TBLsm6sHL.jpg",
        "https://m.media-amazon.com/images/I/41vqJedhUYL.jpg"
    ],
    "product_category": "Patio, Lawn & Garden›Generators & Portable Power›Solar & Wind Power›Solar Panels",
    "average_rating": 3.8,
    "total_reviews": 99,
    "asin": "B0C99GS958"
}

# Sample product with different dimension format (ASIN: B07BMNGVV3)
SAMPLE_RENOGY_PRODUCT_RESPONSE = {
    "name": "Renogy Flexible Solar Panel 100 Watt 12 Volt Monocrystalline",
    "product_information": {
        "Brand": "Renogy",
        "Product Dimensions": "43 x 33.9 x 0.1 inches",
        "Maximum Voltage": "18 Volts",
        "Maximum Power": "100 Watts",
        "Manufacturer": "Renogy",
        "Item Weight": "4.4 pounds",
        "ASIN": "B07BMNGVV3"
    },
    "brand": "Visit the Renogy Store",
    "pricing": "$135.79",
    "images": ["https://m.media-amazon.com/images/I/51abc123.jpg"],
    "full_description": "Renogy flexible solar panel...",
    "asin": "B07BMNGVV3"
}

# Sample search results response from ScraperAPI
SAMPLE_SEARCH_RESPONSE = {
    "search_parameters": {
        "engine": "amazon",
        "query": "solar panel 400w",
        "page": 1
    },
    "search_information": {
        "total_results": 1000
    },
    "products": [
        {
            "asin": "B0C99GS958",
            "title": "Bifacial 100 Watt Solar Panel, 12V 100W Monocrystalline",
            "link": "https://www.amazon.com/dp/B0C99GS958",
            "price": {
                "value": 69.99,
                "currency": "USD",
                "raw": "$69.99"
            },
            "rating": 3.8,
            "ratings_total": 99
        },
        {
            "asin": "B0CB9X9XX1",
            "title": "FivstaSola 20W White Solar Panel",
            "link": "https://www.amazon.com/dp/B0CB9X9XX1",
            "price": {
                "value": 29.99,
                "currency": "USD",
                "raw": "$29.99"
            },
            "rating": 4.2,
            "ratings_total": 45
        },
        {
            "asin": "B0D2RT4S3B",
            "title": "FivstaSola Bifacial 120W Solar Panel",
            "link": "https://www.amazon.com/dp/B0D2RT4S3B",
            "price": {
                "value": 89.99,
                "currency": "USD",
                "raw": "$89.99"
            },
            "rating": 4.0,
            "ratings_total": 67
        }
    ],
    "keyword": "solar panel 400w",
    "page": 1
}

# Error response (product not found or invalid ASIN)
SAMPLE_ERROR_RESPONSE = {
    "error": "Product not found",
    "status": 404
}

