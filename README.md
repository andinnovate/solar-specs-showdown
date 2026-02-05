# Solar Specs Showdown

Compare solar panel specs side-by-side, filter by dimensions and wattage, and manage product data via admin tools and automated ingestion.

---

## Origin & Development

This project **started on [Lovable](https://lovable.dev)** as a quick prototype. It **quickly diverged** from the no-code/low-code workflow: the codebase is now developed primarily with **pure code** in a standard IDE and extended with **agentic coding** (AI-assisted editing, refactors, and feature work in Cursor and similar tools). The repo is the source of truth; Lovable is no longer used for ongoing development.

---

## Tech Stack

### Frontend
- **Vite** — build tool and dev server  
- **TypeScript** — type-safe React  
- **React 18** — UI  
- **React Router** — routing  
- **shadcn-ui** (Radix) + **Tailwind CSS** — components and styling  
- **TanStack Query** — server state  
- **Recharts** — charts (e.g. comparison views)  
- **Supabase (JS client)** — auth, database, real-time

### Backend & Data
- **Supabase** — Postgres database, RLS, auth  
- **Python 3** — scripts for scraping, search, staging, ingest, price updates, and DB operations  
- **ScraperAPI** — Amazon product/search scraping (with autoparse where used)

### Tooling
- **Vitest** + **Testing Library** — unit and component tests  
- **ESLint** — linting  
- **Bun** or **npm** — package management

---

## Features

### Comparison & Discovery (App)
- **Side-by-side comparison** of solar panels with key specs (wattage, dimensions, weight, voltage, price, etc.)
- **Filtering** by wattage, dimensions, weight, and other attributes (including histogram-style sliders)
- **User preferences** — save preferred panels and view toggles
- **Visual comparison** and basic charts for selected panels

### Admin Panel (`/admin`)
- **Database manager** — list, search, edit, and delete panels; all editable fields with **manual override** tracking so scraper runs don’t overwrite admin edits
- **CSV import** — bulk upload with smart field mapping, unit conversion (in/cm, lb/kg, currency), duplicate detection, and change preview before commit
- **User management** — manage app users and access
- **Flag queue** — review user-submitted data-quality flags and scrape failures
- **Dev Supabase config** — switch to a local Supabase instance for development

### Data Pipeline (Python Scripts)
- **Scraper** — fetch product data by ASIN via ScraperAPI; parse specs and normalize units into DB-ready records
- **Search & staging** — search Amazon (e.g. “solar panel 400w”), extract ASINs, stage them for ingestion
- **Ingest** — process staged ASINs (batch, priority, retry failed)
- **Price updates** — refresh prices for existing panels
- **ASIN management** — check existence, stage, retry, and report filtered/blocked ASINs

### Data & Security
- **Manual overrides** — JSONB column tracks admin-edited fields; scrapers skip those fields
- **User flagging** — users can flag incorrect or missing data; admin queue for triage
- **Dual Supabase** — default (e.g. production) vs local override for development (see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md))
- **RLS and hardening** — role-based access and admin-only endpoints where applicable

Detailed docs in the repo include: [CSV_IMPORT_GUIDE.md](./CSV_IMPORT_GUIDE.md), [SEARCH_AND_STAGING_README.md](./SEARCH_AND_STAGING_README.md), [SCRAPER_QUICK_START.md](./SCRAPER_QUICK_START.md), [ADMIN_PANEL_UPDATE_SUMMARY.md](./ADMIN_PANEL_UPDATE_SUMMARY.md), [SUPABASE_SETUP.md](./SUPABASE_SETUP.md), and others in the project root and under `scripts/`.

---

## Quick Start

**Requirements:** Node.js (and npm or Bun), optionally Python 3 for scripts.

```bash
git clone <YOUR_GIT_URL>
cd solar-specs-showdown
npm install
npm run dev
```

For **local Supabase** (optional):

```bash
npm run setup:supabase
```

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for full dual-configuration details.

**Scripts (Python):** use a virtualenv and install from `requirements.backend.txt` (or project equivalents). Example:

```bash
# Single ASIN fetch
python scripts/fetch_solar_panels.py B0C99GS958

# Search and stage ASINs
python scripts/search_solar_panels.py "solar panel 400w" --pages 2

# Process staged ASINs
python scripts/ingest_staged_asins.py --batch-size 10
```

See [SCRAPER_QUICK_START.md](./SCRAPER_QUICK_START.md) and [SEARCH_AND_STAGING_README.md](./SEARCH_AND_STAGING_README.md) for more.

---

## Scripts Overview

| Script | Purpose |
|--------|--------|
| `scripts/fetch_solar_panels.py` | Fetch one or more products by ASIN and upsert to DB |
| `scripts/search_solar_panels.py` | Search Amazon, extract ASINs, stage for ingest |
| `scripts/ingest_staged_asins.py` | Process staging queue (batch, priority, retry) |
| `scripts/update_prices.py` | Refresh prices for existing panels |
| `scripts/export_solar_panels_csv.py` | Export panels to CSV |
| `scripts/asin_manager.py` | ASIN staging/retry/stats (used by search & ingest) |
| `scripts/scraper.py` | ScraperAPI client and parsing (used by fetch/ingest) |
| `scripts/database.py` | DB helpers (panels, ASINs, overrides, flags, etc.) |

Tests live under `scripts/tests/` (pytest). Frontend tests: `npm run test` / `npm run test:coverage`.

---

## Deploy

The app is a standard Vite SPA backed by Supabase. Build with `npm run build` and serve the `dist/` output from any static host; point the app to your Supabase project via environment variables (see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) and `env.example`). The project was initially deployed via Lovable’s “Share → Publish”; for current deployments, use your own hosting and CI.
