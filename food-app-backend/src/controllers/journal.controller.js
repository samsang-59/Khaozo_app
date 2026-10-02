import * as journalService from '../services/journal.service.js';
import { sendResult } from '../utils/reasons.js';

export const timeline = async (req, res) => sendResult(res, await journalService.timeline(req.user.id, req.valid.query));

export const stats = async (req, res) => sendResult(res, await journalService.stats(req.user.id, req.valid.query.period));

export const getContributions = async (req, res) => sendResult(res, await journalService.contributions(req.user.id));

export const publicJournal = async (req, res) =>
  sendResult(res, await journalService.publicJournal(req.valid.params.id, req.valid.query));
