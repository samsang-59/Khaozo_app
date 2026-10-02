import * as userService from '../services/user.service.js';
import * as tasteProfileService from '../services/tasteProfile.service.js';
import { sendResult } from '../utils/reasons.js';

export const getMe = async (req, res) => sendResult(res, await userService.getProfile(req.user.id));

export const updateMe = async (req, res) => sendResult(res, await userService.updateProfile(req.user.id, req.body));

export const getTasteProfile = async (req, res) => sendResult(res, await tasteProfileService.get(req.user.id));

export const saveTasteQuiz = async (req, res) => sendResult(res, await tasteProfileService.saveQuiz(req.user.id, req.body));

export const editTasteProfile = async (req, res) => sendResult(res, await tasteProfileService.edit(req.user.id, req.body));
