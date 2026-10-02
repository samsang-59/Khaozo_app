import * as noteService from '../services/note.service.js';
import { sendResult } from '../utils/reasons.js';

export const list = async (req, res) => sendResult(res, await noteService.list(req.user.id));
export const create = async (req, res) => sendResult(res, await noteService.create(req.user.id, req.body), 201);
export const update = async (req, res) => sendResult(res, await noteService.update(req.user.id, req.valid.params.id, req.body.text));
export const remove = async (req, res) => sendResult(res, await noteService.remove(req.user.id, req.valid.params.id));
