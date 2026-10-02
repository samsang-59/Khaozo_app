import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import { sendFailure } from '../utils/reasons.js';

export const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = {
  httpOnly: true,              // page JavaScript can't read it (XSS)
  secure: env.isProduction,    // https only in production
  sameSite: 'strict',          // only sent from our own site (CSRF)
  path: '/api/v1/auth',        // only sent to auth routes
};

const deviceInfo = (req) => req.get('user-agent')?.slice(0, 200) ?? null;

const setRefreshCookie = (res, token, expiresAt) =>
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions, expires: expiresAt });

const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, cookieOptions);

export const googleLogin = async (req, res) => {
  const result = await authService.loginWithGoogle({ idToken: req.body.idToken, deviceInfo: deviceInfo(req) });
  if (!result.ok) return sendFailure(res, result.reason);
  const { refreshToken, refreshExpiresAt, ...data } = result.data;
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.json({ success: true, data });
};

export const refresh = async (req, res) => {
  const result = await authService.refresh({ refreshToken: req.cookies?.[REFRESH_COOKIE], deviceInfo: deviceInfo(req) });
  if (!result.ok) {
    clearRefreshCookie(res);
    return sendFailure(res, result.reason);
  }
  const { refreshToken, refreshExpiresAt, ...data } = result.data;
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.json({ success: true, data });
};

export const logout = async (req, res) => {
  await authService.logout({ userId: req.user.id, refreshToken: req.cookies?.[REFRESH_COOKIE] });
  clearRefreshCookie(res);
  res.json({ success: true, data: null });
};

export const logoutAll = async (req, res) => {
  const result = await authService.logoutAll({ userId: req.user.id });
  clearRefreshCookie(res);
  res.json({ success: true, data: result.data });
};
