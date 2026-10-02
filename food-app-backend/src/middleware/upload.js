// Photo uploads (multer): images only, max 5 MB each, max 3 per request. Kept in memory,
// then streamed to Cloudinary by storageService — nothing is written to our disk.
import multer from 'multer';
import { sendFailure } from '../utils/reasons.js';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 3;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

class NotAnImageError extends Error {}

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) => (IMAGE_TYPES.has(file.mimetype) ? cb(null, true) : cb(new NotAnImageError())),
}).array('photos', MAX_PHOTOS);

export const uploadPhotos = (req, res, next) => {
  parser(req, res, (err) => {
    if (!err) {
      if (!req.files?.length) return sendFailure(res, 'NO_PHOTOS');
      return next();
    }
    if (err instanceof NotAnImageError) return sendFailure(res, 'NOT_AN_IMAGE');
    if (err.code === 'LIMIT_FILE_SIZE') return sendFailure(res, 'PHOTO_TOO_LARGE');
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return sendFailure(res, 'TOO_MANY_PHOTOS');
    return next(err);
  });
};
