import { sendFailure } from '../utils/reasons.js';

// 👑 routes (always after requireAuth). Role comes from the JWT,
// so a demotion takes effect within 15 min (access token lifetime).
export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return sendFailure(res, 'NOT_ALLOWED');
  next();
};
