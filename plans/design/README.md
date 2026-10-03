# Handoff: Khaozo frontend — "Street Sticker" design (Batches 1–3, all 22 pages)

## Overview
Khaozo is a dish-level food discovery app for Bhubaneswar (find what to order, where, rated by diners). This bundle defines the locked visual direction ("Street Sticker") and hi-fi designs for the Phase 9 core pages: Home, Search, Place, Dish, Best-for-dish, Onboarding, and the Login / Rate / Review / Report / Hours / Note sheets — each at phone (360px) and laptop (1280px).

Product/IA source of truth: the project's `plans/05_frontend_design.md` (22 pages, sheets, components) and `plans/06_phase_plan.md`. Where this README and those docs disagree on *behaviour*, the plans win; on *visuals*, this README wins.

## About the design files
The `.dc.html` files are **design references built in HTML** — they show the intended look and layout, not production code. Recreate them in the app's stack: **React (Vite) + react-leaflet + socket.io-client + Google Identity Services** (per `02_tech_stack.md`). Use real components, CSS (CSS modules, Tailwind or styled — your call), and real data from the API. Don't copy inline styles verbatim; extract them into tokens + components below.

Open the files in a browser to view (they load `support.js` from the same folder).

## Fidelity
**High-fidelity.** Colours, type, borders, shadows, radii and layout are final. Sample data (place names, prices, reviewers) is fake. Photos and map tiles are striped placeholders — replace with Cloudinary images and Leaflet + OSM tiles.

## Design tokens
### Colours
| Token | Hex | Use |
|---|---|---|
| ink | `#141210` | text, all borders, hard shadows, tab bar, dark chips |
| cream (bg) | `#FFF6E6` | app background, text on ink |
| saffron | `#FF7A1A` | header block / top bar, primary button, map pins, active tab |
| green | `#1F9D55` | MUST ORDER, Open, veg, "Yes / order again" |
| amber | `#FFC233` | MIXED REVIEWS, Match % sticker, AI-summary card, warning toast |
| card | `#FFFFFF` | cards, inputs, secondary buttons |
| muted | `#4D453D` | secondary text (also `#3D3630` for card body text) |
| placeholder-input | `#6E655C` | input placeholder text |
| mixed-row tint | `#FFF8E1` | background of a Mixed-reviews dish row |
| notice | `#FFF1C7` | "we widened the search" banner (dashed border) |
| veg-banner | `#E4F4EA` | "Showing veg + non-veg" banner |
| non-veg mark | `#C0392B` | non-veg square icon in menus |
| dashed divider | `#E3D3BA` | 2px dashed separators in menu lists |
| placeholder stripes | `#F5E3C8` / `#FFF0DA` | `repeating-linear-gradient(135deg, #F5E3C8 0 8px, #FFF0DA 8px 16px)` |
| sheet scrim | `#7D746A` | behind bottom sheets / dialogs (or ink @ ~55%) |
| map bg (placeholder) | `#F3E6D0` + grid `#E6D5B8` | only until Leaflet tiles load |

### Typography
- **Bricolage Grotesque 800** — headings, section titles, sticker labels, ratings/numbers, logo "khaozo" (lowercase). Letter-spacing −0.02em to −0.04em on large sizes.
- **Figtree 500–800** — body, buttons (800), chips (700), meta (500–600).
- **Geist Mono 400–500** — only for dev/placeholder captions. Not in production UI.
- Google Fonts: `Figtree:wght@400;500;600;700;800`, `Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800`.

| Role | Phone | Laptop |
|---|---|---|
| Hero headline | Bricolage 34/1.0 | Bricolage 64/0.95 (Best-for-dish 60, Onboarding 72) |
| Page title (place/dish) | Bricolage 30/1.0 | Bricolage 38–40/1.0 |
| Section title | Bricolage 20 | Bricolage 22–26 |
| Card title | Bricolage 16–18 | Bricolage 17–22 |
| Body / meta | Figtree 13–13.5, 500–600 | Figtree 13–15 |
| Chip | Figtree 12–13, 700 | Figtree 13, 700 |
| Sticker label | Bricolage 10–13, 800, UPPERCASE | same |
| Button | Figtree 14–16, 800 | same |

