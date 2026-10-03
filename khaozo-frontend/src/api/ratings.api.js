import { api } from './client.js';

export const createRating = (menuItemId, body) => api.post(`/menu-items/${menuItemId}/ratings`, body);
export const updateRating = (id, body) => api.patch(`/ratings/${id}`, body);
export const deleteRating = (id) => api.del(`/ratings/${id}`);
