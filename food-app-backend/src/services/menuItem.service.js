// menuItemService — add a menu item, dish page, ratings list (AI summary job comes in Phase 6).
import * as placeRepo from '../repositories/place.repo.js';
import * as dishRepo from '../repositories/dish.repo.js';
import * as menuItemRepo from '../repositories/menuItem.repo.js';
import * as metaRepo from '../repositories/meta.repo.js';
import * as ratingRepo from '../repositories/rating.repo.js';
import * as dishMatcher from './helpers/dishMatcher.js';
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
  return ok({ ...item, standardDish: { id: dish.id, name: dish.name, status: dish.status } });
};

// GET /menu-items/:id — dish page (stats / label / typical spice join in with Phase 5)
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
    stats: null,
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
