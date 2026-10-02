# Khaozo (Food Discovery App) — Brainstorming & Design Decisions (v1)

> Status: Brainstorming complete · Next step: Tech stack
> Last updated: 28 Sep 2026

---

## 1. The Idea

A web app that helps people find **the right dish, at the right place, at the right time, for them** — starting with **Bhubaneswar**.

- Purpose: a personal build using backend + AI engineering skills (not a startup).
- Platform: **Web app only** (responsive). Mobile app later, only if it gets traction.
- Language: **English only** (local dish names like dahibara, chhena poda still work as dish names).

---

## 2. Market Check — What Already Exists

| App | What it does |
|---|---|
| Google Maps | Listings, ratings, reviews, "near me" search, **Ask Maps** (Gemini conversational search, global since Aug 2026) |
| Zomato / Swiggy | Dish search, delivery, dish-level ratings (delivery-focused, promoted listings) |
| District / Swiggy Dineout / Magicpin / EazyDiner | Dine-out deals, table booking, cashback |
| TripAdvisor | Tourist-focused reviews |

### Features already present (not our selling point)
- Nearby listings, map, filters (cuisine, price, rating, open now)
- Star ratings, reviews, photos, menus
- "Best X near me" lists, dish search
- Chat-style questions (Google Ask Maps)
- Booking, deals, delivery, directions, busy times

### Gaps we target
- Dish-level truth (best place for a *specific dish*, what to order / avoid)
- Context matching (mood / purpose, personal taste, time)
- Group decision making
- Unlisted street stalls / small shops
- Personal food memory (journal)

### Data reality (hard constraint)
- **Zomato / Swiggy:** no public data API; scraping violates ToS → not an option.
- **Google Places API:** place data (name, location, hours, type) + ~5 reviews/place; paid; limits on storing data.
- **Selling / integrating with Zomato, Swiggy, Google:** not realistic. The real "sell" is the builder (portfolio → jobs).
- **Our strategy:** Google Places for base place data + **our own user-contributed dish-level data** (our only real asset) + seeding by founder & friends.

---

## 3. Final v1 Feature List

### A. Basics
1. Auth — Google login only (changed during data modelling, 30 Sep 2026)
2. Place directory — Bhubaneswar (restaurants, cafés, dhabas, bakeries, street stalls)
3. Map + list view (near me, distance)
4. Place page (details, dishes, ratings, tags)
5. Filters (type, cuisine, veg/non-veg, price, distance, open now)
6. Delete my account & data (DPDP Act compliance)

### B. Unique features
7. Plain-language search
8. Dish-level ranking
9. Order / "Mixed reviews" list
10. Mood / purpose filter
11. Taste profile
12. Time-aware results
13. Group decision mode

### C. Contribution
14. Rate a dish
15. Place review
16. Add a missing place
17. Food journal

---

## 4. Detailed Design Decisions

### 4.1 Dish Rating

**Dish structure — 3 levels** (prevents ratings being split across different spellings of the same dish):

| Level | Example | Purpose |
|---|---|---|
| Category | Biryani | Broad search |
| Standard dish | Chicken Dum Biryani | Fair comparison across places |
| Menu item | "Tarini Special Chicken Biryani" at Tarini | What the user actually ate |

**Dish catalog:**
- Seed as many Bhubaneswar dishes as possible at launch.
- New dish added by user → LLM suggests a match with confidence score:
  - High confidence → auto-link
  - Low confidence → ask user "Is this the same as X?"
  - No match → create new standard dish under the right category, flagged for admin review

**What the user rates:**
- **Required:** Overall ★ (1–5) + "Would you order it again?" (Yes / No)
- **Optional quality:** Taste, Portion, Value for money (1–5 each)
- **Optional character (feeds taste profile):** Spice (mild / medium / spicy / very spicy), Sweetness (low / med / high), Oiliness (low / med / high)
- **Optional extras:** short text review, photo, price paid
- **Auto-captured:** timestamp (meal time)

