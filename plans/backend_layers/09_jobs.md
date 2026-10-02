# Background jobs (BullMQ)

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

---

## How jobs work
```
services ─→ jobQueue helper ─→ puts a job in the BullMQ queue (Redis) → worker.js picks it up → job calls a service
```
- Services **add** jobs to the queue; jobs **run separately** (worker.js) and **call services** to do the work — same direction as sockets.
- worker.js is a separate process so slow AI/embedding jobs never slow API responses.
- **Background jobs are queued only after the transaction commits.**
- Folder: `src/jobs/` → stats, summary, embedding, tasteProfile, trust, autoTags, sessionCleanup

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
