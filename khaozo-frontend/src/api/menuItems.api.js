import { api, cleanParams } from './client.js';

export const getMenuItem = (id) => api.get(`/menu-items/${id}`);
export const listMenuItemRatings = (id, params) => api.get(`/menu-items/${id}/ratings`, cleanParams(params));
