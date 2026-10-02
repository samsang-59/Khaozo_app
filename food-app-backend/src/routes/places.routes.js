import { Router } from 'express';
import * as placesController from '../controllers/places.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/places.validators.js';

const router = Router();

// 🌐 (reviews + photos lists come with Phase 4)
router.get('/places', validate(v.listPlaces), placesController.list);
router.get('/places/:id', optionalAuth, validate(v.placeId), placesController.details);
router.get('/places/:id/menu', validate(v.placeId), placesController.menu);

// 🔐
router.post('/places', requireAuth, validate(v.addPlace), placesController.add);
router.post('/places/:id/confirm', requireAuth, validate(v.placeId), placesController.confirm);
router.post('/places/:id/reports', requireAuth, validate(v.createReport), placesController.report);
router.put('/places/:id/hours', requireAuth, validate(v.setHours), placesController.setHours);

export default router;
