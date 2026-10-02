# DB layer

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

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
