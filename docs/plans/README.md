# Plans (yyyymmdd-prefixed)

This folder holds **plan documents**: forward-looking design/refactor plans, implementation roadmaps, gap analyses, and debugging plans. Filenames are prefixed with `yyyymmdd` (date of the plan or relevant context).

**Moved here from repo root:**
- `20251001_MISSING_COMPONENTS.md` — Gap analysis: search/staging missing vs existing product-detail ingestion
- `20251001_SEARCH_INGESTION_WORKFLOW.md` — Search → ingestion workflow plan (current vs required state)
- `20251017_DEBUG_SEARCH_PLAN.md` — Debugging plan for ScraperAPI search returning 0 products
- `20251024_USER_FLAGGING_SYSTEM_PLAN.md` — User flagging feature plan (schema, architecture)
- `20250211_PRICE_UPDATE_SEARCH_FIRST_REFACTOR.md` — Refactor plan: search-first price updates with product-detail fallback

---

## Top-level docs that remain (guidance / reference)

These stay at repo root as longstanding user/developer documentation:

| Document | Purpose |
|----------|---------|
| **README.md** | Project overview, tech stack, quick start |
| **SUPABASE_SETUP.md** | Dual Supabase config setup |
| **CSV_IMPORT_GUIDE.md** | CSV import feature how-to |
| **SCRAPER_QUICK_START.md** | ScraperAPI quick commands and usage |
| **PRICE_UPDATE_IMPLEMENTATION.md** | Price update scripts reference (usage, options) |
| **SEARCH_AND_STAGING_README.md** | Search/staging implementation and CLI reference |
| **MANUAL_OVERRIDE_SYSTEM.md** | How manual overrides protect admin edits |
| **DIMENSION_PARSING_FORMATS.md** | Supported dimension formats (scraper reference) |
| **DEBUGGING_SEARCH.md** | How to debug ScraperAPI search issues |
| **FILTERING_STRATEGY.md** | Product filtering strategy (two-stage) |
| **PUBLIC_SHARE_SECURITY_REPORT.md** | Security checklist before making repo public |

**Implementation summaries** (post-implementation reference) are in **[../summaries/](../summaries/)**.
