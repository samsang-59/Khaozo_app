// configService (helper) — reads business rules from config_settings, cached in Redis (config:all, 5 min).
import * as configRepo from '../../repositories/config.repo.js';
import * as cacheRepo from '../../repositories/redis/cache.repo.js';

export const CONFIG_CACHE_KEY = 'config:all';
const CONFIG_TTL_SECONDS = 5 * 60;

export const getAll = async () => {
  const cached = await cacheRepo.getJson(CONFIG_CACHE_KEY);
  if (cached) return cached;
  const all = await configRepo.getAll();
  await cacheRepo.setJson(CONFIG_CACHE_KEY, all, CONFIG_TTL_SECONDS);
  return all;
};

export const get = async (key) => {
  const all = await getAll();
  if (!(key in all)) throw new Error(`Missing config setting: ${key}`);
  return all[key];
};

// Called when admin edits config (PATCH /admin/config)
export const clearCache = () => cacheRepo.del(CONFIG_CACHE_KEY);
