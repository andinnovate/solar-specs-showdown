## Cursor Cloud specific instructions

### Services Overview

- **Frontend**: Vite + React + TypeScript SPA, dev server on port 8080 (`npm run dev`)
- **Backend/DB**: Supabase (local via `supabase start`, API on port 54321, DB on port 54322)
- **Data Pipeline**: Python scripts under `scripts/` (scraping, staging, ingestion, price updates)

### Running services

1. **Docker must be running** before starting Supabase. If dockerd is not up: `sudo dockerd &>/tmp/dockerd.log &` and ensure the socket is accessible: `sudo chmod 666 /var/run/docker.sock`.
2. Start local Supabase: `cd /workspace && supabase start` (pulls containers on first run; subsequent starts are fast).
3. After Supabase starts, get the JWT keys with `supabase status -o env` — the `ANON_KEY` and `SERVICE_ROLE_KEY` are needed in `.env.local`.
4. Start the frontend: `npm run dev` (Vite on port 8080).

### Environment files

The app reads `.env.local` (gitignored) at both the Vite and Python levels. Key variables:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — frontend connects to Supabase
- `VITE_LOCAL_SUPABASE_URL` / `VITE_LOCAL_SUPABASE_PUBLISHABLE_KEY` + `VITE_USE_LOCAL_SUPABASE=true` — local override
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — Python scripts (must be a JWT, not the CLI `sb_secret_` key)
- `SCRAPERAPI_KEY` — required by Python config validation at import time; set a dummy value for tests that don't hit the live API

### Commands reference

See `package.json` scripts and `Makefile` targets. Key commands:
- **Lint**: `npm run lint`
- **Typecheck**: `npx tsc --noEmit`
- **Unit tests (frontend)**: `npm run test:run` (Vitest, 5 test files, 102 tests)
- **Build**: `npm run build`
- **E2E tests**: `npm run test:e2e` (Playwright, requires Vite preview on port 4173 and local Supabase)
- **Python tests**: `source dev/bin/activate && SCRAPERAPI_KEY=dummy_key_for_testing pytest scripts/tests/ -k "not live_api and not integration"`
- **Full suite**: `make test` (runs lint → typecheck → unit → e2e → build → pytest)

### Gotchas

- The Python `scripts/config.py` validates `SCRAPERAPI_KEY` at import time for all tests. For unit tests that don't call the API, pass `SCRAPERAPI_KEY=dummy_key_for_testing` as an env var.
- The Python venv is at `dev/` (not `.venv`). The Makefile expects `dev/bin/activate`.
- `python3.12-venv` system package is needed to create the venv on Ubuntu.
- `pytest-asyncio` is required for async Python tests but is not in `requirements.backend.txt`; install it into the venv.
- One pre-existing test failure in `test_database_timestamp.py` (`limit(100)` vs `limit(200)`) is a known issue in the test assertions.
- The `test_live_scraper.py` tests error during collection because they import modules that make real API calls; these are expected to be skipped/error without `--live-api`.
- Admin panel at `/admin` requires authentication (email/password). The seed data in `supabase/seed.sql` may or may not include an admin user.
- Supabase local dev keys are deterministic demo keys (not secrets); they change only if you reinitialize the project.
