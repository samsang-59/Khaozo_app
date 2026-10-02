import * as ratingService from '../services/rating.service.js';
import { sendResult } from '../utils/reasons.js';

export const create = async (req, res) =>
  sendResult(res, await ratingService.create({ userId: req.user.id, menuItemId: req.valid.params.id, ...req.body }), 201);

export const update = async (req, res) =>
  sendResult(res, await ratingService.update(req.valid.params.id, req.user.id, req.body));

export const remove = async (req, res) => sendResult(res, await ratingService.remove(req.valid.params.id, req.user.id));
