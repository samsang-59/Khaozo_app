// verificationService — confirmations ("yes, this place exists"), weight sum, flip to verified.
import * as placeRepo from '../repositories/place.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as confirmationRepo from '../repositories/confirmation.repo.js';
import * as cacheRepo from '../repositories/redis/cache.repo.js';
import * as configService from './helpers/config.js';
import * as trustService from './helpers/trust.js';
import { ok, fail } from '../utils/result.js';

export const confirm = async (placeId, userId) => {
  const place = await placeRepo.findById(placeId);
  if (!place || place.deletedAt) return fail('PLACE_NOT_FOUND');
  if (place.status !== 'unverified') return fail('PLACE_NOT_UNVERIFIED');
  if (place.addedBy === userId) return fail('CANNOT_CONFIRM_OWN_PLACE');

  const user = await userRepo.findById(userId);
  if (!user) return fail('USER_NOT_FOUND');
  // weight = snapshot of the confirmer's trust right now (never recalculated)
  const { level, weight } = await trustService.weightFor(user);
  const threshold = await configService.get('place_verify_threshold');

  const result = await confirmationRepo.confirmAndMaybeVerify({ placeId, userId, weight, threshold });
  if (!result.inserted) return fail('ALREADY_CONFIRMED');
  await cacheRepo.del(`place:${placeId}`);
  return ok({ weight, level, confirmations: result.total, threshold, verified: result.verified });
};
