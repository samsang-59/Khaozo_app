import { Router } from 'express';
import * as dishesController from '../controllers/dishes.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/dishes.validators.js';

const router = Router();

router.get('/dishes/match', validate(v.matchDish), dishesController.match);                           // 🌐
router.post('/places/:id/menu-items', requireAuth, validate(v.addMenuItem), dishesController.addMenuItem); // 🔐
// GET /dishes/:id/best (best places for a dish) needs ranking → Phase 5

export default router;
