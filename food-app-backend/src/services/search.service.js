// searchService — plain-language search (backend_layers/11_search_pipeline.md):
//  1 cache check → 2 understand (AI → keywords) → 3 resolve (dish, area, tags, vibe) →
//  4 candidates (one SQL) → 5 relax if < 3 → 6 rank (code) → [cache] →
//  7 personalise (Match %, diet + foods to avoid) → 8 reasons (code template), top 20.
// The cache holds only non-personal results (steps 2–6) — nobody sees another user's Match %.
import crypto from 'node:crypto';
import * as aiAdapter from '../ai/aiAdapter.js';
import { searchFiltersSchema, MOODS, MEAL_TIMES } from '../ai/schemas/searchFilters.js';
import { searchFiltersPrompt } from '../ai/prompts/searchFilters.js';
import { keywordParse } from '../ai/keywordParser.js';
import * as placeRepo from '../repositories/place.repo.js';
import * as dishRepo from '../repositories/dish.repo.js';
import * as metaRepo from '../repositories/meta.repo.js';
import * as tagVoteRepo from '../repositories/tagVote.repo.js';
import * as tasteProfileRepo from '../repositories/tasteProfile.repo.js';
import * as photoRepo from '../repositories/photo.repo.js';
import * as cacheRepo from '../repositories/redis/cache.repo.js';
import * as configService from './helpers/config.js';
import * as dishMatcher from './helpers/dishMatcher.js';
import * as ranking from './helpers/ranking.js';
import { openingStatus } from '../utils/openingHours.js';
import { distanceM, gridKey } from '../utils/geo.js';
import { toView } from '../utils/taste.js';
import { ok } from '../utils/result.js';

export const RESULTS_SHOWN = 20;
const SEARCH_TTL_SECONDS = 10 * 60;
const PARSE_TTL_SECONDS = 24 * 60 * 60;
const sha = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 40);

// ---- Step 2: understand -------------------------------------------------------------------
// sentence → filters; AI answers cached 24 h; AI down / slow / out of budget → keyword parser
export const understand = async (q) => {
  const key = `parse:${sha(q.trim().toLowerCase())}`;
  const cached = await cacheRepo.getJson(key);
  if (cached) return cached;

  const ai = await aiAdapter.chat(searchFiltersPrompt(q), searchFiltersSchema);
  if (ai.ok) {
    const parsed = { filters: ai.data, understoodBy: 'ai' };
    await cacheRepo.setJson(key, parsed, PARSE_TTL_SECONDS);
    return parsed;
  }
  const areaNames = (await metaRepo.listAreas()).map((a) => a.name);
  return { filters: keywordParse(q, areaNames), understoodBy: 'keywords' }; // not cached: retry AI next time
};

// UI-picked filters override the AI's guess
const applyOverrides = (filters, o) => ({
  ...filters,
  ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)),
});

// ---- Step 3: resolve -------------------------------------------------------------------------
const resolveDish = async (text) => {
  if (!text) return { dishIds: null, dishLabel: null, unresolved: null };
  const byCategory = await dishRepo.findIdsByCategoryText(text); // "biryani" → all biryanis
  if (byCategory.length) return { dishIds: byCategory, dishLabel: text, unresolved: null };
  const m = await dishMatcher.match(text);
  if (m.level === 'exact') return { dishIds: [m.match.id], dishLabel: m.match.name, unresolved: null };
  if (m.level === 'similar') {
    const top = m.candidates.slice(0, 3);
    return { dishIds: top.map((c) => c.id), dishLabel: top[0].name, unresolved: null };
  }
  return { dishIds: null, dishLabel: null, unresolved: text };
};

const resolveTags = async ({ mood, mealTime }) => {
  const wanted = [mood && [mood, 'mood'], mealTime && [mealTime, 'meal_time']].filter(Boolean);
  if (!wanted.length) return [];
  const rows = await tagVoteRepo.tagIdsByName(wanted.map(([n]) => n));
  return wanted.map(([n, t]) => rows.find((r) => r.name === n && r.type === t)).filter(Boolean);
};

// ---- Steps 4–6: candidates, relax, rank (non-personal, cached) -------------------------------
const findWithRelax = async (base, cfg, tags) => {
  const notes = [];
  const f = { ...base };
  let rows = await placeRepo.findCandidates(f);
  const steps = [
    () => {
      if (!f.radiusM || f.radiusM >= cfg.radius.relaxed) return null;
      const from = f.radiusM;
      f.radiusM = cfg.radius.relaxed;
      return `Nothing within ${from / 1000} km — showing places within ${f.radiusM / 1000} km`;
    },
    () => {
      if (!f.maxPrice) return null;
      const from = f.maxPrice;
      f.maxPrice = Math.round((from * (100 + cfg.relaxPricePct)) / 100);
      return `No match under ₹${from}, here are options under ₹${f.maxPrice}`;
    },
    () => {
      if (!f.openNow) return null;
      f.openNow = false;
      return 'Nothing open right now — showing places that may be closed';
    },
    () => {
      if (!f.tagIds?.length) return null;
      f.tagIds = [];
      return `No place tagged ${tags.map((t) => t.name).join(' + ')} yet — showing other options`;
    },
  ];
  // One step at a time. Diet and foods to avoid are never relaxed.
  for (const step of steps) {
    if (rows.length >= cfg.minResults) break;
    const note = step();
    if (!note) continue;
    notes.push(note);
    rows = await placeRepo.findCandidates(f);
  }
  return { rows, notes, final: f };
};

