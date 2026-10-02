import { Router } from 'express';
import * as notes from '../controllers/notes.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/contributions.validators.js';

const router = Router();

// 🔐 private notes — owner only
router.get('/me/notes', requireAuth, notes.list);
router.post('/me/notes', requireAuth, validate(v.createNote), notes.create);
router.patch('/me/notes/:id', requireAuth, validate(v.updateNote), notes.update);
router.delete('/me/notes/:id', requireAuth, validate(v.idParams), notes.remove);

export default router;
