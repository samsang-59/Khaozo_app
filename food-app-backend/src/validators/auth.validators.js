import { z } from 'zod';

export const googleLogin = {
  body: z.object({
    idToken: z.string().min(10).max(5000),
  }),
};
