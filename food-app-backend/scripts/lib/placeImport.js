// Place import helpers (OpenStreetMap + Foursquare Open Places → places table).
// Pure mapping functions + one DB function. Used by scripts/import-places.js and tests.

// Bhubaneswar bounding box (south, west, north, east)
export const BBSR_BBOX = { south: 20.18, west: 85.70, north: 20.40, east: 85.95 };

// ---- OpenStreetMap ------------------------------------------------------------

// OSM amenity/shop → our place_type (restaurant, cafe, dhaba, bakery, street_stall, sweet_shop)
const OSM_TYPE = {
  'amenity=restaurant': 'restaurant',
  'amenity=fast_food': 'restaurant',
  'amenity=food_court': 'restaurant',
  'amenity=cafe': 'cafe',
  'amenity=ice_cream': 'sweet_shop',
  'shop=bakery': 'bakery',
  'shop=pastry': 'bakery',
  'shop=confectionery': 'sweet_shop', // in India "confectionery" = sweet shop
};

// OSM cuisine values → our cuisine names (only linked if that cuisine exists in the DB)
const OSM_CUISINE = {
  odia: 'Odia', oriya: 'Odia',
  north_indian: 'North Indian', punjabi: 'North Indian',
  south_indian: 'South Indian',
  mughlai: 'Mughlai',
  chinese: 'Chinese', indo_chinese: 'Chinese',
  continental: 'Continental',
  street_food: 'Street food',
  bakery: 'Bakery & desserts', cake: 'Bakery & desserts', dessert: 'Bakery & desserts', sweets: 'Bakery & desserts',
};

export const osmPlaceType = (tags = {}) => {
  if (/dhaba/i.test(tags.name ?? '')) return 'dhaba';
  if (tags.amenity && OSM_TYPE[`amenity=${tags.amenity}`]) return OSM_TYPE[`amenity=${tags.amenity}`];
  if (tags.shop && OSM_TYPE[`shop=${tags.shop}`]) return OSM_TYPE[`shop=${tags.shop}`];
  return null;
};

const osmAddress = (tags) => {
  const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'] ?? tags['addr:place'], tags['addr:postcode']]
    .filter(Boolean);
  return parts.length ? parts.join(', ') : (tags['addr:full'] ?? null);
};

// Overpass element (node / way / relation with "out center") → import record, or null to skip
export const osmToRecord = (el) => {
  const tags = el.tags ?? {};
  const name = tags.name?.trim() || tags['name:en']?.trim();
  const placeType = osmPlaceType(tags);
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!name || !placeType || lat == null || lng == null) return null;
  if (tags.disused === 'yes' || tags['disused:amenity'] || tags['was:amenity']) return null;

  const cuisines = (tags.cuisine ?? '')
    .split(';')
    .map((c) => OSM_CUISINE[c.trim().toLowerCase()])
    .filter(Boolean);

  let dietType = null;
  if (tags['diet:vegetarian'] === 'only') dietType = 'pure_veg';

  return {
    source: 'osm',
    sourceRef: `${el.type}/${el.id}`,
    name: name.slice(0, 150),
    lat,
    lng,
    placeType,
    dietType,
    address: osmAddress(tags),
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    cuisines: [...new Set(cuisines)],
  };
};

export const overpassQuery = ({ south, west, north, east } = BBSR_BBOX) => `[out:json][timeout:180];
(
  nwr["amenity"~"^(restaurant|fast_food|food_court|cafe|ice_cream)$"]["name"](${south},${west},${north},${east});
  nwr["shop"~"^(bakery|pastry|confectionery)$"]["name"](${south},${west},${north},${east});
);
out center tags;`;

// ---- Foursquare Open Places --------------------------------------------------
// Input = one JSON object per line, exported from the FSQ OS Places parquet files
// (columns: fsq_place_id, name, latitude, longitude, address, tel, date_closed,
//  fsq_category_labels). Only "Dining and Drinking" categories are imported.

const FSQ_TYPE_RULES = [
  [/dhaba/i, 'dhaba'],
  [/bakery|pastry/i, 'bakery'],
  [/dessert|sweet|candy|ice cream|mithai/i, 'sweet_shop'],
  [/food truck|food stand|street food|snack place/i, 'street_stall'],
  [/caf[eé]|coffee|tea room|juice bar/i, 'cafe'],
  [/restaurant|fast food|diner|food court|joint|biryani|eatery/i, 'restaurant'],
];

