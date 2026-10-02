# Khaozo (Food Discovery App) — Testing Plan (v1)

> Status: LOCKED · Last updated: 2 Oct 2026
> Related: `06_phase_plan.md`, `02_tech_stack.md` (§11 Testing)

---

## Tools
| What | Tool |
|---|---|
| Test runner | Jest |
| API route tests | supertest |
| DB tests | separate test DB `food_app_test`, rebuilt from migrations, cleaned every run |
| AI calls | mocked aiAdapter (no key, no cost) |
| Photos | mocked Cloudinary |
| Group mode | socket.io-client (fake members) |
| Frontend automated | **Playwright** (key flows) |
| Frontend manual | flow checklist on a real phone |
| Auto-run | **GitHub Actions** — full backend test suite on every `git push` (set up in Phase 0) |

## Regression gate (every phase)
A phase is closed only when:
1. **All tests pass — the new phase's AND every earlier phase's** (GitHub Actions green).
2. **Postman collection** updated with the phase's routes (manual checks).
3. Committed + git tag `phase-N-done` (always a working version to go back to).

---

## Tests per phase

| Phase | Key tests |
|---|---|
| **0 Setup** | `/health` = 200 · DB + Redis connect · error middleware returns 500 in our response shape · result / reasons / caseMapper utils · GitHub Actions runs the suite |
| **1 Database** | Migrations run on a fresh test DB · constraints reject bad data (stars = 6, photo with 0 or 2 parents, two current ratings for same user + dish, duplicate source_ref, reason = duplicate without duplicate_of) · seed run twice → no duplicates · import script doesn't duplicate places |
| **2 Auth** | Google token verify (mocked) · first login creates user + empty taste profile; second login reuses the user · refresh rotates (old marked used) · reused token → all sessions revoked · reuse within 10 s → plain 401, no mass revoke · expired / revoked → 401 · requireAuth / optionalAuth / adminOnly · locked taste field not changed · ADMIN_EMAIL script sets role |
| **3 Places & dishes** | Near-me ordered by distance (fixture places with known pins) · closed / deleted places hidden · same-ish name within 50 m → 409 with candidates; `confirm_new=true` → created · confirmation weights reach threshold → verified · can't confirm own place · one confirmation per user · open-now incl. after-midnight + two shifts + unknown hours · dishMatcher alias + pg_trgm · config read from cache · report create rules |
| **4 Contributions** | Required fields (stars, would order again) · re-rate within 30 days → rejected · re-rate after 30 days → old `is_current = false` · transaction rollback if the second write fails · wishlist `tried_at` set on rating · photos: max 3, images only, 5 MB (Cloudinary mocked) · one current review per place · tag vote unique per user/tag/place · **journal: lunch + dinner same place same day = 2 cards (3-hour gap)** · stats All time / This month · `/me/contributions` |
| **5 Jobs & ranking** | Job queued only after commit · Bayesian: one 5★ rating can't beat 80 × 4.6★ · labels need ≥ 5 ratings; must-order / mixed thresholds from config · current-trust weighting (spammer's trust drops → his old ratings shrink) · new-account weight 0.5 · auto-tag rules (quiet + Wi-Fi + plugs → Work; 7–11 AM → Breakfast) · taste learning skips locked fields · expired sessions cleaned |
| **6 AI & search** | Fallback chain Gemini → OpenAI → keyword (mocked failures) · Zod rejects bad AI JSON · 5 s timeout · daily budget guard switches early · resolve steps (dish, area, vibe) · relax order: radius → price → open-now → mood · **diet + foods-to-avoid never relaxed** · **cache never leaks another user's Match %** · 500 m grid cache key · reason template text · rate limits → 429 |
| **7 Group mode** | Socket auth: access token ok, guest pass ok only for its own group · snapshot (`group:state`) after every event · re-vote overwrites · all voted → auto-end · tie → higher match score · creator leaves → next member becomes creator · "Get suggestions" only with ≥ 2 ready · reconnect → fresh snapshot · max 10 members · only finished groups saved (with members + guest_count) |
| **8 Admin & DPDP** | Normal user → 403 on admin routes · dish approve / merge moves menu items + aliases · accepted report applies the fix (closed / hours / duplicate) · config edit clears cache · **account deletion: every table follows its rule** (cascade / SET NULL / review_text removed / Cloudinary delete called) · places she helped verify stay verified |

## Frontend (Phases 9–11)

**Manual checklist (real phone, every frontend phase):**
1. Discover: search → place → dish → best-for-dish → back keeps scroll
2. Login gate: tap Rate logged out → Google → onboarding → Rate sheet opens automatically
3. Rate: 10-second rating · edit mode within 30 days · photo upload (compressed)
4. Review a place with tags
5. Add place: duplicate prompt both ways · Unverified badge
6. Group: create → guest joins with name → preferences → suggestions → vote → winner + Open in Maps · reconnect after airplane mode
7. Delete account: type DELETE → logged out
+ Reload (F5) keeps you logged in · several parallel requests after token expiry → no logout

**How phone testing works**
- **Layout only (quick, daily):** Chrome on the laptop → DevTools (F12) → device toolbar (Ctrl+Shift+M) → pick a phone size.
- **Real phone (each frontend phase):** run frontend + backend on the laptop → expose the frontend through an **HTTPS tunnel** (ngrok free static domain, or Cloudflare quick tunnel) → open that https link on the phone.
  - Why not `http://<laptop-IP>:5173` on the same Wi-Fi: phone **location only works on https** (or localhost), **Google login won't accept a raw IP** as an allowed origin, and campus Wi-Fi often blocks phone ↔ laptop connections.
  - Add the tunnel URL to Google OAuth "Authorised JavaScript origins" (a fixed ngrok domain avoids re-adding it every time).
- **How a check is done:** follow each checklist step by tapping on the phone, write ✅ / ❌ next to it; any ❌ is fixed before the phase closes.

**Playwright (automated) — key flows:** discover (search → place → dish) · rate a dish (logged in, test account) · group flow with 2 browser contexts (create, join, vote, winner). Added in Phase 11, run before launch.

## Launch (Phase 12)
Smoke test on the live URL: Google login · search · rate with photo · group with 2 phones · reload keeps login.
