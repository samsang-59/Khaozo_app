// Small display helpers shared by every page. All times are shown in IST (the app is Bhubaneswar-only).
const IST = 'Asia/Kolkata';

export const SPICE_LABEL = { mild: 'Mild', medium: 'Medium', spicy: 'Spicy', very_spicy: 'Very spicy' };
export const SPICE_LEVEL = { mild: 1, medium: 2, spicy: 3, very_spicy: 4 };
export const LEVEL3_LABEL = { low: 'Low', medium: 'Med', high: 'High' };
export const LEVEL3_STEP = { low: 1, medium: 2, high: 3 };
export const PLACE_TYPE_LABEL = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  dhaba: 'Dhaba',
  bakery: 'Bakery',
  street_stall: 'Street stall',
  sweet_shop: 'Sweet shop',
};
export const PLACE_DIET_LABEL = { pure_veg: 'Pure veg', non_veg: 'Non-veg', both: 'Veg & non-veg' };
export const DISH_DIET_LABEL = { veg: 'Veg', egg: 'Egg', non_veg: 'Non-veg' };
export const BUDGET_LABEL = { 1: '< ₹150', 2: '₹150–300', 3: '₹300–600', 4: '₹600+' };

export const formatPrice = (rupees) => (rupees == null ? null : `₹${Math.round(rupees).toLocaleString('en-IN')}`);
export const priceLevel = (level) => (level ? '₹'.repeat(level) : null);

export const formatDistance = (m) => {
  if (m == null) return null;
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
};

export const formatStars = (avg) => (avg == null ? null : `${Number(avg).toFixed(1)}★`);
export const formatPct = (pct) => (pct == null ? null : `${Math.round(pct)}%`);

// "11:00" → "11 AM", "23:30" → "11:30 PM"
export const formatClock = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
};

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const dayName = (d) => DAY_SHORT[d] ?? '';

// opening: { state: 'open', closesAt, closingSoon } | { state: 'closed', opensAt, opensDay, opensToday } | { state: 'unknown' }
export const openingText = (opening) => {
  if (!opening || opening.state === 'unknown') return null;
  if (opening.state === 'open') return opening.closingSoon ? `Closes ${formatClock(opening.closesAt)}` : `Open till ${formatClock(opening.closesAt)}`;
  if (opening.opensToday) return `Opens ${formatClock(opening.opensAt)}`;
  return `Opens ${dayName(opening.opensDay)} ${formatClock(opening.opensAt)}`;
};

// Hours list → "Mon–Sun 11 AM – 11 PM" when every day is the same, else null
export const sameHoursEveryDay = (hours = []) => {
  if (hours.length !== 7) return null;
  const first = hours[0];
  if (!hours.every((h) => h.opensAt === first.opensAt && h.closesAt === first.closesAt)) return null;
  return `${formatClock(first.opensAt)} – ${formatClock(first.closesAt)}`;
};

export const hoursForDay = (hours = [], day) =>
  hours.filter((h) => h.day === day).map((h) => `${formatClock(h.opensAt)} – ${formatClock(h.closesAt)}`).join(', ');

export const todayInIst = (now = new Date()) => {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' }).format(now);
  return DAY_SHORT.indexOf(wd);
};

export const timeAgo = (iso, now = Date.now()) => {
  if (!iso) return '';
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = h / 24;
  if (d < 2) return 'yesterday';
  if (d < 7) return `${Math.floor(d)} days ago`;
  if (d < 14) return '1 week ago';
  if (d < 31) return `${Math.floor(d / 7)} weeks ago`;
  return formatDate(iso);
};

export const formatDate = (iso, opts = { day: 'numeric', month: 'short' }) =>
  iso ? new Intl.DateTimeFormat('en-IN', { timeZone: IST, ...opts }).format(new Date(iso)) : '';

export const formatMonth = (iso) => formatDate(iso, { month: 'long', year: 'numeric' }).toUpperCase();

export const formatTime = (iso) =>
  iso ? new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '';

export const firstName = (name = '') => name.trim().split(/\s+/)[0] ?? '';
export const initial = (name = '') => (name.trim()[0] ?? '?').toUpperCase();

// "Chicken Dum Biryani 4.6★ (80) · Spicy · ₹220 · 1.2 km · Open till 11 PM"
export const joinMeta = (...parts) => parts.filter(Boolean).join(' · ');

// Maps link for any phone (no Google API): geo: on Android, Apple Maps on iOS, Google Maps web otherwise
export const mapsLink = ({ lat, lng }, label = '') => {
  const q = encodeURIComponent(label);
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return `https://maps.apple.com/?ll=${lat},${lng}&q=${q || 'Here'}`;
  if (/Android/i.test(ua)) return `geo:${lat},${lng}?q=${lat},${lng}(${q})`;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
};
