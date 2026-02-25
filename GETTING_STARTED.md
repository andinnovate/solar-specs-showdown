# Getting Started

Step-by-step guide to run **Solar Specs Showdown** on your machine after cloning the repo.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 18+ (20+ recommended) | [nodejs.org](https://nodejs.org) or use `nvm` |
| **npm** | Comes with Node.js | Lockfile is `package-lock.json` |
| **Docker** | 20+ | Required for local Supabase |
| **Python** | 3.10+ | Optional — only needed for scraper scripts |

---

## 1. Install frontend dependencies

```bash
npm install
```

---

## 2. Start local Supabase

The app stores all data in Supabase (Postgres + Auth + Storage). For local
development you run the full stack in Docker via the Supabase CLI.

```bash
npx supabase start
```

This pulls ~15 Docker images on first run (can take a few minutes), applies
all migrations in `supabase/migrations/`, and seeds an admin user from
`supabase/seed.sql`.

When it finishes you will see a table of URLs and keys. The important values
are:

| Value | Where to find it |
|-------|-----------------|
| API URL | `http://127.0.0.1:54321` |
| Anon / Publishable key | Printed as **Publishable** in the output |
| Service-role JWT | Run `npx supabase status --output env` and copy `SERVICE_ROLE_KEY` |

To stop the stack later: `npx supabase stop`. To wipe and re-seed:
`npx supabase db reset`.

---

## 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Point the frontend at local Supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<Publishable key from step 2>

VITE_LOCAL_SUPABASE_URL=http://127.0.0.1:54321
VITE_LOCAL_SUPABASE_PUBLISHABLE_KEY=<same Publishable key>

VITE_USE_LOCAL_SUPABASE=true
```

> **Tip:** The publishable key is a JWT starting with `eyJ`. You can also copy
> it from `npx supabase status --output env` (the `ANON_KEY` line).

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for full details on the dual-config system.

---

## 4. Start the dev server

```bash
npm run dev
```

Open **http://localhost:8080**. You should see the Solar Panel Comparison UI
with six seed panels loaded from the database. You can filter by price,
dimensions, and wattage, sort by various criteria, and select panels for
side-by-side comparison.

---

## 5. Seed admin account

The database seed (`supabase/seed.sql`) creates an admin user automatically:

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `CHANGE_ME_SECURE_PASSWORD` |

Sign in at **http://localhost:8080/admin** with these credentials to access
the admin panel (database manager, CSV import, flag queue, user management).

---

## Running checks

All commands are defined in `package.json` and the `Makefile`.

### Lint

```bash
npm run lint
```

### Type-check

```bash
npx tsc --noEmit
```

### Unit tests (frontend)

```bash
npm run test:run        # single run
npm run test            # watch mode
npm run test:coverage   # with coverage report
```

### Build

```bash
npm run build
```

> If you see a Browserslist warning, prefix with
> `BROWSERSLIST_IGNORE_OLD_DATA=1`.

### E2E tests (Playwright)

```bash
npx playwright install chromium   # one-time browser download
npm run test:e2e
```

Playwright auto-starts a dev server on port 4173 with its own env vars
(see `playwright.config.ts`).

### Run everything at once

```bash
make test
```

This runs: lint → typecheck → unit → e2e → build → pytest (in that order).

---

## Python scripts (optional)

The `scripts/` directory contains scraper and data-pipeline tools. They are
**not required** to run the frontend, but if you want to use them:

### Setup

```bash
python3 -m venv dev
source dev/bin/activate          # Windows: dev\Scripts\activate
pip install -r requirements.backend.txt
pip install pytest pytest-asyncio  # for running tests
```

### Environment

Python scripts read from a `.env` file (and `.env.local` as an override).
Create `.env` in the project root:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_KEY=<SERVICE_ROLE_KEY JWT from step 2>
SCRAPERAPI_KEY=<your ScraperAPI key, or "placeholder" if not scraping>
```

> **Important:** `SUPABASE_SERVICE_KEY` must be the service-role **JWT**
> (starts with `eyJ`), not the `sb_secret_` CLI key. Get it from
> `npx supabase status --output env`.

### Running scripts

```bash
source dev/bin/activate

# Fetch a single product by ASIN
python scripts/fetch_solar_panels.py B0C99GS958

# Search Amazon and stage ASINs
python scripts/search_solar_panels.py "solar panel 400w" --pages 2

# Process the staging queue
python scripts/ingest_staged_asins.py --batch-size 10
```

See [SCRAPER_QUICK_START.md](./SCRAPER_QUICK_START.md) and
[SEARCH_AND_STAGING_README.md](./SEARCH_AND_STAGING_README.md) for details.

### Python tests

```bash
source dev/bin/activate
pytest                            # all tests
pytest -m "not live_api"          # skip tests that call ScraperAPI
```

Tests marked `live_api` make real API calls and consume ScraperAPI credits.
Tests marked `integration` require a running Supabase instance with test data.

---

## Project structure (key paths)

```
├── src/                    # React frontend (TypeScript)
│   ├── components/         # UI components (shadcn + custom)
│   ├── pages/              # Route pages (Index, Admin, UserPreferences)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities, CSV parser, Supabase config
│   └── integrations/       # Supabase client and generated types
├── e2e/                    # Playwright E2E tests
├── scripts/                # Python scraper & data-pipeline scripts
│   └── tests/              # pytest test suite
├── supabase/
│   ├── config.toml         # Local Supabase configuration
│   ├── migrations/         # 26 SQL migration files
│   └── seed.sql            # Seeds admin user
├── .env.local              # Your local env vars (git-ignored)
├── package.json            # npm scripts and dependencies
├── Makefile                # Shortcut targets (make test, make lint, etc.)
├── vite.config.ts          # Vite dev server config (port 8080)
├── vitest.config.ts        # Vitest test runner config
├── playwright.config.ts    # Playwright E2E config (port 4173)
└── tailwind.config.ts      # Tailwind CSS config
```

---

## Useful links

- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) — Dual Supabase config (local vs hosted)
- [SCRAPER_QUICK_START.md](./SCRAPER_QUICK_START.md) — Scraper usage guide
- [CSV_IMPORT_GUIDE.md](./CSV_IMPORT_GUIDE.md) — Bulk CSV import via admin panel
- [SEARCH_AND_STAGING_README.md](./SEARCH_AND_STAGING_README.md) — Amazon search & ASIN staging
- [scripts/tests/README.md](./scripts/tests/README.md) — Python test suite docs

---

## Troubleshooting

**"Lovable Supabase configuration is missing"**
→ You haven't set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
in `.env.local`, or the file isn't in the project root.

**Docker permission denied when running `supabase start`**
→ Make sure Docker is running and your user is in the `docker` group
(`sudo usermod -aG docker $USER`, then re-login).

**Python config validation error (SUPABASE_SERVICE_KEY)**
→ Use the JWT from `SERVICE_ROLE_KEY` (starts with `eyJ`), not the
`sb_secret_` key shown in the CLI status table.

**Browserslist "old data" warning during build**
→ Prefix with `BROWSERSLIST_IGNORE_OLD_DATA=1`, or run
`npm run browserslist:update`.
