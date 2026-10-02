import * as adminService from '../services/admin.service.js';
import * as reportService from '../services/report.service.js';
import * as ratingService from '../services/rating.service.js';
import * as reviewService from '../services/review.service.js';
import { sendResult } from '../utils/reasons.js';

export const reports = async (req, res) => sendResult(res, await adminService.reports(req.valid.query));

export const resolveReport = async (req, res) =>
  sendResult(res, await reportService.resolve(req.valid.params.id, req.user.id, req.body));

export const places = async (req, res) => sendResult(res, await adminService.places(req.valid.query));

export const placeAction = async (req, res) =>
  sendResult(res, await adminService.placeAction(req.valid.params.id, req.body.action));

export const pendingDishes = async (req, res) => sendResult(res, await adminService.pendingDishes(req.valid.query));

export const createDish = async (req, res) => sendResult(res, await adminService.createDish(req.body), 201);

export const updateDish = async (req, res) => sendResult(res, await adminService.updateDish(req.valid.params.id, req.body));

export const removeReview = async (req, res) => sendResult(res, await reviewService.adminRemove(req.valid.params.id));

export const removeRating = async (req, res) => sendResult(res, await ratingService.adminRemove(req.valid.params.id));

export const config = async (req, res) => sendResult(res, await adminService.config());

export const updateConfig = async (req, res) => sendResult(res, await adminService.updateConfig(req.user.id, req.body));
