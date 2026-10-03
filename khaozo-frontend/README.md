# Khaozo — frontend

React (Vite) + Tailwind CSS v4 + TanStack Query + react-router + react-leaflet + socket.io-client.
Design: "Street Sticker" (`../plans/design/` — Batch 1–3 hi-fi references + tokens README).
Plans: `../plans/05_frontend_design.md` (pages, flows, components, state, folders) and `../plans/06_phase_plan.md`.

## Run locally

1. Start the backend first (`../food-app-backend`: `docker compose up -d`, `npm run dev`; `npm run worker` for jobs).
2. Frontend:
   ```bash
   cp .env.example .env.local   # set VITE_GOOGLE_CLIENT_ID (same client ID as the backend)
   npm install
   npm run dev                  # http://localhost:5173
   ```
   Vite proxies `/api` and `/socket.io` to `localhost:3000`, so the refresh cookie works without CORS.
   In Google Cloud Console add `http://localhost:5173` to the OAuth client's *Authorised JavaScript origins*.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit tests (Vitest) — API client (single-flight refresh), format helpers |
| `npm run build` | Production build into `dist/` |
| `npm run e2e` | Playwright key flows against a running backend (see `tests/e2e/README.md`) |

## Layout (mirrors the backend layers)

`pages → hooks → api/ → backend`. Pages only show things; hooks hold logic; `src/api/` is the only
place that calls the backend (one file per backend module). A page never calls axios directly.

```
src/
├─ api/          client.js (axios, token in memory, single-flight refresh) + one file per module
├─ socket/       socket.js (reads the current token on every (re)connect)
├─ context/      AuthContext (silent refresh, login gate), LocationContext (GPS / area), UiContext
├─ hooks/        useGate, useGroupRoom, useWishlist, useNotes, useMediaQuery, …
├─ pages/        one file per page (22)
├─ components/   ui/ (Button, Chip, Sheet, …) · layout/ · search/ map/ place/ sheets/ journal/ group/ admin/ shared/
├─ lib/          format, compressImage, storage, cn
└─ styles/       index.css (Tailwind + design tokens)
```

## Notes

- **Access token in memory only.** On start the app calls `POST /auth/refresh` (the httpOnly cookie
  survives reloads). Every refresh in the app — start-up, a 401 retry, parallel requests — shares one
  promise: two refreshes racing would make the backend reject one and clear the cookie (= logged out).
- **Login gate:** `useGate(key, fn)` runs `fn` when signed in, else opens the Login sheet and runs it
  after sign-in (also after onboarding for a new user).
- **Search filters live in the URL** (`/search?q=…&maxPrice=250&openNow=1`) — back restores them.
- **Phone < 1024px** (bottom tab bar, bottom sheets) · **laptop ≥ 1024px** (top bar, centred dialogs).
- Light mode only in v1.
