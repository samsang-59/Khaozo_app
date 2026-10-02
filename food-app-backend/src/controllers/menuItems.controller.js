import * as menuItemService from '../services/menuItem.service.js';
import { sendResult } from '../utils/reasons.js';

export const details = async (req, res) =>
  sendResult(res, await menuItemService.details(req.valid.params.id, req.user?.id ?? null));

export const ratings = async (req, res) =>
  sendResult(res, await menuItemService.ratings(req.valid.params.id, req.valid.query));
