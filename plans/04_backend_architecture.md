# Khaozo (Food Discovery App) — Backend Architecture (v1)

> Status: **COMPLETE** (backend architecture) · Next: Frontend design → then phase-wise implementation plan
> Last updated: 2 Oct 2026
> Related: `01_brainstorming.md`, `02_tech_stack.md`, `03_data_modelling.md`

---

## Layer flow (agreed)

Order of design: **routes → controllers → services → repositories → DB**. AI layer is called **only by services**.

```
HTTP route ─→ middleware / validators ─→ controller ─┐
Socket.IO event handler ────────────────────────────┼─→ service ─→ repository ─→ PostgreSQL / Redis
BullMQ worker ──────────────────────────────────────┘      └─→ aiAdapter ─→ Gemini / OpenAI
```
- Middleware/validators sit between route and controller: auth check, admin check, rate limit, multer (photos), request validation.
- Workers and socket handlers call services directly (never controllers).

---

## Part 1: Routes (LOCKED)

**Conventions**
- Prefix: **`/api/v1`**
- **Create nested under the parent, edit/delete flat**, max one level (`POST /menu-items/12/ratings`, `PATCH /ratings/88`)
- Search = **GET** with query params (bookmarkable, cacheable)
- Lists paginate with `?limit=&cursor=`

Access: 🌐 public · 🔐 logged in · 👑 admin

| Module | Routes |
|---|---|
| system | 🌐 GET /health |
| auth | 🌐 POST /auth/google · 🌐 POST /auth/refresh · 🔐 POST /auth/logout · 🔐 POST /auth/logout-all |
| me | 🔐 GET /me · PATCH /me · DELETE /me (account deletion) · GET /me/taste-profile · PUT /me/taste-profile (quiz) · PATCH /me/taste-profile (edit + lock field) |
| search | 🌐 GET /search?q=&lat=&lng=&filters… |
| places | 🌐 GET /places (map/list, filters, `?q=` name, `?status=unverified`) · 🌐 GET /places/:id · 🌐 GET /places/:id/menu · 🌐 GET /places/:id/reviews · 🌐 GET /places/:id/photos · 🔐 POST /places (returns **409 + possible duplicates** unless `confirm_new=true`) · 🔐 POST /places/:id/confirm · 🔐 POST /places/:id/reports · 🔐 PUT /places/:id/hours (only if none exist) |
| dishes | 🌐 GET /dishes/match?q= · 🌐 GET /dishes/:id/best?lat&lng · 🔐 POST /places/:id/menu-items |
| menu items | 🌐 GET /menu-items/:id (summary, stats, label, typical spice; + my rating if logged in) · 🌐 GET /menu-items/:id/ratings |
| ratings | 🔐 POST /menu-items/:id/ratings · PATCH /ratings/:id · DELETE /ratings/:id |
| reviews | 🔐 POST /places/:id/reviews (tag votes included) · PATCH /reviews/:id · DELETE /reviews/:id |
| photos | 🔐 POST /ratings/:id/photos · POST /reviews/:id/photos · POST /places/:id/photos · DELETE /photos/:id |
| journal | 🔐 GET /me/journal · 🔐 GET /me/stats?period=all\|month · 🔐 GET /me/contributions (places added + verification progress, dishes added + review status, reports + status — added in frontend design) · 🌐 GET /users/:id/journal (only if public) |
| wishlist | 🔐 GET /me/wishlist · POST /me/wishlist · DELETE /me/wishlist/:id |
| notes | 🔐 GET /me/notes · POST /me/notes · PATCH /me/notes/:id · DELETE /me/notes/:id |
| groups | 🌐 POST /groups · 🌐 POST /groups/:code/join (guest pass if not logged in) · 🌐 GET /groups/:code · 🔐 GET /me/groups · live actions via Socket.IO |
| meta | 🌐 GET /areas · /cuisines · /dish-categories · /main-ingredients · /tags |
| admin | 👑 GET /admin/reports · PATCH /admin/reports/:id · GET /admin/places?status=unverified · PATCH /admin/places/:id (verify / close / soft-delete / restore) · GET /admin/dishes/pending · POST /admin/dishes · PATCH /admin/dishes/:id (approve / merge) · DELETE /admin/reviews/:id · DELETE /admin/ratings/:id · GET /admin/config · PATCH /admin/config |

