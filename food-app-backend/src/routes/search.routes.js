import { Router } from 'express';
import * as searchController from '../controllers/search.controller.js';
import { optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/search.validators.js';

const router = Router();

// 🌐 plain-language search (personalised when logged in)
router.get('/search', optionalAuth, rateLimit('search'), validate(v.search), searchController.search);

export default router;
