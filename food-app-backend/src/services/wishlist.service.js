// wishlistService — "Want to try": save a place, a menu item or a standard dish.
import * as wishlistRepo from '../repositories/wishlist.repo.js';
import * as placeRepo from '../repositories/place.repo.js';
import * as menuItemRepo from '../repositories/menuItem.repo.js';
import * as dishRepo from '../repositories/dish.repo.js';
import { ok, fail } from '../utils/result.js';

const shape = (w) => ({
  id: w.id,
  triedAt: w.triedAt,
  createdAt: w.createdAt,
  target: w.placeId
    ? { kind: 'place', id: w.placeId, name: w.placeName }
    : w.menuItemId
      ? { kind: 'menu_item', id: w.menuItemId, name: w.menuItemName, place: { id: w.menuItemPlaceId, name: w.menuItemPlaceName } }
      : { kind: 'dish', id: w.standardDishId, name: w.standardDishName },
});

export const list = async (userId) => ok((await wishlistRepo.list(userId)).map(shape));

export const add = async (userId, { placeId, menuItemId, standardDishId }) => {
  if (placeId) {
    const p = await placeRepo.findById(placeId);
    if (!p || p.deletedAt) return fail('PLACE_NOT_FOUND');
  }
  if (menuItemId && !(await menuItemRepo.findById(menuItemId))) return fail('MENU_ITEM_NOT_FOUND');
  if (standardDishId && !(await dishRepo.findById(standardDishId))) return fail('DISH_NOT_FOUND');
  const item = await wishlistRepo.add(userId, { placeId, menuItemId, standardDishId });
  if (!item) return fail('ALREADY_IN_WISHLIST');
  return ok(item);
};

export const remove = async (userId, id) =>
  (await wishlistRepo.removeOwned(id, userId)) ? ok(null) : fail('WISHLIST_ITEM_NOT_FOUND');
