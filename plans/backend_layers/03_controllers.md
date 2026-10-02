# Controllers

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

---

## Part 2: Controllers (LOCKED)

- Job: **receive → delegate → reply**. No business logic, no SQL.
- **15 controllers**, one per module: auth · me · search · places · dishes · menuItems · ratings · reviews · photos · journal · wishlist · notes · groups · meta · admin
- **Express 5** (current stable) — async errors caught automatically, no asyncHandler wrapper.
- **Same response shape always:** `{ success: true, data }` / `{ success: false, error: { code, message } }`

### Result pattern (services know nothing about HTTP)
- Services **return** results: `{ ok: true, data }` or `{ ok: false, reason: 'RATING_TOO_SOON' }`. They never pick status codes — they're also called by workers and socket handlers where HTTP means nothing.
- **Controllers give the result meaning**: one shared map turns `reason` → HTTP status + message (e.g. `MENU_ITEM_NOT_FOUND → 404`, `RATING_TOO_SOON → 409`, `NOT_ALLOWED → 403`), via a `sendFailure(res, reason)` helper.
- **Unexpected failures** (DB down, Cloudinary timeout, bugs) still throw → **one error middleware** as a safety net: logs it, replies `500`.

```js
export const createRating = async (req, res) => {
  const result = await ratingService.create({ userId: req.user.id, menuItemId: req.params.id, ...req.body });
  if (!result.ok) return sendFailure(res, result.reason);
  res.status(201).json({ success: true, data: result.data });
};
```

### Added later: `GET /me/contributions`
- `journalController.getContributions` (existing journal controller, new function) → calls `journalService.getContributions(req.user.id)` → replies `{ success: true, data: { places, dishes, reports } }`.
