# Services (incl. helper services)

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

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

### Added later: `GET /me/contributions` (from frontend design, Journal → "My Contributions" tab)
No new files — one new function in each existing layer:
- route: journal routes · middleware `requireAuth` · validator: pagination (`limit`, `cursor`)
- controller: `journalController.getContributions`
- service: `journalService.getContributions(userId)` → combines the three lists below
- repositories: `placeRepo.findAddedByUser` (+ `confirmationRepo.sumWeights` for "3.5 / 5 confirmations") · `dishRepo.findCreatedByUser` (pending_review / active) · `reportRepo.findByReporter` (pending / accepted / rejected)
