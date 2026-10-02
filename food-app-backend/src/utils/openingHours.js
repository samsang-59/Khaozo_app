// Opening-hours status, computed in Bhubaneswar time (IST, UTC+5:30, no daylight saving).
// Rows: { day: 0–6 (0 = Sunday), opensAt: 'HH:MM[:SS]', closesAt: 'HH:MM[:SS]' }
// closesAt < opensAt → closes after midnight (next day). Two shifts → two rows. No rows → unknown.

export const CLOSING_SOON_MINUTES = 30;
const IST_OFFSET_MIN = 5 * 60 + 30;
const DAY_MIN = 24 * 60;
const WEEK_MIN = 7 * DAY_MIN;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Minutes since Sunday 00:00 IST
export const istWeekMinute = (date) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MIN * 60_000);
  return ist.getUTCDay() * DAY_MIN + ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

// Each row → an interval [start, end) in week-minutes (end may pass the week boundary).
const intervals = (hours) =>
  hours.map((h) => {
    const start = h.day * DAY_MIN + toMinutes(h.opensAt);
    const close = toMinutes(h.closesAt);
    const end = h.day * DAY_MIN + close + (close < toMinutes(h.opensAt) ? DAY_MIN : 0);
    return { start, end, row: h };
  });

const fmt = (hhmm) => hhmm.slice(0, 5);

export const openingStatus = (hours, at = new Date()) => {
  if (!hours?.length) return { state: 'unknown' };
  const now = istWeekMinute(at);
  const spans = intervals(hours);

  // Open now? Check this week and the previous week's overflow (Saturday night → Sunday morning).
  for (const s of spans) {
    for (const shift of [0, -WEEK_MIN]) {
      if (now >= s.start + shift && now < s.end + shift) {
        const minutesLeft = s.end + shift - now;
        return { state: 'open', closesAt: fmt(s.row.closesAt), closingSoon: minutesLeft <= CLOSING_SOON_MINUTES };
      }
    }
  }

  // Closed → next opening within the coming week
  let best = null;
  for (const s of spans) {
    const wait = (s.start - now + WEEK_MIN) % WEEK_MIN;
    if (best === null || wait < best.wait) best = { wait, row: s.row };
  }
  return { state: 'closed', opensAt: fmt(best.row.opensAt), opensDay: best.row.day, opensToday: best.wait < DAY_MIN - (now % DAY_MIN) };
};
