# Repositories

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

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

### Added later: for `GET /me/contributions`
New functions in existing repositories (no new repo):
- `placeRepo.findAddedByUser(userId)` — places with status (unverified / verified / closed)
- `confirmationRepo.sumWeights(placeIds)` — progress like "3.5 / 5 confirmations"
- `dishRepo.findCreatedByUser(userId)` — dishes with status (pending_review / active)
- `reportRepo.findByReporter(userId)` — reports with status (pending / accepted / rejected)
