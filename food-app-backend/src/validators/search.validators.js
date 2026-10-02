import { z } from 'zod';
import { idParam, lat, lng, queryBool } from './common.js';
import { MOODS, MEAL_TIMES, SPICE, DIETS } from '../ai/schemas/searchFilters.js';

// GET /search?q=&lat=&lng= + optional UI filters (they override what the AI understood)
export const search = {
  query: z
    .object({
      q: z.string().trim().min(2).max(200),
      lat: lat.optional(),
      lng: lng.optional(),
      areaId: idParam.optional(),
      maxPrice: z.coerce.number().int().positive().max(100000).optional(),
      openNow: queryBool.optional(),
      diet: z.enum(DIETS).optional(),
      mood: z.enum(MOODS).optional(),
      mealTime: z.enum(MEAL_TIMES).optional(),
      spice: z.enum(SPICE).optional(),
      showAll: queryBool.optional(), // turn off the automatic diet / foods-to-avoid filter
    })
    .refine((q) => (q.lat == null) === (q.lng == null), { message: 'Send both lat and lng, or neither' }),
};
