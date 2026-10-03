import { api, cleanParams } from './client.js';

// q + optional lat/lng/areaId + UI overrides (maxPrice, openNow, diet, mood, mealTime, spice, showAll)
export const search = (params) => api.get('/search', cleanParams(params), { timeout: 15000 });
