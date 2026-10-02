// After a review (mood tags from tick boxes) or a rating (meal-time tag from the time).
import * as tagService from '../services/helpers/tag.js';

export default async ({ kind, id }) => {
  const added = kind === 'review' ? await tagService.autoTagReview(id) : await tagService.autoTagRating(id);
  return { added };
};
