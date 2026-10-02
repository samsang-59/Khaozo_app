// rankingService (helper) — ranking numbers. The Bayesian average, trust weighting and
// Must order / Mixed reviews labels are computed in SQL (materialized views, migration 010);
// this helper refreshes them and holds the JS mirror of the formula (used in docs / tests).
// Match % and search ranking weights come with search in Phase 6.
import * as statsRepo from '../../repositories/stats.repo.js';

// Same formula as menu_item_stats.bayes_score
export const bayesianScore = ({ prior, ratings }) => {
  const weightSum = ratings.reduce((s, r) => s + r.weight, 0);
  const starSum = ratings.reduce((s, r) => s + r.weight * r.stars, 0);
  return (prior.weight * prior.mean + starSum) / (prior.weight + weightSum);
};

// Every ~5 min (worker): new ratings appear in rankings up to 5 min later (accepted trade-off).
export const refreshStats = () => statsRepo.refresh();
