// Nightly: delete expired login sessions (refresh tokens).
import * as authService from '../services/auth.service.js';

export default async () => (await authService.cleanupExpiredSessions()).data;
