# Khaozo (Food Discovery App) — Phase-wise Implementation Plan (v1)

> Status: LOCKED · Last updated: 2 Oct 2026
> Related: `03_data_modelling.md`, `04_backend_architecture.md`, `backend_layers/`, `05_frontend_design.md`

---

## Rules
- **Backend fully first (Phases 0–8), then frontend (Phases 9–11), then launch (Phase 12).**
- Layer order inside every feature: route → validator/middleware → controller → service → repository → DB (+ aiAdapter from services only).
- **Tests written in the same phase** (Jest + supertest, test DB `food_app_test`, mocked aiAdapter / Cloudinary, socket.io-client).
- A phase is done only when its **done-check** passes **and the regression gate passes** (all tests of this and every earlier phase green, Postman updated, git tag `phase-N-done`) — see `07_testing_plan.md`.
- **All settings from environment variables** (`config/env.js`) — same code runs on laptop and on Railway.
- **Visual design:** pages designed in **Claude Design** during the frontend phases, page by page, before building each page.

---

## Prerequisites (accounts/keys needed before a phase starts)
| Before phase | Need |
|---|---|
| 0 | Docker Desktop installed (Windows) · Node.js LTS |
| 2 | Google Cloud project + **OAuth Client ID** (authorised origin: localhost) |
| 4 | **Cloudinary** account (free) + API keys |
| 6 | **Gemini API key** (Google AI Studio, free tier) · OpenAI key optional (fallback, prepaid) |
| 12 | Railway account (trial) · Vercel account · OAuth consent screen with `/privacy` link |

## Backend

| # | Phase | Build | Done when |
|---|---|---|---|
| 0 | Setup | Repo, Docker (custom Postgres image: PostGIS + pgvector — **verify exact image tag + pgvector package name at setup time**) + Redis via docker-compose, Express 5 skeleton, ES Modules, `.env` + env.js, db.js (pool, withTransaction, BIGINT → number) / redis.js, error middleware, result / reasons / caseMapper utils, **cacheRepo (Redis)**, `GET /health`, Jest, **GitHub Actions (tests on every push)** | `docker compose up` works · `/health` = ok · one test passes |
| 1 | Database | Migrations 001–008 (extensions, lookup tables + must-have rows, users/auth, places, food, contributions, personal/group, indexes) · `seed.sql` (areas, dish catalog + aliases — **dish list must be prepared first: Claude drafts, Sangram reviews**) · OSM / Foursquare import script (**verify Foursquare Open Places licence + OSM attribution terms before importing**) | All tables exist · Bhubaneswar places in DB |
| 2 | Auth | Google login (google-auth-library), access + refresh tokens (SHA-256 hash, rotation, reuse detection, 10 s race window), httpOnly cookie, requireAuth / optionalAuth / adminOnly, `/me`, taste profile + quiz, logout / logout-all · **first admin: one-time script that sets `role = admin` for the email in `ADMIN_EMAIL` env** · **tiny test HTML page with the Google button** (only to get an ID token for testing — real frontend comes in Phase 9) · nightly session cleanup job added in Phase 5 | Google login via test page → refresh (Postman) → logout works |
| 3 | Places & dishes | **configService (config_settings, Redis-cached)** · **trustService weight function** (reads trust_score + new-account rule, used for confirmation weight snapshots) · places list / near me (PostGIS), place page (stats/labels appear after Phase 5), menu, opening hours, meta routes, dishMatcher (alias → pg_trgm; embedding step added in Phase 6), add place + 409 duplicate prompt (place photo upload comes with photos in Phase 4), confirmations (weights, verify), **reports — create only** (admin accept/reject in Phase 8) | "Places within 2 km" works · add place with duplicate prompt |
| 4 | Contributions | Ratings (30-day rule, is_current, replaceCurrent), reviews + tag votes (user), photos (Cloudinary + multer, max 3, 5 MB), wishlist (tried_at), notes, journal (3-hour grouping), stats, `/me/contributions` | Rate a dish → shows in journal · photo upload works |
| 5 | Jobs & ranking | worker.js + BullMQ (jobQueue helper), migration 009 (menu_item_stats, place_stats) + 5-min refresh job, **trust score recalculation job**, taste learning, auto tag votes, session cleanup | Must-order / mixed labels + Bayesian ranking appear |
| 6 | AI & search | aiAdapter (Gemini → OpenAI → keyword, Zod, 5 s timeout, daily budget guard), embeddings (dishes, reviews) + dishMatcher embedding step, AI summaries, full search pipeline (8 steps, relax rules, diet auto-apply), caching, rate limits | "spicy biryani near KIIT under 250" → ranked results with reasons |
| 7 | Group mode | Socket.IO + socket auth, groupLiveRepo (Redis, 4 h expiry), guest pass, preferences, suggestions (≥ 2 ready), voting (auto-end, tie-break, creator handover), history | 3 test clients join, vote, winner saved |
| 8 | Admin & DPDP | Admin queues (reports, pending dishes, unverified places), approve / merge dishes, config editor, **account deletion** (one transaction + Cloudinary cleanup) | Delete account → data erased / anonymised correctly |

## Frontend (after backend is complete)

