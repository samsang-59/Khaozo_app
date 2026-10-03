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
8. **Foursquare import (dev DB, 2 Oct 2026):** release `dt=2026-09-15` → 6,024 Bhubaneswar rows → 830 food places → 791 inserted, 39 merged with OSM. Total 917 places (634 restaurants, 139 cafés, 59 sweet shops, 46 bakeries, 27 street stalls, 12 dhabas).

## Phase 2 notes (2 Oct 2026)
- **Quiz → learned blend:** the plan says "few ratings → trust quiz, many → trust learned" without a number. Implemented as a linear blend reaching 100 % learned at **20 rated dishes** (`BLEND_FULL_AT_RATINGS` in tasteProfileService). Edited fields store the user's value in `<field>_learned` and set `<field>_locked`.
- **optionalAuth:** no token → guest; a token that is present but invalid/expired → 401 (so the frontend refreshes instead of silently dropping "Match %").
- **PATCH /me** accepts `name` and `journalVisibility` only. **DELETE /me** comes with account deletion in Phase 8.
- BIGINT[] results (e.g. `array_agg(id)`) are also parsed as numbers (db.js).

## Phase 3 notes (2 Oct 2026)
- **Trust levels:** the plan names the weights (new 0.5 / normal 1.0 / trusted 2.0) but not the rules. Added config keys in **migration 009** (so the materialized views migration becomes **010**): `new_account_days` = 7 (younger accounts are "new"), `trusted_min_score` = 2.0 (users.trust_score at or above → "trusted").
- **Places list:** default radius 3 km (same as search), max 20 km; centre from lat/lng or an area pin; nearest first with keyset (cursor) pagination. Closed + soft-deleted places hidden; `?status=closed` shows closed ones.
- **Opening hours:** computed in IST; "closing soon" = within 30 minutes. Same rules in the SQL open-now filter and the JS status (tested against each other).
- **Add place:** Bhubaneswar bounding box only (`OUTSIDE_SERVICE_AREA`). Duplicate = similar name (pg_trgm default threshold) within 50 m.
- **Reports:** one pending report per user + place + reason. `suggestedChange` shapes: `{lat,lng}` / `{hours:[…]}` / `{text}`.
- **Menu items** (`POST /places/:id/menu-items`, built here because dishMatcher is): exact match → auto-link; similar → 409 "Is this X?" with candidates, and a confirmed spelling becomes an alias; no match → new standard dish `pending_review` (needs category, cuisine, diet; diet checked against the main ingredient). `GET /dishes/:id/best` needs ranking → Phase 5.
- Redis client connects lazily (first command), so importing a module never opens a socket.

## Phase 4 notes (2 Oct 2026)
- **Re-rate / re-review rule:** a second rating of the same dish (or review of the same place) inside `rerate_after_days` → 409 `RATING_TOO_SOON` / `REVIEW_TOO_SOON` with the id to edit (frontend opens edit mode). After that → new current row, old one kept as history. Only the current one can be edited.
- **Delete** (own rating / review) is a hard delete; its photos are removed from Cloudinary first. Admin removal (soft delete) comes in Phase 8.
- **Photos:** multipart field `photos`; JPG / PNG / WebP / HEIC; Cloudinary shrinks to ≤ 1600 px with automatic quality. Place photos can only be added by the person who added the place (photos have no uploader column, so ownership comes from the parent). Uploads that would exceed 3 are rolled back on Cloudinary.
- **Wishlist "Tried ✅":** set when the user rates the saved menu item or any menu item of the saved standard dish (saving a place is not marked).
- **Journal:** a card = same place, each entry ≤ `journal_gap_hours` after the previous one at that place. **My Stats:** places tried, dishes tried, top cuisine, favourite dish (highest average stars), per-dish comparison (same standard dish rated at 2+ places, latest rating per place); "This month" = calendar month in IST.
- **Public journal** (`/users/:id/journal`): only when `journal_visibility = public`; shows name + avatar, timeline, all-time stats — never email.
- Route files: one per module (menuItems, ratings, reviews, photos, journal, wishlist, notes).

