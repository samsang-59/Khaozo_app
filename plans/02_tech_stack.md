# Khaozo (Food Discovery App) — Tech Stack (v1)

> Status: Tech stack locked · Next step: Data modelling
> Last updated: 28 Sep 2026
> Related: `01_brainstorming.md`

---

## Summary Table

| # | Part | Choice |
|---|---|---|
| 1 | Backend language + framework | **JavaScript + Node.js + Express** (async/await) |
| 2 | Database | **PostgreSQL** + **`pg`** (raw SQL) + **node-pg-migrate** + **pg_trgm** (fuzzy text match, added in data modelling) |
| 3 | Location queries | **PostGIS** |
| 4 | Vector search | **pgvector** |
| 5 | AI / LLM | **Gemini API** (primary) + **OpenAI** (chat fallback) behind an **aiAdapter** + **Zod** |
| 6 | Background jobs + cache | **Redis + BullMQ** |
| 7 | Real-time (group mode) | **Socket.IO** + live group data in **Redis** (auto-expiry) |
| 8 | Auth | **Google login only** (google-auth-library) + **JWT access + refresh tokens** + roles |
| 9 | Place data + map | **OpenStreetMap + Foursquare Open Places** (data) · **Leaflet + OSM tiles** (map) · own **areas** table |
| 10 | Photo storage | **Cloudinary + multer** |
| 11 | Testing | **Jest + supertest** + test DB + mocks + **socket.io-client** · frontend: **Playwright** + manual phone checklist · **GitHub Actions** CI |
| 12 | Local setup | **Docker Desktop + docker-compose** |
| 13 | Frontend (later) | **React (Vite)** + **react-leaflet** + **socket.io-client** + **Google Identity Services** |
| 14 | Deployment (added in phase planning) | **Railway** (API + worker + Postgres + Redis, trial credit at Phase 12) + **Vercel** (frontend, free) — local Docker until then |

---

## 1. Backend Language + Framework

- **JavaScript + Express** (familiar from the Resume Evaluator project).
- Async/await throughout.
- Layered structure: model/schema → router → validators → controller → service → repository → DB.

## 2. Database

- **PostgreSQL**: data is relational (user → rating → dish → place); one database handles normal data, location and vectors.
- **`pg` (raw SQL)**: every query written by hand (SQL learning + full control; PostGIS and pgvector queries are natural in raw SQL).
- **node-pg-migrate**: create/change tables step by step with version history (migrations in SQL).

## 3. Location Queries — PostGIS

Location add-on for PostgreSQL. Stores place locations as points, does real-Earth distance math, spatial index keeps "near me" fast.

| Need | PostGIS function |
|---|---|
| Places within X km | `ST_DWithin` |
| Distance to each place | `ST_Distance` |
| Nearest first | `ORDER BY location <-> point` |
| Duplicate check (50m) | `ST_DWithin(..., 50)` |
| Group midpoint | `ST_Centroid` |

## 4. Vector Search — pgvector

Vector database inside PostgreSQL (same role as Qdrant). Stores embeddings; finds closest match by cosine similarity (`<=>`). Can be combined with normal filters in one SQL query.

Used for:
- **Dish auto-match** ("chkn biryani" → Chicken Dum Biryani)
- **Meaning search** ("cozy" → reviews saying "warm, comfortable")

## 5. AI / LLM

### Models
- **Chat model**: text in → text/JSON out (search → filters, review summaries, dish-match confirmation).
- **Embedding model**: text in → vector out (dish matching, meaning search).

### Providers & fallback
- **Chat:** Gemini → (limit/error) → OpenAI → (both fail) → keyword search
- **Embeddings:** **Gemini only** → (fail) → keyword search
  - Reason: embeddings from different providers are different "number systems" and can't be compared. Switching the embedding provider later requires re-converting all stored vectors.
- Gemini API free tier (via Google AI Studio). Note: free-tier data may be used by Google to improve products → never send private user data in prompts. Rate limits apply.
- OpenAI API usually needs prepaid credits.
- Consumer Gemini subscription (AI Plus) ≠ API access.

### aiAdapter layer
- One file (`aiAdapter.js`) with `chat()` and `embed()`; services never call a provider directly.
- Benefits: switch provider/model in one file, easy mocking in tests, one place for timeout/retry/error handling.
- Position: `controller → service → aiAdapter → Gemini/OpenAI` (alongside `service → repository → PostgreSQL`).

### Rules
- **Zod** validates every AI JSON output before use.
- **LLM for words, code for numbers**: ranking, scores, "Match for you %", order/mixed labels are computed by code.
- **Search result reasons** use **code templates** filled with DB data (not LLM).
- Timeout + retry; keyword search fallback.

## 6. Background Jobs + Cache — Redis + BullMQ

