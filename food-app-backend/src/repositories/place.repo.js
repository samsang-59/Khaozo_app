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

// Trust job: places each user added that got verified → { userId: count }
export const verifiedCountsByAdder = async () => {
  const { rows } = await pool.query(
    `SELECT added_by, COUNT(*)::int AS n FROM places
     WHERE source = 'user' AND status = 'verified' AND added_by IS NOT NULL AND deleted_at IS NULL
     GROUP BY added_by`,
  );
  return Object.fromEntries(rows.map((r) => [r.added_by, r.n]));
};

// ---- Search / group candidates (search step 4, one SQL) ------------------------------
// f: { lat, lng, radiusM, dishIds, maxPrice, diet, openNow, at, tagIds, vibeVector, limit, likely }
// With dishIds → one row per place: its best-rated menu item of those dishes.
// Without → one row per place (place-level search, e.g. "cozy cafe to study").
// likely (place-level only): { nameTerms, cuisineIds, excludePureVeg } → only places that probably
// serve the dish (name contains a term, or a matching cuisine); name matches first.
// Closed / deleted places never appear.
export const findCandidates = async (f) => {
  const params = [];
  const add = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const where = ['p.deleted_at IS NULL', "p.status <> 'closed'"];
  const hasCentre = f.lat != null && f.lng != null;
  let distance = 'NULL::float';
  if (hasCentre) {
    const centre = `ST_SetSRID(ST_MakePoint(${add(f.lng)}, ${add(f.lat)}), 4326)::geography`;
    distance = `ST_Distance(p.location, ${centre})`;
    if (f.radiusM) where.push(`ST_DWithin(p.location, ${centre}, ${add(f.radiusM)})`);
  }
  const at = add(f.at ?? new Date());
  if (f.openNow) where.push(openNowSql(`${at}::timestamptz`));
  if (f.tagIds?.length) where.push(`ps.tag_ids @> ${add(f.tagIds)}::bigint[]`);
  const vibe = f.vibeVector
    ? `(SELECT MAX(1 - (r.text_embedding <=> ${add(JSON.stringify(f.vibeVector))}::vector))
        FROM place_reviews r WHERE r.place_id = p.id AND r.is_current AND r.deleted_at IS NULL AND r.text_embedding IS NOT NULL)`
    : 'NULL::float';

  const placeColumns = `
    p.id AS place_id, p.name AS place_name, p.place_type, p.diet_type, p.price_level, p.status AS place_status,
    a.name AS area_name, ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
    ${distance} AS distance_m,
    COALESCE(ps.tag_ids, '{}') AS tag_ids, ps.avg_stars AS place_avg_stars, COALESCE(ps.review_count, 0) AS place_review_count,
    ${openNowSql(`${at}::timestamptz`)} AS open_now,
    EXISTS (SELECT 1 FROM opening_hours oh WHERE oh.place_id = p.id) AS has_hours,
    ${vibe} AS vibe_similarity,
    COALESCE((SELECT array_agg(pc.cuisine_id) FROM place_cuisines pc WHERE pc.place_id = p.id), '{}') AS cuisine_ids`;

  let sql;
  if (f.dishIds?.length) {
    where.push("m.status = 'active'", `m.standard_dish_id = ANY(${add(f.dishIds)}::bigint[])`);
    if (f.maxPrice) where.push(`m.price <= ${add(f.maxPrice)}`);
    if (f.diet === 'veg') where.push(`d.diet = 'veg'`);
    if (f.diet === 'egg') where.push(`d.diet IN ('veg', 'egg')`);
    if (f.diet === 'non_veg') where.push(`d.diet = 'non_veg'`);
    sql = `
      SELECT * FROM (
        SELECT DISTINCT ON (p.id) ${placeColumns},
               m.id AS menu_item_id, m.name AS menu_item_name, m.price,
               d.id AS standard_dish_id, d.name AS standard_dish_name, d.diet AS dish_diet,
               d.main_ingredient_id, d.cuisine_id,
               COALESCE(s.rating_count, 0) AS rating_count, s.avg_stars, s.bayes_score, s.label,
               s.typical_spice, s.typical_sweetness, s.typical_oiliness
        FROM menu_items m
        JOIN places p ON p.id = m.place_id
        JOIN areas a ON a.id = p.area_id
        JOIN standard_dishes d ON d.id = m.standard_dish_id
        LEFT JOIN menu_item_stats s ON s.menu_item_id = m.id
        LEFT JOIN place_stats ps ON ps.place_id = p.id
        WHERE ${where.join(' AND ')}
        ORDER BY p.id, s.bayes_score DESC NULLS LAST, m.id
      ) best
      ORDER BY bayes_score DESC NULLS LAST, distance_m NULLS LAST
      LIMIT ${add(f.limit ?? 200)}`;
  } else {
    if (f.diet === 'veg') where.push(`p.diet_type IN ('pure_veg', 'both')`);
    let nameMatch = 'NULL::boolean';
    if (f.likely) {
      nameMatch = `p.name ILIKE ANY(${add(f.likely.nameTerms.map((t) => `%${t}%`))}::text[])`;
      where.push(`(${nameMatch} OR EXISTS (SELECT 1 FROM place_cuisines pc
                     WHERE pc.place_id = p.id AND pc.cuisine_id = ANY(${add(f.likely.cuisineIds)}::bigint[])))`);
      if (f.likely.excludePureVeg) where.push(`p.diet_type IS DISTINCT FROM 'pure_veg'`);
    }
    sql = `
      SELECT ${placeColumns}, ${nameMatch} AS likely_name_match
      FROM places p
      JOIN areas a ON a.id = p.area_id
      LEFT JOIN place_stats ps ON ps.place_id = p.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${f.likely ? 'likely_name_match DESC, ' : ''}ps.avg_stars DESC NULLS LAST, distance_m NULLS LAST
      LIMIT ${add(f.limit ?? 200)}`;
  }
  const { rows } = await pool.query(sql, params);
  return rowsToCamel(rows);
};

