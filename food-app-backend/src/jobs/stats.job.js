// Every ~5 min: REFRESH MATERIALIZED VIEW CONCURRENTLY menu_item_stats, place_stats.
import * as rankingService from '../services/helpers/ranking.js';

export default async () => {
  await rankingService.refreshStats();
  return { refreshed: true };
};
