import { z } from 'zod';
import { idParam, lat, lng, pagination } from './common.js';

export const matchDish = {
  query: z.object({ q: z.string().trim().min(2).max(100) }),
};

export const addMenuItem = {
  params: z.object({ id: idParam }),
  body: z
    .object({
      name: z.string().trim().min(2).max(150),
      price: z.number().int().positive().max(100000).optional(), // rupees, full plate
      standardDishId: idParam.optional(),
      newDish: z
        .object({
          categoryId: idParam,
          cuisineId: idParam,
          mainIngredientId: idParam.optional(),
          diet: z.enum(['veg', 'egg', 'non_veg']),
        })
        .strict()
        .optional(),
    })
    .strict(),
};

export const bestForDish = {
  params: z.object({ id: idParam }),
  query: z
    .object({ lat: lat.optional(), lng: lng.optional(), ...pagination })
    .refine((q) => (q.lat == null) === (q.lng == null), { message: 'Send both lat and lng, or neither' }),
};
