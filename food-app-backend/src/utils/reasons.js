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

  // Contributions (Phase 4)
  MENU_ITEM_NOT_FOUND: { status: 404, message: 'Dish not found on this menu.' },
  RATING_NOT_FOUND: { status: 404, message: 'Rating not found.' },
  RATING_TOO_SOON: { status: 409, message: 'You rated this dish recently — edit that rating instead.' },
  RATING_NOT_CURRENT: { status: 409, message: 'Only your latest rating can be edited.' },
  REVIEW_NOT_FOUND: { status: 404, message: 'Review not found.' },
  REVIEW_TOO_SOON: { status: 409, message: 'You reviewed this place recently — edit that review instead.' },
  REVIEW_NOT_CURRENT: { status: 409, message: 'Only your latest review can be edited.' },
  TAG_NOT_FOUND: { status: 400, message: 'One of the tags does not exist.' },
  PHOTO_NOT_FOUND: { status: 404, message: 'Photo not found.' },
  NO_PHOTOS: { status: 400, message: 'Choose at least one photo.' },
  NOT_AN_IMAGE: { status: 400, message: 'Only images (JPG, PNG, WebP, HEIC) can be uploaded.' },
  PHOTO_TOO_LARGE: { status: 400, message: 'Each photo must be 5 MB or smaller.' },
  TOO_MANY_PHOTOS: { status: 400, message: 'Up to 3 photos per rating, review or place.' },
  ALREADY_IN_WISHLIST: { status: 409, message: 'Already in your wishlist.' },
  WISHLIST_ITEM_NOT_FOUND: { status: 404, message: 'Wishlist item not found.' },
  NOTE_NOT_FOUND: { status: 404, message: 'Note not found.' },
  JOURNAL_PRIVATE: { status: 403, message: 'This journal is private.' },

  // Group mode (Phase 7)
  GUEST_NAME_REQUIRED: { status: 400, message: 'Enter a name so your friends know who you are.' },
  GROUP_NOT_FOUND: { status: 404, message: 'This group has ended or the code is wrong.' },
  GROUP_ENDED: { status: 409, message: 'This group has ended.' },
  GROUP_FULL: { status: 409, message: 'This group is full (10 people max).' },
  NOT_A_MEMBER: { status: 403, message: 'Join the group first.' },
  GUEST_PASS_OTHER_GROUP: { status: 403, message: 'This guest pass is for a different group.' },
  GUEST_HAS_NO_PROFILE: { status: 400, message: 'Sign in to use your taste profile, or choose for this outing.' },
  NOT_CREATOR: { status: 403, message: 'Only the creator can do this.' },
  GROUP_NOT_JOINING: { status: 409, message: 'Suggestions are already out.' },
  GROUP_NOT_VOTING: { status: 409, message: 'Voting is not open.' },
  NOT_ENOUGH_READY: { status: 409, message: 'At least 2 people need to be ready.' },
  LOCATION_REQUIRED: { status: 409, message: 'Pick a spot or the midpoint first.' },
  MIDPOINT_NEEDS_LOCATIONS: { status: 409, message: 'Nobody shared a location yet — pick a spot instead.' },
  NO_SUGGESTIONS: { status: 409, message: 'No places found nearby — try another spot.' },
  NOT_A_SUGGESTION: { status: 400, message: 'That place is not one of the suggestions.' },

  // Admin (Phase 8)
  REPORT_NOT_FOUND: { status: 404, message: 'Report not found.' },
  REPORT_ALREADY_RESOLVED: { status: 409, message: 'This report was already accepted or rejected.' },
  REPORT_CHANGE_REQUIRED: { status: 400, message: 'Send the corrected details for this report (new pin, hours or place info).' },
  PLACE_ACTION_NOT_APPLICABLE: { status: 409, message: 'Nothing to change — the place is already like that.' },
  DISH_NAME_TAKEN: { status: 409, message: 'A dish with this name already exists.' },
  DISH_NOT_PENDING: { status: 409, message: 'This dish is already approved.' },
  DISH_MERGE_INTO_SELF: { status: 400, message: 'A dish cannot be merged into itself.' },
  DISH_MERGE_TARGET_INVALID: { status: 400, message: 'Merge into an approved dish that exists.' },
  CONFIG_KEY_NOT_FOUND: { status: 404, message: 'Setting not found.' },
  CONFIG_VALUE_INVALID: { status: 400, message: 'The new value does not fit this setting.' },
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