### Added later: `GET /me/contributions` (from frontend design, Journal → "My Contributions" tab)
No new files — one new function in each existing layer:
- route: journal routes · middleware `requireAuth` · validator: pagination (`limit`, `cursor`)
- controller: `journalController.getContributions`
- service: `journalService.getContributions(userId)` → combines the three lists below
- repositories: `placeRepo.findAddedByUser` (+ `confirmationRepo.sumWeights` for "3.5 / 5 confirmations") · `dishRepo.findCreatedByUser` (pending_review / active) · `reportRepo.findByReporter` (pending / accepted / rejected)

---

## Part 2: Controllers (LOCKED)

- Job: **receive → delegate → reply**. No business logic, no SQL.
- **15 controllers**, one per module: auth · me · search · places · dishes · menuItems · ratings · reviews · photos · journal · wishlist · notes · groups · meta · admin
- **Express 5** (current stable) — async errors caught automatically, no asyncHandler wrapper.
- **Same response shape always:** `{ success: true, data }` / `{ success: false, error: { code, message } }`

### Result pattern (services know nothing about HTTP)
- Services **return** results: `{ ok: true, data }` or `{ ok: false, reason: 'RATING_TOO_SOON' }`. They never pick status codes — they're also called by workers and socket handlers where HTTP means nothing.
- **Controllers give the result meaning**: one shared map turns `reason` → HTTP status + message (e.g. `MENU_ITEM_NOT_FOUND → 404`, `RATING_TOO_SOON → 409`, `NOT_ALLOWED → 403`), via a `sendFailure(res, reason)` helper.
- **Unexpected failures** (DB down, Cloudinary timeout, bugs) still throw → **one error middleware** as a safety net: logs it, replies `500`.

```js
export const createRating = async (req, res) => {
  const result = await ratingService.create({ userId: req.user.id, menuItemId: req.params.id, ...req.body });
  if (!result.ok) return sendFailure(res, result.reason);
  res.status(201).json({ success: true, data: result.data });
};
```

---

## Part 3: Services (LOCKED)

Services = business logic only. Return `{ ok, data }` / `{ ok: false, reason }`. Only services call `aiAdapter`.

### Feature services (called by controllers, workers, socket handlers)
| Service | Main jobs |
|---|---|
| authService | verify Google token, find/create user, issue tokens, refresh with rotation + reuse detection, logout, **issueGuestPass** (group mode), nightly cleanup of expired sessions |
| userService | profile, journal visibility, account deletion (DPDP flow) |
| tasteProfileService | quiz, edit + lock field, blend quiz/learned, learning job |
| searchService | AI → filters → DB → rank → reasons → relax filters → Redis cache |
| placeService | list, details, add place (duplicate check → 409), hours |
| verificationService | confirmations, weight sum, flip to verified |
| reportService | create report, admin accept/reject (applies fix) |
| dishService | best places for a dish, dish embeddings job |
| menuItemService | add menu item, details, AI summary refresh job |
| ratingService | rate (30-day rule, is_current), edit, delete, mark wishlist tried (via wishlistRepo) |
| reviewService | review + tag votes (user + auto), edit, delete, review embeddings job |
| photoService | photo rules (max 3, 5 MB), uses storageService |
| journalService | timeline (3-hour grouping), My Stats, **getContributions** (places added + confirmation progress, dishes added + review status, reports + status) |
| wishlistService · noteService | CRUD |
| groupService | create, join, preferences, suggestions, voting, tie-break, save history |
| metaService | areas, cuisines, categories, ingredients, tags (cached) |
| adminService | queues, approve/merge dishes, place actions, config |

### Helper services (used only by other services)
| Service | Job |
|---|---|
| rankingService | Bayesian score, match %, conflict handling, reason templates, materialized view refresh job |
| trustService | trust scores + weights |
| tagService | auto-tag rules (quiet + Wi-Fi + plugs → Work; rating time → meal tag) |
| configService | read config (Redis-cached) |
| storageService | Cloudinary upload / delete (used by photoService + userService) |
| dishMatcher | typed name → standard dish (alias → pg_trgm → embedding) (used by dishService, menuItemService, searchService) |
| jobQueue | add BullMQ jobs |

