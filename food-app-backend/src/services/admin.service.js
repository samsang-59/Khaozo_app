// adminService — queues (reports, unverified places, pending dishes), place actions,
// dish create / approve / merge, config editor. Report accept / reject lives in reportService.
import * as reportRepo from '../repositories/report.repo.js';
import * as placeRepo from '../repositories/place.repo.js';
import * as dishRepo from '../repositories/dish.repo.js';
import * as metaRepo from '../repositories/meta.repo.js';
import * as configRepo from '../repositories/config.repo.js';
import * as cacheRepo from '../repositories/redis/cache.repo.js';
import * as configService from './helpers/config.js';
import * as jobQueue from './helpers/jobQueue.js';
import { dietClash } from '../utils/dishDiet.js';
import { page } from '../utils/pagination.js';
import { ok, fail } from '../utils/result.js';

// Similar active dishes shown next to each pending dish ("merge into X?")
const MERGE_SUGGESTIONS = 3;

const byId = (r) => ({ id: r.id });

// ---- Queues -----------------------------------------------------------------------

export const reports = async ({ status, limit, cursor }) =>
  ok(page(await reportRepo.listForAdmin({ status, limit, cursor }), limit, byId));

export const places = async ({ status, limit, cursor }) =>
  ok(page(await placeRepo.listForAdmin({ status, limit, cursor }), limit, byId));

export const pendingDishes = async ({ limit, cursor }) => {
  const { items, nextCursor } = page(await dishRepo.listPending({ limit, cursor }), limit, byId);
  for (const d of items) {
    const similar = await dishRepo.findSimilar(d.name, MERGE_SUGGESTIONS + 1);
    d.similar = similar
      .filter((s) => s.id !== d.id && s.status === 'active')
      .slice(0, MERGE_SUGGESTIONS)
      .map(({ id, name, category, diet, score }) => ({ id, name, category, diet, score }));
  }
  return ok({ items, nextCursor });
};

// ---- Places -----------------------------------------------------------------------

// PATCH /admin/places/:id — verify (admin override) / close / delete (soft) / restore
export const placeAction = async (placeId, action) => {
  const place = await placeRepo.findById(placeId);
  if (!place) return fail('PLACE_NOT_FOUND');
  const changed = await placeRepo.applyAdminAction(placeId, action);
  if (!changed) return fail('PLACE_ACTION_NOT_APPLICABLE');
  await cacheRepo.del(`place:${placeId}`);
  await jobQueue.add(jobQueue.JOBS.REFRESH_STATS, {});
  const updated = await placeRepo.findById(placeId);
  return ok({ id: updated.id, name: updated.name, status: updated.status, verifiedAt: updated.verifiedAt, deletedAt: updated.deletedAt });
};

// ---- Dishes -----------------------------------------------------------------------

// Category / cuisine / ingredient exist, and veg / non-veg fits the main ingredient.
const checkDishDetails = async ({ categoryId, cuisineId, mainIngredientId, diet }) => {
  if (categoryId && (await metaRepo.countExisting('dish_categories', [categoryId])) !== 1) {
    return fail('VALIDATION_ERROR', [{ path: 'body.categoryId', message: 'Unknown category' }]);
  }
  if (cuisineId && (await metaRepo.countExisting('cuisines', [cuisineId])) !== 1) return fail('CUISINE_NOT_FOUND');
  let ingredientName = null;
  if (mainIngredientId) {
    const ing = await metaRepo.findMainIngredient(mainIngredientId);
    if (!ing) return fail('INGREDIENT_NOT_FOUND');
    ingredientName = ing.name;
  }
  if (dietClash(ingredientName, diet)) return fail('DIET_INGREDIENT_MISMATCH');
  return null;
};

// POST /admin/dishes — straight into the catalog as active (+ aliases)
export const createDish = async ({ name, categoryId, cuisineId, mainIngredientId = null, diet, aliases = [] }) => {
  const problem = await checkDishDetails({ categoryId, cuisineId, mainIngredientId, diet });
  if (problem) return problem;
  if (await dishRepo.nameTaken(name)) return fail('DISH_NAME_TAKEN');
  const id = await dishRepo.createActive({ name, categoryId, cuisineId, mainIngredientId, diet, aliases: [...new Set(aliases)] });
  if (!id) return fail('DISH_NAME_TAKEN');
  await jobQueue.add(jobQueue.JOBS.EMBED_DISHES, {});
  return ok(await dishRepo.findById(id));
};

