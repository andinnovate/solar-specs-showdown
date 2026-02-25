# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Solar Specs Showdown is a React + Vite + TypeScript frontend backed by Supabase (Postgres, Auth, Storage). Python scraper scripts live in `scripts/`. See `README.md` for architecture and `SUPABASE_SETUP.md` for dual-config details.

### Services

| Service | How to start | Port | Notes |
|---------|-------------|------|-------|
| Vite dev server | `npm run dev` | 8080 | Frontend SPA |
| Local Supabase | `npx supabase start` | 54321 (API), 54322 (DB), 54323 (Studio) | Requires Docker running first |

### Running checks

Standard commands from `package.json` and `Makefile`:

- **Lint**: `npm run lint`
- **Typecheck**: `npx tsc --noEmit`
- **Unit tests (frontend)**: `npm run test:run` (Vitest, 102 tests)
- **Build**: `BROWSERSLIST_IGNORE_OLD_DATA=1 npm run build`
- **E2E tests**: `npm run test:e2e` (Playwright, needs Chromium installed via `npx playwright install chromium`)
- **Python tests**: `source dev/bin/activate && pytest scripts/tests/` (needs env vars, see below)

### Non-obvious caveats

- **Docker must be running before `supabase start`**: Start dockerd first (`sudo dockerd &`), then `sudo chmod 666 /var/run/docker.sock` for user access.
- **`.env.local` for frontend**: Must set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_USE_LOCAL_SUPABASE=true` pointing to `http://127.0.0.1:54321`. The publishable key is the anon JWT from `npx supabase status --output env` (`ANON_KEY`).
- **`.env` for Python scripts**: Python scripts read `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (the JWT service_role key, starts with `eyJ`), and `SCRAPERAPI_KEY`. Get the service_role key from `npx supabase status --output env` (`SERVICE_ROLE_KEY`). Use `placeholder_for_local_dev` for `SCRAPERAPI_KEY` if not testing live scraping.
- **Python venv**: The Makefile expects a venv at `dev/` — create with `python3 -m venv dev && source dev/bin/activate && pip install -r requirements.backend.txt`. Also install `pytest` and `pytest-asyncio` for running tests.
- **Browserslist warning**: Suppress with `BROWSERSLIST_IGNORE_OLD_DATA=1` on build commands.
- **Supabase CLI via npx**: The CLI is not globally installed; use `npx supabase <command>`.
