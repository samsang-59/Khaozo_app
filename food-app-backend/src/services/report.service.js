// reportService — create a place report (admin accept / reject comes in Phase 8).
import * as placeRepo from '../repositories/place.repo.js';
import * as reportRepo from '../repositories/report.repo.js';
import { ok, fail } from '../utils/result.js';

export const create = async (placeId, userId, { reason, details, suggestedChange, duplicateOf }) => {
  const place = await placeRepo.findById(placeId);
  if (!place || place.deletedAt) return fail('PLACE_NOT_FOUND');

  if (reason === 'duplicate') {
    if (duplicateOf === placeId) return fail('DUPLICATE_OF_SELF');
    const original = await placeRepo.findById(duplicateOf);
    if (!original || original.deletedAt) return fail('DUPLICATE_TARGET_NOT_FOUND');
  }
  if (reason === 'closed' && place.status === 'closed') return fail('PLACE_ALREADY_CLOSED');

  // one open report per user, place and reason
  if (await reportRepo.hasPending({ placeId, reportedBy: userId, reason })) return fail('REPORT_ALREADY_PENDING');

  const report = await reportRepo.create({
    placeId,
    reportedBy: userId,
    reason,
    details: details ?? null,
    suggestedChange: suggestedChange ?? null,
    duplicateOf: reason === 'duplicate' ? duplicateOf : null,
  });
  return ok(report);
};
