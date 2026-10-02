// aiAdapter — the only file that talks to AI providers. Services call chat() / embed().
//   chat:  Gemini → (limit / error / bad JSON) → OpenAI (if configured) → { ok: false }
//          → the calling service falls back to code (keyword search, no summary).
//   embed: Gemini only (vectors from different providers can't be compared).
// Safety: 5 s timeout, one retry, Zod-validated JSON, daily Gemini budget guard in Redis,
// embeddings cached 7 days. Never put private data (notes, emails, names) in prompts.
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import * as cacheRepo from '../repositories/redis/cache.repo.js';
import * as configService from '../services/helpers/config.js';

export const TIMEOUT_MS = 5000;
export const EMBED_DIMENSIONS = 768; // matches vector(768) columns
const EMBED_TTL_SECONDS = 7 * 24 * 60 * 60;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
const istDay = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

// Counts a Gemini call; false when today's budget is used up.
const takeGeminiBudget = async () => {
  const limit = (await configService.get('ai_daily_limit')).gemini;
  const { count } = await cacheRepo.incrementWindow(`ai:gemini:${istDay()}`, 26 * 60 * 60);
  return count <= limit;
};

const postJson = async (url, body, headers) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`AI call timed out after ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
};

// One retry for transient problems (timeout, 429, 5xx); a 4xx config error fails at once.
const withRetry = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    const transient = !err.status || err.status === 429 || err.status >= 500;
    if (!transient) throw err;
    return fn();
  }
};

// ---- Providers ----------------------------------------------------------------------

const geminiChat = async ({ system, user }) => {
  const json = await postJson(
    `${GEMINI_BASE}/${env.ai.geminiChatModel}:generateContent`,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    },
    { 'x-goog-api-key': env.ai.geminiKey },
  );
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
};

const openaiChat = async ({ system, user }) => {
  const json = await postJson(
    'https://api.openai.com/v1/chat/completions',
    {
      model: env.ai.openaiChatModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    },
    { Authorization: `Bearer ${env.ai.openaiKey}` },
  );
  return json.choices?.[0]?.message?.content ?? '';
};

const geminiEmbed = async (text, taskType) => {
  const json = await postJson(
    `${GEMINI_BASE}/${env.ai.geminiEmbedModel}:embedContent`,
    { content: { parts: [{ text }] }, taskType, outputDimensionality: EMBED_DIMENSIONS },
    { 'x-goog-api-key': env.ai.geminiKey },
  );
  const values = json.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMENSIONS) throw new Error('Bad embedding response');
  return values;
};

// ---- Public API ---------------------------------------------------------------------

// prompt: { system, user } · schema: Zod schema for the JSON answer
// → { ok: true, data, provider } | { ok: false, reason }
export const chat = async ({ system, user }, schema) => {
  const providers = [];
  if (env.ai.geminiKey) providers.push(['gemini', geminiChat]);
  if (env.ai.openaiKey && env.ai.openaiChatModel) providers.push(['openai', openaiChat]);

  for (const [name, call] of providers) {
    try {
      if (name === 'gemini' && !(await takeGeminiBudget())) continue; // budget used up → next
      const text = await withRetry(() => call({ system, user }));
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return { ok: true, data: parsed.data, provider: name };
      console.warn(`[ai] ${name} returned JSON that failed validation`);
    } catch (err) {
      console.warn(`[ai] ${name} chat failed: ${err.message}`);
    }
  }
  return { ok: false, reason: 'AI_UNAVAILABLE' };
};

// taskType: RETRIEVAL_QUERY (search text) · RETRIEVAL_DOCUMENT (stored reviews) ·
// SEMANTIC_SIMILARITY (dish names). → number[768] | null (null → caller uses keywords)
export const embed = async (text, taskType = 'SEMANTIC_SIMILARITY') => {
  if (!env.ai.geminiKey || !text?.trim()) return null;
  const key = `embed:${taskType}:${sha(text.trim().toLowerCase())}`;
  const cached = await cacheRepo.getJson(key);
  if (cached) return cached;
  try {
    if (!(await takeGeminiBudget())) return null;
    const vector = await withRetry(() => geminiEmbed(text.trim(), taskType));
    await cacheRepo.setJson(key, vector, EMBED_TTL_SECONDS);
    return vector;
  } catch (err) {
    console.warn(`[ai] embed failed: ${err.message}`);
    return null;
  }
};

export const isEnabled = () => Boolean(env.ai.geminiKey);
