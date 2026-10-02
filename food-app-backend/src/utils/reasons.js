// One shared map: service failure reason → HTTP status + user-facing message.
// Controllers call sendFailure(res, reason); new reasons are added as phases add features.

export const REASONS = Object.freeze({
  // Generic
  VALIDATION_ERROR: { status: 400, message: 'Some of the details are invalid.' },
  UNAUTHORIZED: { status: 401, message: 'Please sign in to continue.' },
  NOT_ALLOWED: { status: 403, message: 'You are not allowed to do this.' },
  NOT_FOUND: { status: 404, message: 'Not found.' },
  ROUTE_NOT_FOUND: { status: 404, message: 'This API route does not exist.' },
  RATE_LIMITED: { status: 429, message: 'Slow down a bit and try again shortly.' },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong on our side.' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporarily unavailable.' },

  // Auth (Phase 2) — every session problem is a 401 so the frontend logs in again
  GOOGLE_TOKEN_INVALID: { status: 401, message: 'Google sign-in failed. Please try again.' },
  SESSION_INVALID: { status: 401, message: 'Your session has ended. Please sign in again.' },
  SESSION_REUSED: { status: 401, message: 'For your safety you were signed out on all devices. Please sign in again.' },

  // Me / taste profile
  USER_NOT_FOUND: { status: 404, message: 'User not found.' },
  TASTE_PROFILE_NOT_FOUND: { status: 404, message: 'Taste profile not found.' },
  CUISINE_NOT_FOUND: { status: 400, message: 'One of the cuisines does not exist.' },
  INGREDIENT_NOT_FOUND: { status: 400, message: 'One of the ingredients does not exist.' },
});

export const getReason = (reason) => REASONS[reason] ?? REASONS.INTERNAL_ERROR;

// details (optional) is sent back as error.details — e.g. Zod issues,
// or possible duplicate places for a 409.
export const sendFailure = (res, reason, details) => {
  const known = Object.hasOwn(REASONS, reason);
  const { status, message } = getReason(reason);
  const error = { code: known ? reason : 'INTERNAL_ERROR', message };
  if (details !== undefined) error.details = details;
  return res.status(status).json({ success: false, error });
};
