# Auth flow

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

---

## Cross-cutting 2: Auth flow (LOCKED)

### Login (Google)
1. Frontend: "Sign in with Google" → Google gives frontend an **ID token**
2. Frontend → `POST /api/v1/auth/google { idToken }` → **our backend**
3. Backend verifies it with **google-auth-library** (really from Google, for our client ID)
4. Find user by `google_id` → else create user + empty taste profile
5. Issue **access token** (JWT, 15 min, `{ sub: userId, role }`) in body + **refresh token** (64 random bytes, 7 days) in an httpOnly cookie
6. Refresh token stored in `login_sessions` as a **SHA-256 hash** (not bcrypt: token is random/unguessable, and bcrypt's random salt makes `WHERE token_hash = $1` lookup impossible)
7. Server stores no access token — frontend keeps it in memory, sends `Authorization: Bearer <token>`; server only checks the signature

### Refresh (silent, ~every 15 min)
`POST /auth/refresh` (cookie sent automatically) → hash → find in login_sessions
- not found / expired / revoked → 401 (log in again)
- already used → **reuse detected → revoke all user's sessions** → 401
- ok → mark used (`replaced_by`), issue new access + refresh (rotation)
- Frontend: on 401 → refresh → retry the original request automatically (user notices nothing)

### ⚠️ Trap: parallel refresh (handled)
Opening a page fires several API calls at once (place details + menu + reviews). If the access token expired, all get 401 and each would refresh with the **same** refresh token → the 2nd/3rd look like reuse → user logged out.
- **Frontend fix:** single-flight refresh — only one refresh runs at a time; other requests wait for it and reuse the new token.
- **Backend safety net:** if a used token comes back within **10 seconds** of being rotated, treat it as a race (plain 401, no mass revoke), not theft.

### Middleware
| Middleware | Used on | Does |
|---|---|---|
| `requireAuth` | 🔐 routes | no/invalid token → 401; rejects guest passes |
| `optionalAuth` | 🌐 routes that personalise (search, place, menu item) | token present → `req.user`; else continue as guest (no "Match %", no "your rating") |
| `adminOnly` | 👑 routes | role ≠ admin → 403 (role read from JWT; demotion takes effect within 15 min) |

### Guest pass (group mode)
- `POST /groups/:code/join` without login → **one guest pass per guest person**: JWT `{ type: 'guest', guestId, groupCode }`, 4 hours.
- Valid **only for that one group** (join, preferences, vote). Any other group or any normal route → rejected.
- Logged-in members use their normal access token.

### Socket.IO auth
- Each person opens **their own** socket with **their own** token (`io(url, { auth: { token } })`) — access token or guest pass.
- One `io.use()` check accepts access tokens or a guest pass matching the group; all members join room `group:<code>`.
- Socket.IO handles **group-mode events only**; everything else is HTTP.

### Refresh cookie settings
| Setting | Means | Protects against |
|---|---|---|
| httpOnly | page JavaScript can't read it | injected scripts stealing it (XSS) |
| secure | https only (production) | snooping on public Wi-Fi |
| sameSite: strict | sent only from our own site | other sites using the cookie (CSRF) |
| path: /api/v1/auth | sent only to auth routes | needless exposure |
