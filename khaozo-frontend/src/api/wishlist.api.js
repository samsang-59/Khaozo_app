import { api } from './client.js';

export const listWishlist = () => api.get('/me/wishlist');
export const addToWishlist = (target) => api.post('/me/wishlist', target); // exactly one of placeId / menuItemId / standardDishId
export const removeFromWishlist = (id) => api.del(`/me/wishlist/${id}`);
