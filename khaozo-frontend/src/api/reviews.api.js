import { api, cleanParams } from './client.js';

export const createReview = (placeId, body) => api.post(`/places/${placeId}/reviews`, body);
export const updateReview = (id, body) => api.patch(`/reviews/${id}`, body);
export const deleteReview = (id) => api.del(`/reviews/${id}`);
export const listPlaceReviews = (placeId, params) => api.get(`/places/${placeId}/reviews`, cleanParams(params));
