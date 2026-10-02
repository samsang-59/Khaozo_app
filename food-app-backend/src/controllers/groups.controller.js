import * as groupService from '../services/group.service.js';
import * as authService from '../services/auth.service.js';
import { sendResult } from '../utils/reasons.js';

// A new guest gets a guest pass for exactly this group (stored per tab by the frontend)
const withGuestPass = (result, name) => {
  if (!result.ok || !result.data.guestId) return result;
  const { guestId, ...data } = result.data;
  return { ok: true, data: { ...data, guestPass: authService.issueGuestPass({ groupCode: data.code, guestId, name }) } };
};

// POST /groups — logged in, or a guest with a display name
export const create = async (req, res) => {
  const result = await groupService.create({ userId: req.groupIdentity?.userId ?? null, guestName: req.body.name ?? null });
  sendResult(res, withGuestPass(result, req.body.name), 201);
};

// POST /groups/:code/join
export const join = async (req, res) => {
  const result = await groupService.join(req.valid.params.code, { identity: req.groupIdentity, guestName: req.body.name ?? null });
  sendResult(res, withGuestPass(result, req.body.name));
};

export const peek = async (req, res) => sendResult(res, await groupService.peek(req.valid.params.code));

export const history = async (req, res) => sendResult(res, await groupService.history(req.user.id));
