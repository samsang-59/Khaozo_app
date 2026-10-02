import { Router } from 'express';
import * as journal from '../controllers/journal.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/contributions.validators.js';

const router = Router();

router.get('/me/journal', requireAuth, validate(v.listQuery), journal.timeline);        // 🔐
router.get('/me/stats', requireAuth, validate(v.stats), journal.stats);                 // 🔐
router.get('/me/contributions', requireAuth, journal.getContributions);                 // 🔐
router.get('/users/:id/journal', validate(v.listById), journal.publicJournal);          // 🌐 public journals only

export default router;
