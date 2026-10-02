import * as reviewService from '../services/review.service.js';
import { sendResult } from '../utils/reasons.js';

export const create = async (req, res) =>
  sendResult(res, await reviewService.create({ userId: req.user.id, placeId: req.valid.params.id, ...req.body }), 201);

export const update = async (req, res) =>
  sendResult(res, await reviewService.update(req.valid.params.id, req.user.id, req.body));

export const remove = async (req, res) => sendResult(res, await reviewService.remove(req.valid.params.id, req.user.id));

export const listForPlace = async (req, res) =>
  sendResult(res, await reviewService.listForPlace(req.valid.params.id, req.valid.query));
