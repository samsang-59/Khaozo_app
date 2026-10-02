// dishService — dish match, best places for a dish (embeddings job comes in Phase 6).
import * as dishMatcher from './helpers/dishMatcher.js';
import * as dishRepo from '../repositories/dish.repo.js';
import * as statsRepo from '../repositories/stats.repo.js';
import { page } from '../utils/pagination.js';
import { ok, fail } from '../utils/result.js';

const publicDish = (d) => ({
  id: d.id,
  name: d.name,
  diet: d.diet,
  status: d.status,
  category: d.category,
  cuisine: d.cuisine,
  mainIngredient: d.mainIngredient,
  ...(d.score !== undefined ? { score: d.score } : {}),
});

// GET /dishes/match?q= — "chkn biryani" → Chicken Dum Biryani
export const match = async (q) => {
  const result = await dishMatcher.match(q);
  return ok({
    level: result.level,
    match: result.match && publicDish(result.match),
    candidates: result.candidates.map(publicDish),
  });
};

// GET /dishes/:id/best — "Best biryani in town": places ranked by the Bayesian score of
// their menu item for this standard dish. lat/lng only adds the distance for display.
export const best = async (standardDishId, { lat, lng, limit, cursor }) => {
  const dish = await dishRepo.findById(standardDishId);
  if (!dish) return fail('DISH_NOT_FOUND');
  const rows = await statsRepo.bestForDish(standardDishId, { lat, lng, limit, cursor });
  const { items, nextCursor } = page(rows, limit, (r) => ({ s: r.bayesScore, id: r.menuItemId }));
  return ok({
    dish: publicDish(dish),
    items: items.map((r) => ({
      menuItem: { id: r.menuItemId, name: r.menuItemName, price: r.price },
      place: { id: r.placeId, name: r.placeName, area: r.areaName, status: r.placeStatus, location: { lat: r.lat, lng: r.lng } },
      distanceM: r.distanceM == null ? null : Math.round(r.distanceM),
      stats: { ratingCount: r.ratingCount, avgStars: r.avgStars, bayesScore: r.bayesScore, orderAgainPct: r.orderAgainPct, label: r.label, typicalSpice: r.typicalSpice },
    })),
    nextCursor,
  });
};