### Rules
- **Service → service only downward** (feature → helper). Helpers never call feature services; feature services never call each other. A service may call **any repository** directly.
- **Transactions live in the repository.** The service decides *what* must happen together and calls **one repository method** that runs BEGIN → queries → COMMIT (ROLLBACK on error). Multi-table operations are still one repo method (e.g. `userRepo.deleteAccount`, `reviewRepo.createWithTagVotes`, `ratingRepo.replaceCurrent`).
- **Background jobs are queued only after the transaction commits.**

### Background jobs → owner
| Job | Owner |
|---|---|
| Refresh menu_item_stats / place_stats (every ~5 min) | rankingService |
| AI summary refresh (every 5 new reviews) | menuItemService + aiAdapter |
| Embeddings for new dishes / reviews | dishService / reviewService + aiAdapter |
| Learn taste profile | tasteProfileService |
| Trust scores | trustService |
| Auto tag votes | tagService |
| Clean expired login sessions (nightly) | authService |

### Double-check fixes (applied)
- ratingService → wishlistService broke the downward rule → uses wishlistRepo directly
- userService → photoService → new helper **storageService**
- searchService → dishService → new helper **dishMatcher**
- Guest pass had no owner → authService.issueGuestPass
- Expired login sessions never cleaned → nightly job

---

## Part 4: Repositories (LOCKED)

- **Only place with SQL / Redis access.** Plain data in, plain data out, no business rules.
- Raw SQL with `pg` written inline in repo files (`pool.query(...)` / `client.query(...)`), **always parameterised** (`$1, $2`) — never string-joined (SQL injection).
- **Transactions inside repository methods** via a shared `withTransaction(fn)` helper in `db.js` (BEGIN → fn(client) → COMMIT, ROLLBACK on error, release client).
- **snake_case → camelCase**: one small helper converts keys on every result.
- **Redis also only through repositories** (same rule as PostgreSQL): `groupLiveRepo` (live group sessions), `cacheRepo` (search cache, config cache, rate limits). Services never touch the Redis client. Easy to mock in tests.
- Big ranking SQL (materialized views) lives in **migrations** (part of the schema).

| Repository | Tables |
|---|---|
| userRepo | users (+ `deleteAccount` across all tables, one transaction) |
| sessionRepo | login_sessions |
| tasteProfileRepo | taste_profiles · taste_profile_cuisines · taste_profile_avoid |
| placeRepo | places · place_cuisines · opening_hours |
| confirmationRepo | place_confirmations |
| reportRepo | place_reports |
| dishRepo | standard_dishes · dish_aliases |
| menuItemRepo | menu_items |
| ratingRepo | dish_ratings |
| reviewRepo | place_reviews |
| tagVoteRepo | place_tag_votes |
| photoRepo | photos |
| wishlistRepo · noteRepo | wishlist_items · private_notes |
| groupRepo | group_sessions · group_session_members |
| metaRepo | areas · cuisines · dish_categories · main_ingredients · tags |
| configRepo | config_settings |
| statsRepo | menu_item_stats · place_stats (read + refresh) |
| groupLiveRepo (Redis) | live group data `group:<code>` |
| cacheRepo (Redis) | search cache, config cache, rate limits |

Check: all 27 tables + 2 materialized views + Redis covered.

---

## Part 5: DB layer (LOCKED)

### Connection files
- `db.js` — one `pg` **Pool** (~10 reusable connections) from `DATABASE_URL` (.env) + `withTransaction` helper.
- **BIGINT IDs returned as numbers** (pg type parser) — by default pg returns them as text ("42"), causing `===` and `+` bugs. Safe: we'll never exceed 9 quadrillion rows.
- `redis.js` — one `ioredis` client (required by BullMQ).

### Migrations (node-pg-migrate) — numbered SQL files, version history for the DB structure
- Each file runs **once, in order**; node-pg-migrate records what ran in its own `pgmigrations` table.
- Never edit a migration that already ran → add a new numbered file (e.g. `010_add_phone_to_users.sql`).
- Same files build laptop DB, test DB (`food_app_test`) and live DB identically.