// Fallback when a known dish has no menu item nearby yet (new city data has places, not menus):
// places that probably serve it — the dish / category word in the name ("… Biryani House"), or a
// matching cuisine. A non-veg / egg dish never suggests a pure-veg place. Only runs when no menu
// nearby has the dish at all — too pricey / closed / untagged menus keep the normal (empty) answer.
const likelyServing = async (dish, f) => {
  const onAnyMenu = await placeRepo.findCandidates({ ...f, maxPrice: null, openNow: false, tagIds: [], limit: 1 });
  if (onAnyMenu.length) return [];
  const dishes = await dishRepo.findManyByIds(dish.dishIds);
  if (!dishes.length) return [];
  // "Momos" also matches "Momo Point"
  const words = dishes.flatMap((d) => [d.name, d.category]).map((t) => t.toLowerCase());
  const nameTerms = [...new Set(words.flatMap((t) => (t.length > 4 && t.endsWith('s') ? [t, t.slice(0, -1)] : [t])))];
  const rows = await placeRepo.findCandidates({
    ...f,
    dishIds: null,
    maxPrice: null,
    likely: {
      nameTerms,
      cuisineIds: [...new Set(dishes.map((d) => d.cuisineId))],
      excludePureVeg: dishes.every((d) => d.diet !== 'veg'),
    },
  });
  const what = dish.dishLabel.toLowerCase();
  return rows.map((r) => ({ ...r, likelyServes: true, likelyReason: `Probably serves ${what}` }));
};

const nonPersonal = async ({ q, overrides, centre, at }) => {
  const all = await configService.getAll();
  const cfg = {
    radius: all.search_radius_m,
    relaxPricePct: all.search_relax_price_pct,
    minResults: all.search_min_results,
    priorMean: all.bayes_prior.mean,
  };

  const parsed = await understand(q);
  const filters = applyOverrides(parsed.filters, overrides);

  let area = null;
  if (overrides.areaId) area = await metaRepo.findArea(overrides.areaId);
  else if (filters.area) area = await metaRepo.findAreaByText(filters.area);
  const searchCentre = area ? { lat: area.lat, lng: area.lng } : centre; // area wins, else user location

  const [dish, tags, vibeVector] = await Promise.all([
    resolveDish(filters.dish),
    resolveTags(filters),
    filters.vibe ? aiAdapter.embed(filters.vibe, 'RETRIEVAL_QUERY') : null,
  ]);

  const base = {
    lat: searchCentre?.lat,
    lng: searchCentre?.lng,
    radiusM: searchCentre ? cfg.radius.start : null,
    dishIds: dish.dishIds,
    maxPrice: dish.dishIds ? filters.maxPrice : null,
    diet: filters.diet,
    openNow: filters.openNow === true,
    at,
    tagIds: tags.map((t) => t.id),
    vibeVector,
  };
  let { rows, notes, final } = await findWithRelax(base, cfg, tags);
  if (dish.dishIds && rows.length === 0) {
    rows = await likelyServing(dish, final);
    if (rows.length) notes.push(`No one has added ${dish.dishLabel.toLowerCase()} at places near here yet — these places probably serve it`);
  }
  if (dish.unresolved) notes.unshift(`We don't know "${dish.unresolved}" yet — showing places instead`);

  // Non-personal score parts (distance + taste are finished in step 7)
  // Tag fit uses the tags that were ASKED for: relaxing drops the requirement, not the reward.
  const ctxBase = { priorMean: cfg.priorMean, tagIds: base.tagIds, wantsVibe: Boolean(vibeVector) };
  const candidates = rows.map((c) => ({ ...c, parts: ranking.scoreParts({ ...c, distanceM: null }, ctxBase) }));

  return {
    understoodBy: parsed.understoodBy,
    filters,
    resolved: {
      dish: dish.dishLabel,
      area: area ? { id: area.id, name: area.name } : null,
      tags: tags.map((t) => t.name),
      vibe: vibeVector ? filters.vibe : null,
    },
    relaxed: notes,
    centre: searchCentre ?? null,
    centreIsArea: Boolean(area),
    radiusM: final.radiusM,
    candidates,
  };
};

// ---- Step 7 + 8: personalise, rank, reasons ---------------------------------------------------
const personalProfile = async (userId) => {
  if (!userId) return null;
  const p = await tasteProfileRepo.findByUserId(userId);
  return p ? toView(p) : null;
};

const dietAllows = (diet, c) => {
  if (!diet) return true;
  if (c.menuItemId) {
    if (diet === 'veg') return c.dishDiet === 'veg';
    if (diet === 'egg') return c.dishDiet !== 'non_veg';
    return true;
  }
  return diet === 'non_veg' || c.dietType !== 'non_veg';
};

