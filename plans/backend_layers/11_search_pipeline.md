# Search pipeline

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

---

## Cross-cutting 3: Search pipeline (LOCKED)

`GET /api/v1/search?q=&lat=&lng=&filters…` (optionalAuth)

1. **Cache check** (Redis) — hit → skip to step 7
2. **Understand (AI):** sentence → JSON filters `{ dish, spice, maxPrice, area, openNow, mood, mealTime, diet, vibe }`; Zod-validated; sentence→filters cached 24 h; Gemini → OpenAI → keyword parser (pg_trgm + simple rules). UI-picked filters override the AI's guess.
3. **Resolve:** dish text → dishMatcher → standard_dish_ids · area name → areas pin (else user location) · vibe ("cozy") → embedding (only if present)
4. **Find candidates (one SQL):** places within 3 km (GiST), not closed/deleted + menu_items of dish with price filter + menu_item_stats + place_stats (tags) + opening_hours (open now) + review-embedding similarity (only if vibe) → up to ~200
5. **Relax if < 3 results**, one step at a time with a note: radius 3→6 km → price +20% → drop open-now → drop mood tag. **Never relaxed: diet, foods to avoid.**
6. **Rank (code, rankingService), weights in config:** dish score 40% · distance 20% · mood/tag fit 15% · taste match 10% · vibe 10% · open/time 5%
7. **Personalise (logged in only):** "Match for you %", taste-match weight; **diet + foods-to-avoid auto-applied** with a "Show all" toggle
8. **Reason (code template):** "Chicken Dum Biryani 4.6★ (80) · Spicy · ₹220 · 1.2 km · Open till 11 PM" → top 20 + relax note

**Traps handled**
- Cache stores only **non-personal** results (steps 2–6); personalisation added after reading cache — no one sees another user's Match %.
- Cache key rounds location to a **~500 m grid** (otherwise every GPS point is a new key).
- Diet / foods-to-avoid never relaxed.