| # | Phase | Build | Done when |
|---|---|---|---|
| 9 | Frontend core | Vite + Tailwind + shadcn setup, api/client.js (interceptors, single-flight refresh), AuthContext (silent refresh on load), TanStack Query, AppShell + tab bar · Pages: Home, Search, Place, Dish, Best-for-dish, Login sheet, Onboarding, Rate / Review / Report / Hours / Note sheets | Search → place → rate works in the browser |
| 10 | Frontend personal | Journal (Timeline · Stats · Contributions), Me hub, Wishlist, Notes, Taste profile (sliders + lock), Settings (delete account), Add place (PinPicker, duplicate prompt), Public journal | All 🔐 pages work |
| 11 | Frontend group + admin | Group hub, Join (guest name), Group room (live, reconnect banner, Open in Maps), Admin dashboard, Privacy / Terms / About, Not found · **Playwright tests for key flows** | Group flow works on 2 real phones |

## Launch

| # | Phase | Build | Done when |
|---|---|---|---|
| 12 | Launch | Full test pass · deploy backend on **Railway** (API + worker + Postgres via our Dockerfile + Redis, trial credit) · frontend on **Vercel** · production env vars · Google OAuth app approval (needs `/privacy`) · domain / Instagram handle check for Khaozo | Live link works on a phone · reel recorded |

---

## Deployment (LOCKED)
- **Build everything locally with Docker (₹0)** until Phase 12.
- **Backend → Railway** (one-time trial credit ≈ $5; not free forever — after it runs out, Hobby ≈ $5/month or services pause). Runs API, worker, Postgres (our PostGIS + pgvector Dockerfile), Redis. Never sleeps → demo works instantly.
- **Frontend → Vercel** (free).
- After launch: decide whether to pay ~$5/month to keep it live.
- Rejected: all-free combo (Render free sleeps ~15 min → slow first load, drops Socket.IO, no free worker; BullMQ polling burns Upstash free commands) · own VPS (too much setup for a first deployment on a deadline).

---

## Verification log (2 Oct 2026)
Plan re-checked against `03_data_modelling.md`, `04_backend_architecture.md`, `backend_layers/`, `05_frontend_design.md`. Fixes applied:
1. configService + cacheRepo were never scheduled, but Phase 3 needs config (verify threshold, weights) → added to Phase 0 (cacheRepo) and Phase 3 (configService).
2. Confirmation weights (Phase 3) need trustService, which was only in Phase 5 → weight function in Phase 3, recalculation job stays in Phase 5.
3. No way to create the first admin → one-time `ADMIN_EMAIL` script in Phase 2.
4. Google login can't be tested from Postman alone (needs an ID token) and the frontend comes later → tiny test HTML page in Phase 2.
5. Google OAuth Client ID, Cloudinary and Gemini keys are needed during the build, not only at launch → Prerequisites table.
6. Reports: Phase 3 = create only; admin accept/reject = Phase 8 (made explicit).
7. Place page in Phase 3 has no labels/stats until the materialized views exist (Phase 5) — made explicit.
8. Not yet verified (marked in the plan, checked at that phase): exact Docker image tag + pgvector package name (Phase 0) · Foursquare Open Places licence + OSM terms (Phase 1) · Bhubaneswar dish catalog content still to be prepared (Phase 1).

## Setup-time verification log (2 Oct 2026, during Phase 0)
Items marked "verify at setup time" above, now checked:
1. **Docker image (Phase 0):** `postgis/postgis:17-3.5` is built on Debian bullseye, whose PGDG apt repo is gone (404) → pgvector can't be installed on it. **Changed:** custom image now builds `FROM postgres:17-bookworm` + `postgresql-17-postgis-3` (**PostGIS 3.6.x**) + `postgresql-17-pgvector` (0.8.x) from PGDG. All PostGIS functions used by the plan are unchanged in 3.6. apt runs over **HTTPS** (the home network blocks plain-HTTP apt downloads; CA bundle copied from a tiny Alpine stage).
2. **Local ports:** a native Windows PostgreSQL already uses 5432 → container Postgres is mapped to host **5433**.
3. **Place data licences (Phase 1) — decision: import both, as planned.**
   - **Foursquare OS Places:** Apache 2.0 (commercial use OK) → keep the NOTICE / attribution. Download is gated on Hugging Face (needs Sangram's login + accepting terms).
   - **OpenStreetMap:** ODbL → credit "© OpenStreetMap contributors" + state data is under ODbL. Mixing OSM with other POIs in one `places` table = a *derivative database* → if publicly used, the **places data** must be offered under ODbL (share-alike). Ratings/reviews are a separate data type and stay ours. Accepted for v1: credits on `/about`, places dump offered on request.
4. **Dish catalog (Phase 1):** reviewed → `08_dish_catalog.md` (source of truth): 10 cuisines (+ Fast food, Beverages), 29 categories, 9 main ingredients (+ Crab, Chhena; no Pork), 175 dishes, 164 aliases. Cakes/pastries default to egg.
5. **Imported places start `verified`** (OSM / Foursquare are established datasets). Only **user-added** places start `unverified` and need confirmation weights ≥ `place_verify_threshold` (5).
6. **Area pins:** 73 (not ~100) — OSM has no reliable points for more Bhubaneswar localities; admin can add more later.
7. **First OSM import (dev DB):** 130 OSM elements → 126 places (4 merged as duplicates).
