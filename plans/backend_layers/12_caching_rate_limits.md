# Caching, rate limits, AI safety

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

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
