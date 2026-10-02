import { z } from 'zod';
import { idParam, idParams, pagination } from './common.js';

const score = z.number().int().min(1).max(5);
const level3 = z.enum(['low', 'medium', 'high']);
const reviewText = z.string().trim().max(1000);

// ---- Dish ratings: stars + "order again?" required, everything else optional
const ratingFields = {
  stars: score,
  wouldOrderAgain: z.boolean(),
  taste: score.nullable().optional(),
  portion: score.nullable().optional(),
  value: score.nullable().optional(),
  spice: z.enum(['mild', 'medium', 'spicy', 'very_spicy']).nullable().optional(),
  sweetness: level3.nullable().optional(),
  oiliness: level3.nullable().optional(),
  reviewText: reviewText.nullable().optional(),
  pricePaid: z.number().int().positive().max(100000).nullable().optional(),
};

export const createRating = { ...idParams, body: z.object(ratingFields).strict() };

export const updateRating = {
  ...idParams,
  body: z
    .object({ ...ratingFields, stars: score.optional(), wouldOrderAgain: z.boolean().optional() })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' }),
};

// ---- Place reviews: stars required; facilities = tick boxes (true / false / not answered)
const yesNo = z.boolean().nullable().optional();
const reviewFields = {
  stars: score,
  vibe: score.nullable().optional(),
  looks: score.nullable().optional(),
  serviceSpeed: score.nullable().optional(),
  staff: score.nullable().optional(),
  hygiene: score.nullable().optional(),
  noise: z.enum(['quiet', 'moderate', 'loud']).nullable().optional(),
  wifi: yesNo, plugPoints: yesNo, ac: yesNo, washroom: yesNo,
  bikeParking: yesNo, carParking: yesNo,
  acceptsCash: yesNo, acceptsUpi: yesNo, acceptsCard: yesNo,
  crowd: z.enum(['empty', 'okay', 'packed']).nullable().optional(),
  reviewText: reviewText.nullable().optional(),
  tagIds: z.array(idParam).max(15).optional(), // "Good for: …" (mood + meal-time tags)
};

export const createReview = { ...idParams, body: z.object(reviewFields).strict() };

export const updateReview = {
  ...idParams,
  body: z
    .object({ ...reviewFields, stars: score.optional() })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' }),
};

// ---- Lists
export const listById = { ...idParams, query: z.object({ ...pagination }) };
export const listQuery = { query: z.object({ ...pagination }) };

// ---- Journal
export const stats = { query: z.object({ period: z.enum(['all', 'month']).default('all') }) };

// ---- Wishlist / notes: exactly one target
const exactlyOne = (keys) => (b) => keys.filter((k) => b[k] != null).length === 1;

export const addWishlist = {
  body: z
    .object({ placeId: idParam.optional(), menuItemId: idParam.optional(), standardDishId: idParam.optional() })
    .strict()
    .refine(exactlyOne(['placeId', 'menuItemId', 'standardDishId']), { message: 'Send exactly one of placeId, menuItemId, standardDishId' }),
};

const noteText = z.string().trim().min(1).max(2000);

export const createNote = {
  body: z
    .object({ placeId: idParam.optional(), menuItemId: idParam.optional(), text: noteText })
    .strict()
    .refine(exactlyOne(['placeId', 'menuItemId']), { message: 'Send exactly one of placeId, menuItemId' }),
};

export const updateNote = { ...idParams, body: z.object({ text: noteText }).strict() };

export { idParams };
