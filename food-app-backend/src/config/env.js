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
  GOOGLE_CLIENT_ID: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  ADMIN_EMAIL: z.string().email().optional(),
  // AI (Phase 6). Without GEMINI_API_KEY the app still works: search falls back to keywords.
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_CHAT_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  GEMINI_EMBED_MODEL: z.string().min(1).default('gemini-embedding-001'),
  // Optional chat fallback — used only when both are set.
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_CHAT_MODEL: z.string().min(1).optional(),
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
  googleClientId: raw.GOOGLE_CLIENT_ID,
  jwtSecret: raw.JWT_SECRET,
  adminEmail: raw.ADMIN_EMAIL,
  // Tests never call real AI (no cost, no flakiness): keys are ignored when NODE_ENV=test.
  ai: Object.freeze({
    geminiKey: isTest ? undefined : raw.GEMINI_API_KEY,
    geminiChatModel: raw.GEMINI_CHAT_MODEL,
    geminiEmbedModel: raw.GEMINI_EMBED_MODEL,
    openaiKey: isTest ? undefined : raw.OPENAI_API_KEY,
    openaiChatModel: raw.OPENAI_CHAT_MODEL,
  }),
});
