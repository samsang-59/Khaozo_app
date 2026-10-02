import * as photoService from '../services/photo.service.js';
import { sendResult } from '../utils/reasons.js';

const addTo = (kind) => async (req, res) =>
  sendResult(res, await photoService.add(kind, req.valid.params.id, req.user.id, req.files), 201);

export const addToRating = addTo('rating');
export const addToReview = addTo('review');
export const addToPlace = addTo('place');

export const remove = async (req, res) => sendResult(res, await photoService.remove(req.valid.params.id, req.user.id));

export const listForPlace = async (req, res) =>
  sendResult(res, await photoService.listForPlace(req.valid.params.id, req.valid.query));