### Background jobs (run after replying to the user)
- Refresh dish summaries (every 5 new reviews)
- Create embeddings for new dishes
- Recount mood tags & meal-time tags
- Update learned taste profiles
- Update trust scores
- Clean up expired group sessions

### Cache
- Popular search/ranking results (short expiry, e.g. 10 min)
- Search sentence → AI filters (saves AI calls)
- Rate limiting

## 7. Real-time (Group Mode) — Socket.IO

- One Socket.IO **room** per group session; auto-reconnect.
- Live group data in **Redis** with **auto-expiry** (e.g. 4 hours) → handles session expiry.
- Final result optionally saved to PostgreSQL for history.

## 8. Auth

### User types
| Type | Access |
|---|---|
| Normal user | Google login only (email + password dropped in data modelling, 30 Sep 2026) |
| Admin | Same login with `admin` role (approve places, review new dishes) |
| Guest | No account; temporary **guest pass** for one group session only |

### Pieces
- ~~bcrypt~~ — removed: v1 is Google login only (no passwords, no email service needed; every account is a verified Google account).
- **Access token** (~15 min) + **refresh token** (~7 days, httpOnly cookie).
- **google-auth-library** — Google login flow:
  1. User clicks "Sign in with Google" → picks account
  2. Google gives frontend an ID token
  3. Frontend sends it to backend
  4. Backend verifies it with google-auth-library (really from Google, for this app)
  5. Find/create user by email → issue own access + refresh tokens
- **Role guard** middleware for admin routes.

### Access rules
| Action | No login | Logged in |
|---|---|---|
| Search, filters, map | ✅ | ✅ |
| Place pages, dish rankings, order/mixed list | ✅ | ✅ |
| Join a group session (guest pass) | ✅ | ✅ |
| "Match for you %" | ❌ | ✅ |
| Rate a dish / review a place | ❌ | ✅ |
| Add / confirm a missing place | ❌ | ✅ |
| Food journal, wishlist, notes | ❌ | ✅ |

- Guests trying a login-only action see a nudge: "Sign in with Google to save this — takes 2 seconds."
- Reason ratings need login: prevents fake/spam ratings that would break trust scores and rankings.

## 9. Place Data + Map

### Why not Google
- Google Places content (names, hours, ratings, reviews) can't be stored in our DB.
- Lat/lng can only be cached for 30 days.
- Google place data must be shown on a Google map.
- Our app needs places **stored permanently** (PostGIS, duplicate check, rankings, mood tags) → Google doesn't fit.

### Chosen setup
- **Place data:** one-time import of Bhubaneswar food places from **OpenStreetMap** (via Overpass API) + **Foursquare Open Places** (open dataset) into PostgreSQL. Duplicate check merges overlaps. Users + admin fill the gaps (street stalls, small shops).
  - Show credit: "© OpenStreetMap contributors".
- **Map display:** **Leaflet + OSM tiles** (free).
- **Area names** ("near Patia", "near KIIT"): own **`areas` table** with ~100 Bhubaneswar localities + coordinates (no API calls).
- **Google:** not used in v1.

### Other providers considered
- Map display: Mapbox, MapTiler, Mappls (MapmyIndia), Ola Maps, HERE, TomTom.
- Place data that can be stored: OSM, Foursquare Open Places, Overture Maps. Most paid providers restrict storage like Google.

## 10. Photo Storage — Cloudinary + multer

- Photos are **not** stored in PostgreSQL; DB keeps only the URL.
- Flow: user picks photo → backend (multer) checks it → uploads to Cloudinary → saves URL.
- Limits: **images only**, **max 5 MB** per photo, **max 3 photos** per rating/review.
- Cloudinary auto-resizes/compresses.

## 11. Testing

| What | Tool |
|---|---|
| Test runner | Jest |
| API route tests | supertest |
| DB tests | Separate test database (`food_app_test`), cleaned every run |
| AI calls | Mock aiAdapter (fixed answers, no API key, no cost) |
| Photos | Mock Cloudinary |
| Group mode | socket.io-client (fake members join & vote) |

## 12. Local Setup — Docker

- **Docker Desktop** (one-time install on Windows) + **`docker-compose.yml`**.
- Runs **PostgreSQL (+ PostGIS + pgvector)** and **Redis** in containers.
- `docker compose up` to start, `docker compose down` to stop.
- Node.js app runs normally on Windows and connects to the containers.
- First time using Docker → set up step by step in the first build phase.

## 13. Frontend (details designed later)

- **React (Vite)**
- **react-leaflet** for the map
- **socket.io-client** for group mode
- **Google Identity Services** for the Google sign-in button

---

## Next Steps (agreed order)

1. ✅ Brainstorming (`01_brainstorming.md`)
2. ✅ Tech stack (`02_tech_stack.md`)
3. **Data modelling** ← next (detailed discussion)
4. Architectural design (detailed discussion)
5. Phase-wise implementation plan
