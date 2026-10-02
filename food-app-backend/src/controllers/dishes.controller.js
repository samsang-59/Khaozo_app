import * as dishService from '../services/dish.service.js';
import * as menuItemService from '../services/menuItem.service.js';
import { sendResult } from '../utils/reasons.js';

export const match = async (req, res) => sendResult(res, await dishService.match(req.valid.query.q));

export const addMenuItem = async (req, res) =>
  sendResult(res, await menuItemService.addMenuItem(req.valid.params.id, req.user.id, req.body), 201);
