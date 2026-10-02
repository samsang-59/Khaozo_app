import * as userService from '../services/user.service.js';
import * as tasteProfileService from '../services/tasteProfile.service.js';
import { sendFailure } from '../utils/reasons.js';

const reply = (res, result) => {
  if (!result.ok) return sendFailure(res, result.reason);
  res.json({ success: true, data: result.data });
};

export const getMe = async (req, res) => reply(res, await userService.getProfile(req.user.id));

export const updateMe = async (req, res) => reply(res, await userService.updateProfile(req.user.id, req.body));

export const getTasteProfile = async (req, res) => reply(res, await tasteProfileService.get(req.user.id));

export const saveTasteQuiz = async (req, res) => reply(res, await tasteProfileService.saveQuiz(req.user.id, req.body));

export const editTasteProfile = async (req, res) => reply(res, await tasteProfileService.edit(req.user.id, req.body));
