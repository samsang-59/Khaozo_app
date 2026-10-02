# Socket.IO (group mode)

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

---

### Guest pass (group mode)
- `POST /groups/:code/join` without login → **one guest pass per guest person**: JWT `{ type: 'guest', guestId, groupCode }`, 4 hours.
- Valid **only for that one group** (join, preferences, vote). Any other group or any normal route → rejected.
- Logged-in members use their normal access token.

### Socket.IO auth
- Each person opens **their own** socket with **their own** token (`io(url, { auth: { token } })`) — access token or guest pass.
- One `io.use()` check accepts access tokens or a guest pass matching the group; all members join room `group:<code>`.
- Socket.IO handles **group-mode events only**; everything else is HTTP.

---

## Cross-cutting 4: Socket.IO events — group mode (LOCKED)

Room per group: `group:<code>`. State in Redis via `groupLiveRepo`. Status: `joining → choosing → voting → done`.

**Phone → server**
| Event | Who | Data |
|---|---|---|
| group:join | everyone | code (token sent at connect) |
| group:set_preferences | everyone | mode (profile / for now), diet, spice, budget, cuisines, avoid, strict flags, location (optional) |
| group:set_location | creator | picked spot or "use midpoint" |
| group:start_suggestions | creator | – |
| group:vote | everyone | placeId (re-vote replaces old vote) |
| group:finish | creator | optional placeId (override) |
| group:leave | everyone | – |

**Server → everyone in the room**
| Event | When |
|---|---|
| group:state | after ANY change — **full snapshot** of the group (members, ready, location, status, vote counts) |
| group:suggestions | top 3–5 places + reasons |
| group:result | winner chosen → history saved to Postgres |
| group:error | e.g. "Only the creator can do this" |

**Rules / traps handled**
- **Full snapshot, not small "something changed" events** — every phone always gets the complete picture, so it can never drift out of sync (missed messages don't matter).
- **Reconnect** (phone locked / network drop) → auto re-join room → fresh `group:state` (state is in Redis, not server memory).
- **Votes stored as member → place** → re-vote overwrites, no double voting.
- **groupService does NOT call searchService** (feature → feature). Both use `placeRepo.findCandidates()` + `rankingService` (helper).
- **Max 10 members** (config).
- **Creator leaves / phone dies** → next member by join order becomes creator automatically.
- **Voting ends automatically when everyone has voted**; creator can also end early. Tie → higher match score wins; creator can override.
- **"Get suggestions" allowed once ≥ 2 members are ready** (added in frontend design); members not ready use their taste profile (guests: no preferences).
