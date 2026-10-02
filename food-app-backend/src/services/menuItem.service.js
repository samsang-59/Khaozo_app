// menuItemService — add a menu item, dish page, ratings list, AI one-line summary job.
import * as placeRepo from '../repositories/place.repo.js';
import * as dishRepo from '../repositories/dish.repo.js';
import * as menuItemRepo from '../repositories/menuItem.repo.js';
import * as metaRepo from '../repositories/meta.repo.js';
import * as ratingRepo from '../repositories/rating.repo.js';
import * as statsRepo from '../repositories/stats.repo.js';
import * as dishMatcher from './helpers/dishMatcher.js';
import * as configService from './helpers/config.js';
import * as jobQueue from './helpers/jobQueue.js';
import * as aiAdapter from '../ai/aiAdapter.js';
import { dishSummarySchema } from '../ai/schemas/dishSummary.js';
import { dishSummaryPrompt } from '../ai/prompts/dishSummary.js';
import { page } from '../utils/pagination.js';
import { ok, fail } from '../utils/result.js';

const MEAT_OR_FISH = new Set(['Chicken', 'Mutton', 'Fish', 'Prawn', 'Crab']);

// Code-level sanity (data model Step 7): no "Chicken + veg", no "Egg + veg".
const dietClash = (ingredientName, diet) => {
  if (!ingredientName) return false;
  if (MEAT_OR_FISH.has(ingredientName)) return diet !== 'non_veg';
  if (ingredientName === 'Egg') return diet === 'veg';
  return false;
};

// input: { name, price?, standardDishId?, newDish?: { categoryId, cuisineId, mainIngredientId?, diet } }
// Dish resolution:
//   standardDishId given          → user picked / confirmed the dish
//   name matches exactly          → auto-link
//   name similar to known dishes  → 409 DISH_NEEDS_CONFIRMATION + candidates ("Is this X?")
//   no match                      → newDish details required → new standard dish (pending admin review)
export const addMenuItem = async (placeId, userId, input) => {
  const place = await placeRepo.findById(placeId);
  if (!place || place.deletedAt) return fail('PLACE_NOT_FOUND');
  if (place.status === 'closed') return fail('PLACE_CLOSED');

  const existingId = await menuItemRepo.findSameName(placeId, input.name);
  if (existingId) return fail('MENU_ITEM_EXISTS', { menuItemId: existingId });

  let standardDishId = input.standardDishId;
  if (standardDishId) {
    const dish = await dishRepo.findById(standardDishId);
    if (!dish) return fail('DISH_NOT_FOUND');
    // The user confirmed "Is this X?" for a typed spelling → remember it as an alias
    const m = await dishMatcher.match(input.name);
    if (m.level === 'similar' && m.candidates.some((c) => c.id === standardDishId)) {
      await dishRepo.addAlias(input.name, standardDishId);
    }
  } else {
    const m = await dishMatcher.match(input.name);
    if (m.level === 'exact') standardDishId = m.match.id;
    else if (m.level === 'similar' && !input.newDish) {
      return fail('DISH_NEEDS_CONFIRMATION', { candidates: m.candidates.map(({ id, name, category, diet, score }) => ({ id, name, category, diet, score })) });
    } else {
      if (!input.newDish) return fail('DISH_DETAILS_REQUIRED');
      const nd = input.newDish;
      const counts = await Promise.all([
        metaRepo.countExisting('dish_categories', [nd.categoryId]),
        metaRepo.countExisting('cuisines', [nd.cuisineId]),
      ]);
      if (counts.some((n) => n !== 1)) return fail('VALIDATION_ERROR', [{ path: 'body.newDish', message: 'Unknown category or cuisine' }]);
      let ingredientName = null;
      if (nd.mainIngredientId) {
        const ing = await metaRepo.findMainIngredient(nd.mainIngredientId);
        if (!ing) return fail('INGREDIENT_NOT_FOUND');
        ingredientName = ing.name;
      }
      if (dietClash(ingredientName, nd.diet)) return fail('DIET_INGREDIENT_MISMATCH');
      standardDishId = await dishRepo.createPending({
        name: input.name.trim(),
        categoryId: nd.categoryId,
        cuisineId: nd.cuisineId,
        mainIngredientId: nd.mainIngredientId ?? null,
        diet: nd.diet,
        createdBy: userId,
      });
      if (!standardDishId) {
        // a dish with this exact name appeared meanwhile → link to it
        standardDishId = (await dishRepo.findExact(input.name.trim()))?.id;
      }
    }
  }

  const item = await menuItemRepo.create({
    placeId,
    standardDishId,
    name: input.name.trim(),
    price: input.price ?? null,
    addedBy: userId,
  });
  const dish = await dishRepo.findById(standardDishId);
  if (dish.status === 'pending_review') await jobQueue.add(jobQueue.JOBS.EMBED_DISHES, {});
  return ok({ ...item, standardDish: { id: dish.id, name: dish.name, status: dish.status } });
};

// GET /menu-items/:id — dish page (stats, label, typical spice; + your rating)
export const details = async (menuItemId, userId = null) => {
  const item = await menuItemRepo.findById(menuItemId);
  if (!item || item.status !== 'active' || item.placeDeletedAt) return fail('MENU_ITEM_NOT_FOUND');
  const data = {
    id: item.id,
    name: item.name,
    price: item.price,
    place: { id: item.placeId, name: item.placeName, status: item.placeStatus },
    standardDish: { id: item.standardDishId, name: item.standardDishName, diet: item.diet, category: item.category, cuisine: item.cuisine },
    aiSummary: item.aiSummary,
    stats: await statsRepo.forMenuItem(menuItemId),
  };
  if (userId) data.myRating = await ratingRepo.findCurrent(userId, menuItemId);
  return ok(data);
};

// GET /menu-items/:id/ratings
export const ratings = async (menuItemId, { limit, cursor }) => {
  const item = await menuItemRepo.findById(menuItemId);
  if (!item || item.placeDeletedAt) return fail('MENU_ITEM_NOT_FOUND');
  const rows = await ratingRepo.listForMenuItem(menuItemId, { limit, cursor });
  return ok(page(rows, limit, (r) => ({ t: r.createdAt, id: r.id })));
};

// Job: AI one-line summary for labelled dishes (Must order / Mixed reviews), from text reviews.
// Written the first time a labelled dish has text reviews, then refreshed every
// summary_refresh_every new text reviews. AI unavailable → no summary (retried next time).
export const refreshSummaryIfDue = async (menuItemId) => {
  const s = await menuItemRepo.summaryInputs(menuItemId);
  if (!s || !s.label || s.reviews.length === 0) return ok({ updated: false, why: 'not labelled or no text reviews' });
  const every = await configService.get('summary_refresh_every');
  const due = s.summaryUpdatedAt === null || s.newTextReviews >= every;
  if (!due) return ok({ updated: false, why: 'not due' });
  const ai = await aiAdapter.chat(
    dishSummaryPrompt({ dishName: s.name, placeName: s.placeName, label: s.label, reviews: s.reviews }),
    dishSummarySchema,
  );
  if (!ai.ok) return ok({ updated: false, why: 'AI unavailable' });
  await menuItemRepo.setSummary(menuItemId, ai.data.summary);
  return ok({ updated: true, summary: ai.data.summary });
};
