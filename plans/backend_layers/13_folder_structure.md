# Folder structure

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

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
