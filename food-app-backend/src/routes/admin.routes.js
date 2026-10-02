import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/admin.validators.js';

const router = Router();

// 👑 every route
router.use('/admin', requireAuth, adminOnly);

router.get('/admin/reports', validate(v.listReports), adminController.reports);
router.patch('/admin/reports/:id', validate(v.resolveReport), adminController.resolveReport);
router.get('/admin/places', validate(v.listPlaces), adminController.places);
router.patch('/admin/places/:id', validate(v.placeAction), adminController.placeAction);
router.get('/admin/dishes/pending', validate(v.listPendingDishes), adminController.pendingDishes);
router.post('/admin/dishes', validate(v.createDish), adminController.createDish);
router.patch('/admin/dishes/:id', validate(v.updateDish), adminController.updateDish);
router.delete('/admin/reviews/:id', validate(v.removeById), adminController.removeReview);
router.delete('/admin/ratings/:id', validate(v.removeById), adminController.removeRating);
router.get('/admin/config', adminController.config);
router.patch('/admin/config', validate(v.updateConfig), adminController.updateConfig);

export default router;
