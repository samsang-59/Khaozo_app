// journalService — timeline (3-hour cards), My Stats, My Contributions, public journal.
import * as ratingRepo from '../repositories/rating.repo.js';
import * as placeRepo from '../repositories/place.repo.js';
import * as confirmationRepo from '../repositories/confirmation.repo.js';
import * as dishRepo from '../repositories/dish.repo.js';
import * as reportRepo from '../repositories/report.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as configService from './helpers/config.js';
import { page } from '../utils/pagination.js';
import { ok, fail } from '../utils/result.js';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// First moment of the current calendar month in Bhubaneswar time
export const startOfIstMonth = (now = new Date()) => {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
};

const toCard = (c) => ({
  place: { id: c.placeId, name: c.placeName, area: c.areaName },
  startedAt: c.startedAt,
  endedAt: c.endedAt,
  entries: c.entries,
});

// GET /me/journal
export const timeline = async (userId, { limit, cursor }) => {
  const gapHours = await configService.get('journal_gap_hours');
  const rows = await ratingRepo.journalCards(userId, { gapHours, limit, cursor });
  const { items, nextCursor } = page(rows, limit, (c) => ({ t: c.startedAt, p: c.placeId, c: c.cardNo }));
  return ok({ items: items.map(toCard), nextCursor });
};

// GET /me/stats?period=all|month
export const stats = async (userId, period = 'all', now = new Date()) => {
  const since = period === 'month' ? startOfIstMonth(now) : null;
  const s = await ratingRepo.journalStats(userId, since);
  return ok({ period, since, ...s });
};

// GET /me/contributions — places added (+ confirmation progress), dishes added, reports
export const contributions = async (userId) => {
  const [places, dishes, reports, threshold] = await Promise.all([
    placeRepo.findAddedByUser(userId),
    dishRepo.findCreatedByUser(userId),
    reportRepo.findByReporter(userId),
    configService.get('place_verify_threshold'),
  ]);
  const sums = await confirmationRepo.sumWeights(places.map((p) => p.id));
  return ok({
    places: places.map((p) => ({
      ...p,
      verification: p.status === 'unverified' ? { confirmations: sums[p.id] ?? 0, threshold } : null,
    })),
    dishes,
    reports,
  });
};

// GET /users/:id/journal — only if that user made their journal public
export const publicJournal = async (ownerId, { limit, cursor }) => {
  const owner = await userRepo.findPublicById(ownerId);
  if (!owner) return fail('USER_NOT_FOUND');
  if (owner.journalVisibility !== 'public') return fail('JOURNAL_PRIVATE');
  const [cards, allTime] = await Promise.all([timeline(ownerId, { limit, cursor }), stats(ownerId, 'all')]);
  return ok({ user: { id: owner.id, name: owner.name, avatarUrl: owner.avatarUrl }, timeline: cards.data, stats: allTime.data });
};
