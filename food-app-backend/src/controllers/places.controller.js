import * as placeService from '../services/place.service.js';
import * as verificationService from '../services/verification.service.js';
import * as reportService from '../services/report.service.js';
import { sendResult } from '../utils/reasons.js';

export const list = async (req, res) => sendResult(res, await placeService.list(req.valid.query));

export const details = async (req, res) =>
  sendResult(res, await placeService.details(req.valid.params.id, req.user?.id ?? null));

export const menu = async (req, res) => sendResult(res, await placeService.menu(req.valid.params.id));

export const add = async (req, res) => sendResult(res, await placeService.addPlace(req.user.id, req.body), 201);

export const confirm = async (req, res) =>
  sendResult(res, await verificationService.confirm(req.valid.params.id, req.user.id), 201);

export const report = async (req, res) =>
  sendResult(res, await reportService.create(req.valid.params.id, req.user.id, req.body), 201);

export const setHours = async (req, res) =>
  sendResult(res, await placeService.setHours(req.valid.params.id, req.body.hours), 201);
