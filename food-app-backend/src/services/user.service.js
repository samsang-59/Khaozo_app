// userService — profile, journal visibility, account deletion (DPDP flow).
import * as userRepo from '../repositories/user.repo.js';
import * as storageService from './helpers/storage.js';
import * as jobQueue from './helpers/jobQueue.js';
import { ok, fail } from '../utils/result.js';

const toProfile = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
  role: u.role,
  journalVisibility: u.journalVisibility,
  createdAt: u.createdAt,
});

export const getProfile = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) return fail('USER_NOT_FOUND');
  return ok(toProfile(user));
};

export const updateProfile = async (userId, { name, journalVisibility }) => {
  const user = await userRepo.updateProfile(userId, { name, journalVisibility });
  if (!user) return fail('USER_NOT_FOUND');
  return ok(toProfile(user));
};

// DELETE /me — real erasure in one transaction (see userRepo.deleteAccount), then the photo
// files on Cloudinary. Files only go after the commit (a failed transaction must not lose
// photos that are still referenced); any Cloudinary failure is retried by a background job.
export const deleteAccount = async (userId) => {
  const result = await userRepo.deleteAccount(userId);
  if (!result) return fail('USER_NOT_FOUND');
  const failed = await storageService.destroyMany(result.photoPublicIds);
  if (failed.length) await jobQueue.add(jobQueue.JOBS.DELETE_PHOTOS, { publicIds: failed });
  await jobQueue.add(jobQueue.JOBS.REFRESH_STATS, {}); // their ratings now count as anonymous
  return ok({
    deleted: true,
    photosDeleted: result.photoPublicIds.length,
    ratingsKeptAnonymous: result.ratingsKept,
    reviewsKeptAnonymous: result.reviewsKept,
  });
};
