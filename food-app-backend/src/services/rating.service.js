// ratingService — rate a dish (30-day rule, is_current history), edit, delete, mark wishlist tried.
// Background jobs are queued only after the transaction has committed.
import * as ratingRepo from '../repositories/rating.repo.js';
import * as menuItemRepo from '../repositories/menuItem.repo.js';
import * as wishlistRepo from '../repositories/wishlist.repo.js';
import * as photoRepo from '../repositories/photo.repo.js';
import * as cacheRepo from '../repositories/redis/cache.repo.js';
import * as configService from './helpers/config.js';
import * as storageService from './helpers/storage.js';
import * as jobQueue from './helpers/jobQueue.js';
import { ok, fail } from '../utils/result.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const ratable = (item) => {
  if (!item || item.status !== 'active') return 'MENU_ITEM_NOT_FOUND';
  if (item.placeDeletedAt) return 'MENU_ITEM_NOT_FOUND';
  if (item.placeStatus === 'closed') return 'PLACE_CLOSED';
  return null;
};

// POST /menu-items/:id/ratings
export const create = async ({ userId, menuItemId, ...fields }) => {
  const item = await menuItemRepo.findById(menuItemId);
  const problem = ratable(item);
  if (problem) return fail(problem);

  const current = await ratingRepo.findCurrent(userId, menuItemId);
  if (current) {
    // One vote per dish: edit it, or add a fresh rating once the re-rate window has passed.
    const days = await configService.get('rerate_after_days');
    const canRateAgainAt = new Date(new Date(current.createdAt).getTime() + days * DAY_MS);
    if (Date.now() < canRateAgainAt.getTime()) {
      return fail('RATING_TOO_SOON', { ratingId: current.id, canRateAgainAt });
    }
  }

  const rating = await ratingRepo.replaceCurrent(userId, menuItemId, fields); // committed here
  await wishlistRepo.markTried(userId, { menuItemId, standardDishId: item.standardDishId });
  await jobQueue.add(jobQueue.JOBS.LEARN_TASTE, { userId });
  await jobQueue.add(jobQueue.JOBS.AUTO_TAGS, { kind: 'rating', id: rating.id });
  if (rating.reviewText) await jobQueue.add(jobQueue.JOBS.SUMMARY, { menuItemId });
  return ok(rating);
};

const owned = async (ratingId, userId) => {
  const rating = await ratingRepo.findById(ratingId);
  if (!rating) return { error: 'RATING_NOT_FOUND' };
  if (rating.userId !== userId) return { error: 'NOT_ALLOWED' };
  return { rating };
};

// PATCH /ratings/:id — edit anytime (only the current rating; history stays as it was)
export const update = async (ratingId, userId, fields) => {
  const { rating, error } = await owned(ratingId, userId);
  if (error) return fail(error);
  if (!rating.isCurrent) return fail('RATING_NOT_CURRENT');
  const updated = await ratingRepo.update(ratingId, fields);
  await jobQueue.add(jobQueue.JOBS.LEARN_TASTE, { userId });
  if (fields.reviewText) await jobQueue.add(jobQueue.JOBS.SUMMARY, { menuItemId: rating.menuItemId });
  return ok(updated);
};

// DELETE /ratings/:id — removes the rating and its photos (Cloudinary files first)
export const remove = async (ratingId, userId) => {
  const { error } = await owned(ratingId, userId);
  if (error) return fail(error);
  await storageService.destroyMany(await photoRepo.publicIdsFor('rating', ratingId));
  await ratingRepo.remove(ratingId);
  return ok(null);
};

// DELETE /admin/ratings/:id — soft delete (hidden everywhere, photos kept, restorable in the DB)
export const adminRemove = async (ratingId) => {
  const removed = await ratingRepo.softDelete(ratingId);
  if (!removed) return fail('RATING_NOT_FOUND');
  await cacheRepo.del(`place:${removed.placeId}`);
  await jobQueue.add(jobQueue.JOBS.REFRESH_STATS, {});
  return ok({ id: removed.id });
};
