# Price Update Refactor: Search-First with Product-Detail Fallback

## Goal

Use ScraperAPI **search results** to capture price data for ASINs/panels when possible, and **fall back to per-ASIN product detail** (current behavior) only for panels not found in search. This reduces API credits (1 search returns many products; 1 product call = 1 credit) while accepting that search cannot provide 100% coverage.

---

## Current Behavior

- **`scripts/update_prices.py`**: Gets panels needing price update (by `updated_at` age or explicit `--asins`). For **each** panel it calls `scraper.fetch_product(asin)` (one ScraperAPI product-detail call per panel), parses price from the response, then `db.update_panel_price(panel_id, new_price, source='scraperapi')`.
- **Cost**: N panels → N product API calls.
- **`scripts/scraper.py`**: `search_amazon(keyword, page)` already returns autoparse JSON with a `products` array; each product can include `asin`, `price` (e.g. `{ value, currency, raw }`), `title`, `link`, etc. `extract_asins_from_search()` returns only ASINs; **prices from search are not yet used anywhere**.

---

## Target Behavior

1. **Search phase (batch)**  
   Run a configurable set of search requests (e.g. keywords like `"solar panel"`, `"solar panel 400w"` over 1–N pages). Merge all results into a single **ASIN → price** map. One API call per (keyword, page) returns many ASINs + prices.

2. **Update from search**  
   For each panel needing a price update, if its ASIN is in the search map and the mapped price is valid (non-$0, parseable), update the panel from this map **without** calling `fetch_product(asin)`.

3. **Fallback to product detail**  
   For panels whose ASIN was not in the search map (or whose search price was invalid/missing), keep current behavior: call `fetch_product(asin)` and use the parsed product-detail price.

4. **Source tracking**  
   Record in DB whether the price came from search vs product detail (e.g. `source='scraperapi_search'` vs `source='scraperapi'`) for analytics and debugging.

5. **Optional: product-only mode**  
   Support a flag (e.g. `--product-only`) to skip search and behave exactly as today (all updates via `fetch_product`), for testing or when search is undesirable.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Search strategy | Fixed set of keywords + pages (config or CLI) | Simple, predictable credit usage; no need to derive a query per panel. |
| ASIN in multiple searches | First price wins (or last overwrite) | Keep logic simple; small variance acceptable for price freshness. |
| Search price format | Support object `{value, currency, raw}` and string; use `UnitConverter.parse_price_string` for strings | Matches existing scraper docstring and handles autoparse variations. |
| $0 / invalid search price | Treat as “no price from search”; fall back to product detail | Same as current rejection of $0 from product detail. |
| 403 / retries | Reuse existing `RetryHandler` and `ScraperAPIForbiddenError` for search calls | Consistency with current product-detail behavior. |

---

## Implementation Plan

### 1. Scraper: extract ASIN → price from search results

**File:** `scripts/scraper.py`

- Add **`extract_prices_from_search(search_results: Dict) -> Dict[str, float]`**  
  - Input: same structure returned by `search_amazon()` (dict with `products` list).  
  - For each product: get ASIN (existing logic from `extract_asins_from_search`: `product.get('asin')` or extract from `link`).  
  - Price: if `product.get('price')` is a dict with `'value'`, use it (optional: check `currency == 'USD'`); if it’s a string, use `UnitConverter.parse_price_string(price)`.  
  - Return `{ asin: price_float }`; skip products with no ASIN or no valid price.  
  - If same ASIN appears multiple times, last seen wins (or first—document the choice).

- **Unit tests** (e.g. in `scripts/tests/test_scraper_parsing.py` or new `test_search_price_extraction.py`):  
  - Example payloads: `products` with `price` as `{ "value": 69.99, "currency": "USD" }`, as `"$69.99"`, and missing/invalid price; assert returned dict and that invalid entries are skipped.

### 2. Update-prices: search phase and keyword/page configuration

**File:** `scripts/update_prices.py`

- **CLI / config**  
  - Add optional **`--search-keywords`** (repeatable or comma-separated), default e.g. `["solar panel", "solar panel 400w"]`.  
  - Add **`--search-pages`** (int, default e.g. 2) for how many pages per keyword.  
  - Add **`--product-only`** flag: when set, skip search entirely and use only `fetch_product` (current behavior).

