// All settings come from environment variables — same code on laptop and Railway.
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),
  TEST_REDIS_URL: z.string().min(1).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment variables — ${problems}`);
}

const raw = parsed.data;
const isTest = raw.NODE_ENV === 'test';

if (isTest && (!raw.TEST_DATABASE_URL || !raw.TEST_REDIS_URL)) {
  throw new Error('TEST_DATABASE_URL and TEST_REDIS_URL are required when NODE_ENV=test');
}

export const env = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  isTest,
  isProduction: raw.NODE_ENV === 'production',
  port: raw.PORT,
  // Tests always run against the separate test DB (food_app_test) and Redis DB
  databaseUrl: isTest ? raw.TEST_DATABASE_URL : raw.DATABASE_URL,
  redisUrl: isTest ? raw.TEST_REDIS_URL : raw.REDIS_URL,
});