### Shape, borders, shadows
- **Every** card, chip, button, input, frame: `2px solid #141210`.
- Hard offset shadow (no blur) on *primary* things only — primary cards, primary button, search bar, active dialog: `4px 4px 0 #141210` (cards/search), `3px 3px 0 #141210` (buttons, small), `8px 8px 0 #141210` (laptop dialogs/frames). Secondary cards have no shadow.
- Radius: chips/buttons/inputs **10–12px**; cards **14–18px**; bottom sheet top **26px**; laptop dialog **22px**; sticker badges **6–8px**; tab bar **20px**.
- Stickers (Match %, OPEN TILL…, MUST ORDER on hero photo): slight `rotate(±2–3deg)`. Only these — nothing else rotates.

### Spacing
4-px based. Common gaps: 6, 8, 10, 12, 14, 16, 18, 20, 24, 28. Phone page padding 20px (16px on Search). Laptop page padding 36–48px. Card padding 12–14px phone, 14–18px laptop.

## Global layout
### Phone (≤ 767px)
- **Saffron header block** (`#FF7A1A`, 2px ink bottom border) on Home, Search, Best-for-dish: logo/back, area pill (`Patia ▾`: cream bg, 2px border, radius 999), headline, search bar (white, 2px border, radius 14, shadow 4px 4px 0).
- Detail pages (Place, Dish): full-width photo (190–210px) with 38px square icon buttons (white, 2px border, radius 12) for back / share / save; a rotated green sticker overlaps the photo's bottom edge (`bottom:-14px`).
- **Floating tab bar**: fixed 12px from left/right, 14px from bottom, height 62, ink bg, radius 20. Five items: Home · Group · **+** · Journal · Me. Labels Figtree 11/700, inactive `#A39A90`, active saffron. Centre "+" = 40×40 saffron square radius 12, ink "+" Bricolage 24. Add 100px bottom padding to page content.
- Dish page replaces the tab bar with a 2-button sticky action bar (Note | **Rate this dish**).

### Laptop (≥ 1024px)
- **Saffron top bar**, height 76, padding 0 36px: logo (Bricolage 28) · search (max 540) · nav links Home / Group / Journal (Figtree 14/800, active = 3px underline offset 6px) · `+ ADD` (ink bg, saffron text, Bricolage 14) · avatar (38px square, radius 10, cream).
- Home: the saffron block extends into a hero (headline left, search + mood chips right).
- Search & Home: **list + map side by side** (map column 420–460px, map in a 2px-bordered radius-18 card).
- Place/Dish: two columns — left 420–480px (photo, title, actions, info), right flexible (Order this, menu, ratings/reviews).
- Sheets become **centred dialogs** (width 520) over a scrim.

