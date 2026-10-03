import { api, cleanParams } from './client.js';

export const matchDish = (q) => api.get('/dishes/match', { q });
export const bestForDish = (id, params) => api.get(`/dishes/${id}/best`, cleanParams(params));
// { name, price?, standardDishId?, newDish? } → 409 DISH_NEEDS_CONFIRMATION with candidates
export const addMenuItem = (placeId, body) => api.post(`/places/${placeId}/menu-items`, body);
