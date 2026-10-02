# Routes (Router layer)

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

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
