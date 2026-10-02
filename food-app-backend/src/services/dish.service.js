// dishService — dish match (best places for a dish + embeddings job come in Phases 5–6).
import * as dishMatcher from './helpers/dishMatcher.js';
import { ok } from '../utils/result.js';

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
