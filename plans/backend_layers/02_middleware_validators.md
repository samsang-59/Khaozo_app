# Middleware & Validators

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

---

## Position
- Middleware/validators sit **between route and controller**: auth check, admin check, rate limit, multer (photos), request validation.
- **Zod** for request validation (same library as AI output validation).
- Files: `middleware/` → auth.js, adminOnly.js, rateLimit.js, upload.js, errorHandler.js · `validators/` → Zod schemas per module

---

### Middleware
| Middleware | Used on | Does |
|---|---|---|
| `requireAuth` | 🔐 routes | no/invalid token → 401; rejects guest passes |
| `optionalAuth` | 🌐 routes that personalise (search, place, menu item) | token present → `req.user`; else continue as guest (no "Match %", no "your rating") |
| `adminOnly` | 👑 routes | role ≠ admin → 403 (role read from JWT; demotion takes effect within 15 min) |

---

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

---

### Error middleware (safety net)
- **Unexpected failures** (DB down, Cloudinary timeout, bugs) still throw → **one error middleware** as a safety net: logs it, replies `500`.
- Express 5 sends async errors there automatically.

### Photo uploads (multer)
- Images only, max 5 MB per photo, max 3 photos per rating/review (from `02_tech_stack.md`).
