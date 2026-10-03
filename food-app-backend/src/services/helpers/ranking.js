// rankingService (helper) — all ranking numbers ("LLM for words, code for numbers").
//  - Bayesian average, trust weighting and labels: SQL materialized views (migration 010);
//    refreshStats() runs every ~5 min.
//  - Search / group ranking: scoreCandidate() with the config weights (dish 40 % · distance 20 % ·
//    mood/tag 15 % · taste 10 % · vibe 10 % · open/time 5 %).
//  - Match for you %: matchPercent() from the user's taste profile.
//  - Result reasons: reasonFor() — a code template filled with DB data, never the LLM.
// Used by searchService and groupService (helpers never call feature services).
import * as statsRepo from '../../repositories/stats.repo.js';

// Same formula as menu_item_stats.bayes_score
export const bayesianScore = ({ prior, ratings }) => {
  const weightSum = ratings.reduce((s, r) => s + r.weight, 0);
  const starSum = ratings.reduce((s, r) => s + r.weight * r.stars, 0);
  return (prior.weight * prior.mean + starSum) / (prior.weight + weightSum);
};

export const refreshStats = () => statsRepo.refresh();

// ---- Scales ---------------------------------------------------------------------------
export const SPICE_LEVEL = { mild: 1, medium: 2, spicy: 3, very_spicy: 4 };
export const LEVEL3 = { low: 1, medium: 2, high: 3 };
export const SPICE_LABEL = { mild: 'Mild', medium: 'Medium spicy', spicy: 'Spicy', very_spicy: 'Very spicy' };

// Budget buckets (taste profile): <₹150 / ₹150–300 / ₹300–600 / ₹600+
export const budgetBucket = (price) => {
  if (price == null) return null;
  if (price < 150) return 1;
  if (price < 300) return 2;
  if (price < 600) return 3;
  return 4;
};

const closeness = (a, b, range) => (a == null || b == null ? null : 1 - Math.abs(a - b) / range);
const avg = (xs) => {
  const v = xs.filter((x) => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

// ---- Match for you % (logged in only) ---------------------------------------------------
// profile: tasteProfileService view ({ effective: { spice, sweet, oiliness, budget }, cuisineIds })
// candidate: { typicalSpice, typicalSweetness, typicalOiliness, price, cuisineId }
// Average of what can be compared: spice / sweetness / oiliness closeness, budget fit,
// favourite cuisine (1) or not (0.5). null when nothing can be compared.
export const matchPercent = (profile, c) => {
  if (!profile) return null;
  const e = profile.effective ?? {};
  const parts = [
    closeness(e.spice, SPICE_LEVEL[c.typicalSpice], 3),
    closeness(e.sweet, LEVEL3[c.typicalSweetness], 2),
    closeness(e.oiliness, LEVEL3[c.typicalOiliness], 2),
    closeness(e.budget, budgetBucket(c.price), 3),
    profile.cuisineIds?.length && c.cuisineId ? (profile.cuisineIds.includes(c.cuisineId) ? 1 : 0.5) : null,
  ];
  const m = avg(parts);
  return m == null ? null : Math.round(m * 100);
};

// ---- Search score -------------------------------------------------------------------------
// Each part is 0..1; parts that don't apply to this search are left out and the weights of
// the rest are re-normalised (e.g. no "vibe" asked → vibe doesn't dilute the score).
export const scoreParts = (c, ctx) => {
  const parts = {};
  parts.dish = c.menuItemId
    ? (c.bayesScore ?? ctx.priorMean) / 5
    : (c.placeAvgStars ?? ctx.priorMean) / 5;
  if (c.distanceM != null && ctx.radiusM) parts.distance = Math.max(0, 1 - c.distanceM / ctx.radiusM);
  if (ctx.tagIds?.length) parts.tag = ctx.tagIds.filter((t) => c.tagIds.includes(t)).length / ctx.tagIds.length;
  if (ctx.tasteMatch != null) parts.taste = ctx.tasteMatch;
  if (ctx.wantsVibe) parts.vibe = c.vibeSimilarity ?? 0;
  parts.open = c.openNow ? 1 : c.hasHours ? 0 : 0.5;
  return parts;
};

export const combine = (parts, weights) => {
  let sum = 0;
  let wSum = 0;
  for (const [k, v] of Object.entries(parts)) {
    sum += (weights[k] ?? 0) * v;
    wSum += weights[k] ?? 0;
  }
  return wSum ? sum / wSum : 0;
};

// Query spice ("spicy biryani") without a profile → how close the dish's typical spice is
export const spiceFit = (wanted, typical) => closeness(SPICE_LEVEL[wanted], SPICE_LEVEL[typical], 3);

// ---- Reason (code template) -------------------------------------------------------------
const km = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

const time12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
};

export const openingText = (opening) => {
  if (!opening || opening.state === 'unknown') return null;
  if (opening.state === 'open') return opening.closingSoon ? `Closes soon (${time12(opening.closesAt)})` : `Open till ${time12(opening.closesAt)}`;
  return opening.opensToday ? `Opens at ${time12(opening.opensAt)}` : 'Closed now';
};

// "Chicken Dum Biryani 4.6★ (80) · Spicy · ₹220 · 1.2 km · Open till 11 PM"
export const reasonFor = (c, { opening, tagNames = [] } = {}) => {
  const bits = [];
  if (c.likelyReason) bits.push(c.likelyReason);
  if (c.menuItemId) {
    const rating = c.ratingCount > 0 && c.avgStars != null ? ` ${c.avgStars.toFixed(1)}★ (${c.ratingCount})` : ' · new';
    bits.push(`${c.standardDishName}${rating}`);
    if (c.typicalSpice) bits.push(SPICE_LABEL[c.typicalSpice]);
    if (c.price) bits.push(`₹${c.price}`);
  } else if (c.placeReviewCount > 0 && c.placeAvgStars != null) {
    bits.push(`${c.placeAvgStars.toFixed(1)}★ (${c.placeReviewCount} reviews)`);
  }
  if (tagNames.length) bits.push(`Good for ${tagNames.join(', ')}`);
  if (c.distanceM != null) bits.push(km(c.distanceM));
  const open = openingText(opening);
  if (open) bits.push(open);
  return bits.join(' · ');
};
