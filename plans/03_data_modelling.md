# Khaozo (Food Discovery App) — Data Modelling (v1)

> Status: **COMPLETE** (Steps 1–10) · Next: Architectural design
> Last updated: 1 Oct 2026
> Related: `01_brainstorming.md`, `02_tech_stack.md`

---

## Process (agreed)

1. Entities
2. Attributes
3. Relationships (1:1, 1:N, M:N) + ER diagram
4. Normalization check (no fact stored twice)
5. Tables
6. Primary keys + foreign keys
7. Constraints (NOT NULL, UNIQUE, CHECK)
8. Indexes
9. Stored vs calculated + delete rules
10. Test with real queries (key screens)

---

## Step 1: Entities (LOCKED)

| Group | Entities (PostgreSQL) |
|---|---|
| People | User, Taste profile, Login session (refresh token) |
| Location | Area, Place, Opening hours, Place confirmation, Place report *(added in Step 2)* |
| Food | Cuisine, Dish category, Main ingredient *(added in Step 2)*, Standard dish, Menu item |
| Contributions | Dish rating, Place review, Photo, Tag, Place tag vote |
| Personal | Wishlist item, Private note |
| Group mode | Group session, Group session member |
| System | Config setting |

**Group mode — live data in Redis only (few hours, not Postgres tables):** Group member, Member preferences, Group suggestion, Group vote.

### Decisions
- **Taste profile** = separate entity (1:1 with User; big and updated often by background jobs).
- **Private note** = its own entity (can be about a place or a dish, even before rating).
- **No Visit entity.** Dish ratings and place reviews stand alone. Journal groups records by same place + **3-hour time gap** (gap > 3h = new card).
- **One Tag entity with a type**: `mood` (Date, Work…) or `meal_time` (Breakfast, Dinner…). Same logic (auto + user votes, shown after 3+ agree).
- **Group history:** save session + winning place + which logged-in users were in it. Guests are never saved (guest pass = temporary token).

