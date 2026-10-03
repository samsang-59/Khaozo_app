import { api, cleanParams } from './client.js';

export const listReports = (params) => api.get('/admin/reports', cleanParams(params));
export const resolveReport = (id, body) => api.patch(`/admin/reports/${id}`, body); // { action, change? }
export const listAdminPlaces = (params) => api.get('/admin/places', cleanParams(params));
export const placeAction = (id, action) => api.patch(`/admin/places/${id}`, { action });
export const listPendingDishes = (params) => api.get('/admin/dishes/pending', cleanParams(params));
export const createDish = (body) => api.post('/admin/dishes', body);
export const updateDish = (id, body) => api.patch(`/admin/dishes/${id}`, body); // approve | merge
export const removeReview = (id) => api.del(`/admin/reviews/${id}`);
export const removeRating = (id) => api.del(`/admin/ratings/${id}`);
export const getConfig = () => api.get('/admin/config');
export const updateConfig = (key, value) => api.patch('/admin/config', { key, value });