## Components
- **Chip** — 2px border, radius 10, padding 7×13. Default white/cream; selected = ink bg + cream text. Removable filter: "Under ₹250 ×".
- **Segmented toggle** (List / Map, Recent / With photos) — 2px border radius 10, overflow hidden, active segment ink.
- **Button** — primary: saffron, 2px border, 3px shadow, Figtree 800. Secondary: white, 2px border, no shadow. Dark: ink bg, cream text. Dashed: `2px dashed` for "+ More details", "+ Photo".
- **Place card (Home)** — white, 2px, radius 18, shadow 4px; 120px photo with bottom border; amber rotated "87% YOUR MATCH" sticker top-right; title Bricolage 18; meta line `Dish rating★ (count) · Spice · ₹price · km · Open till X`.
- **Result row (Search)** — horizontal card: 76px thumb (phone) / 180px photo column (laptop), title, % sticker, meta, optional MUST ORDER tag.
- **Dish row ("Order this")** — stacked rows in one bordered card, separated by 2px ink lines. Name (Figtree 15/800) + rating (Bricolage). Tag: green `MUST ORDER` or amber `MIXED REVIEWS` (with 1.5px ink border; row bg `#FFF8E1`) + "91% again · ₹220", optional quote.
- **Stat strip** — grid of 3–4 cells in one bordered card, cells divided by 2px ink: big Bricolage number + Figtree 11–12/700 label.
- **AI summary card** — amber bg, 2px border, 3px shadow; label "WHAT PEOPLE SAY · AI SUMMARY" (Bricolage 11).
- **Level bars** (spice 4 steps, oiliness 3, rating details 5) — row of bordered segments radius 4–8, filled saffron or ink.
- **Rank card (Best-for-dish)** — big Bricolage rank number (36 phone / 52 laptop) + info; #1 gets the shadow.
- **Banners** — veg banner (green-tint, solid border), widened-radius notice (`#FFF1C7`, dashed border).
- **Bottom sheet** — cream, 2px top border, radius 26 top, grab handle 44×5 ink; title Bricolage 26–30; primary CTA full width at bottom.
- **Star picker** — 5 equal squares 52px tall (56 laptop), radius 12; filled = saffron, empty = white with `#C9BBA6` star.
- **Toasts** — success: ink bg, cream text, saffron 4px shadow + saffron "View" link. Rate-limit: amber, border, ink shadow ("Slow down a bit"). Neutral: white bordered ("Reconnecting…").
- **Skeleton** — blocks in `#F5E3C8` / `#FBEEDB`, radius 6–12.
- **Unverified badge** — white, `2px dashed` ink, "UNVERIFIED"; confirmation progress bar (green fill in bordered track).

## Screens (see `Khaozo Batch 1 - Core.dc.html`, labelled 01–07)
1. **Home `/`** — header block ("Stop guessing. Start eating right."), search, mood chips (Late night, Date, Quick bite, Study, Work/laptop, Budget meal), "Open now near you" place cards, "Best in Bhubaneswar for…" dish tiles → `/dishes/:id`. State: location denied → area-picker card ("Where are you eating?", area chips, "Use my location").
2. **Search `/search?q=`** — query in header, removable filter chips, veg banner, widened-radius notice, count title, List/Map toggle, result rows, Load more. Laptop: list + map (pins = saffron squares; selected pin = saffron label "₹220 · 4.6★" with shadow; "Search this area" button). States: empty ("Nothing matches, even after widening" + Clear filters / Add a place), loading skeleton.
3. **Place `/places/:id`** — photo, OPEN sticker, name, meta, place rating; actions Rate a dish (primary) / Review / Note (/♡ on laptop); Order this; Full menu (+ Add menu, veg/non-veg marks, "no ratings"); Good for chips; Hours + Facilities cards; Reviews; OSM credit "© OpenStreetMap contributors" + "Report a problem". State: unverified user-added place (2 of 5 confirmations, "I've been here ✓").
4. **Dish `/menu-items/:id`** — photo + MUST ORDER sticker; name + "at {place}" link; stat strip (rating, % again, price, spice); AI summary; spice/oiliness bars; Your rating card (Edit); dark link "Best {dish} in town →"; ratings list (Recent / With photos).
5. **Best for dish `/dishes/:id`** — saffron header "BEST IN BHUBANESWAR" + dish name + "Ranked by diners · N places · N ratings"; sort chips (Best rated, Nearest, Open now, Under ₹250); ranked cards.
6. **Onboarding `/onboarding`** — full saffron screen, 6-step progress (ink filled / cream outlined), Skip, step label "2 OF 6 · TASTE", big question, single-select rows (selected = ink + ✓ + cream shadow) or multi-select chips; Back / Next. Laptop: pitch on left, cream card with step on right.
7. **Sheets** — Login (Google only, terms/privacy links), Rate quick (stars + order-again required, "+ More details") and expanded (taste/portion/value, spice, oiliness, review text, price paid, photo max 3), Review place (stars, more details, Good-for chips), Report (reasons list + detail), Hours (same every day / by day, opens/closes, closed-on days), Private note ("ONLY YOU SEE THIS", Delete / Save). Laptop dialog example for Rate.

