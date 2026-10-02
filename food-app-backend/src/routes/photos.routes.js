import { Router } from 'express';
import * as photos from '../controllers/photos.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadPhotos } from '../middleware/upload.js';
import { validate } from '../validators/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as v from '../validators/contributions.validators.js';

const router = Router();

// 🔐 multipart field "photos": up to 3 images, ≤ 5 MB each; 🌐 place gallery
router.post('/ratings/:id/photos', requireAuth, rateLimit('contribute'), validate(v.idParams), uploadPhotos, photos.addToRating);
router.post('/reviews/:id/photos', requireAuth, rateLimit('contribute'), validate(v.idParams), uploadPhotos, photos.addToReview);
router.post('/places/:id/photos', requireAuth, rateLimit('contribute'), validate(v.idParams), uploadPhotos, photos.addToPlace);
router.delete('/photos/:id', requireAuth, validate(v.idParams), photos.remove);
router.get('/places/:id/photos', validate(v.listById), photos.listForPlace);

export default router;
