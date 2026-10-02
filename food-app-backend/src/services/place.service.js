// placeService — list / near me, place page, menu, add place (duplicate check → 409), hours.
import * as placeRepo from '../repositories/place.repo.js';
import * as menuItemRepo from '../repositories/menuItem.repo.js';
import * as statsRepo from '../repositories/stats.repo.js';
import * as confirmationRepo from '../repositories/confirmation.repo.js';
import * as metaRepo from '../repositories/meta.repo.js';
import * as cacheRepo from '../repositories/redis/cache.repo.js';
import * as configService from './helpers/config.js';
import { openingStatus } from '../utils/openingHours.js';
import { insideBbox } from '../utils/geo.js';
import { page } from '../utils/pagination.js';
import { ok, fail } from '../utils/result.js';

export const DEFAULT_RADIUS_M = 3000;
export const DUPLICATE_RADIUS_M = 50;
// Place page shows the top 3 Must order + up to 2 Mixed reviews dishes (brainstorm 4.7)
const MUST_ORDER_SHOWN = 3;
const MIXED_SHOWN = 2;
const PLACE_CACHE_TTL_SECONDS = 5 * 60;
export const placeCacheKey = (id) => `place:${id}`;

const toListItem = (row, hours, at) => ({
  id: row.id,
  name: row.name,
  placeType: row.placeType,
  dietType: row.dietType,
  priceLevel: row.priceLevel,
  status: row.status,
  address: row.address,
  area: { id: row.areaId, name: row.areaName },
  location: { lat: row.lat, lng: row.lng },
  distanceM: row.distanceM == null ? null : Math.round(row.distanceM),
  cuisines: row.cuisines,
  opening: openingStatus(hours ?? [], at),
});

// filters already validated; centre from lat/lng or an area pin
export const list = async (filters, at = new Date()) => {
  let { lat, lng } = filters;
  if (filters.areaId && (lat == null || lng == null)) {
    const area = await metaRepo.findArea(filters.areaId);
    if (!area) return fail('AREA_NOT_FOUND');
    ({ lat, lng } = area);
  }
  const hasCentre = lat != null && lng != null;
  const rows = await placeRepo.list({
    ...filters,
    lat,
    lng,
    radiusM: filters.radius ?? DEFAULT_RADIUS_M,
    at,
  });
  const { items, nextCursor } = page(rows, filters.limit, (r) =>
    hasCentre ? { d: r.distanceM, id: r.id } : { n: r.name, id: r.id },
  );
  const hours = await placeRepo.findHoursForPlaces(items.map((r) => r.id));
  return ok({ items: items.map((r) => toListItem(r, hours[r.id], at)), nextCursor });
};

// Public part of the place page (cached 5 min). Opening status is time-based → added after.
const loadPublicDetails = async (placeId) => {
  const cached = await cacheRepo.getJson(placeCacheKey(placeId));
  if (cached) return cached;
  const row = await placeRepo.findById(placeId);
  if (!row || row.deletedAt) return null;
  const [hours, sums, threshold, stats, labelled] = await Promise.all([
    placeRepo.findHours(placeId),
    confirmationRepo.sumWeights([placeId]),
    configService.get('place_verify_threshold'),
    statsRepo.forPlace(placeId),
    statsRepo.labelledForPlace(placeId, { mustOrder: MUST_ORDER_SHOWN, mixed: MIXED_SHOWN }),
  ]);
  const details = {
    ...toListItem(row, hours),
    phone: row.phone,
    source: row.source,
    addedBy: row.addedBy,
    verifiedAt: row.verifiedAt,
    cuisines: row.cuisineList,
    hours,
    verification: row.status === 'unverified' ? { confirmations: sums[placeId] ?? 0, threshold } : null,
    stats, // place_stats: average stars, facilities (majority answer), tags with enough votes
    mustOrder: labelled.filter((d) => d.label === 'must_order'),
    mixedReviews: labelled.filter((d) => d.label === 'mixed_reviews'),
  };
  delete details.opening;
  delete details.distanceM;
  await cacheRepo.setJson(placeCacheKey(placeId), details, PLACE_CACHE_TTL_SECONDS);
  return details;
};

export const details = async (placeId, userId = null, at = new Date()) => {
  const pub = await loadPublicDetails(placeId);
  if (!pub) return fail('PLACE_NOT_FOUND');
  const data = { ...pub, opening: openingStatus(pub.hours, at) };
  if (userId) {
    // personal part — never cached
    data.me = {
      isAdder: pub.addedBy === userId,
      hasConfirmed: pub.status === 'unverified' ? await confirmationRepo.hasConfirmed(placeId, userId) : null,
    };
  }
  delete data.addedBy;
  return ok(data);
};

export const menu = async (placeId) => {
  const row = await placeRepo.findById(placeId);
  if (!row || row.deletedAt) return fail('PLACE_NOT_FOUND');
  const [items, stats] = await Promise.all([menuItemRepo.listByPlace(placeId), statsRepo.forPlaceMenu(placeId)]);
  return ok(items.map((i) => ({ ...i, stats: stats[i.id] ?? null })));
};

// POST /places — duplicate check first (similar name within 50 m) unless confirmNew.
export const addPlace = async (userId, input) => {
  if (!insideBbox(input)) return fail('OUTSIDE_SERVICE_AREA');
  const cuisineIds = [...new Set(input.cuisineIds ?? [])];
  if (cuisineIds.length && (await metaRepo.countExisting('cuisines', cuisineIds)) !== cuisineIds.length) {
    return fail('CUISINE_NOT_FOUND');
  }
  if (!input.confirmNew) {
    const similar = await placeRepo.findSimilarNearby({ name: input.name, lat: input.lat, lng: input.lng, radiusM: DUPLICATE_RADIUS_M });
    if (similar.length) return fail('POSSIBLE_DUPLICATE', { candidates: similar });
  }
  const placeId = await placeRepo.createUserPlace({
    name: input.name,
    lat: input.lat,
    lng: input.lng,
    placeType: input.placeType,
    dietType: input.dietType ?? null,
    priceLevel: input.priceLevel ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    cuisineIds,
    addedBy: userId,
  });
  return details(placeId, userId);
};

// PUT /places/:id/hours — only while the place has no hours (changes go through a wrong_hours report).
export const setHours = async (placeId, hours) => {
  const row = await placeRepo.findById(placeId);
  if (!row || row.deletedAt) return fail('PLACE_NOT_FOUND');
  const inserted = await placeRepo.insertHoursIfNone(placeId, hours);
  if (!inserted) return fail('HOURS_ALREADY_SET');
  await cacheRepo.del(placeCacheKey(placeId));
  return ok({ hours: await placeRepo.findHours(placeId) });
};