const FSQ_CUISINE_RULES = [
  [/odia|oriya/i, 'Odia'],
  [/north indian|punjabi/i, 'North Indian'],
  [/south indian/i, 'South Indian'],
  [/mughlai/i, 'Mughlai'],
  [/chinese/i, 'Chinese'],
  [/continental|european/i, 'Continental'],
  [/street food/i, 'Street food'],
  [/bakery|dessert/i, 'Bakery & desserts'],
];

export const fsqPlaceType = (labels = [], name = '') => {
  const dining = labels.filter((l) => l.startsWith('Dining and Drinking'));
  if (dining.length === 0) return null;
  if (/dhaba/i.test(name)) return 'dhaba';
  // Most specific part of each label first ("Dining and Drinking > Restaurant > Indian Restaurant")
  const leaves = dining.map((l) => l.split('>').pop().trim());
  for (const [pattern, type] of FSQ_TYPE_RULES) {
    if (leaves.some((leaf) => pattern.test(leaf))) return type;
  }
  return null;
};

const asArray = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.startsWith('[')) {
    try { return JSON.parse(v); } catch { return [v]; }
  }
  return v ? [v] : [];
};

export const fsqToRecord = (row) => {
  const name = row.name?.trim();
  const labels = asArray(row.fsq_category_labels);
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (row.date_closed) return null;
  const placeType = fsqPlaceType(labels, name);
  if (!placeType) return null;

  const cuisines = FSQ_CUISINE_RULES.filter(([pattern]) => labels.some((l) => pattern.test(l))).map(([, c]) => c);

  return {
    source: 'foursquare',
    sourceRef: String(row.fsq_place_id),
    name: name.slice(0, 150),
    lat,
    lng,
    placeType,
    dietType: null,
    address: row.address ?? null,
    phone: row.tel ?? null,
    cuisines: [...new Set(cuisines)],
  };
};

export const insideBbox = ({ lat, lng }, { south, west, north, east } = BBSR_BBOX) =>
  lat >= south && lat <= north && lng >= west && lng <= east;

// ---- Database -----------------------------------------------------------------

const POINT = 'ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography';

// Inserts records one by one. Skips (counts as duplicate) when:
//  - the same (source, source_ref) already exists (re-running the import), or
//  - any existing place is within 50 m with a similar name (pg_trgm %, OSM ↔ Foursquare overlap).
// area_id = nearest area pin.
// Imported places start as verified (established datasets — decision 2 Oct 2026);
// only user-added places go through the confirmation rule (Phase 3).
export const importRecords = async (db, records) => {
  const stats = { inserted: 0, sameSource: 0, merged: 0, skippedOutside: 0 };

  const { rows: areaCheck } = await db.query('SELECT COUNT(*) AS n FROM areas');
  if (Number(areaCheck[0].n) === 0) throw new Error('No areas — run `npm run seed` first');

  const { rows: cuisineRows } = await db.query('SELECT id, name FROM cuisines');
  const cuisineIds = new Map(cuisineRows.map((c) => [c.name, c.id]));

  for (const r of records) {
    if (!insideBbox(r)) {
      stats.skippedOutside += 1;
      continue;
    }

    const existing = await db.query('SELECT 1 FROM places WHERE source = $1 AND source_ref = $2', [r.source, r.sourceRef]);
    if (existing.rowCount > 0) {
      stats.sameSource += 1;
      continue;
    }

    const similar = await db.query(
      `SELECT id FROM places
       WHERE ST_DWithin(location, ${POINT}, 50) AND name % $1
       LIMIT 1`,
      [r.name, r.lng, r.lat],
    );
    if (similar.rowCount > 0) {
      stats.merged += 1;
      continue;
    }

    const { rows } = await db.query(
      `INSERT INTO places (name, location, address, area_id, place_type, diet_type, phone, source, source_ref, status, verified_at)
       VALUES ($1, ${POINT}, $4,
               (SELECT id FROM areas ORDER BY location <-> ${POINT} LIMIT 1),
               $5, $6, $7, $8, $9, 'verified', now())
       ON CONFLICT (source, source_ref) DO NOTHING
       RETURNING id`,
      [r.name, r.lng, r.lat, r.address, r.placeType, r.dietType, r.phone, r.source, r.sourceRef],
    );
    if (rows.length === 0) {
      stats.sameSource += 1;
      continue;
    }
    stats.inserted += 1;

    for (const cuisine of r.cuisines) {
      const cuisineId = cuisineIds.get(cuisine);
      if (!cuisineId) continue;
      await db.query(
        'INSERT INTO place_cuisines (place_id, cuisine_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [rows[0].id, cuisineId],
      );
    }
  }
  return stats;
};