```
001  extensions     → postgis, vector, pg_trgm
002  lookup tables  → areas, cuisines, dish_categories, main_ingredients, tags, config_settings
                      + must-have rows (tags, cuisines, categories, main ingredients, config defaults)
003  users + auth   → users, taste_profiles (+2 middle tables), login_sessions
004  places         → places, place_cuisines, opening_hours, place_confirmations, place_reports
005  food           → standard_dishes, dish_aliases, menu_items
006  contributions  → dish_ratings, place_reviews, photos, place_tag_votes
007  personal/group → private_notes, wishlist_items, group_sessions, group_session_members
008  indexes        → B-tree, GiST, HNSW, pg_trgm
009  views          → menu_item_stats, place_stats
```
Order matters: a table must exist before another table can point to it (FK).

### Seed data — `seed.sql` / `npm run seed` (safe to run twice, no duplicates)
- ~100 Bhubaneswar area pins
- Dish catalog (standard dishes + aliases)
- OSM / Foursquare place import (separate import script)

### Docker
No official image has both PostGIS and pgvector → small custom Dockerfile:
```dockerfile
FROM postgis/postgis:17-3.5
RUN apt-get update && apt-get install -y postgresql-17-pgvector
```
(pg_trgm is built into Postgres.)

---

## Cross-cutting 1: Folder structure (LOCKED)

- **ES Modules** (`import/export`, `"type": "module"`)
- **Zod** for request validation (same library as AI output validation)

```
food-app-backend/
├─ docker-compose.yml
├─ docker/postgres/Dockerfile        ← PostGIS + pgvector image
├─ migrations/                       ← 001_…sql to 009_…sql
├─ seeds/seed.sql
├─ scripts/import-places.js          ← OSM / Foursquare import
├─ .env / .env.example
├─ src/
│  ├─ app.js                         ← Express app, middleware, routes
│  ├─ server.js                      ← starts HTTP + Socket.IO
│  ├─ worker.js                      ← starts BullMQ workers (separate process)
│  ├─ config/        env.js, db.js, redis.js
│  ├─ routes/        (15 route files)
│  ├─ validators/    Zod schemas per module
│  ├─ middleware/    auth.js, adminOnly.js, rateLimit.js, upload.js, errorHandler.js
│  ├─ controllers/   (15)
│  ├─ services/      feature services
│  │  └─ helpers/    ranking, trust, tag, config, storage, dishMatcher, jobQueue
│  ├─ repositories/  SQL repos + redis/ (groupLive.repo.js, cache.repo.js)
│  ├─ ai/            aiAdapter.js, prompts/, schemas/
│  ├─ sockets/       group.socket.js
│  ├─ jobs/          stats, summary, embedding, tasteProfile, trust, autoTags, sessionCleanup
│  └─ utils/         result.js, reasons.js, caseMapper.js
└─ tests/            unit/, api/, sockets/
```

### Who calls whom
```
routes → validators/middleware → controllers ─┐
sockets (real-time) ──────────────────────────┼─→ services ─→ helpers
jobs (run by worker.js) ──────────────────────┘      ├─→ repositories ─→ PostgreSQL / Redis
                                                     └─→ ai (aiAdapter) ─→ Gemini / OpenAI
services ─→ jobQueue helper ─→ puts a job in the BullMQ queue (Redis) → worker.js picks it up → job calls a service
utils: small shared tools, used by any layer
```
- Services **add** jobs to the queue; jobs **run separately** (worker.js) and **call services** to do the work — same direction as sockets.
- worker.js is a separate process so slow AI/embedding jobs never slow API responses.

---

## Cross-cutting 2: Auth flow (LOCKED)

