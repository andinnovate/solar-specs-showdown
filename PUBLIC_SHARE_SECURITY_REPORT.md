# Public Share Security Report

This document summarizes issues that could result from sharing this repository publicly, and the steps taken or recommended before making the repo public.

---

## Critical: Secrets and credentials

### 1. Environment files were tracked by Git

**Issue:** The files `.env`, `.env.backup`, and `.env.lovable` were committed to the repository. They can contain:

- Supabase project URL and anon (publishable) key
- ScraperAPI key
- Admin email
- Optional: service role key, SMTP credentials

**Done in repo:**

- `.gitignore` was updated to ignore `.env`, `.env.backup`, `.env.lovable`, `.env.local`, and `.env.*` (with `!.env.example` so a template can be committed).

**You must do locally (before pushing a public repo):**

1. **Stop tracking env files (without deleting them from disk):**
   ```bash
   git rm --cached .env .env.backup .env.lovable
   git commit -m "Stop tracking env files; add to .gitignore"
   ```
2. **Rotate any credentials that were ever committed:**
   - **ScraperAPI:** Generate a new key in the ScraperAPI dashboard and update your local `.env`. The old key may have been exposed in docs or history.
   - **Supabase:** Consider rotating the anon key (and service role if it was ever in a committed file) in Supabase Dashboard → Settings → API.
   - **Admin account:** Change the password for the admin user (and any dev account) in Supabase Auth. If the repo was public, create a new admin user and remove or change the old one.
3. **Optional but recommended:** Remove env files from Git history so they are not in clones or `git log`:
   ```bash
   # Use git filter-repo or BFG Repo-Cleaner to remove .env, .env.backup, .env.lovable from history
   # Then force-push (coordinate with any collaborators).
   ```

---

### 2. Hardcoded credentials in source code

**Issue:** The following were present and have been addressed in the repo:

| Location | What was there | Change made |
|----------|----------------|-------------|
| `src/pages/Admin.tsx` | Hardcoded dev email and password for “Sign In with Development Account” | Removed. Dev sign-in only appears when `VITE_ADMIN_DEV_EMAIL` and `VITE_ADMIN_DEV_PASSWORD` are set in local env (not committed). |
| `src/lib/adminUtils.ts` | Hardcoded `ADMIN_EMAIL` | Now uses `VITE_ADMIN_EMAIL` from env, with fallback `admin@example.com`. |
| `ADMIN_PANEL_UPDATE_SUMMARY.md` | Real ScraperAPI key in docs | Redacted to placeholder `your_scraperapi_key`. |
| `supabase/seed.sql` | Real admin email and password | Replaced with `admin@example.com` and `CHANGE_ME_SECURE_PASSWORD`; comment added to replace before use. |
| `scripts/config.py` | Default `ADMIN_EMAIL` | Default set to `admin@example.com`; can override with `ADMIN_EMAIL` env. |

**Note:** Supabase migrations still reference a specific admin email in RLS policies. For a **new** deployment from this public repo, either:

- Run the existing migrations (which use that email), then create your admin user with the same email and set `VITE_ADMIN_EMAIL` to match, or  
- Add a new migration that updates the RLS policies to use your admin email (e.g. `admin@example.com` or your own).

---

### 3. Files that must not be committed

- **`scraperapi_sample.py`** – In `.gitignore`; if it was ever committed, it contained a ScraperAPI key. Ensure it is not tracked and remove from history if it was.
- **`scraperapi_search_debug_*.json`** – Debug JSON from ScraperAPI may contain product or response data. Consider adding `scraperapi_search_debug*.json` or `*.debug.json` to `.gitignore` if you generate such files.

---

## Medium: Configuration and docs

- **`env.example`** – Updated with `VITE_ADMIN_EMAIL`, `VITE_ADMIN_DEV_EMAIL`, and `VITE_ADMIN_DEV_PASSWORD` (commented) so deployers know what to set without putting real values in the repo.
- **Admin panel** – “Restricted to” message now uses `ADMIN_EMAIL` from config (env-driven) instead of a hardcoded address.

---

## Before you publish

1. Run `git rm --cached .env .env.backup .env.lovable` and commit (and add `.env*` to `.gitignore` if not already).
2. Rotate ScraperAPI key, change admin/dev passwords, and consider rotating Supabase keys if they were ever in tracked files or history.
3. Ensure no other files with real keys or passwords are tracked (e.g. `scraperapi_sample.py`, debug JSONs).
4. Optionally purge `.env` (and any backup env files) from Git history, then force-push after coordinating with collaborators.

After these steps, the repo is in a better state for public sharing; rotating exposed credentials is essential even if you remove the files from the current tree.
