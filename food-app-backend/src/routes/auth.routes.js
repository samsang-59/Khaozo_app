import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as v from '../validators/auth.validators.js';

const router = Router();

router.use('/auth', rateLimit('auth'));

router.post('/auth/google', validate(v.googleLogin), authController.googleLogin);   // 🌐
router.post('/auth/refresh', authController.refresh);                               // 🌐 (cookie)
router.post('/auth/logout', requireAuth, authController.logout);                    // 🔐
router.post('/auth/logout-all', requireAuth, authController.logoutAll);             // 🔐

export default router;
