import { api } from './client.js';

export const listAreas = () => api.get('/areas');
export const listCuisines = () => api.get('/cuisines');
export const listDishCategories = () => api.get('/dish-categories');
export const listMainIngredients = () => api.get('/main-ingredients');
export const listTags = () => api.get('/tags');
