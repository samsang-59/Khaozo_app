// noteService — private notes about a place or a menu item (owner only, never shown to anyone else).
import * as noteRepo from '../repositories/note.repo.js';
import * as placeRepo from '../repositories/place.repo.js';
import * as menuItemRepo from '../repositories/menuItem.repo.js';
import { ok, fail } from '../utils/result.js';

export const list = async (userId) => ok(await noteRepo.list(userId));

export const create = async (userId, { placeId, menuItemId, text }) => {
  if (placeId) {
    const p = await placeRepo.findById(placeId);
    if (!p || p.deletedAt) return fail('PLACE_NOT_FOUND');
  }
  if (menuItemId && !(await menuItemRepo.findById(menuItemId))) return fail('MENU_ITEM_NOT_FOUND');
  return ok(await noteRepo.create(userId, { placeId, menuItemId, text }));
};

// Someone else's note behaves exactly like a missing one (no hint that it exists)
export const update = async (userId, id, text) => {
  const note = await noteRepo.updateOwned(id, userId, text);
  return note ? ok(note) : fail('NOTE_NOT_FOUND');
};

export const remove = async (userId, id) =>
  (await noteRepo.removeOwned(id, userId)) ? ok(null) : fail('NOTE_NOT_FOUND');