### Login (Google)
1. Frontend: "Sign in with Google" → Google gives frontend an **ID token**
2. Frontend → `POST /api/v1/auth/google { idToken }` → **our backend**
3. Backend verifies it with **google-auth-library** (really from Google, for our client ID)
4. Find user by `google_id` → else create user + empty taste profile
5. Issue **access token** (JWT, 15 min, `{ sub: userId, role }`) in body + **refresh token** (64 random bytes, 7 days) in an httpOnly cookie
6. Refresh token stored in `login_sessions` as a **SHA-256 hash** (not bcrypt: token is random/unguessable, and bcrypt's random salt makes `WHERE token_hash = $1` lookup impossible)
7. Server stores no access token — frontend keeps it in memory, sends `Authorization: Bearer <token>`; server only checks the signature

### Refresh (silent, ~every 15 min)
`POST /auth/refresh` (cookie sent automatically) → hash → find in login_sessions
- not found / expired / revoked → 401 (log in again)
- already used → **reuse detected → revoke all user's sessions** → 401
- ok → mark used (`replaced_by`), issue new access + refresh (rotation)
- Frontend: on 401 → refresh → retry the original request automatically (user notices nothing)

### ⚠️ Trap: parallel refresh (handled)
Opening a page fires several API calls at once (place details + menu + reviews). If the access token expired, all get 401 and each would refresh with the **same** refresh token → the 2nd/3rd look like reuse → user logged out.
- **Frontend fix:** single-flight refresh — only one refresh runs at a time; other requests wait for it and reuse the new token.
- **Backend safety net:** if a used token comes back within **10 seconds** of being rotated, treat it as a race (plain 401, no mass revoke), not theft.

### Middleware
| Middleware | Used on | Does |
|---|---|---|
| `requireAuth` | 🔐 routes | no/invalid token → 401; rejects guest passes |
| `optionalAuth` | 🌐 routes that personalise (search, place, menu item) | token present → `req.user`; else continue as guest (no "Match %", no "your rating") |
| `adminOnly` | 👑 routes | role ≠ admin → 403 (role read from JWT; demotion takes effect within 15 min) |

### Guest pass (group mode)
- `POST /groups/:code/join` without login → **one guest pass per guest person**: JWT `{ type: 'guest', guestId, groupCode }`, 4 hours.
- Valid **only for that one group** (join, preferences, vote). Any other group or any normal route → rejected.
- Logged-in members use their normal access token.

### Socket.IO auth
- Each person opens **their own** socket with **their own** token (`io(url, { auth: { token } })`) — access token or guest pass.
- One `io.use()` check accepts access tokens or a guest pass matching the group; all members join room `group:<code>`.
- Socket.IO handles **group-mode events only**; everything else is HTTP.

### Refresh cookie settings
| Setting | Means | Protects against |
|---|---|---|
| httpOnly | page JavaScript can't read it | injected scripts stealing it (XSS) |
| secure | https only (production) | snooping on public Wi-Fi |
| sameSite: strict | sent only from our own site | other sites using the cookie (CSRF) |
| path: /api/v1/auth | sent only to auth routes | needless exposure |

---

## Cross-cutting 3: Search pipeline (LOCKED)

`GET /api/v1/search?q=&lat=&lng=&filters…` (optionalAuth)

1. **Cache check** (Redis) — hit → skip to step 7
2. **Understand (AI):** sentence → JSON filters `{ dish, spice, maxPrice, area, openNow, mood, mealTime, diet, vibe }`; Zod-validated; sentence→filters cached 24 h; Gemini → OpenAI → keyword parser (pg_trgm + simple rules). UI-picked filters override the AI's guess.
3. **Resolve:** dish text → dishMatcher → standard_dish_ids · area name → areas pin (else user location) · vibe ("cozy") → embedding (only if present)
4. **Find candidates (one SQL):** places within 3 km (GiST), not closed/deleted + menu_items of dish with price filter + menu_item_stats + place_stats (tags) + opening_hours (open now) + review-embedding similarity (only if vibe) → up to ~200
5. **Relax if < 3 results**, one step at a time with a note: radius 3→6 km → price +20% → drop open-now → drop mood tag. **Never relaxed: diet, foods to avoid.**
6. **Rank (code, rankingService), weights in config:** dish score 40% · distance 20% · mood/tag fit 15% · taste match 10% · vibe 10% · open/time 5%
7. **Personalise (logged in only):** "Match for you %", taste-match weight; **diet + foods-to-avoid auto-applied** with a "Show all" toggle
8. **Reason (code template):** "Chicken Dum Biryani 4.6★ (80) · Spicy · ₹220 · 1.2 km · Open till 11 PM" → top 20 + relax note

**Traps handled**
- Cache stores only **non-personal** results (steps 2–6); personalisation added after reading cache — no one sees another user's Match %.
- Cache key rounds location to a **~500 m grid** (otherwise every GPS point is a new key).
- Diet / foods-to-avoid never relaxed.

---

## Cross-cutting 4: Socket.IO events — group mode (LOCKED)

Room per group: `group:<code>`. State in Redis via `groupLiveRepo`. Status: `joining → choosing → voting → done`.

**Phone → server**
| Event | Who | Data |
|---|---|---|
| group:join | everyone | code (token sent at connect) |
| group:set_preferences | everyone | mode (profile / for now), diet, spice, budget, cuisines, avoid, strict flags, location (optional) |
| group:set_location | creator | picked spot or "use midpoint" |
| group:start_suggestions | creator | – |
| group:vote | everyone | placeId (re-vote replaces old vote) |
| group:finish | creator | optional placeId (override) |
| group:leave | everyone | – |

**Server → everyone in the room**
| Event | When |
|---|---|
| group:state | after ANY change — **full snapshot** of the group (members, ready, location, status, vote counts) |
| group:suggestions | top 3–5 places + reasons |
| group:result | winner chosen → history saved to Postgres |
| group:error | e.g. "Only the creator can do this" |

**Rules / traps handled**
- **Full snapshot, not small "something changed" events** — every phone always gets the complete picture, so it can never drift out of sync (missed messages don't matter).
- **Reconnect** (phone locked / network drop) → auto re-join room → fresh `group:state` (state is in Redis, not server memory).
- **Votes stored as member → place** → re-vote overwrites, no double voting.
- **groupService does NOT call searchService** (feature → feature). Both use `placeRepo.findCandidates()` + `rankingService` (helper).
- **Max 10 members** (config).
- **Creator leaves / phone dies** → next member by join order becomes creator automatically.
- **Voting ends automatically when everyone has voted**; creator can also end early. Tie → higher match score wins; creator can override.
- **"Get suggestions" allowed once ≥ 2 members are ready** (added in frontend design); members not ready use their taste profile (guests: no preferences).

---

## Cross-cutting 5: Caching, rate limits, AI safety (LOCKED)

### Caching (Redis via cacheRepo)
| What | Key | TTL | Notes |
|---|---|---|---|
| Search results (non-personal) | search:<hash(query + filters + 500 m grid)> | 10 min | personalisation added after |
| Sentence → AI filters | parse:<hash(sentence)> | 24 h | saves Gemini calls |
| Text → embedding | embed:<hash(text)> | 7 days | saves Gemini calls |
| Meta lists | meta:<name> | 24 h | cleared when admin edits |
| Config | config:all | 5 min | cleared when admin edits |
| Place page (public part) | place:<id> | 5 min | matches stats refresh |

Never cached: anything personal (journal, wishlist, notes, profile, "your rating").

### Rate limits (Redis counters; per user if logged in, else per IP) → 429 + retry-after
| Route | Logged in | Guest (per IP) |
|---|---|---|
| All API | 120/min | 300/min |
| /search | 20/min | 60/min |
| /auth/* | – | 20/min |
| Ratings, reviews, photos, reports | 30/hour | – |
| Add place | 5/day | – |
| Create group | 10/hour | 10/hour |
| Socket events | 5/sec per connection | same |
All are config values.
- **Trap handled:** hostels/colleges share one IP → generous per-IP guest limits, strict per-user limits (all writes need login anyway).

### AI safety
- 5 s timeout, retry once, then fallback
- Chat: Gemini → OpenAI → keyword · Embeddings: Gemini → keyword
- Daily Gemini call counter in Redis → switch to fallback before hitting the free-tier limit
- Never send private data (notes, emails, names) in prompts

---

## Architecture: COMPLETE ✅
Next: **Frontend design** (new doc `05_frontend_design.md`). Per-layer files: `backend_layers/` folder → then phase-wise implementation plan.
