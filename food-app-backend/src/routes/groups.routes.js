import { Router } from 'express';
import * as groupsController from '../controllers/groups.controller.js';
import { requireAuth, groupIdentity } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../validators/validate.js';
import * as v from '../validators/groups.validators.js';

const router = Router();

// 🌐 live actions happen over Socket.IO (sockets/group.socket.js)
router.post('/groups', groupIdentity, rateLimit('createGroup'), validate(v.createGroup), groupsController.create);
router.post('/groups/:code/join', groupIdentity, validate(v.joinGroup), groupsController.join);
router.get('/groups/:code', validate(v.groupCode), groupsController.peek);

// 🔐 past groups
router.get('/me/groups', requireAuth, groupsController.history);

export default router;