## Interactions & behaviour
- Logged-out actions (Rate, Review, Note, Save, Add) open the **Login sheet**, then resume the action.
- Rate: overall stars + order-again are required; Save disabled until both set. "+ More details" expands in place.
- After save → success toast "Added to your journal · View". 429 → amber "Slow down a bit". Socket drop → "Reconnecting…".
- Search chips toggle filters and update the URL query; List/Map toggle on phone; laptop shows both, hovering a row highlights its pin.
- Location: ask on first visit; on deny show area picker; area pill always opens the picker.
- Sheets: drag-down / scrim tap to close on phone; Esc / ✕ on laptop. Focus trap.
- Press state for bordered buttons: translate(2px,2px) and shrink shadow to 1px (sticker "press" feel). Transitions ≤150ms ease-out.
- Responsive: phone layout < 768px, laptop layout ≥ 1024px; tablet can use the laptop layout with a narrower map column.

## Assets
None final. Photos → Cloudinary (user uploads). Map → Leaflet + OSM tiles. Icons in mocks are text glyphs (‹ ↗ ♡ ★ ✓ ✕ +); replace with one consistent icon set (e.g. Lucide/Phosphor, 2px stroke to match borders).

## Files
- `Khaozo Batch 1 - Core.dc.html` — all Batch 1 screens, states and sheets (phone + laptop).
- `Khaozo Visual Directions.dc.html` — direction exploration; **1b (phone) and 2b (laptop) are the locked look**, others are rejected options.
- `support.js` — runtime needed to open the `.dc.html` files in a browser.

- `Khaozo Batch 2 - Personal.dc.html` — 08 Journal, 09 Me, 10 Wishlist, 11 Notes, 12 Taste profile, 13 Settings, 14 Add place, 15 Public journal.
- `Khaozo Batch 3 - Group, Admin, Utility.dc.html` — 16 Group hub, 17 Join group (guest), 18 Group room (lobby, preferences sheet, voting, winner, ended, laptop voting), 19 "+" tab menu + Delete account + post-delete toast, 20 Admin (laptop), 21 Privacy (laptop) + About (phone), 22 Not found.

## Batch 3 notes
- **Group room** is one route with states driven by socket events: lobby → voting → winner, or ended. Member status stickers: READY / VOTED (green), CHOOSING (amber), JOINED / THINKING (white). Guests get a dashed avatar border.
- **Get suggestions** stays disabled (white, grey text, no shadow) until ≥ 2 members are READY. Only the host sees Get suggestions, End voting and End group.
- **Vote bars**: bordered track, leader fill saffron, others ink. Your vote = ink button with ✓. Votes update live.
- **Share on WhatsApp** uses the green token (`#1F9D55`); it's a `wa.me` link with the join URL.
- **Winner**: full saffron screen, "Open in Maps" = plain geo/maps link (no Google API).
- **Destructive red** `#B42318` is used only for Delete account (Settings row + confirm button). Confirm button enabled only when the input equals DELETE.
- **Admin** uses an ink top bar to separate it from the user app. Tabs: New places · Reports · Dish merges · Flagged photos. Possible-duplicate rows use the mixed tint `#FFF8E1`. Config values shown are examples.
- **Static pages** share one StaticPage layout: saffron header, sticky TOC (laptop) / link list (phone), body Figtree 16/1.65, max 680px. Legal copy is a draft placeholder.
