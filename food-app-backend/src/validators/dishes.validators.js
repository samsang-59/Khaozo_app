import { z } from 'zod';
import { idParam } from './common.js';

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
