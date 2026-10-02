import 'dotenv/config';
import { jest } from '@jest/globals';
import { z } from 'zod';

// Real config, but with fake AI keys (tests never call real providers — fetch is mocked below)
jest.unstable_mockModule('../../src/config/env.js', () => ({
  env: Object.freeze({
    nodeEnv: 'test', isTest: true, isProduction: false, port: 0,
    databaseUrl: process.env.TEST_DATABASE_URL, redisUrl: process.env.TEST_REDIS_URL,
    googleClientId: 'x', jwtSecret: 'x'.repeat(40), adminEmail: undefined,
    ai: Object.freeze({
      geminiKey: 'fake-gemini', geminiChatModel: 'gemini-test', geminiEmbedModel: 'embed-test',
      openaiKey: 'fake-openai', openaiChatModel: 'gpt-test',
    }),
  }),
}));

const ai = await import('../../src/ai/aiAdapter.js');
const configService = await import('../../src/services/helpers/config.js');
const { pool } = await import('../../src/config/db.js');
const { closeConnections } = await import('../helpers/connections.js');
const { resetCache } = await import('../helpers/db.js');

const schema = z.object({ dish: z.string().nullable() });
const prompt = { system: 's', user: 'biryani' };

// fetch mock: route by provider; each handler returns { status, body }
let routes;
const isGemini = (url) => url.includes('generativelanguage.googleapis.com');
global.fetch = jest.fn(async (url, opts) => {
  const handler = isGemini(url) ? (url.includes(':embedContent') ? routes.embed : routes.gemini) : routes.openai;
  const { status = 200, body = {} } = await handler(url, opts);
  return { ok: status < 400, status, json: async () => body };
});
const geminiText = (text) => ({ body: { candidates: [{ content: { parts: [{ text }] } }] } });
const openaiText = (text) => ({ body: { choices: [{ message: { content: text } }] } });
const calls = (kind) => global.fetch.mock.calls.filter(([url]) => (kind === 'openai' ? !isGemini(url) : isGemini(url))).length;

beforeEach(async () => {
  await resetCache();
  global.fetch.mockClear();
  routes = {
    gemini: async () => geminiText('{"dish":"biryani"}'),
    openai: async () => openaiText('{"dish":"from-openai"}'),
    embed: async () => ({ body: { embedding: { values: Array(768).fill(0.1) } } }),
  };
});
afterAll(async () => {
  await pool.query(`UPDATE config_settings SET value = '{"gemini": 500}' WHERE key = 'ai_daily_limit'`);
  await closeConnections();
});

describe('chat: Gemini → OpenAI → fail', () => {
  test('Gemini answers → used, validated', async () => {
    expect(await ai.chat(prompt, schema)).toEqual({ ok: true, data: { dish: 'biryani' }, provider: 'gemini' });
    expect(calls('openai')).toBe(0);
  });

  test('Zod rejects bad JSON from Gemini → OpenAI is tried', async () => {
    routes.gemini = async () => geminiText('{"dish": 42}');
    expect(await ai.chat(prompt, schema)).toMatchObject({ ok: true, provider: 'openai', data: { dish: 'from-openai' } });
  });

  test('not even JSON → next provider', async () => {
    routes.gemini = async () => geminiText('Sure! Here is biryani');
    expect((await ai.chat(prompt, schema)).provider).toBe('openai');
  });

  test('transient error → one retry, then fallback', async () => {
    routes.gemini = async () => ({ status: 503, body: { error: { message: 'busy' } } });
    expect((await ai.chat(prompt, schema)).provider).toBe('openai');
    expect(calls('gemini')).toBe(2); // first try + one retry
  });

  test('config error (400) → no retry', async () => {
    routes.gemini = async () => ({ status: 400, body: { error: { message: 'bad key' } } });
    await ai.chat(prompt, schema);
    expect(calls('gemini')).toBe(1);
  });

  test('both fail → { ok: false } (caller falls back to keywords)', async () => {
    routes.gemini = async () => ({ status: 500 });
    routes.openai = async () => ({ status: 500 });
    expect(await ai.chat(prompt, schema)).toEqual({ ok: false, reason: 'AI_UNAVAILABLE' });
  });

  test('5 s timeout aborts a hanging call', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    routes.gemini = (url, opts) => new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason)));
    routes.openai = async () => ({ status: 500 });
    try {
      const pending = ai.chat(prompt, schema);
      const waitForCall = async (n) => {
        while (calls('gemini') < n) await new Promise((r) => setImmediate(r));
      };
      await waitForCall(1);
      jest.advanceTimersByTime(4999);
      expect(calls('gemini')).toBe(1); // not aborted yet
      jest.advanceTimersByTime(1);
      await waitForCall(2); // aborted at 5 s → retried once
      jest.advanceTimersByTime(5000);
      expect(await pending).toEqual({ ok: false, reason: 'AI_UNAVAILABLE' });
    } finally {
      jest.useRealTimers();
    }
  });

  test('daily budget guard switches to the fallback before the free-tier limit', async () => {
    await pool.query(`UPDATE config_settings SET value = '{"gemini": 2}' WHERE key = 'ai_daily_limit'`);
    await configService.clearCache();
    expect((await ai.chat(prompt, schema)).provider).toBe('gemini');
    expect((await ai.chat(prompt, schema)).provider).toBe('gemini');
    expect((await ai.chat(prompt, schema)).provider).toBe('openai'); // 3rd call of the day
    expect(calls('gemini')).toBe(2);
    await pool.query(`UPDATE config_settings SET value = '{"gemini": 500}' WHERE key = 'ai_daily_limit'`);
    await configService.clearCache();
  });
});

describe('embed: Gemini only, cached', () => {
  test('returns 768 numbers and caches by text', async () => {
    const v = await ai.embed('Chicken Dum Biryani');
    expect(v).toHaveLength(768);
    await ai.embed('chicken dum biryani'); // same text (case-insensitive) → cache
    expect(calls('gemini')).toBe(1);
    expect(calls('openai')).toBe(0);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).outputDimensionality).toBe(768);
  });

  test('failure → null (never another provider)', async () => {
    routes.embed = async () => ({ status: 500 });
    expect(await ai.embed('cozy')).toBeNull();
    expect(calls('openai')).toBe(0);
  });
});
