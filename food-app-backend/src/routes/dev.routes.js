// Development-only test page (never mounted in production).
// Open http://localhost:3000/dev/google-login → sign in with Google → the page shows
// the ID token and calls POST /api/v1/auth/google, so login → refresh → logout can be
// checked before the real frontend exists (Phase 9).
import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { env } from '../config/env.js';

const router = Router();
const PAGE = new URL('../../dev/google-login.html', import.meta.url);

router.get('/dev/google-login', async (req, res) => {
  const html = await readFile(PAGE, 'utf8');
  res.type('html').send(html.replaceAll('__GOOGLE_CLIENT_ID__', env.googleClientId));
});

export default router;
