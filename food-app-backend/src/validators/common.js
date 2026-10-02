import { z } from 'zod';
import { decodeCursor, DEFAULT_LIMIT, MAX_LIMIT } from '../utils/pagination.js';

export const idParam = z.coerce.number().int().positive();
export const idParams = { params: z.object({ id: idParam }) };

export const lat = z.coerce.number().min(-90).max(90);
export const lng = z.coerce.number().min(-180).max(180);

export const queryBool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const pagination = {
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z
    .string()
    .max(500)
    .optional()
    .transform((c, ctx) => {
      if (c === undefined) return null;
      const decoded = decodeCursor(c);
      if (!decoded) ctx.addIssue({ code: 'custom', message: 'Invalid cursor' });
      return decoded;
    }),
};

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 h)');
