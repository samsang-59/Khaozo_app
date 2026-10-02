import { Router } from 'express';
import * as reviews from '../controllers/reviews.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as v from '../validators/contributions.validators.js';

const router = Router();

// 🔐 review + "Good for" tag votes; 🌐 public list for a place
router.post('/places/:id/reviews', requireAuth, rateLimit('contribute'), validate(v.createReview), reviews.create);
router.patch('/reviews/:id', requireAuth, validate(v.updateReview), reviews.update);
router.delete('/reviews/:id', requireAuth, validate(v.idParams), reviews.remove);
router.get('/places/:id/reviews', validate(v.listById), reviews.listForPlace);

export default router;
