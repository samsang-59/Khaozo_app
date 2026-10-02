import { Router } from 'express';
import * as meController from '../controllers/me.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/me.validators.js';

const router = Router();

// 🔐 all routes. DELETE /me (account deletion) comes in Phase 8.
router.get('/me', requireAuth, meController.getMe);
router.patch('/me', requireAuth, validate(v.updateMe), meController.updateMe);
router.get('/me/taste-profile', requireAuth, meController.getTasteProfile);
router.put('/me/taste-profile', requireAuth, validate(v.tasteQuiz), meController.saveTasteQuiz);
router.patch('/me/taste-profile', requireAuth, validate(v.tasteEdit), meController.editTasteProfile);

export default router;
