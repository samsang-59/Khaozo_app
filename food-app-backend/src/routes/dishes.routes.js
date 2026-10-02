import { Router } from 'express';
import * as dishesController from '../controllers/dishes.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/dishes.validators.js';

const router = Router();

router.get('/dishes/match', validate(v.matchDish), dishesController.match);                           // 🌐
router.post('/places/:id/menu-items', requireAuth, validate(v.addMenuItem), dishesController.addMenuItem); // 🔐
router.get('/dishes/:id/best', validate(v.bestForDish), dishesController.best);                        // 🌐

export default router;
