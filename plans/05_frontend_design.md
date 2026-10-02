# Khaozo (Food Discovery App) — Frontend Design (v1)

> Status: **COMPLETE** · App name: **Khaozo** · Next: Phase-wise implementation plan
> Last updated: 2 Oct 2026
> Related: `04_backend_architecture.md`, `backend_layers/`

---

## Plan (part by part)
1. Pages ✅
2. User flows ✅
3. Components ✅
4. State + API layer ✅
5. Styling / UI library ✅
6. Folder structure ✅

---

## Part 1: Pages

### Decisions locked
- **Mobile-first**, then stretched for laptop.
- **Bottom tab bar on phones** (top bar on laptop): Home · Group · Add · Journal · Me
- Login, Rate a dish, Review a place = **pop-up sheets**, not pages.

### Draft page list (before scenario check)
🌐 Home `/` · Search results `/search` · Place `/places/:id` · Dish (menu item) `/menu-items/:id` · Best places for a dish `/dishes/:id` · Public journal `/u/:id` · Join group `/g/:code` · Group room `/g/:code/room`
🔐 Onboarding quiz `/onboarding` · My journal `/journal` · Wishlist `/wishlist` · Notes `/notes` · Taste profile `/profile/taste` · Settings `/settings` · Add place `/places/new` · Group history `/groups`
👑 Admin `/admin` · Not found `*`

