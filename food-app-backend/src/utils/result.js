// Services return results, never HTTP status codes (they're also called by
// workers and socket handlers where HTTP means nothing).
//   { ok: true, data }            → success
//   { ok: false, reason, details } → expected failure (controller maps reason → HTTP)

export const ok = (data = null) => ({ ok: true, data });

export const fail = (reason, details) =>
  details === undefined ? { ok: false, reason } : { ok: false, reason, details };
