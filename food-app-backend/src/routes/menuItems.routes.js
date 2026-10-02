import { Router } from 'express';
import * as menuItems from '../controllers/menuItems.controller.js';
import { optionalAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/contributions.validators.js';

const router = Router();

// 🌐 dish page (+ "your rating" when logged in) and its ratings
router.get('/menu-items/:id', optionalAuth, validate(v.idParams), menuItems.details);
router.get('/menu-items/:id/ratings', validate(v.listById), menuItems.ratings);

export default router;