// Group "fair midpoint": PostGIS centroid of the members' locations ([{ lat, lng }])
export const centroid = async (points) => {
  const { rows } = await pool.query(
    `SELECT ST_Y(c) AS lat, ST_X(c) AS lng FROM (
       SELECT ST_Centroid(ST_Collect(ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326))) AS c
       FROM unnest($1::float[], $2::float[]) AS p(lat, lng)) x`,
    [points.map((p) => p.lat), points.map((p) => p.lng)],
  );
  return rows[0];
};

// ---- Admin (Phase 8) -------------------------------------------------------------
// Functions that take `db` run on the pool, or on a transaction client when called
// from another repo's transaction (reportRepo.resolve applies a report's fix this way).

// Admin queue: unverified (default) / closed / soft-deleted places, oldest first.
export const listForAdmin = async ({ status, limit, cursor }) => {
  const where = {
    unverified: `p.status = 'unverified' AND p.deleted_at IS NULL`,
    closed: `p.status = 'closed' AND p.deleted_at IS NULL`,
    deleted: 'p.deleted_at IS NOT NULL',
  }[status];
  const params = [limit + 1];
  let after = '';
  if (cursor) {
    params.push(cursor.id);
    after = 'AND p.id > $2::bigint';
  }
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.status, p.source, p.place_type, p.address, a.name AS area_name,
            ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
            p.added_by, u.name AS added_by_name, p.created_at, p.deleted_at,
            COALESCE((SELECT SUM(weight) FROM place_confirmations c WHERE c.place_id = p.id), 0)::float AS confirmations,
            (SELECT COUNT(*) FROM place_reports r WHERE r.place_id = p.id AND r.status = 'pending')::int AS pending_reports
     FROM places p JOIN areas a ON a.id = p.area_id LEFT JOIN users u ON u.id = p.added_by
     WHERE ${where} ${after}
     ORDER BY p.id
     LIMIT $1`,
    params,
  );
  return rowsToCamel(rows);
};

// Restore = undo soft delete and re-open a closed place (verified again if it ever was,
// or came from an import; a never-verified user place goes back to unverified).
const ADMIN_ACTIONS = {
  verify: `SET status = 'verified', verified_at = now(), updated_at = now()
           WHERE id = $1 AND status = 'unverified' AND deleted_at IS NULL`,
  close: `SET status = 'closed', updated_at = now()
          WHERE id = $1 AND status <> 'closed' AND deleted_at IS NULL`,
  delete: `SET deleted_at = now(), updated_at = now()
           WHERE id = $1 AND deleted_at IS NULL`,
  restore: `SET deleted_at = NULL, updated_at = now(),
                status = CASE WHEN status <> 'closed' THEN status
                              WHEN verified_at IS NOT NULL OR source <> 'user' THEN 'verified'
                              ELSE 'unverified' END
            WHERE id = $1 AND (deleted_at IS NOT NULL OR status = 'closed')`,
};

// → true if the place changed (false: already in that state)
export const applyAdminAction = async (placeId, action, db = pool) => {
  const { rowCount } = await db.query(`UPDATE places ${ADMIN_ACTIONS[action]}`, [placeId]);
  return rowCount === 1;
};

// Wrong pin fixed → new location and nearest area pin again
export const updateLocation = async (placeId, { lat, lng }, db = pool) => {
  await db.query(
    `UPDATE places SET location = ${point('$3', '$2')},
            area_id = (SELECT id FROM areas ORDER BY location <-> ${point('$3', '$2')} LIMIT 1),
            updated_at = now()
     WHERE id = $1`,
    [placeId, lat, lng],
  );
};

export const replaceHours = async (placeId, hours, db = pool) => {
  await db.query('DELETE FROM opening_hours WHERE place_id = $1', [placeId]);
  for (const h of hours) {
    await db.query(
      'INSERT INTO opening_hours (place_id, day, opens_at, closes_at) VALUES ($1, $2, $3, $4)',
      [placeId, h.day, h.opensAt, h.closesAt],
    );
  }
};

const INFO_COLUMNS = { name: 'name', address: 'address', phone: 'phone', placeType: 'place_type', dietType: 'diet_type', priceLevel: 'price_level' };

// fields: any of name / address / phone / placeType / dietType / priceLevel
export const updateInfo = async (placeId, fields, db = pool) => {
  const keys = Object.keys(INFO_COLUMNS).filter((k) => fields[k] !== undefined);
  if (!keys.length) return;
  await db.query(
    `UPDATE places SET ${keys.map((k, i) => `${INFO_COLUMNS[k]} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`,
    [placeId, ...keys.map((k) => fields[k])],
  );
};

// Duplicate report accepted: everything users added about `fromId` moves to `intoId`,
// then `fromId` is soft-deleted. Must run inside a transaction (db = client).
//   menu items        → moved; one with the same name already on the target menu is folded into it
//                       (its ratings / wishlist saves / notes move to the target item, it becomes removed)
//   ratings / reviews → one current per user: if the user had one at both, the newer stays current
//   tag votes, wishlist saves → moved unless the user already has the same one on the target
//   photos, notes, cuisines   → moved / added
//   hours, phone, address, price, diet → copied only where the target has none
export const mergeInto = async (fromId, intoId, db) => {
  await db.query('SELECT id FROM places WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE', [[fromId, intoId]]);

  await db.query(
    `CREATE TEMP TABLE merge_items ON COMMIT DROP AS
     SELECT f.id AS from_item, t.id AS to_item
     FROM menu_items f
     JOIN LATERAL (SELECT id FROM menu_items t
                   WHERE t.place_id = $2 AND t.status = 'active' AND lower(t.name) = lower(f.name)
                   ORDER BY t.id LIMIT 1) t ON true
     WHERE f.place_id = $1`,
    [fromId, intoId],
  );
  await db.query(
    `UPDATE dish_ratings r SET is_current = false, updated_at = now()
     FROM merge_items mi, dish_ratings o
     WHERE r.is_current AND o.is_current AND r.user_id = o.user_id AND r.id <> o.id
       AND ((r.menu_item_id = mi.from_item AND o.menu_item_id = mi.to_item)
         OR (r.menu_item_id = mi.to_item AND o.menu_item_id = mi.from_item))
       AND (r.created_at, r.id) < (o.created_at, o.id)`,
  );
  await db.query('UPDATE dish_ratings r SET menu_item_id = mi.to_item FROM merge_items mi WHERE r.menu_item_id = mi.from_item');
  await db.query(
    `UPDATE wishlist_items w SET menu_item_id = mi.to_item FROM merge_items mi
     WHERE w.menu_item_id = mi.from_item
       AND NOT EXISTS (SELECT 1 FROM wishlist_items x WHERE x.user_id = w.user_id AND x.menu_item_id = mi.to_item)`,
  );
  await db.query('DELETE FROM wishlist_items w USING merge_items mi WHERE w.menu_item_id = mi.from_item');
  await db.query('UPDATE private_notes n SET menu_item_id = mi.to_item FROM merge_items mi WHERE n.menu_item_id = mi.from_item');
  await db.query(`UPDATE menu_items SET status = 'removed', updated_at = now() WHERE id IN (SELECT from_item FROM merge_items)`);
  await db.query('UPDATE menu_items SET place_id = $2, updated_at = now() WHERE place_id = $1', [fromId, intoId]);

  await db.query(
    `UPDATE place_reviews r SET is_current = false, updated_at = now()
     FROM place_reviews o
     WHERE r.is_current AND o.is_current AND r.user_id = o.user_id
       AND r.place_id = ANY($1::bigint[]) AND o.place_id = ANY($1::bigint[]) AND r.place_id <> o.place_id
       AND (r.created_at, r.id) < (o.created_at, o.id)`,
    [[fromId, intoId]],
  );
  await db.query('UPDATE place_reviews SET place_id = $2, updated_at = now() WHERE place_id = $1', [fromId, intoId]);

  await db.query(
    `INSERT INTO place_tag_votes (place_id, tag_id, user_id, source, created_at)
     SELECT $2, tag_id, user_id, source, created_at FROM place_tag_votes WHERE place_id = $1
     ON CONFLICT (place_id, tag_id, user_id) DO NOTHING`,
    [fromId, intoId],
  );
  await db.query('DELETE FROM place_tag_votes WHERE place_id = $1', [fromId]);

  await db.query(
    `UPDATE wishlist_items w SET place_id = $2 WHERE w.place_id = $1
       AND NOT EXISTS (SELECT 1 FROM wishlist_items x WHERE x.user_id = w.user_id AND x.place_id = $2)`,
    [fromId, intoId],
  );
  await db.query('DELETE FROM wishlist_items WHERE place_id = $1', [fromId]);
  await db.query('UPDATE private_notes SET place_id = $2 WHERE place_id = $1', [fromId, intoId]);
  await db.query('UPDATE photos SET place_id = $2 WHERE place_id = $1', [fromId, intoId]);
  await db.query(
    'INSERT INTO place_cuisines (place_id, cuisine_id) SELECT $2, cuisine_id FROM place_cuisines WHERE place_id = $1 ON CONFLICT DO NOTHING',
    [fromId, intoId],
  );
  await db.query(
    `INSERT INTO opening_hours (place_id, day, opens_at, closes_at)
     SELECT $2, day, opens_at, closes_at FROM opening_hours
     WHERE place_id = $1 AND NOT EXISTS (SELECT 1 FROM opening_hours WHERE place_id = $2)`,
    [fromId, intoId],
  );
  await db.query(
    `UPDATE places t SET phone = COALESCE(t.phone, f.phone), address = COALESCE(t.address, f.address),
            price_level = COALESCE(t.price_level, f.price_level), diet_type = COALESCE(t.diet_type, f.diet_type),
            updated_at = now()
     FROM places f WHERE t.id = $2 AND f.id = $1`,
    [fromId, intoId],
  );
  await db.query('UPDATE places SET deleted_at = now(), updated_at = now() WHERE id = $1', [fromId]);
};
