// reviewService — place review + "Good for" tag votes (user), edit, delete, public list.
// Auto tag votes (code rules) + review embeddings are background jobs in Phases 5–6.
import * as reviewRepo from '../repositories/review.repo.js';
import * as placeRepo from '../repositories/place.repo.js';
import * as photoRepo from '../repositories/photo.repo.js';
import * as metaRepo from '../repositories/meta.repo.js';
import * as configService from './helpers/config.js';
import * as storageService from './helpers/storage.js';
import { page } from '../utils/pagination.js';
import { ok, fail } from '../utils/result.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const checkTags = async (tagIds) => {
  if (tagIds === undefined) return null;
  const unique = [...new Set(tagIds)];
  if (unique.length && (await metaRepo.countExisting('tags', unique)) !== unique.length) return 'TAG_NOT_FOUND';
  return null;
};

// POST /places/:id/reviews
export const create = async ({ userId, placeId, tagIds, ...fields }) => {
  const place = await placeRepo.findById(placeId);
  if (!place || place.deletedAt) return fail('PLACE_NOT_FOUND');
  if (place.status === 'closed') return fail('PLACE_CLOSED');
  const tagProblem = await checkTags(tagIds);
  if (tagProblem) return fail(tagProblem);

  const current = await reviewRepo.findCurrent(userId, placeId);
  if (current) {
    const days = await configService.get('rerate_after_days');
    const canReviewAgainAt = new Date(new Date(current.createdAt).getTime() + days * DAY_MS);
    if (Date.now() < canReviewAgainAt.getTime()) {
      return fail('REVIEW_TOO_SOON', { reviewId: current.id, canReviewAgainAt });
    }
  }

  const review = await reviewRepo.createWithTagVotes(userId, placeId, fields, tagIds && [...new Set(tagIds)]);
  return ok({ ...review, tagIds: await reviewRepo.userTagIds(userId, placeId) });
};

const owned = async (reviewId, userId) => {
  const review = await reviewRepo.findById(reviewId);
  if (!review) return { error: 'REVIEW_NOT_FOUND' };
  if (review.userId !== userId) return { error: 'NOT_ALLOWED' };
  return { review };
};

// PATCH /reviews/:id
export const update = async (reviewId, userId, { tagIds, ...fields }) => {
  const { review, error } = await owned(reviewId, userId);
  if (error) return fail(error);
  if (!review.isCurrent) return fail('REVIEW_NOT_CURRENT');
  const tagProblem = await checkTags(tagIds);
  if (tagProblem) return fail(tagProblem);
  const updated = await reviewRepo.updateWithTagVotes(review, fields, tagIds && [...new Set(tagIds)]);
  return ok({ ...updated, tagIds: await reviewRepo.userTagIds(userId, review.placeId) });
};

// DELETE /reviews/:id (the user's tag votes stay — they are separate "Good for" votes)
export const remove = async (reviewId, userId) => {
  const { error } = await owned(reviewId, userId);
  if (error) return fail(error);
  await storageService.destroyMany(await photoRepo.publicIdsFor('review', reviewId));
  await reviewRepo.remove(reviewId);
  return ok(null);
};

// GET /places/:id/reviews
export const listForPlace = async (placeId, { limit, cursor }) => {
  const place = await placeRepo.findById(placeId);
  if (!place || place.deletedAt) return fail('PLACE_NOT_FOUND');
  const rows = await reviewRepo.listForPlace(placeId, { limit, cursor });
  return ok(page(rows, limit, (r) => ({ t: r.createdAt, id: r.id })));
};
