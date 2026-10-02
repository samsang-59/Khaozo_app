// Group mode: HTTP bodies + Socket.IO event payloads (both validated with Zod).
import { z } from 'zod';
import { idParam, lat, lng } from './common.js';

const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, 'Group code is 6 letters / digits');
const guestName = z.string().trim().min(1).max(40);

export const createGroup = { body: z.object({ name: guestName.optional() }).strict() };
export const groupCode = { params: z.object({ code }) };
export const joinGroup = { params: z.object({ code }), body: z.object({ name: guestName.optional() }).strict() };

// ---- Socket payloads
export const socketJoin = z.object({ code });

const strict = z
  .object({ diet: z.boolean().optional(), budget: z.boolean().optional(), cuisines: z.boolean().optional() })
  .strict()
  .default({});

export const socketPreferences = z
  .object({
    mode: z.enum(['profile', 'for_now']), // "Use my taste profile" or "Choose for this outing"
    diet: z.enum(['veg', 'egg', 'non_veg']).nullable().optional(),
    spice: z.number().int().min(1).max(4).nullable().optional(),
    budget: z.number().int().min(1).max(4).nullable().optional(),
    cuisineIds: z.array(idParam).max(10).optional(),
    avoidIds: z.array(idParam).max(10).optional(),
    strict,
    location: z.object({ lat, lng }).strict().optional(), // for the fair midpoint
  })
  .strict();

export const socketLocation = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('spot'), lat, lng, label: z.string().trim().min(1).max(80) }).strict(),
  z.object({ mode: z.literal('midpoint') }).strict(),
]);

export const socketVote = z.object({ placeId: idParam }).strict();
export const socketFinish = z.object({ placeId: idParam.optional() }).strict().default({});
