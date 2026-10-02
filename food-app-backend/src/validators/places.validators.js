import { z } from 'zod';
import { idParam, idParams, lat, lng, queryBool, pagination, hhmm } from './common.js';

const PLACE_TYPES = ['restaurant', 'cafe', 'dhaba', 'bakery', 'street_stall', 'sweet_shop'];
const DIET_TYPES = ['pure_veg', 'non_veg', 'both'];

export const listPlaces = {
  query: z
    .object({
      lat: lat.optional(),
      lng: lng.optional(),
      areaId: idParam.optional(),
      radius: z.coerce.number().int().min(100).max(20000).optional(), // metres
      q: z.string().trim().min(1).max(100).optional(),
      status: z.enum(['unverified', 'verified', 'closed']).optional(),
      type: z.enum(PLACE_TYPES).optional(),
      diet: z.enum(DIET_TYPES).optional(),
      maxPrice: z.coerce.number().int().min(1).max(4).optional(),
      cuisineId: idParam.optional(),
      openNow: queryBool.optional(),
      ...pagination,
    })
    .refine((q) => (q.lat == null) === (q.lng == null), { message: 'Send both lat and lng, or neither' })
    .transform((q) => ({
      lat: q.lat, lng: q.lng, areaId: q.areaId, radius: q.radius, q: q.q, status: q.status,
      placeType: q.type, dietType: q.diet, maxPriceLevel: q.maxPrice, cuisineId: q.cuisineId,
      openNow: q.openNow ?? false, limit: q.limit, cursor: q.cursor,
    })),
};

export const placeId = idParams;

export const addPlace = {
  body: z
    .object({
      name: z.string().trim().min(1).max(150),
      lat,
      lng,
      placeType: z.enum(PLACE_TYPES),
      dietType: z.enum(DIET_TYPES).optional(),
      priceLevel: z.number().int().min(1).max(4).optional(),
      address: z.string().trim().max(300).optional(),
      phone: z.string().trim().max(30).optional(),
      cuisineIds: z.array(idParam).max(10).optional(),
      confirmNew: z.boolean().optional(), // "No, it's a different place" after a 409
    })
    .strict(),
};

const hoursRow = z
  .object({ day: z.number().int().min(0).max(6), opensAt: hhmm, closesAt: hhmm })
  .refine((h) => h.opensAt !== h.closesAt, { message: 'opensAt and closesAt must differ' });

export const setHours = {
  params: z.object({ id: idParam }),
  body: z
    .object({ hours: z.array(hoursRow).min(1).max(14) })
    .refine((b) => {
      const perDay = {};
      for (const h of b.hours) perDay[h.day] = (perDay[h.day] ?? 0) + 1;
      return Object.values(perDay).every((n) => n <= 2);
    }, { message: 'At most two shifts per day' }),
};

export const createReport = {
  params: z.object({ id: idParam }),
  body: z
    .object({
      reason: z.enum(['closed', 'not_found', 'wrong_location', 'wrong_hours', 'wrong_info', 'duplicate']),
      details: z.string().trim().max(1000).optional(),
      suggestedChange: z
        .union([
          z.object({ lat, lng }).strict(),                        // wrong_location
          z.object({ hours: z.array(hoursRow).max(14) }).strict(), // wrong_hours
          z.object({ text: z.string().trim().max(500) }).strict(), // wrong_info
        ])
        .optional(),
      duplicateOf: idParam.optional(),
    })
    .strict()
    .refine((b) => b.reason !== 'duplicate' || b.duplicateOf, { message: 'duplicateOf is required for a duplicate report', path: ['duplicateOf'] }),
};
