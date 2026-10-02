// Zod schema for search step 2 (sentence → filters). Every AI answer is validated before use.
import { z } from 'zod';

export const MOODS = ['Work', 'Study', 'Date', 'Family', 'Friends', 'Solo', 'Quick bite', 'Late night', 'Celebration', 'Budget'];
export const MEAL_TIMES = ['Breakfast', 'Lunch', 'Evening snacks', 'Dinner', 'Late night'];
export const SPICE = ['mild', 'medium', 'spicy', 'very_spicy'];
export const DIETS = ['veg', 'egg', 'non_veg'];

const text = z.string().trim().min(1).max(80);
const opt = (schema) => schema.nullish().transform((v) => v ?? null);

export const searchFiltersSchema = z.object({
  dish: opt(text),
  spice: opt(z.enum(SPICE)),
  maxPrice: opt(z.number().int().positive().max(100000)),
  area: opt(text),
  openNow: opt(z.boolean()),
  mood: opt(z.enum(MOODS)),
  mealTime: opt(z.enum(MEAL_TIMES)),
  diet: opt(z.enum(DIETS)),
  vibe: opt(text),
});

export const EMPTY_FILTERS = Object.freeze({
  dish: null, spice: null, maxPrice: null, area: null, openNow: null, mood: null, mealTime: null, diet: null, vibe: null,
});
