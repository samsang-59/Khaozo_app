// reportService — create a place report; admin accept (applies the fix) / reject.
import * as placeRepo from '../repositories/place.repo.js';
import * as reportRepo from '../repositories/report.repo.js';
import * as cacheRepo from '../repositories/redis/cache.repo.js';
import * as jobQueue from './helpers/jobQueue.js';
import { insideBbox } from '../utils/geo.js';
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

// What accepting a report does to the place. change = the admin's corrected details
// (else the reporter's suggestedChange): { lat, lng } · { hours } · place info fields.
const fixFor = async (report, change) => {
  const proposed = change ?? report.suggestedChange;
  switch (report.reason) {
    case 'closed':
      return { fix: { kind: 'close' } };
    case 'not_found':
      return { fix: { kind: 'delete' } };
    case 'wrong_location':
      if (proposed?.lat == null || proposed?.lng == null) return { error: 'REPORT_CHANGE_REQUIRED' };
      if (!insideBbox(proposed)) return { error: 'OUTSIDE_SERVICE_AREA' };
      return { fix: { kind: 'location', lat: proposed.lat, lng: proposed.lng } };
    case 'wrong_hours':
      if (!Array.isArray(proposed?.hours)) return { error: 'REPORT_CHANGE_REQUIRED' };
      return { fix: { kind: 'hours', hours: proposed.hours } };
    case 'wrong_info':
      // free text from the reporter → only the admin's structured change is applied (if any)
      if (!change) return { fix: null };
      if ('lat' in change || 'hours' in change) return { error: 'REPORT_CHANGE_REQUIRED' };
      return { fix: { kind: 'info', fields: change } };
    case 'duplicate': {
      const original = await placeRepo.findById(report.duplicateOf);
      if (!original || original.deletedAt) return { error: 'DUPLICATE_TARGET_NOT_FOUND' };
      return { fix: { kind: 'merge', intoId: report.duplicateOf } };
    }
    default:
      return { fix: null };
  }
};

// PATCH /admin/reports/:id — { action: 'accept' | 'reject', change? }
export const resolve = async (reportId, adminId, { action, change }) => {
  const report = await reportRepo.findById(reportId);
  if (!report) return fail('REPORT_NOT_FOUND');
  if (report.status !== 'pending') return fail('REPORT_ALREADY_RESOLVED');

  let fix = null;
  if (action === 'accept') {
    const planned = await fixFor(report, change);
    if (planned.error) return fail(planned.error);
    fix = planned.fix;
  }
  const resolved = await reportRepo.resolve(reportId, {
    status: action === 'accept' ? 'accepted' : 'rejected',
    reviewedBy: adminId,
    fix,
  });
  if (!resolved) return fail('REPORT_ALREADY_RESOLVED'); // another admin resolved it meanwhile

  if (fix) {
    await cacheRepo.del(`place:${report.placeId}`, ...(report.duplicateOf ? [`place:${report.duplicateOf}`] : []));
    await jobQueue.add(jobQueue.JOBS.REFRESH_STATS, {});
  }
  return ok(resolved);
};