// PATCH /admin/dishes/:id — { action: 'approve', ...fixes } | { action: 'merge', intoId }
export const updateDish = async (dishId, { action, intoId, ...fields }) => {
  const dish = await dishRepo.findById(dishId);
  if (!dish) return fail('DISH_NOT_FOUND');
  return action === 'merge' ? mergeDish(dish, intoId) : approveDish(dish, fields);
};

const approveDish = async (dish, fields) => {
  if (dish.status !== 'pending_review') return fail('DISH_NOT_PENDING');
  const problem = await checkDishDetails({
    categoryId: fields.categoryId,
    cuisineId: fields.cuisineId,
    mainIngredientId: fields.mainIngredientId !== undefined ? fields.mainIngredientId : dish.mainIngredientId,
    diet: fields.diet ?? dish.diet,
  });
  if (problem) return problem;
  if (fields.name !== undefined && (await dishRepo.nameTaken(fields.name, dish.id))) return fail('DISH_NAME_TAKEN');
  await dishRepo.approve(dish.id, fields);
  await jobQueue.add(jobQueue.JOBS.EMBED_DISHES, {});
  return ok(await dishRepo.findById(dish.id));
};

const mergeDish = async (dish, intoId) => {
  if (intoId === dish.id) return fail('DISH_MERGE_INTO_SELF');
  const target = await dishRepo.findById(intoId);
  if (!target || target.status !== 'active') return fail('DISH_MERGE_TARGET_INVALID');
  const moved = await dishRepo.mergeInto(dish.id, intoId);
  await jobQueue.add(jobQueue.JOBS.REFRESH_STATS, {});
  return ok({ mergedDishId: dish.id, into: await dishRepo.findById(intoId), ...moved });
};

// ---- Config -----------------------------------------------------------------------

export const config = async () => ok(await configRepo.listForAdmin());

// Admin tunes values, not the structure: the new value must have the same JSON shape as the
// current one (numbers stay numbers ≥ 0, objects keep exactly their keys, lists their length).
// → list of problems ([] = fine)
export const shapeProblems = (current, next, path = 'value') => {
  if (typeof current === 'number') {
    return typeof next === 'number' && Number.isFinite(next) && next >= 0 ? [] : [`${path} must be a number ≥ 0`];
  }
  if (typeof current === 'boolean' || typeof current === 'string') {
    return typeof next === typeof current ? [] : [`${path} must be a ${typeof current}`];
  }
  if (Array.isArray(current)) {
    if (!Array.isArray(next) || next.length !== current.length) return [`${path} must be a list of ${current.length}`];
    return current.flatMap((c, i) => shapeProblems(c, next[i], `${path}[${i}]`));
  }
  if (current && typeof current === 'object') {
    if (!next || typeof next !== 'object' || Array.isArray(next)) return [`${path} must be an object`];
    const keys = Object.keys(current);
    const extra = Object.keys(next).filter((k) => !keys.includes(k));
    if (extra.length) return [`${path} has unknown keys: ${extra.join(', ')}`];
    return keys.flatMap((k) => (k in next ? shapeProblems(current[k], next[k], `${path}.${k}`) : [`${path}.${k} is missing`]));
  }
  return [];
};

// PATCH /admin/config — { key, value }; clears the config cache so every process sees it
// within one request (API) or one job (worker reads through the same cache).
export const updateConfig = async (adminId, { key, value }) => {
  const current = await configRepo.findValue(key);
  if (!current) return fail('CONFIG_KEY_NOT_FOUND');
  const problems = shapeProblems(current.value, value);
  if (problems.length) return fail('CONFIG_VALUE_INVALID', problems.map((message) => ({ path: 'body.value', message })));
  const updated = await configRepo.update(key, value, adminId);
  await configService.clearCache();
  return ok(updated);
};
