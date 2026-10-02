import { z } from 'zod';
import { idParam, lat, lng, pagination } from './common.js';
import { hoursRow, maxTwoShiftsPerDay, PLACE_TYPES, DIET_TYPES } from './places.validators.js';

const DISH_DIETS = ['veg', 'egg', 'non_veg'];

export const listReports = {
  query: z.object({ status: z.enum(['pending', 'accepted', 'rejected']).default('pending'), ...pagination }),
};

// accept: change = corrected details (overrides the reporter's suggestion):
//   wrong_location → { lat, lng } · wrong_hours → { hours } · wrong_info → place fields
export const resolveReport = {
  params: z.object({ id: idParam }),
  body: z
    .object({
      action: z.enum(['accept', 'reject']),
      change: z
        .union([
          z.object({ lat, lng }).strict(),
          z.object({ hours: z.array(hoursRow).max(14).refine(maxTwoShiftsPerDay, { message: 'At most two shifts per day' }) }).strict(),
          z
            .object({
              name: z.string().trim().min(1).max(150).optional(),
              address: z.string().trim().max(300).optional(),
              phone: z.string().trim().max(30).optional(),
              placeType: z.enum(PLACE_TYPES).optional(),
              dietType: z.enum(DIET_TYPES).optional(),
              priceLevel: z.number().int().min(1).max(4).optional(),
            })
            .strict()
            .refine((c) => Object.keys(c).length > 0, { message: 'Nothing to change' }),
        ])
        .optional(),
    })
    .strict()
    .refine((b) => b.action === 'accept' || b.change === undefined, { message: 'change is only used when accepting', path: ['change'] }),
};

export const listPlaces = {
  query: z.object({ status: z.enum(['unverified', 'closed', 'deleted']).default('unverified'), ...pagination }),
};

export const placeAction = {
  params: z.object({ id: idParam }),
  body: z.object({ action: z.enum(['verify', 'close', 'delete', 'restore']) }).strict(),
};

export const listPendingDishes = {
  query: z.object({ ...pagination }),
};

export const createDish = {
  body: z
    .object({
      name: z.string().trim().min(2).max(150),
      categoryId: idParam,
      cuisineId: idParam,
      mainIngredientId: idParam.optional(),
      diet: z.enum(DISH_DIETS),
      aliases: z.array(z.string().trim().min(2).max(100)).max(20).optional(),
    })
    .strict(),
};

export const updateDish = {
  params: z.object({ id: idParam }),
  body: z.discriminatedUnion('action', [
    z
      .object({
        action: z.literal('approve'),
        name: z.string().trim().min(2).max(150).optional(),
        categoryId: idParam.optional(),
        cuisineId: idParam.optional(),
        mainIngredientId: idParam.nullable().optional(), // null = no main ingredient
        diet: z.enum(DISH_DIETS).optional(),
      })
      .strict(),
    z.object({ action: z.literal('merge'), intoId: idParam }).strict(),
  ]),
};

export const removeById = {
  params: z.object({ id: idParam }),
};

export const updateConfig = {
  body: z
    .object({
      key: z.string().trim().min(1).max(100),
      value: z.json(),
    })
    .strict(),
};