// input: { q, lat?, lng?, overrides: { maxPrice, openNow, diet, mood, mealTime, spice, areaId }, showAll, userId, at }
export const search = async ({ q, lat, lng, overrides = {}, showAll = false, userId = null, at = new Date() }) => {
  const userPoint = lat != null && lng != null ? { lat, lng } : null;

  // Step 1: cache (non-personal part), key = query + UI filters + ~500 m grid
  const key = `search:${sha({ q: q.trim().toLowerCase(), overrides, grid: userPoint ? gridKey(userPoint) : 'none' })}`;
  let base = await cacheRepo.getJson(key);
  const cacheHit = Boolean(base);
  if (!base) {
    base = await nonPersonal({ q, overrides, centre: userPoint, at });
    await cacheRepo.setJson(key, base, SEARCH_TTL_SECONDS);
  }

  const weights = await configService.get('search_weights');
  const profile = await personalProfile(userId);
  // Diet + foods to avoid from the profile are applied automatically ("Show all" turns it off)
  const personalFilter = profile && !showAll ? { diet: profile.diet, avoidIds: profile.avoidIds } : null;

  // Distances from the user's own point (cache was built for the grid), or from the area pin
  const from = base.centreIsArea ? base.centre : userPoint ?? base.centre;

  let hidden = 0;
  const scored = [];
  for (const c of base.candidates) {
    if (personalFilter) {
      const avoided = c.mainIngredientId && personalFilter.avoidIds.includes(c.mainIngredientId);
      if (!dietAllows(personalFilter.diet, c) || avoided) {
        hidden += 1;
        continue;
      }
    }
    const dist = from ? distanceM(from, { lat: c.lat, lng: c.lng }) : null;
    const matchPct = profile && c.menuItemId ? ranking.matchPercent(profile, c) : null;
    const tasteMatch = matchPct != null ? matchPct / 100
      : base.filters.spice && c.typicalSpice ? ranking.spiceFit(base.filters.spice, c.typicalSpice) : null;
    const parts = { ...c.parts };
    if (dist != null && base.radiusM) parts.distance = Math.max(0, 1 - dist / base.radiusM);
    if (tasteMatch != null) parts.taste = tasteMatch;
    scored.push({ c: { ...c, distanceM: dist }, matchPct, score: ranking.combine(parts, weights) });
  }
  // Fallback places (likelyServes): a name match ("Biryani House") before a cuisine-only match
  scored.sort((a, b) => Number(Boolean(b.c.likelyNameMatch)) - Number(Boolean(a.c.likelyNameMatch)) || b.score - a.score);
  const top = scored.slice(0, RESULTS_SHOWN);

  // Step 8: reasons (code template) + opening status
  const hours = await placeRepo.findHoursForPlaces(top.map((s) => s.c.placeId));
  // Card photo: a dish result shows that dish (never another dish of the place); a place result its gallery
  const covers = await photoRepo.coverPhotos({
    menuItemIds: top.filter((s) => s.c.menuItemId).map((s) => s.c.menuItemId),
    placeIds: top.filter((s) => !s.c.menuItemId).map((s) => s.c.placeId),
  });
  const tagNames = new Set(base.resolved.tags);
  const allTags = tagNames.size ? await metaRepo.listTags() : [];
  const items = top.map(({ c, matchPct, score }) => {
    const opening = openingStatus(hours[c.placeId] ?? [], at);
    const matchedTags = allTags.filter((t) => tagNames.has(t.name) && c.tagIds.includes(t.id)).map((t) => t.name);
    return {
      place: { id: c.placeId, name: c.placeName, type: c.placeType, area: c.areaName, status: c.placeStatus, location: { lat: c.lat, lng: c.lng } },
      menuItem: c.menuItemId
        ? { id: c.menuItemId, name: c.menuItemName, price: c.price, standardDish: c.standardDishName, diet: c.dishDiet,
            stats: { ratingCount: c.ratingCount, avgStars: c.avgStars, label: c.label, typicalSpice: c.typicalSpice } }
        : null,
      distanceM: c.distanceM == null ? null : Math.round(c.distanceM),
      opening,
      matchPct,
      likelyServes: Boolean(c.likelyServes),
      photoUrl: (c.menuItemId ? covers.menuItems[c.menuItemId] : covers.places[c.placeId]) ?? null,
      score: Math.round(score * 1000) / 1000,
      reason: ranking.reasonFor(c, { opening, tagNames: matchedTags }),
    };
  });

  return ok({
    query: q,
    understoodBy: base.understoodBy,
    filters: base.filters,
    resolved: base.resolved,
    relaxed: base.relaxed,
    personalised: {
      applied: Boolean(profile),
      dietFilter: personalFilter ? { diet: personalFilter.diet, avoidIds: personalFilter.avoidIds } : null,
      hiddenByDiet: hidden,
      showAll,
    },
    cached: cacheHit,
    items,
  });
};

export { MOODS, MEAL_TIMES };