**Rules:**
- One active rating per user per dish; can edit, or add a fresh one after **30 days**.
- Recent ratings weigh more.
- Trusted users weigh more.
- Ranking uses a **Bayesian average** (a dish with one 5★ rating can't beat 4.6★ from 80 people).

### 4.2 Place Review (separate from dish rating — once per visit)

- **Required:** Overall place rating ★ (1–5)
- **Optional:**
  - Vibe / ambience ★, Looks / décor ★, Service speed ★, Staff behaviour ★, Hygiene ★
  - Noise: quiet / moderate / loud
  - Wi-Fi: yes / no · Plug points: yes / no · AC: yes / no · Washroom: yes / no
  - Parking: bike / car / none
  - Payment: UPI / card / cash only
  - Crowd at visit: empty / okay / packed
  - Mood tags ("Good for: …") and meal-time tags

### 4.3 Mood / Purpose Tags

**List:** Work / laptop · Study · Date · Family outing · Friends hangout · Solo meal · Quick bite · Late night · Celebration · Budget meal

**How a place gets a tag (both methods):**
- **Auto** from place review answers (e.g. quiet + Wi-Fi + plugs → Work; good vibe + looks + quiet/moderate → Date)
- **User tags** at the end of the place review
- Tag shown only after **3+ people agree**

### 4.4 Taste Profile

**Setup quiz (~30 sec, skippable):**
1. Veg / non-veg / eggetarian
2. Spice level
3. Sweet tooth
4. Budget per meal (<₹150 / ₹150–300 / ₹300–600 / ₹600+)
5. Favourite cuisines (multi-select)
6. Foods to avoid (optional)

**Learning:** profile updates from the user's dish ratings; over time ratings count more than quiz answers.

**Usage:** "Match for you: X%" on results · personalized ranking · auto-fills group mode.

**User control:** users can **see and edit** their learned profile.

### 4.5 Time-Aware (v1)

- **Open now / closing soon / opens at …** (Google hours, or user-added for small stalls)
- **Meal-time tags:** Breakfast · Lunch · Evening snacks · Dinner · Late night
  - Auto from rating timestamps + user tags in place review
- **v2:** dish availability by time, best time to visit
- **Not doing:** live crowd levels (data unavailable)

### 4.6 Plain-Language Search

**Flow:**
1. LLM converts the sentence into structured filters (dish, spice, budget, area, time, mood)
2. Database finds matching places
3. Ranking: dish rating + taste match + distance + mood fit + time
4. Results shown with a **short reason** (e.g. "Biryani 4.6★ by 80 people, spicy, ₹220, 1.2 km, quiet")

**Rules:**
- **English only**
- If nothing matches → **relax filters** and show close results with a note ("No match under ₹250, here are options under ₹300")
- If AI fails / is slow → fall back to keyword search
- Filters panel always available

### 4.7 Order / "Mixed Reviews" List

| Label | Rule |
|---|---|
| ✅ Must order | ≥ 4★ **and** ≥ 70% "would order again" |
| ⚠️ Mixed reviews | ≤ 2.5★ **or** < 40% "would order again" |
| No label | Everything in between |

- Minimum **5 ratings** before any label.
- Thresholds are **config values**.
- **AI one-line summary** per labelled dish from text reviews; refreshed every **5 new reviews**.
- Place page shows top **3** must-order + up to **2** mixed-reviews dishes.

### 4.8 Group Decision Mode

**Flow:**
1. Creator starts a group session → shareable link / code
2. Friends join (logged-in or guest)
3. Each member sets constraints
4. App suggests top 3–5 places that suit everyone, with reasons
5. Group votes → winner picked
6. Session expires after a few hours

**Taste input:**
- **Logged-in users:** "Use my taste profile" **or** "Choose for this outing" (pre-filled from profile)
- **Guests:** "Choose for this outing" only

**Real-time:** **WebSockets**

**Conflicts:**
- Default = **preference** → lowers rank, doesn't remove
- User can mark **strict** ("can't compromise") → removes non-matching places
- Places serving both veg & non-veg get a boost

**Location:** default = **a spot the group picks** (e.g. "near Esplanade One"); option = **fair midpoint** of all members.

### 4.9 Add a Missing Place

- User adds name + pin + photo.
- **Duplicate check (only while adding a place, never while rating):** similar name **and** within ~50m → prompt "Is this the same as X?"
  - Yes → go to existing place
  - No, different → new place created
- **Verification:** trust-weighted confirmations (threshold = **5**, config value; trusted users count more) + **admin override**.
- Until verified → visible with an **"Unverified"** badge.

### 4.10 Food Journal

- **Timeline:** every rated dish auto-saved (place, date, stars, photo, note)
- **My Stats:** places tried, dishes tried, top cuisine, favourite dish, per-dish comparisons — filter **[All time | This month]** (this month = monthly summary)
- **Wishlist ("Want to try"):** save places / dishes for later
- **Private notes:** only visible to the user
- **Visibility:** user chooses **public or private**
- User can **delete account & data** anytime

---

## 5. v2 (Later)

- Bill photo verification ("Verified eater" badge) — moved for privacy reasons
- Dish availability by time
- Best time to visit (from check-in patterns)
- Overrated / underrated score
- Fake-review detection
- More cities
- Mobile app

## 6. Out of Scope

Delivery · Table booking · Payments · Live crowd levels · Non-English languages

---

## 7. Next Steps

1. **Tech stack requirements** ← next
2. Phase-wise plan
3. Build (layered: model/schema → router → validators → controller → service → repository → DB), backend first, async throughout
