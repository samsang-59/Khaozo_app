import * as wishlistService from '../services/wishlist.service.js';
import { sendResult } from '../utils/reasons.js';

export const list = async (req, res) => sendResult(res, await wishlistService.list(req.user.id));
export const add = async (req, res) => sendResult(res, await wishlistService.add(req.user.id, req.body), 201);
export const remove = async (req, res) => sendResult(res, await wishlistService.remove(req.user.id, req.valid.params.id));
