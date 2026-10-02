import { Router } from 'express';
import * as wishlist from '../controllers/wishlist.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/contributions.validators.js';

const router = Router();

// 🔐
router.get('/me/wishlist', requireAuth, wishlist.list);
router.post('/me/wishlist', requireAuth, validate(v.addWishlist), wishlist.add);
router.delete('/me/wishlist/:id', requireAuth, validate(v.idParams), wishlist.remove);

export default router;
