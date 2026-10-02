// Embeddings (Gemini): dishes without one (sweep) and single reviews.
import * as dishService from '../services/dish.service.js';
import * as reviewService from '../services/review.service.js';

export const embedDishes = async () => (await dishService.embedMissingDishes()).data;
export const embedReview = async ({ reviewId }) => (await reviewService.embedReview(reviewId)).data;
