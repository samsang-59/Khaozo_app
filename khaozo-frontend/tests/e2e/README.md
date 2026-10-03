# Playwright key flows (Phase 11)

Flows from `plans/07_testing_plan.md`: discover (search → place → dish → best), login gate,
rate a dish (+ journal, edit mode), reload keeps you signed in, group mode with two browsers.

## Run

1. Backend running on `:3000` with its database and Redis (`food-app-backend`: `docker compose up -d`, `npm run migrate`, `npm run seed`, `npm run dev`).
2. `npm run e2e` (starts the Vite dev server itself, or reuses one on `:5173`).

`global-setup.js` seeds a small world through the real API (a verified place near Patia, two
dishes, six diners' ratings) and refreshes the ranking views. Sign-in can't go through Google
in a test, so `fixtures.js` creates a user and a real refresh session in the database and sets
its cookie — the app's normal start-up refresh then signs the browser in.

Secrets (`DATABASE_URL`, `JWT_SECRET`) come from the environment or `food-app-backend/.env`.