### Not entities (calculated, not stored)
Food journal (= user's ratings by date), My Stats, distance, search results, visit grouping.

### Parked for later steps
- ~~Place review spam rule~~ → resolved in Step 2 (one current review per place, like dish ratings)
- Primary key type (BIGINT vs UUID) → Step 6
- Fixed lists (TEXT + CHECK vs lookup table) → Step 7
- Delete rules (account deletion, soft delete) → Step 9

---

## Step 2: Attributes (in progress)

### Auth change
- **v1 = Google login only.** Email + password dropped (would need an email service for verification + password reset; password/JWT/bcrypt flows already learned in earlier projects). bcrypt removed from stack. Account-linking question no longer applies.

### User (draft)
id · name · email · google_id · avatar_url · role (user / admin) · trust_score · journal_visibility (public / private) · created_at · updated_at
→ **User LOCKED.**

### Taste profile (LOCKED)
user_id · diet (never learned — only the user sets it) · spice_quiz / spice_learned / spice_locked · sweet_quiz / sweet_learned / sweet_locked · oiliness_learned / oiliness_locked (no quiz question) · budget_quiz / budget_learned / budget_locked · favourite_cuisines · foods_to_avoid · quiz_done · ratings_used · created_at · updated_at

- **Store both quiz and learned values**; app blends them (few ratings → trust quiz, many → trust learned).
- **User edit wins permanently**: editing a field sets `<field>_locked = yes`, background jobs stop changing it.
- ~~Foods to avoid = dish categories~~ → **changed: foods to avoid = main ingredients** (Chicken, Mutton, Fish, Prawn, Egg, Paneer, Mushroom…). Reason: Prawn Biryani sits in category "Biryani", not "Seafood", so category-based avoiding fails.

### Login session (LOCKED)
id · user_id · token_hash · replaced_by · device_info · expires_at · revoked_at · created_at

- Stores **refresh tokens only** (hashed, like passwords). Access token = JWT, 15 min, never stored. Google ID token = used once at login, never stored.
- **Rotation + reuse detection:** every refresh gives a new refresh token and marks the old one used (`replaced_by`). If a used token comes back → it was stolen → revoke all of the user's sessions.
- **Multi-device:** one row per device + "log out of all devices".

### Area (LOCKED)
id · name · location (centre point)

- **One centre pin per area** (not a boundary shape). A place's area = nearest pin. Can be slightly off near borders; fine for v1. Pins copied from OpenStreetMap (~100 localities).

### Place (LOCKED)
id · name · location · address · area_id · place_type (restaurant / cafe / dhaba / bakery / street_stall / sweet_shop) · diet_type (pure_veg / non_veg / both) · price_level (1–4, ₹–₹₹₹₹) · phone · cuisines · source (osm / foursquare / user) · source_ref · added_by · status (unverified / verified / closed) · verified_at · created_at · updated_at

- **Price = price level ₹–₹₹₹₹** (rough, set by adder/admin; imports start empty). "Dish under ₹250" uses Menu item price, not this.
- **Closed places**: status `closed` → hidden from search, ratings + journal entries kept. Users report "permanently closed", admin confirms.
- Facilities (Wi-Fi, AC, parking, noise…) NOT stored on place → come from place reviews (majority answer, calculated).

### Place report (NEW entity, added in Step 2 — LOCKED)
id · place_id · reported_by · reason (closed / not_found / wrong_location / wrong_hours / wrong_info / duplicate) · details · suggested_change · duplicate_of (place, only for "duplicate") · status (pending / accepted / rejected) · reviewed_by · reviewed_at · created_at

- Found while designing Place: "users report closed, admin confirms" needed somewhere to store reports. Gives admin a review queue.

### Opening hours (LOCKED)
place_id · day (0–6) · opens_at · closes_at

- **Two shifts** → 2 rows for the same day.
- **After midnight** → closes_at earlier than opens_at = next day (e.g. 18:00–02:00).
- **Unknown** → no rows → "Hours not known"; excluded from "open now", still in normal search.
- **Editing:** anyone can add hours if none exist; changing existing hours = Place report (wrong_hours) → admin approves.

### Place confirmation (LOCKED)
place_id · confirmed_by · weight · created_at

- "Yes, this place exists" vote (no stars). Verified when sum of weights ≥ threshold (5, config).
- **Weight saved at the moment of confirming** (snapshot of trust); total = simple sum, never recalculated.
- **New accounts count less** (example config: new 0.5 / normal 1.0 / trusted 2.0 — exact numbers decided in derived-data step). Stops 5 fake accounts verifying a fake place.
- Adder can't confirm own place; one confirmation per user per place; "doesn't exist" = Place report (not_found).
- Trust weighting works the same way in dish ratings and place reviews (weighted average): trusted users don't silence new users, but many fresh accounts can't overpower a few long-standing honest ones.

→ **Location group complete.**

### Cuisine (LOCKED)
id · name (Odia, North Indian, South Indian, Mughlai, Chinese, Continental, Street food, Bakery & desserts…)

### Dish category (LOCKED)
id · name (Biryani, Momos, Dosa, Rolls, Thali, Chhena sweets…)
- Category = dish type only. **Cuisine sits on the standard dish**, not the category (Odia Thali vs North Indian Thali share category "Thali").

### Main ingredient (NEW entity, added in Step 2 — LOCKED)
id · name (Chicken, Mutton, Fish, Prawn, Egg, Paneer, Mushroom…)
- One main ingredient per standard dish. Used for "foods to avoid".

### Standard dish (LOCKED)
id · name · category_id · cuisine_id · main_ingredient_id (optional) · diet (veg / egg / non_veg) · ~~aliases~~ (moved to dish_aliases table in Step 4) · embedding (vector) · status (active / pending_review) · created_by · created_at · updated_at

- **Aliases stored** ("chkn biryani", "dum biryani"…): keyword fallback works when AI is down; every user-confirmed spelling is added as a new alias.
- **Diet = own column** (not derived from main ingredient — Dal has none).
- **Embedding** = dish name as numbers; pgvector finds closest dish for auto-match.

### Menu item (LOCKED)
id · place_id · standard_dish_id · name · price (optional, full plate) · ai_summary · summary_updated_at · added_by · status (active / removed) · created_at · updated_at

- **Price = one column, overwritten** with latest price. History lives in dish ratings' "price paid" — no price-history table.
- **Variants allowed**: a place can have several menu items for the same standard dish (Special ₹280 / Regular ₹200), each rated separately; search shows the better-rated one.
- Half/full plates not modelled in v1.
- Average rating + Must order / Mixed reviews label → stored vs calculated decided in Step 9.

→ **Food group complete.**

### Dish rating (LOCKED)
id · user_id · menu_item_id · stars (req) · would_order_again (req) · taste · portion · value · spice (mild / medium / spicy / very_spicy) · sweetness · oiliness (low / medium / high) · review_text · price_paid · is_current · created_at · updated_at

- **No place_id** — place comes through menu item (same fact never stored twice).
- **Re-rating after 30 days:** old rating kept as history (journal), `is_current = no`; only the latest counts in rankings. One person, one vote per dish.
- **Trust weight = always the user's current trust** (not a snapshot). If a spammer's trust drops, all his old ratings shrink automatically. (Different from place confirmation, which snapshots.)

### Place review (LOCKED)
id · user_id · place_id · stars (req) · vibe · looks · service_speed · staff · hygiene (1–5, optional) · noise (quiet / moderate / loud) · wifi · plug_points · ac · washroom (yes/no) · bike_parking · car_parking (yes/no) · accepts_cash · accepts_upi · accepts_card (yes/no) · crowd (empty / okay / packed) · review_text · text_embedding (vector, added in Step 10) · is_current · created_at · updated_at

- **Payment and parking = tick every option available** (one yes/no column each). No "cash assumed" — some cafés are cashless. Nothing ticked for parking = no parking.
- **Spam rule (resolves parked item):** one current review per user per place, same as dish ratings. Edit anytime; fresh review after 30 days (old kept as history, only latest counts). One person, one vote per place.
- Mood / meal-time tags NOT here → Place tag vote.

### Photo (LOCKED)
id · url · cloudinary_public_id · ~~uploaded_by~~ (removed in Step 4) · dish_rating_id · place_review_id · place_id · created_at

- Photo can belong to a dish rating, a place review, or a new place → **three separate columns, exactly one filled** (DB can check the parent really exists via foreign key). Rejected: generic owner_type + owner_id (DB can't check), three photo tables (duplication).
- `cloudinary_public_id` needed to delete the file from Cloudinary (account deletion).
- Max 3 photos per rating/review, 5 MB each (enforced in code).

### Tag (LOCKED)
id · name · type (mood / meal_time)
- mood: Work, Study, Date, Family, Friends, Solo, Quick bite, Late night, Celebration, Budget
- meal_time: Breakfast, Lunch, Evening snacks, Dinner, Late night

### Place tag vote (LOCKED)
place_id · tag_id · user_id · source (user / auto) · created_at
- Two ways to vote: **user ticks** "Good for: …" in the review, or **code rules (not AI)** read tick-box answers / rating time (quiet + Wi-Fi + plugs → Work; dish rated 7–11 AM → Breakfast).
- **Auto guesses saved as votes** in the same table (`source = auto`) → one simple count.
- One vote per user per tag per place. Tag shown after 3+ votes.

→ **Contributions group complete.**

### Private note (LOCKED)
id · user_id · place_id · menu_item_id (exactly one filled) · text · created_at · updated_at
- Only the owner can ever see it.

### Wishlist item (LOCKED)
id · user_id · place_id · menu_item_id · standard_dish_id (exactly one filled) · tried_at · created_at
- Can save a **place**, a **specific menu item**, or a **standard dish** ("want to try Chhena Poda" → app shows best place near you).
- When the user rates a wishlisted dish → **auto-marked "Tried ✅"** (`tried_at` set), stays in the list.

→ **Personal group complete.**

### Group mode — live in Redis (auto-expire 4h, key `group:<code>`)
creator · status (joining / choosing / voting / done) · location · members [id, name, is_guest, location (optional, for midpoint — added in Step 10), mode (profile / for_now), diet, spice, budget, cuisines, avoid, strict flags] · suggestions [place, match %, reason] · votes [member → place]

### Group session (Postgres, LOCKED)
id · code · created_by · location_label · location · winning_place_id · guest_count · started_at · ended_at
- **Saved only when a winner is picked**; expired/abandoned sessions are not saved.
- `guest_count` → "Went to Tarini with 3 friends" without storing guests.
- **Tie in voting → higher match score wins**; creator can override.

### Group session member (Postgres, LOCKED)
group_session_id · user_id · joined_at (logged-in members only)

→ **Group mode complete.**

### Config setting (LOCKED)
key · value · description · updated_by · updated_at
- Business rules live in a **DB table** (admin can change instantly, no redeploy), cached in Redis.
- **Secrets stay in `.env`** (Gemini/OpenAI keys, JWT secret, Cloudinary keys) — never in the DB.
- Initial keys: place_verify_threshold (5) · trust weights new/normal/trusted (0.5 / 1.0 / 2.0) · min_ratings_for_label (5) · must_order (≥4★ & ≥70%) · mixed_reviews (≤2.5★ or <40%) · rerate_after_days (30) · journal_gap_hours (3) · tag_min_votes (3) · summary_refresh_every (5) · group_expiry_hours (4)

---

## Step 2: Attributes — COMPLETE ✅
Next: Step 3 — Relationships + ER diagram.

---

## Step 3: Relationships (in progress)

**Rule:** ask "one A has how many B?" and "one B has how many A?" → 1:1, 1:N or M:N. M:N always needs a middle table.

**1:1** — User → Taste profile

**1:N**
- User → login sessions, dish ratings, place reviews, photos, place reports, private notes, wishlist items, places added, group sessions created
- Area → places
- Place → opening hours, menu items, place reviews, photos, place reports
- Dish category / Cuisine / Main ingredient → standard dishes
- Standard dish → menu items
- Menu item → dish ratings
- Dish rating / Place review → photos

**M:N (middle tables)**
| Relationship | Middle table |
|---|---|
| User ↔ Place (confirmations) | place_confirmations (already an entity) |
| User ↔ Place ↔ Tag | place_tag_votes (already an entity) |
| User ↔ Group session | group_session_members (already an entity) |
| Place ↔ Cuisine | **place_cuisines** (new) |
| Taste profile ↔ Cuisine (favourites) | **taste_profile_cuisines** (new) |
| Taste profile ↔ Main ingredient (avoid) | **taste_profile_avoid** (new) |

- **Middle tables, not array columns** — DB can check every ID exists; easy to query "all users who like Odia food".
- Lesson: confirmations and tag votes were really M:N middle tables carrying extra data (weight, source).

→ **Step 3 COMPLETE.** ER diagram: `er_diagram.png` / `er_diagram.mermaid` (this folder).

---

## Step 4: Normalization check (COMPLETE ✅)

Rules: **1NF** one value per cell (no lists) · **2NF** with a two-column key, every column depends on both · **3NF** no column depends on another non-key column.

**Fixes**
- **`aliases` list broke 1NF** → new table **dish_aliases** (alias · standard_dish_id). One row per spelling; DB enforces one spelling → one dish.
- **`photos.uploaded_by` was duplicated** (parent rating / review / place already knows the user) → removed; owner found through the parent.

**Accepted on purpose**
- `standard_dishes.diet` + `main_ingredient_id` overlap (Dal has no main ingredient). Code blocks nonsense like Chicken + veg.

**Calculated values currently stored → decide in Step 9**
places.area_id · users.trust_score · taste profile *_learned · wishlist_items.tried_at · menu_items.ai_summary

All other tables pass 1NF/2NF/3NF.

---

## Step 5: Tables (COMPLETE ✅)

**27 tables**
| Group | Tables |
|---|---|
| People (5) | users · taste_profiles · taste_profile_cuisines · taste_profile_avoid · login_sessions |
| Location (6) | areas · places · place_cuisines · opening_hours · place_confirmations · place_reports |
| Food (6) | cuisines · dish_categories · main_ingredients · standard_dishes · dish_aliases · menu_items |
| Contributions (5) | dish_ratings · place_reviews · photos · tags · place_tag_votes |
| Personal (2) | private_notes · wishlist_items |
| Group (2) | group_sessions · group_session_members |
| System (1) | config_settings |

**Conventions**
- Table names plural snake_case; columns snake_case
- `created_at` on every table, `updated_at` on editable ones — `TIMESTAMPTZ` (stored UTC, shown IST)
- Money = `INTEGER` rupees · Location = `GEOGRAPHY(Point, 4326)` · Yes/no = `BOOLEAN` · Stars = `SMALLINT` · Embedding = `vector(768)`
- Text = `TEXT` + length rules via CHECK (Step 7), not VARCHAR(n)

---

## Step 6: Primary keys + foreign keys (in progress)

### Primary keys (LOCKED)
- Type: **BIGINT auto-number** (`GENERATED ALWAYS AS IDENTITY`). Public data is public anyway; private data protected by auth; group join uses its own random `code`.
- Middle tables use a **composite PK** (blocks duplicates for free).

| PK | Tables |
|---|---|
| `id` (BIGINT) | users · login_sessions · areas · places · opening_hours · place_reports · cuisines · dish_categories · main_ingredients · standard_dishes · menu_items · dish_ratings · place_reviews · photos · tags · private_notes · wishlist_items · group_sessions |
| Composite | place_cuisines (place_id, cuisine_id) · taste_profile_cuisines (user_id, cuisine_id) · taste_profile_avoid (user_id, main_ingredient_id) · group_session_members (group_session_id, user_id) · place_confirmations (place_id, confirmed_by) · place_tag_votes (place_id, tag_id, user_id) |
| Natural key | taste_profiles (user_id) · config_settings (key) · dish_aliases (alias) |

- place_confirmations PK (place + user) = the "one confirmation per user per place" rule, enforced by the DB.

### Foreign keys (LOCKED) — "(opt)" = can be empty
- **People:** taste_profiles.user_id → users · taste_profile_cuisines.user_id → taste_profiles, cuisine_id → cuisines · taste_profile_avoid.user_id → taste_profiles, main_ingredient_id → main_ingredients · login_sessions.user_id → users, replaced_by → login_sessions (opt, self-reference)
- **Location:** places.area_id → areas, added_by → users (opt) · place_cuisines.place_id → places, cuisine_id → cuisines · opening_hours.place_id → places · place_confirmations.place_id → places, confirmed_by → users · place_reports.place_id → places, reported_by → users, duplicate_of → places (opt), reviewed_by → users (opt)
- **Food:** standard_dishes.category_id → dish_categories, cuisine_id → cuisines, main_ingredient_id → main_ingredients (opt), created_by → users (opt) · dish_aliases.standard_dish_id → standard_dishes · menu_items.place_id → places, standard_dish_id → standard_dishes, added_by → users (opt)
- **Contributions:** dish_ratings.user_id → users, menu_item_id → menu_items · place_reviews.user_id → users, place_id → places · photos.dish_rating_id / place_review_id / place_id (opt, exactly one) · place_tag_votes.place_id → places, tag_id → tags, user_id → users
- **Personal / Group / System:** private_notes.user_id → users, place_id / menu_item_id (opt, exactly one) · wishlist_items.user_id → users, place_id / menu_item_id / standard_dish_id (opt, exactly one) · group_sessions.created_by → users, winning_place_id → places · group_session_members.group_session_id → group_sessions, user_id → users · config_settings.updated_by → users (opt)

Patterns: **self-reference** (login_sessions.replaced_by) · **two FKs to the same table** (place_reports.place_id + duplicate_of).

⚠️ For Step 9: user_id is part of the PK in place_tag_votes and place_confirmations → can't be anonymised (PK can't be empty) → account deletion must delete those rows.

→ **Step 6 COMPLETE.**

---

## Step 7: Constraints (COMPLETE ✅)

- **Fixed small lists = `TEXT` + `CHECK (x IN (...))`**, not Postgres ENUM. Growing lists are their own tables (cuisines, tags, categories, main ingredients).
- **Exactly-one-parent** (photos, private_notes, wishlist_items): `CHECK (num_nonnulls(...) = 1)`.
- **One current rating/review**: partial unique index `UNIQUE (user_id, menu_item_id) WHERE is_current` (dish_ratings) and `UNIQUE (user_id, place_id) WHERE is_current` (place_reviews).
- **Same-row conditional rule**: place_reports `CHECK (reason <> 'duplicate' OR duplicate_of IS NOT NULL)`.

| Table | Rules |
|---|---|
| users | email, google_id UNIQUE NOT NULL · role ∈ (user, admin) default user · trust_score ≥ 0 default 1.0 · journal_visibility default **private** |
| taste_profiles | diet CHECK · spice 1–4 · sweet 1–3 · budget 1–4 · *_locked, quiz_done default false |
| login_sessions | token_hash UNIQUE · expires_at NOT NULL |
| areas | name UNIQUE |
| places | name NOT NULL ≤ 150 · location NOT NULL · place_type / diet_type / status CHECK · status default unverified · price_level 1–4 · UNIQUE (source, source_ref) |
| opening_hours | day 0–6 · opens_at ≠ closes_at |
| place_reports | reason / status CHECK · status default pending · duplicate rule above |
| cuisines, dish_categories, main_ingredients, standard_dishes | name UNIQUE |
| tags | UNIQUE (name, type) · type CHECK |
| dish_aliases | alias = lower(alias) |
| menu_items | price > 0 · status CHECK default active |
| dish_ratings | stars 1–5 NOT NULL · would_order_again NOT NULL · optional scores 1–5 · spice / sweetness / oiliness CHECK · price_paid > 0 · review_text ≤ 1000 |
| place_reviews | stars 1–5 NOT NULL · optional scores 1–5 · noise / crowd CHECK · review_text ≤ 1000 |
| place_tag_votes | source ∈ (user, auto) |
| private_notes | text NOT NULL ≤ 2000 |
| wishlist_items | no duplicate saves per user |
| group_sessions | code UNIQUE · guest_count ≥ 0 |
| config_settings | value NOT NULL |

**Enforced in service code (need other rows/tables, CHECK can't):** re-rate/re-review after 30 days · can't confirm own place · max 3 photos per rating/review · diet vs main ingredient sanity (no Chicken + veg).

---

## Step 8: Indexes (COMPLETE ✅)

PK and UNIQUE columns are indexed automatically; **foreign keys are NOT** in Postgres — index the ones we search by.

**B-tree:** dish_ratings (menu_item_id) · dish_ratings (user_id, created_at) · place_reviews (place_id) · menu_items (place_id) · menu_items (standard_dish_id) · places (area_id) · photos (dish_rating_id), (place_review_id), (place_id) · login_sessions (user_id) · wishlist_items (user_id) · private_notes (user_id) · standard_dishes (category_id) · place_reports (status) WHERE status = 'pending' (partial)
**GiST (spatial):** places.location · areas.location
**HNSW (vector):** standard_dishes.embedding
**GIN pg_trgm (fuzzy text, NEW):** places.name · standard_dishes.name · dish_aliases.alias — similar-spelling match for the duplicate place check and keyword fallback ("biriyani" → "biryani"), no AI needed.

---

## Step 9: Stored vs calculated + delete rules (in progress)

### Part A — Stored vs calculated (LOCKED)
| Value | Decision |
|---|---|
| places.area_id | Store — set once when place added (nearest area pin) |
| users.trust_score | Store — background job updates |
| taste profile *_learned | Store — background job updates |
| wishlist_items.tried_at | Store — set when user rates the item |
| menu_items.ai_summary | Store — LLM call is slow + costs money |
| places.status (verified) | Store — flipped when confirmation weights reach threshold |
| Journal, My Stats | Calculate live (per user, small, indexed) |
| Search results | Redis cache, 10 min |
| **Ranking numbers** | **Materialized views**, refreshed every ~5 min by a BullMQ job |

**Materialized views (NEW concept):** a saved query result, stored like a table, refreshed with `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
- `menu_item_stats` — weighted Bayesian average (current trust), rating count, % would order again, label (must order / mixed / none), typical_spice / typical_sweetness / typical_oiliness (majority of ratings — added in Step 10)
- `place_stats` — average stars, facilities majority (Wi-Fi, AC, parking, payment…), tags with 3+ votes
- Trade-off accepted: a new rating appears in rankings up to ~5 min later. All ranking maths lives in one SQL file.

### Part B — Delete rules (LOCKED)
FK options: **CASCADE** (delete children) · **SET NULL** (keep row, empty pointer) · **RESTRICT** (block delete).

**Account deletion (DPDP — real erasure)**
| Data | Rule |
|---|---|
| users row | deleted |
| taste_profiles, taste_profile_cuisines, taste_profile_avoid | CASCADE |
| login_sessions, private_notes, wishlist_items | CASCADE |
| photos | deleted (code also removes from Cloudinary) |
| dish_ratings, place_reviews | SET NULL user_id → anonymous; **review_text deleted**, numbers kept (rankings intact, nothing identifying) |
| place_tag_votes, place_confirmations | CASCADE (user_id is in the PK); places stay verified because status is stored |
| places.added_by, menu_items.added_by, standard_dishes.created_by | SET NULL |
| place_reports.reported_by / reviewed_by, group_sessions.created_by, config_settings.updated_by | SET NULL |
| group_session_members | CASCADE (history row stays, she's not named) |

**Lookup tables** (cuisines, dish_categories, main_ingredients, tags): RESTRICT.

**Admin removals:** **soft delete** (`deleted_at` column) on places, place_reviews, dish_ratings — hidden everywhere, restorable. Menu items use status `removed`; closed places use status `closed`.

→ **Step 9 COMPLETE.**

---

## Step 10: Test with real screens (COMPLETE ✅)

| Screen | Tables used | Result |
|---|---|---|
| "Spicy chicken biryani near KIIT under ₹250, open now" | areas → places (GiST) → dish_aliases / pg_trgm / embedding → menu_items → menu_item_stats → opening_hours | ✅ after fix 1 |
| Place page (Tarini) | places · place_stats · opening_hours · photos · menu_items · menu_item_stats · ai_summary | ✅ |
| Rate a dish not on the menu | match → menu_items (or pending standard dish) → dish_ratings (old is_current = false) → photos → wishlist tried_at → background jobs | ✅ |
| Journal | dish_ratings + place_reviews by user, grouped by 3-hour gap (window function `LAG()`) | ✅ |
| Group mode with midpoint | Redis members → ST_Centroid | ✅ after fix 2 |
| "Cozy café to study" | tags (study) + review embeddings (cozy) | ✅ after fix 3 |
| Admin queue | place_reports (pending) · standard_dishes (pending_review) · places (unverified) | ✅ |

**Gaps found and fixed**
1. **Dish character missing** ("spicy", "Match for you %") → `menu_item_stats` gets typical_spice / typical_sweetness / typical_oiliness.
2. **Midpoint needs member locations** → Redis group member gets optional `location`.
3. **Meaning search had no review embeddings** → `place_reviews.text_embedding` (vector). Deleted with the text on account deletion (SET NULL).

---

## Final summary
- **27 tables** + **2 materialized views** (menu_item_stats, place_stats) + Redis live group data
- Extensions: PostGIS · pgvector · pg_trgm
- ER diagram: `er_diagram.png` / `er_diagram.mermaid`
- **Next: Architectural design** (detailed discussion) → then phase-wise implementation plan
