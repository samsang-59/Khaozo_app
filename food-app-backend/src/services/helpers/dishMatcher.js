// dishMatcher (helper) — typed name → standard dish.
// Steps: alias / exact name → pg_trgm similar names & aliases → embedding (Gemini + pgvector).
//   exact   → auto-link
//   similar → ask the user "Is this the same as X?" (candidates, best first)
//   none    → new standard dish, flagged for admin review
// Used by dishService, menuItemService and searchService.
import * as dishRepo from '../../repositories/dish.repo.js';
import * as aiAdapter from '../../ai/aiAdapter.js';

// Embedding matches below this cosine similarity are not offered ("Is this X?")
export const EMBEDDING_MIN_SIMILARITY = 0.75;

const normalise = (text) => text.trim().replace(/\s+/g, ' ');

export const match = async (text) => {
  const clean = normalise(text);
  const exact = await dishRepo.findExact(clean);
  if (exact) return { level: 'exact', match: exact, candidates: [] };

  const candidates = await dishRepo.findSimilar(clean);
  if (candidates.length) return { level: 'similar', match: null, candidates };

  // Spelling didn't help — compare meaning ("chkn dum pulao" → biryani-like dishes).
  // No AI key / budget / network → this step is skipped and the dish counts as new.
  const vector = await aiAdapter.embed(clean, 'SEMANTIC_SIMILARITY');
  if (vector) {
    const near = await dishRepo.findNearestByEmbedding(vector, { limit: 5, minSimilarity: EMBEDDING_MIN_SIMILARITY });
    if (near.length) return { level: 'similar', match: null, candidates: near, via: 'embedding' };
  }
  return { level: 'none', match: null, candidates: [] };
};