- **Search phase (when not `--product-only`)**  
  - Build list of (keyword, page) pairs from `--search-keywords` and `--search-pages`.  
  - For each pair, call `scraper.search_amazon(keyword, page)` with existing retry/delay/403 handling.  
  - Merge results: for each response, call `scraper.extract_prices_from_search(response)` and merge into a single `asin_to_price: Dict[str, float]`.  
  - Apply same delay between search requests as between product requests (e.g. `--delay`).

- **Split panels**  
  - `panels_from_search`: panels whose `asin` is in `asin_to_price` and `asin_to_price[asin]` is valid (not 0, not None).  
  - `panels_fallback`: the rest.

- **Process panels**  
  - For `panels_from_search`: do **not** call `fetch_product`. Build update result from `asin_to_price[asin]`; apply same validation (reject $0); call `db.update_panel_price(..., source='scraperapi_search')`. Optionally skip `save_raw_scraper_data` for search-sourced updates (no raw product JSON).  
  - For `panels_fallback`: call existing `update_panel_price(scraper, db, panel, retry_handler, logger)` (which uses `fetch_product` and `source='scraperapi'`).

- **Ordering**  
  - Process search-sourced updates first, then fallback (or the reverse—document choice). Summary output should report counts: updated from search, updated from product, unchanged, failed.

### 3. Database: source field

**File:** `scripts/database.py`

- **`update_panel_price(..., source=...)`** already exists. Ensure callers pass `source='scraperapi_search'` when the price came from search and `source='scraperapi'` when from product detail. No schema change required if `price_history.source` is already a string.

### 4. Logging and summary

**File:** `scripts/update_prices.py`

- Log how many panels were satisfied from search vs how many fell back to product.  
- Summary block: e.g. “Updated from search: N; Updated from product: M; Unchanged: K; Failed: F.”  
- Optional: log which ASINs were found in search vs not (at DEBUG or with `--verbose`).

### 5. Tests

- **Scraper**  
  - `extract_prices_from_search`: multiple shapes of `products[].price` and missing ASIN/price.  
- **Update prices**  
  - Unit test: mock `search_amazon` to return a small payload; mock `extract_prices_from_search` or use real implementation; assert that panels in the map are updated without calling `fetch_product`, and that panels not in the map trigger `fetch_product`.  
  - Test `--product-only`: no search calls, all panels updated via `fetch_product`.  
  - Optional: integration test with real ScraperAPI search (marked/labeled so it can be skipped in CI).

### 6. Documentation and config

- **README or PRICE_UPDATE_*.md**: Short section describing “Search-first price updates” and the fallback; mention `--search-keywords`, `--search-pages`, and `--product-only`.  
- **Optional:** In `scripts/config.py` or env, add `PRICE_UPDATE_SEARCH_KEYWORDS` / `PRICE_UPDATE_SEARCH_PAGES` as defaults so cron jobs can rely on env without extra CLI args.

---

## File Checklist

| File | Change |
|------|--------|
| `scripts/scraper.py` | Add `extract_prices_from_search()`; optionally document autoparse price shape. |
| `scripts/update_prices.py` | Add search phase, keyword/page args, `--product-only`, split panels, two code paths (search vs product), summary stats. |
| `scripts/database.py` | No change (source already supported). |
| `scripts/config.py` | Optional: add default search keywords/pages. |
| `scripts/tests/test_scraper_parsing.py` or new test file | Tests for `extract_prices_from_search`. |
| `scripts/tests/test_update_prices.py` | Tests for search-first flow and `--product-only`. |
| `PRICE_UPDATE_SEARCH_FIRST_REFACTOR.md` | This plan. |
| `README.md` or `PRICE_UPDATE_IMPLEMENTATION.md` | Brief “search-first” description and flags. |

---

## Edge Cases

- **Search returns no products**: `asin_to_price` is empty; all panels use fallback (current behavior).  
- **Search 403**: Same as today—raise `ScraperAPIForbiddenError`, stop run (or retry per policy).  
- **Duplicate ASIN in search**: Last (or first) price wins; document in code.  
- **Price “See price in cart” / non-numeric**: `parse_price_string` returns None; treat as no price from search → fall back to product.  
- **Panel has no ASIN**: Already skipped in current code; no change.

---

## Success Criteria

- With search enabled, many panels get prices from search with fewer API calls than “one per panel.”  
- Panels not appearing in the configured search results still get updated via `fetch_product`.  
- `--product-only` reproduces current behavior.  
- Existing tests still pass; new tests cover search extraction and update-prices search vs fallback.
