// placeRepo — places · place_cuisines · opening_hours.
import { pool, withTransaction } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

// Bhubaneswar local time for "open now" (IST, no daylight saving)
const TZ = 'Asia/Kolkata';

const point = (lngParam, latParam) => `ST_SetSRID(ST_MakePoint(${lngParam}, ${latParam}), 4326)::geography`;

// SQL condition: place p is open at timestamptz param `atParam` (after-midnight rows + two shifts handled).
export const openNowSql = (atParam) => `EXISTS (
  SELECT 1 FROM opening_hours oh
  WHERE oh.place_id = p.id AND (
    (oh.opens_at < oh.closes_at
       AND oh.day = EXTRACT(DOW FROM (${atParam} AT TIME ZONE '${TZ}'))
       AND (${atParam} AT TIME ZONE '${TZ}')::time >= oh.opens_at
       AND (${atParam} AT TIME ZONE '${TZ}')::time <  oh.closes_at)
    OR (oh.opens_at > oh.closes_at AND (
         (oh.day = EXTRACT(DOW FROM (${atParam} AT TIME ZONE '${TZ}'))
            AND (${atParam} AT TIME ZONE '${TZ}')::time >= oh.opens_at)
      OR (oh.day = (EXTRACT(DOW FROM (${atParam} AT TIME ZONE '${TZ}'))::int + 6) % 7
            AND (${atParam} AT TIME ZONE '${TZ}')::time < oh.closes_at)))
  ))`;

const LIST_COLUMNS = `
  p.id, p.name, p.place_type, p.diet_type, p.price_level, p.status, p.address, p.area_id,
  a.name AS area_name,
  ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
  COALESCE((SELECT array_agg(c.name ORDER BY c.name) FROM place_cuisines pc JOIN cuisines c ON c.id = pc.cuisine_id WHERE pc.place_id = p.id), '{}') AS cuisines`;

// Map / list. filters: { lat, lng, radiusM, q, status, placeType, dietType, maxPriceLevel, cuisineId, openNow, at, limit, cursor }
// With a centre → nearest first (keyset on distance, id); without → by name (keyset on name, id).
// Always hidden: soft-deleted places; closed places unless status = 'closed' is asked for.
export const list = async (f) => {
  const params = [];
  const add = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const where = ['p.deleted_at IS NULL'];
  const hasCentre = f.lat != null && f.lng != null;
  let distance = 'NULL::float';

  if (hasCentre) {
    const centre = point(add(f.lng), add(f.lat));
    distance = `ST_Distance(p.location, ${centre})`;
    where.push(`ST_DWithin(p.location, ${centre}, ${add(f.radiusM)})`);
  }
  if (f.status) where.push(`p.status = ${add(f.status)}`);
  else where.push(`p.status <> 'closed'`);
  if (f.q) {
    const q = add(f.q);
    where.push(`(p.name ILIKE '%' || ${q} || '%' OR p.name % ${q})`);
  }
  if (f.placeType) where.push(`p.place_type = ${add(f.placeType)}`);
  if (f.dietType) where.push(`p.diet_type = ${add(f.dietType)}`);
  if (f.maxPriceLevel) where.push(`p.price_level <= ${add(f.maxPriceLevel)}`);
  if (f.cuisineId) where.push(`EXISTS (SELECT 1 FROM place_cuisines pc WHERE pc.place_id = p.id AND pc.cuisine_id = ${add(f.cuisineId)})`);
  if (f.openNow) where.push(openNowSql(`${add(f.at ?? new Date())}::timestamptz`));

  const orderKey = hasCentre ? 'distance_m' : 'name';
  let cursorWhere = '';
  if (f.cursor) {
    cursorWhere = hasCentre
      ? `WHERE (distance_m, id) > (${add(f.cursor.d)}::float, ${add(f.cursor.id)}::bigint)`
      : `WHERE (name, id) > (${add(f.cursor.n)}::text, ${add(f.cursor.id)}::bigint)`;
  }

  const { rows } = await pool.query(
    `WITH c AS (
       SELECT ${LIST_COLUMNS}, ${distance} AS distance_m
       FROM places p JOIN areas a ON a.id = p.area_id
       WHERE ${where.join(' AND ')}
     )
     SELECT * FROM c ${cursorWhere}
     ORDER BY ${orderKey}, id
     LIMIT ${add(f.limit + 1)}`,
    params,
  );
  return rowsToCamel(rows);
};

