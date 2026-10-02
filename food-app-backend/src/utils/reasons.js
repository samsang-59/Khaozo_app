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

  // Places (Phase 3)
  AREA_NOT_FOUND: { status: 404, message: 'Area not found.' },
  PLACE_NOT_FOUND: { status: 404, message: 'Place not found.' },
  OUTSIDE_SERVICE_AREA: { status: 400, message: 'Khaozo covers Bhubaneswar only for now.' },
  POSSIBLE_DUPLICATE: { status: 409, message: 'A similar place already exists nearby. Is it the same place?' },
  HOURS_ALREADY_SET: { status: 409, message: 'Hours already exist. Report wrong hours instead.' },
  PLACE_NOT_UNVERIFIED: { status: 409, message: 'This place does not need confirmations.' },
  CANNOT_CONFIRM_OWN_PLACE: { status: 403, message: 'You added this place, so you cannot confirm it.' },
  ALREADY_CONFIRMED: { status: 409, message: 'You already confirmed this place.' },
  PLACE_CLOSED: { status: 409, message: 'This place is permanently closed.' },
  PLACE_ALREADY_CLOSED: { status: 409, message: 'This place is already marked closed.' },
  DUPLICATE_OF_SELF: { status: 400, message: 'A place cannot be a duplicate of itself.' },
  DUPLICATE_TARGET_NOT_FOUND: { status: 400, message: 'The original place was not found.' },
  REPORT_ALREADY_PENDING: { status: 409, message: 'You already reported this. An admin will check it soon.' },

  // Dishes / menu (Phase 3)
  DISH_NOT_FOUND: { status: 404, message: 'Dish not found.' },
  MENU_ITEM_EXISTS: { status: 409, message: 'This dish is already on the menu.' },
  DISH_NEEDS_CONFIRMATION: { status: 409, message: 'Is this one of these dishes?' },
  DISH_DETAILS_REQUIRED: { status: 400, message: 'New dish — please add its category, cuisine and veg / non-veg.' },
  DIET_INGREDIENT_MISMATCH: { status: 400, message: 'Veg / non-veg does not match the main ingredient.' },
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

// Controllers: service result → response. { ok: true } → successStatus + data; else sendFailure.
export const sendResult = (res, result, successStatus = 200) => {
  if (!result.ok) return sendFailure(res, result.reason, result.details);
  return res.status(successStatus).json({ success: true, data: result.data });
};