### Scenario check (user lifetime + group mode) → changes
- **New pages:** `/me` (Me hub: photo, name, links to taste profile, wishlist, notes, past groups, settings) · `/privacy` · `/terms` (Google login approval needs a privacy policy link; DPDP Act) · `/about` (OSM / Foursquare credits)
- **Changed:** `/groups` = **Group hub** (create group · join with code · past groups). Join page `/g/:code` asks guests for a **display name**.
- **Journal** gets a 3rd tab: **Timeline · My Stats · My Contributions** (places added + verified or not, dishes added, reports + accepted or not) → new backend route `GET /me/contributions`.
- **Small pieces (not pages):** area picker when location is denied · "Add" tab menu (Rate a dish → pick place first · Review a place · Add a missing place) · "Share on WhatsApp" in group lobby · "Open in Maps" link on group winner (plain link to the phone's maps app, no Google API) · "This group has ended" screen state · redirect back to where the user was after login/onboarding.

### Final page list (LOCKED) — 22 pages
| Who | Page | URL |
|---|---|---|
| 🌐 | Home (search bar + map/list near me, area picker if location denied) | `/` |
| 🌐 | Search results (list ↔ map) | `/search?q=` |
| 🌐 | Place page | `/places/:id` |
| 🌐 | Dish page (menu item) | `/menu-items/:id` |
| 🌐 | Best places for a dish | `/dishes/:id` |
| 🌐 | Public journal | `/u/:id` |
| 🌐 | Join group (guest name or sign in) | `/g/:code` |
| 🌐 | Group room (lobby → preferences → suggestions → voting → winner / ended) | `/g/:code/room` |
| 🌐 | Privacy policy · Terms · About | `/privacy` · `/terms` · `/about` |
| 🔐 | Onboarding quiz | `/onboarding` |
| 🔐 | My journal (Timeline · My Stats · My Contributions) | `/journal` |
| 🔐 | Me hub | `/me` |
| 🔐 | Wishlist | `/wishlist` |
| 🔐 | Notes | `/notes` |
| 🔐 | Taste profile | `/profile/taste` |
| 🔐 | Settings | `/settings` |
| 🔐 | Add place | `/places/new` |
| 🔐 | Group hub (create · join with code · past groups) | `/groups` |
| 👑 | Admin | `/admin` |
| – | Not found | `*` |

Pop-up sheets (not pages): Login · Rate a dish · Review a place · Report a place · Group preferences · Add menu.

---

## Part 2: User flows (LOCKED)

**1. Discover (no login)**
Home → search → Search results (list ↔ map) → Place page → Dish page → "Best biryani in town" → Best-for-dish page. Back button returns to the previous screen with scroll position kept.

**2. Login gate (any 🔐 action)**
Tap Rate / ❤️ / Add place while logged out → Login sheet → Google pop-up → first time? Onboarding quiz (skippable) → back to the SAME screen and the tapped action opens automatically.

**3. Rate a dish**
Dish page → Rate sheet: ★ + "Order again?" (required) → Save (~10 s). "+ More details" **folded by default** (taste, portion, value, spice, sweet, oily, text, price, photos). Saved → toast "Added to your journal" → Dish page shows "Your rating".
- From place page: pick from menu or type a new dish → "Is this Chicken Dum Biryani?" yes / no.
- Rated within 30 days → sheet opens in **edit mode**.

**4. Review a place**
Place page → Review sheet: ★ (required) → "+ More details" (folded) → "Good for:" tags → Save.

**5. Add a missing place**
Add tab → Add a missing place → map pin (starts at your location, draggable) → name, type, veg/non-veg, photo → Submit → similar place within 50 m? "Is this X?" → Yes: open X / No: create → new Place page with "Unverified" badge + "Ask friends to confirm" share.

**6. Group mode**
Group tab → Group hub → Create → Lobby (code + Share on WhatsApp) → friends join (logged in: straight in · guest: enter name) → each sets Preferences → Ready → creator sets location (spot / midpoint) → "Get suggestions" → 3–5 places with reasons → live voting → all voted (or creator ends) → Winner + "Open in Maps" → saved to Past groups.
- **"Get suggestions" enabled once ≥ 2 members are ready**; members not ready use their taste profile (guests: no preferences).

**7. Delete account**
Me → Settings → Delete account → screen explaining what is deleted / kept anonymous → **type DELETE** to confirm → logged out → Home with "Your account was deleted".

---

## Part 3: Components (LOCKED)

**Photo trap handled:** phone photos are 4–8 MB (limit is 5 MB) → `PhotoUploader` compresses in the browser before upload (~1600 px, < 1 MB) with `browser-image-compression`.

### Component list (after page-by-page check)
| Group | Components |
|---|---|
| Layout / app | AppShell (bottom tab bar / top bar) · BottomSheet · Toast · PageHeader · Tabs (also used as segmented toggle) · Skeleton · EmptyState · ErrorState · ErrorBoundary · ConnectionBanner ("Reconnecting…") · StaticPage |
| Route guards | AuthGate (login gate → resumes the tapped action) · AdminRoute |
| Search | SearchBar · FilterChips · AreaPicker (incl. location-permission explainer) · ResultCard (place + dish + reason + Match %) · ListMapToggle · RelaxNote · DietOverrideToggle ("Showing veg only · Show all") · LoadMore (pagination) |
| Map | MapView (react-leaflet) · PinPicker (draggable) |
| Place | PlaceHeader (badges, open now) · ActionBar (Rate · Review · Report · ❤️ · Note) · MenuList (items + price + LabelBadge) · MustOrderList · OpeningHours · FacilitiesList · TagChips · PhotoGallery · ReviewList · ConfirmButton |
| Dish | DishHeader (AI summary, rating, typical spice, your rating) · RatingList |
| Inputs | StarPicker · ChoiceChips · YesNoToggle · PhotoUploader (compresses) · DishPicker · PlacePicker · SameAsPrompt ("Is this X?" — dishes and duplicate places) · TasteSlider (with 🔒 lock) · JoinCodeInput · GuestNameForm |
| Sheets | LoginSheet · RateSheet · ReviewSheet · ReportSheet · HoursSheet · NoteSheet · PreferencesSheet · AddMenuSheet |
| Onboarding | QuizStepper (6 questions, skippable) |
| Journal / personal | TimelineCard · StatsTiles · ContributionItem · WishlistItem ("Tried ✅") · NoteItem · MenuLinkList (Me hub) |
| Group | MemberList · ShareButton (WhatsApp / copy link — also "Ask friends to confirm") · LocationChooser (spot / midpoint) · SuggestionCard + VoteButton · WinnerCard ("Open in Maps") · GroupEnded · GroupHistoryItem |
| Small shared | Avatar · Badge · MatchBadge · LabelBadge · WishlistHeart · ConfirmDialog (type DELETE) |
| Admin | QueueTable · ConfigEditor |

### Page → components
| Page | Components |
|---|---|
| Home | SearchBar · AreaPicker · MapView · ListMapToggle · FilterChips · ResultCard |
| Search results | SearchBar · FilterChips · DietOverrideToggle · RelaxNote · ResultCard · ListMapToggle · MapView · LoadMore · Skeleton · EmptyState |
| Place | PlaceHeader · ActionBar · MenuList · MustOrderList · OpeningHours (+ HoursSheet if none) · FacilitiesList · TagChips · PhotoGallery · ReviewList · ConfirmButton · ShareButton · Rate/Review/Report/Note sheets |
| Dish | DishHeader · RatingList · WishlistHeart · RateSheet · NoteSheet |
| Best for dish | ResultCard · LoadMore |
| Public journal | TimelineCard · StatsTiles · EmptyState (private) |
| Join group | GuestNameForm · LoginSheet |
| Group room | MemberList · ShareButton · PreferencesSheet · LocationChooser · SuggestionCard · VoteButton · WinnerCard · GroupEnded · ConnectionBanner |
| Privacy · Terms · About | StaticPage |
| Onboarding | QuizStepper |
| Journal | Tabs · TimelineCard · StatsTiles (All time / This month) · ContributionItem |
| Me | Avatar · MenuLinkList |
| Wishlist · Notes | WishlistItem · NoteItem · NoteSheet |
| Taste profile | TasteSlider · ChoiceChips |
| Settings | YesNoToggle · ConfirmDialog |
| Add place | PinPicker · ChoiceChips · PhotoUploader · SameAsPrompt |
| Group hub | JoinCodeInput · GroupHistoryItem · ShareButton |
| Admin | Tabs · QueueTable · ConfigEditor · DishPicker |
| Not found | EmptyState |

---

## Part 4: State + API layer (LOCKED)

| Kind of state | Example | Tool |
|---|---|---|
| Data from backend | places, ratings, journal | **TanStack Query** (caching, loading/error, refetch; invalidate dish + journal queries after rating) |
| Who's logged in | user, access token | **AuthContext** — access token **in memory only** |
| Screen-only | sheet open, active tab | `useState` |
| Live group data | members, votes | **useGroupRoom(code)** hook + Socket.IO (each `group:state` snapshot replaces local state) |

- **Search filters live in the URL** (`/search?q=biryani&maxPrice=250&veg=1`) — back button restores them, searches are shareable.

### API layer
- One **axios** instance: baseURL `/api/v1`, `withCredentials: true` (refresh cookie).
- Request interceptor adds `Authorization: Bearer <token>`.
- Response interceptor: **401 → single-flight refresh** (one shared refresh promise, others wait) → retry once; refresh fails → log out + open Login sheet.
- Unwraps `{ success, data }`; errors → Toast with `error.message`; 429 → "Slow down a bit".
- One API file per backend module (`places.api.js`, `ratings.api.js`, …).

### Traps handled
- **Reload logs you out** (token in memory) → on app start, silently call `/auth/refresh` (cookie survives reload).
- **Socket reconnect with expired token** → socket `auth` is a function that reads the **current** token on every (re)connect.
- **Cookies across localhost:5173 ↔ :3000** → Vite **dev proxy** `/api` → backend.
- **Guest pass** stored in **sessionStorage** (per tab, keyed by group code) so a refresh doesn't create a duplicate guest. Low risk: one group, 4 hours.

---

## Part 5: Styling / UI library (LOCKED)
- **Tailwind CSS + shadcn/ui** (Drawer = bottom sheet, Tabs, Dialog, Sonner toast) · icons **lucide-react**
- **Light mode only in v1** (dark mode later)
- **Visual design (colours, layout, look) → done separately in Claude Design** from the backend + frontend docs; chosen design handed over **before frontend implementation**.
- **Colour suggestion (input for Claude Design, not final):** saffron orange = main (buttons, badges, map pins) · green = "Must order" / veg · amber = "Mixed reviews". Warm colours suit food apps.
- **App name: Khaozo** (LOCKED, 2 Oct 2026) — from *khao* (eat). Reel hook: "Khaozo: stop guessing, start eating right." Still to do: check domain (.com / .in) + Instagram handle. Shortlist: DishWise (Claude's pick) · Khaiba (Odia, "to eat") · OrderRight · PlatePick · TasteMatch · Thaali Map — check existing apps, domain, Instagram handle before locking.

### App name check (web search, 2 Oct 2026)
- ❌ **Swaado** — taken: home-chef food platform in Belagavi (swaado.in)
- ❌ **Cravo** — taken: several food-delivery apps / app template on Play Store + App Store
- ❌ **Bhookr** — taken: meal-subscription brand in Hyderabad (bhookr.com, on Zomato)
- ❌ **Biteva** — taken: App Store apps incl. a calorie tracker
- ✅ **Khaozo** — no food app found (only an unrelated SoundCloud artist "KhaoZOfficial")
- ✅ **Chakhly** — no matches found
- 🟡 **Zaykr** — no exact match (similar: "Zaakr", "Zayka" apps)
- Still to check manually before locking: domain availability (.com / .in), Instagram handle. A web search is not a trademark check.

**→ Name LOCKED: Khaozo.**

---

## Part 6: Folder structure (LOCKED)

```
khaozo-frontend/
├─ index.html
├─ vite.config.js              ← dev proxy /api → localhost:3000
├─ tailwind.config.js · components.json (shadcn)
├─ .env                        ← VITE_GOOGLE_CLIENT_ID
└─ src/
   ├─ main.jsx                 ← starts React, TanStack Query, AuthContext
   ├─ App.jsx                  ← all routes (pages), AuthGate, AdminRoute
   ├─ api/                     ← client.js (axios + interceptors + single-flight refresh)
   │                              + one file per backend module (places.api.js, ratings.api.js, …)
   ├─ socket/                  ← socket.js (reads current token on every reconnect)
   ├─ context/                 ← AuthContext.jsx
   ├─ hooks/                   ← useAuth, useGroupRoom, useLocation, usePlace, useSearch, …
   ├─ pages/                   ← one file per page (22)
   ├─ components/
   │  ├─ ui/                   ← shadcn building blocks (Button, Drawer, Tabs, Dialog, …)
   │  ├─ layout/               ← AppShell, PageHeader, ConnectionBanner, ErrorBoundary, …
   │  └─ search/ map/ place/ dish/ inputs/ sheets/ journal/ group/ admin/ shared/
   ├─ lib/                     ← small helpers: formatPrice, timeAgo, compressImage, …
   └─ styles/                  ← index.css (Tailwind)
```

**Layer rule (mirrors the backend):** `pages → hooks → api/ → backend`
- pages = show things (like controllers, no heavy logic)
- hooks = logic (like services)
- api/ = the only place that calls the backend (like repositories)
- A page never calls axios directly.

---

## Frontend design: COMPLETE ✅
- Visual design (colours, layout, look) → **Claude Design**, page by page **during implementation**, from these docs.
- Next: **Phase-wise implementation plan** → done: `06_phase_plan.md`.