export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT ${LIST_COLUMNS}, p.phone, p.source, p.added_by, p.verified_at, p.deleted_at, p.created_at,
            COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name)
                      FROM place_cuisines pc JOIN cuisines c ON c.id = pc.cuisine_id WHERE pc.place_id = p.id), '[]') AS cuisine_list
     FROM places p JOIN areas a ON a.id = p.area_id
     WHERE p.id = $1`,
    [id],
  );
  return toCamel(rows[0]) ?? null;
};

// Hours for many places at once (list pages) → { placeId: [rows] }
export const findHoursForPlaces = async (placeIds) => {
  if (placeIds.length === 0) return {};
  const { rows } = await pool.query(
    `SELECT place_id, day, to_char(opens_at, 'HH24:MI') AS opens_at, to_char(closes_at, 'HH24:MI') AS closes_at
     FROM opening_hours WHERE place_id = ANY($1::bigint[]) ORDER BY day, opens_at`,
    [placeIds],
  );
  const byPlace = {};
  for (const row of rowsToCamel(rows)) (byPlace[row.placeId] ??= []).push({ day: row.day, opensAt: row.opensAt, closesAt: row.closesAt });
  return byPlace;
};

export const findHours = async (placeId) => {
  const { rows } = await pool.query(
    `SELECT day, to_char(opens_at, 'HH24:MI') AS opens_at, to_char(closes_at, 'HH24:MI') AS closes_at
     FROM opening_hours WHERE place_id = $1 ORDER BY day, opens_at`,
    [placeId],
  );
  return rowsToCamel(rows);
};

// Duplicate check while adding a place: similar name (pg_trgm %) AND within `radiusM` metres.
export const findSimilarNearby = async ({ name, lat, lng, radiusM }) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.status, p.place_type, a.name AS area_name,
            ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
            round(ST_Distance(p.location, ${point('$3', '$2')})) AS distance_m,
            round(similarity(p.name, $1)::numeric, 2)::float AS name_similarity
     FROM places p JOIN areas a ON a.id = p.area_id
     WHERE p.deleted_at IS NULL
       AND ST_DWithin(p.location, ${point('$3', '$2')}, $4)
       AND p.name % $1
     ORDER BY similarity(p.name, $1) DESC, distance_m
     LIMIT 5`,
    [name, lat, lng, radiusM],
  );
  return rowsToCamel(rows);
};

// User-added place (+ cuisines) in one transaction; area = nearest area pin.
export const createUserPlace = async ({ name, lat, lng, placeType, dietType, priceLevel, address, phone, cuisineIds, addedBy }) =>
  withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO places (name, location, address, area_id, place_type, diet_type, price_level, phone, source, added_by)
       VALUES ($1, ${point('$3', '$2')}, $4,
               (SELECT id FROM areas ORDER BY location <-> ${point('$3', '$2')} LIMIT 1),
               $5, $6, $7, $8, 'user', $9)
       RETURNING id`,
      [name, lat, lng, address, placeType, dietType, priceLevel, phone, addedBy],
    );
    const placeId = rows[0].id;
    if (cuisineIds.length) {
      await client.query(
        'INSERT INTO place_cuisines (place_id, cuisine_id) SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING',
        [placeId, cuisineIds],
      );
    }
    return placeId;
  });

// Hours can be added by anyone only while none exist. Returns false if hours already existed.
export const insertHoursIfNone = async (placeId, hours) =>
  withTransaction(async (client) => {
    await client.query('SELECT id FROM places WHERE id = $1 FOR UPDATE', [placeId]); // serialise concurrent adds
    const { rows } = await client.query('SELECT 1 FROM opening_hours WHERE place_id = $1 LIMIT 1', [placeId]);
    if (rows.length) return false;
    for (const h of hours) {
      await client.query(
        'INSERT INTO opening_hours (place_id, day, opens_at, closes_at) VALUES ($1, $2, $3, $4)',
        [placeId, h.day, h.opensAt, h.closesAt],
      );
    }
    return true;
  });

// Places a user added + status (journal → My Contributions)
export const findAddedByUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT id, name, status, verified_at, created_at FROM places
     WHERE added_by = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId],
  );
  return rowsToCamel(rows);
};
