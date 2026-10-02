import { z } from 'zod';

const id = z.number().int().positive();
const idList = z.array(id).max(50);

export const updateMe = {
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      journalVisibility: z.enum(['public', 'private']).optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' }),
};

// Quiz scales: spice 1–4 · sweet 1–3 · budget 1–4 (<₹150 / ₹150–300 / ₹300–600 / ₹600+).
// Every question is skippable (null or missing).
export const tasteQuiz = {
  body: z
    .object({
      diet: z.enum(['veg', 'egg', 'non_veg']).nullable().optional(),
      spice: z.number().int().min(1).max(4).nullable().optional(),
      sweet: z.number().int().min(1).max(3).nullable().optional(),
      budget: z.number().int().min(1).max(4).nullable().optional(),
      cuisineIds: idList.optional(),
      avoidIds: idList.optional(),
    })
    .strict(),
};

// Edit + lock: the slider value may be fractional (learned values are).
export const tasteEdit = {
  body: z
    .object({
      diet: z.enum(['veg', 'egg', 'non_veg']).nullable().optional(),
      spice: z.number().min(1).max(4).optional(),
      sweet: z.number().min(1).max(3).optional(),
      oiliness: z.number().min(1).max(3).optional(),
      budget: z.number().min(1).max(4).optional(),
      cuisineIds: idList.optional(),
      avoidIds: idList.optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' }),
};
