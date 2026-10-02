// photoService — photo rules (max 3 per rating / review / place, images ≤ 5 MB), uses storageService.
import * as photoRepo from '../repositories/photo.repo.js';
import * as ratingRepo from '../repositories/rating.repo.js';
import * as reviewRepo from '../repositories/review.repo.js';
import * as placeRepo from '../repositories/place.repo.js';
import * as storageService from './helpers/storage.js';
import { MAX_PHOTOS } from '../middleware/upload.js';
import { page } from '../utils/pagination.js';
import { ok, fail } from '../utils/result.js';

// Who may add photos to which parent
const loadParent = {
  rating: async (id, userId) => {
    const r = await ratingRepo.findById(id);
    if (!r) return 'RATING_NOT_FOUND';
    return r.userId === userId ? null : 'NOT_ALLOWED';
  },
  review: async (id, userId) => {
    const v = await reviewRepo.findById(id);
    if (!v) return 'REVIEW_NOT_FOUND';
    return v.userId === userId ? null : 'NOT_ALLOWED';
  },
  // Place photos come with "Add a missing place" → only the person who added it
  place: async (id, userId) => {
    const p = await placeRepo.findById(id);
    if (!p || p.deletedAt) return 'PLACE_NOT_FOUND';
    return p.addedBy === userId ? null : 'NOT_ALLOWED';
  },
};

const FOLDER = { rating: 'ratings', review: 'reviews', place: 'places' };

// files: multer memory files (already checked: images, ≤ 5 MB, ≤ 3)
export const add = async (parentKind, parentId, userId, files) => {
  const problem = await loadParent[parentKind](parentId, userId);
  if (problem) return fail(problem);
  if ((await photoRepo.countFor(parentKind, parentId)) + files.length > MAX_PHOTOS) return fail('TOO_MANY_PHOTOS');

  const uploaded = [];
  try {
    for (const f of files) uploaded.push(await storageService.upload(f.buffer, FOLDER[parentKind]));
  } catch (err) {
    await storageService.destroyMany(uploaded.map((u) => u.publicId));
    throw err; // Cloudinary down → 500 via error middleware
  }

  let saved;
  try {
    saved = await photoRepo.addWithinLimit(parentKind, parentId, uploaded, MAX_PHOTOS);
  } catch (err) {
    await storageService.destroyMany(uploaded.map((u) => u.publicId));
    throw err;
  }
  if (!saved) {
    // another upload filled the slots meanwhile → don't leave orphan files on Cloudinary
    await storageService.destroyMany(uploaded.map((u) => u.publicId));
    return fail('TOO_MANY_PHOTOS');
  }
  return ok(saved);
};

// DELETE /photos/:id — only the owner of the parent
export const remove = async (photoId, userId) => {
  const photo = await photoRepo.findWithOwner(photoId);
  if (!photo) return fail('PHOTO_NOT_FOUND');
  if (photo.ownerId !== userId) return fail('NOT_ALLOWED');
  await storageService.destroy(photo.cloudinaryPublicId);
  await photoRepo.remove(photoId);
  return ok(null);
};

// GET /places/:id/photos
export const listForPlace = async (placeId, { limit, cursor }) => {
  const place = await placeRepo.findById(placeId);
  if (!place || place.deletedAt) return fail('PLACE_NOT_FOUND');
  const rows = await photoRepo.listForPlace(placeId, { limit, cursor });
  return ok(page(rows, limit, (r) => ({ id: r.id })));
};
