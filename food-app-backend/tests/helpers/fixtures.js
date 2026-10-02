// A small world for contribution tests: one area, one verified place, two menu items.
import { pool } from '../../src/config/db.js';
import { insertUser, insertArea, insertPlace, insertStandardDish, insertMenuItem, ageUser } from './db.js';
import { accessTokenFor } from './auth.js';

export const world = async () => {
  const area = await insertArea({ name: 'Saheed Nagar', lat: 20.2887, lng: 85.8488 });
  const place = await insertPlace({ areaId: area.id, name: 'Dalma Restaurant', lat: 20.2887, lng: 85.8488 });
  await pool.query(`UPDATE places SET status = 'verified' WHERE id = $1`, [place.id]);
  const biryani = await insertStandardDish({ name: 'Chicken Dum Biryani', diet: 'non_veg' });
  const dalma = await insertStandardDish({ name: 'Dalma', diet: 'veg' });
  const biryaniItem = await insertMenuItem({ placeId: place.id, standardDishId: biryani.id, name: 'Special Biryani', price: 280 });
  const dalmaItem = await insertMenuItem({ placeId: place.id, standardDishId: dalma.id, name: 'Dalma', price: 120 });
  const user = await insertUser({ name: 'Asha' });
  await ageUser(user.id, 60);
  const other = await insertUser({ name: 'Ravi' });
  return { area, place, biryani, dalma, biryaniItem, dalmaItem, user, other };
};

export const bearer = (user) => ({ Authorization: `Bearer ${accessTokenFor(user)}` });

// Move a row's created_at back in time (simulate days passing)
export const backdate = async (table, id, interval) => {
  await pool.query(`UPDATE ${table} SET created_at = now() - $2::interval WHERE id = $1`, [id, interval]);
};

export const setCreatedAt = async (table, id, isoTime) => {
  await pool.query(`UPDATE ${table} SET created_at = $2::timestamptz WHERE id = $1`, [id, isoTime]);
};
