import { z } from 'zod';

// One short line about a labelled dish, from its text reviews.
export const dishSummarySchema = z.object({
  summary: z.string().trim().min(5).max(160),
});
