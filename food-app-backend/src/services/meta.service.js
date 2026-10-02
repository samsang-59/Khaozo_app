// metaService — areas, cuisines, categories, ingredients, tags (cached meta:<name>, 24 h).
import * as metaRepo from '../repositories/meta.repo.js';
import * as cacheRepo from '../repositories/redis/cache.repo.js';
import { ok } from '../utils/result.js';

const META_TTL_SECONDS = 24 * 60 * 60;

const cached = async (name, load) => {
  const key = `meta:${name}`;
  const hit = await cacheRepo.getJson(key);
  if (hit) return ok(hit);
  const data = await load();
  await cacheRepo.setJson(key, data, META_TTL_SECONDS);
  return ok(data);
};

export const areas = () => cached('areas', metaRepo.listAreas);
export const cuisines = () => cached('cuisines', () => metaRepo.listNamed('cuisines'));
export const dishCategories = () => cached('dish-categories', () => metaRepo.listNamed('dish_categories'));
export const mainIngredients = () => cached('main-ingredients', () => metaRepo.listNamed('main_ingredients'));
export const tags = () => cached('tags', metaRepo.listTags);

// For when admin edits lookup lists (no admin route for that in v1 — lookups change via migrations)
export const clearCache = () => cacheRepo.delByPrefix('meta:');
