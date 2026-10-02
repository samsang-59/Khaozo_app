import { Router } from 'express';
import { pingDb } from '../config/db.js';
import { pingRedis } from '../config/redis.js';
import { sendFailure } from '../utils/reasons.js';

const router = Router();

// 🌐 GET /health — infrastructure check only (no business logic, so no service layer).
router.get('/health', async (req, res) => {
  const [db, redis] = await Promise.allSettled([pingDb(), pingRedis()]);
  const checks = {
    db: db.status === 'fulfilled' ? 'ok' : 'down',
    redis: redis.status === 'fulfilled' ? 'ok' : 'down',
  };
  if (checks.db !== 'ok' || checks.redis !== 'ok') {
    return sendFailure(res, 'SERVICE_UNAVAILABLE', checks);
  }
  res.json({ success: true, data: { status: 'ok', ...checks } });
});

export default router;
