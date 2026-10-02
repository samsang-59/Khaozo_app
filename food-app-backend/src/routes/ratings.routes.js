import { Router } from 'express';
import * as ratings from '../controllers/ratings.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as v from '../validators/contributions.validators.js';

const router = Router();

// 🔐 create nested under the menu item, edit / delete flat
router.post('/menu-items/:id/ratings', requireAuth, rateLimit('contribute'), validate(v.createRating), ratings.create);
router.patch('/ratings/:id', requireAuth, validate(v.updateRating), ratings.update);
router.delete('/ratings/:id', requireAuth, validate(v.idParams), ratings.remove);

export default router;