## Phase 5 notes (2 Oct 2026)
- **Migration 010** = materialized views `menu_item_stats`, `place_stats` (+ plain view `contribution_weights`). All ranking maths in SQL, rules read from `config_settings` at refresh.
- **Bayesian prior** (`bayes_prior`, new config): mean **3.5**, weight **5**. A prior equal to the global mean would let one 5★ beat 80 × 4.6★ (the plan's own example), so a fixed neutral-ish prior is used.
- **Rating / review weight = current trust:** `trust_weights[level] × min(trust_score, 1)` (trusted users get the full 2.0). A falling trust score shrinks all of that user's old ratings; anonymised rows count as normal.
- **Trust score** (`trust_rules`, new config, nightly 02:30 IST): `1 + 0.05 × ratings within 1★ of the crowd − 0.2 × ratings ≥ 2.5★ away + 0.1 × places added that got verified`, clamped 0.1–3.0. Crowd = other current ratings of the same menu item, only when there are ≥ `min_ratings_for_label` of them.
- **Labels:** need ≥ `min_ratings_for_label` ratings; use the weighted average and weighted "order again" %. Typical spice / sweetness / oiliness = most common answer.
- **Facilities** = majority answer of current reviews (tie → unknown). Tags shown at ≥ `tag_min_votes` votes (user + auto).
- **Auto tags (code rules):** Work = quiet + Wi-Fi + plug points (plan); Date = vibe ≥ 4 + looks ≥ 4 + quiet/moderate (brainstorm). Meal time from rating time (IST): Breakfast 7–11 (plan); ours: Lunch 12–16, Evening snacks 16–19, Dinner 19–23, Late night 23–03.
- **Taste learning** (after each rating): from liked dishes (≥ 4★): spice / sweetness / oiliness averages, budget bucket from price paid (else menu price). Locked fields never change.
- **Jobs:** one BullMQ queue `khaozo`; `npm run worker`. Schedules: stats every 5 min, trust 02:30 IST, expired sessions 03:00 IST. Jobs are queued after commit; a queue failure never fails the user's request (logged; periodic jobs catch up).
- **API now shows stats:** place page (`stats`, `mustOrder` top 3, `mixedReviews` up to 2), menu items, dish page; new `GET /dishes/:id/best` (by Bayesian score).

## Phase 6 notes (2 Oct 2026)
- **Models (env, swappable):** chat `gemini-3.5-flash-lite` (gemini-2.5-flash is closed to new users; 3.8-flash returned 503 "high demand" at setup), embeddings `gemini-embedding-001` at **768 dims** (matches `vector(768)`). OpenAI fallback only when both `OPENAI_API_KEY` and `OPENAI_CHAT_MODEL` are set (not configured now → chain is Gemini → keywords).
- **Migration 011** (config): `search_weights` (plan's 40/20/15/10/10/5), `search_radius_m` 3 km → 6 km, `search_relax_price_pct` 20, `search_min_results` 3, `ai_daily_limit` gemini **500/day** (ours — counts chat + embeddings; check the real quota in AI Studio and adjust), `rate_limits` (plan's table).
- **Score:** each part is 0..1; parts that don't apply to a search (no centre, no tags asked, no vibe, no taste) are left out and the other weights re-normalised. Relaxing drops a requirement, not its reward (a place with the asked-for tag still scores higher).
- **Dish words:** a category word ("biryani", "momos") matches every dish in that category; otherwise dishMatcher (alias → pg_trgm → embedding, cosine ≥ 0.75). Unknown dish → place search with a note.
- **Match %** (ours): average of spice / sweetness / oiliness closeness, budget-bucket closeness, favourite cuisine (1) or not (0.5). Query spice ("spicy biryani") is used as the taste part for guests.
- **Personal diet + foods to avoid:** applied after the cache, `showAll=true` turns them off; the query's own diet is a filter that is never relaxed.
- **Cache:** non-personal steps 2–6 for 10 min, key = query + UI filters + ~500 m grid; distances re-measured from the user's own point after reading the cache. AI parses cached 24 h (keyword parses are not cached, so AI is retried).
- **Rate limits:** global `api` on every route except `/health`; `search`, `auth` (per IP), `contribute` (ratings, reviews, photos, reports — per user/hour), `addPlace` (per user/day). Off in the test app except in the rate-limit tests.
- **Jobs:** `dishes.embed` (daily + right after the worker starts), `review.embed` (after a review with text), `summary.refresh` (after a rating with text; first summary once labelled, then every `summary_refresh_every` new text reviews). Prompts never contain names, emails or notes.
- Tests never call real AI (keys ignored when NODE_ENV=test; AI tests mock fetch / the adapter).

## Phase 7 notes (2 Oct 2026)
- **Migration 012** (config): `group_max_members` 10 (plan), `group_suggestions` 5 (plan: 3–5), `group_creator_grace_seconds` **60** (ours: how long a creator may be offline before handover).
- **Create:** `POST /groups` is 🌐 — logged in, or a guest with a display name (gets a guest pass). Join: logged in → straight in; guest → name → guest pass for that one group. Guest passes are issued by authService in the controller (groupService never calls another feature service).
- **Statuses:** `joining` (lobby, preferences) → `choosing` (suggestions being computed) → `voting` → `done`.
- **Live state** in Redis `group:<code>` (expires after `group_expiry_hours`); every change is read-modify-write under a short per-group Redis lock (two votes at the same instant never overwrite each other). Snapshots carry names, ready / connected / voted flags, suggestions and vote counts — never members' preferences or emails.
- **Suggestions are place-level:** diet (place `diet_type`), budget (place `price_level`, same 1–4 scale) and favourite cuisines (place cuisines). Strict = place removed; preference = lower rank; unknown place data counts 0.7 and never removes a place. Spice and foods-to-avoid have no place-level data, so they don't filter suggestions in v1. Places serving both veg and non-veg get +0.05 when the group mixes diets. Radius 3 km → 6 km if fewer than 3. Ranking = search weights with the group fit as the taste part.
- **Midpoint** = PostGIS `ST_Centroid` of the locations members shared with their preferences.
- **Winner:** most votes; tie → higher score; no votes → best suggestion; the creator can end early or override. Saved to `group_sessions` (+ logged-in members, `guest_count`) only when a winner is picked.
- **Leave:** vote removed; creator leaving → next member by join order; last person out → live group deleted (nothing saved). Disconnect (phone died) → offline; creator still offline after the grace period → handover. Reconnect → re-join → fresh snapshot.
- Every socket event has an ack `{ ok, error }`; failures also emit `group:error`. Socket event limit 5/s per connection (config).
- Live check on dev data: 3 clients (1 user + 2 guests) joined, voted (with a re-vote), winner saved to history.

## Phase 8 notes (2 Oct 2026)
- **No migration needed** — every column used (deleted_at, status, reviewed_by, updated_by, FK rules) already existed.
- **Admin routes** (`/admin/*`, 👑 = requireAuth + adminOnly on the whole prefix): reports queue + accept / reject, places queue (`?status=unverified|closed|deleted`) + `verify / close / delete / restore`, pending dishes (each with up to 3 similar active dishes to merge into), add dish (active, + aliases), approve / merge dish, soft-delete review / rating, config list / edit. Queues are oldest first (resolved reports newest first), keyset pagination.
- **Accepting a report applies the fix in the same transaction:** closed → place closed · not_found → soft-deleted · wrong_location → new pin (+ nearest area pin again) · wrong_hours → hours replaced · wrong_info → the admin's structured fix (name / address / phone / type / diet / price; the reporter's free text can't be applied automatically) · duplicate → **merge**. The admin can send `change` to correct the reporter's suggestion; a location / hours report with no details anywhere → 400 `REPORT_CHANGE_REQUIRED`. Only pending reports can be resolved (row-locked, so two admins can't both resolve one).
- **Place merge (duplicate accepted):** everything moves to the original — menu items (an item with the same name on the original menu is folded into it: its ratings / saves / notes move, it becomes `removed`), reviews, photos, notes, tag votes, wishlist saves, cuisines; hours / phone / address / price / diet copied only where the original has none. One current rating / review per user is kept: the newer one. The duplicate is soft-deleted.
- **Restore** undoes soft delete and re-opens a closed place: back to `verified` if it was ever verified (or imported), else `unverified`.
- **Dish approve:** optional fixes; a rename keeps the user's typed name as an alias and clears the embedding (re-embedded by the job). **Dish merge:** menu items, aliases and wishlist saves move; the merged dish's name becomes an alias; the dish is deleted. Target must be an active dish.
- **Admin removal of ratings / reviews = soft delete** (hidden everywhere incl. the author's journal; photos kept; restorable in the DB — no restore route in v1). The author can rate again straight away.
- **Config editor:** the new value must keep the setting's JSON shape (numbers stay numbers ≥ 0, objects keep exactly their keys, lists their length) → admin tunes values, never the structure. `updated_by` recorded; `config:all` cache cleared.
- **Account deletion (`DELETE /me`, body `{ "confirm": "DELETE" }`):** one transaction in `userRepo.deleteAccount` — user row locked; photos of her ratings, reviews **and places she added** deleted; ratings / reviews kept anonymous with text (+ review embedding) cleared; then the user row is deleted and the FK rules do the rest (CASCADE / SET NULL as in the data model). Cloudinary files are deleted **after** commit (a rolled-back transaction must not lose files still in use); any that fail go to a `photos.delete` job (BullMQ retries). Refresh cookie cleared; stats refresh queued.
- **Known v1 limits:** an access token stays valid up to 15 min after deletion (refresh sessions are gone; `/me` → 404 and writes fail) · a live group in Redis keeps the display name until it expires (≤ 4 h) · existing AI one-line summaries are not regenerated just because a reviewer left (they summarise many reviews, no names).
- Tests: `admin.test.js` (27) + `accountDeletion.test.js` (7) — 362 tests in total, all green.

## Phase 9 notes (3 Oct 2026)
- **Design source:** Claude Design handoff "Street Sticker" — `plans/design/` (Batch 1 core, Batch 2 personal, Batch 3 group / admin / utility + tokens README). Where the design and the plans disagree on *behaviour* the plans win (URLs, journal tabs, group without a name); on *visuals* the design wins.
- **Stack as planned:** Vite 8 + React 19 + Tailwind v4 (tokens in `src/styles/index.css` `@theme`) + TanStack Query + axios + react-router 7 + react-leaflet + vaul (bottom sheet) / Radix Dialog (laptop dialog) / Radix Tabs + sonner + lucide-react. The shadcn building blocks are written by hand in `components/ui/` in the Street Sticker style (same Radix / vaul primitives shadcn uses).
- **Single-flight refresh everywhere** (start-up refresh, 401 retries, parallel requests share one promise). Found while reading the backend: a losing parallel refresh gets 401 *and* the controller clears the cookie → the user would be logged out on the next reload. React StrictMode's double effects are covered by the same promise.
- **Login gate** = `useGate(key, fn)`: logged out → Login sheet → after sign-in the same action runs; a new user goes through onboarding and comes back with `{ resume: key }` in history state.
- **Google sign-in:** the official GIS button (`renderButton`, popup) inside the design's bordered frame — a fully custom button can't get an ID token reliably. Without `VITE_GOOGLE_CLIENT_ID` the sheet says sign-in isn't configured.
- **Location:** asked on the first Home visit; denied → area picker card; the choice (GPS or area pin) is remembered in localStorage. The area pill always opens the picker.
- **Home "Open now near you"** uses `GET /places?openNow=1` (place-level meta: cuisines · ₹₹ · distance · hours). If nothing is open it shows the nearest places instead. "Best in Bhubaneswar for…" tiles resolve catalogue dish names with `/dishes/match` (ids differ per database).
- **Search:** chips show what the sentence was understood as (not removable — they come from the text) plus filters the user picked (removable, in the URL). Diet banner only when a personal diet / foods-to-avoid filter applied (`Show all` → `showAll=1`). The API returns all results in one go → "Load more" pages through them 10 at a time. Laptop: list + map, hovering a row highlights its pin, "Search this area" puts the map centre into the URL.
- **Place page** "Rate a dish" → pick from the menu or type a new dish (→ "Is this X?" → new dish with category / cuisine / diet) → Rate sheet. Rate / review within 30 days → the sheet edits that one (the 409 `RATING_TOO_SOON` / `REVIEW_TOO_SOON` id is used automatically).
- **Photos** are compressed in the browser (≤ 1600 px, < 1 MB; HEIC sent as is) before upload.
- **Tests:** Vitest unit tests for the API client (unwrap, errors, 429, single-flight refresh, no refresh for guests / logged-out) and format helpers. New CI workflow `frontend.yml` (unit tests + build). Playwright key flows come in Phase 11 (plan).
