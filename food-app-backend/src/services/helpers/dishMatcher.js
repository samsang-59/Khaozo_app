// dishMatcher (helper) — typed name → standard dish.
// Steps: alias / exact name → pg_trgm similar names & aliases → (embedding step added in Phase 6).
//   exact   → auto-link
//   similar → ask the user "Is this the same as X?" (candidates, best first)
//   none    → new standard dish, flagged for admin review
import * as dishRepo from '../../repositories/dish.repo.js';

const normalise = (text) => text.trim().replace(/\s+/g, ' ');

export const match = async (text) => {
  const clean = normalise(text);
  const exact = await dishRepo.findExact(clean);
  if (exact) return { level: 'exact', match: exact, candidates: [] };

  const candidates = await dishRepo.findSimilar(clean);
  if (candidates.length) return { level: 'similar', match: null, candidates };

  return { level: 'none', match: null, candidates: [] };
};
