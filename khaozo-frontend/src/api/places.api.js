import { api, cleanParams } from './client.js';

export const listPlaces = (params) => api.get('/places', cleanParams(params));
export const getPlace = (id) => api.get(`/places/${id}`);
export const getMenu = (id) => api.get(`/places/${id}/menu`);
export const addPlace = (body) => api.post('/places', body);
export const confirmPlace = (id) => api.post(`/places/${id}/confirm`);
export const reportPlace = (id, body) => api.post(`/places/${id}/reports`, body);
export const setHours = (id, hours) => api.put(`/places/${id}/hours`, { hours });
