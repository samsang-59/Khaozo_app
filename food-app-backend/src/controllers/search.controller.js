import * as searchService from '../services/search.service.js';
import { sendResult } from '../utils/reasons.js';

export const search = async (req, res) => {
  const { q, lat, lng, showAll, ...overrides } = req.valid.query;
  sendResult(res, await searchService.search({ q, lat, lng, overrides, showAll: showAll ?? false, userId: req.user?.id ?? null }));
};
