// One-time import of Bhubaneswar food places. Safe to re-run (no duplicates).
//
//   node scripts/import-places.js osm
//   node scripts/import-places.js foursquare <file.ndjson>
//
// Run OSM first, then Foursquare: Foursquare places within 50 m of an OSM place
// with a similar name are treated as the same place and skipped.
//
// Licences (see plans/06_phase_plan.md, setup-time verification log):
// - OSM: © OpenStreetMap contributors, ODbL — credit on /about.
// - Foursquare OS Places: Apache 2.0 — keep the NOTICE / attribution on /about.
//
// Foursquare input: the dataset is gated on Hugging Face (foursquare/fsq-os-places).
// After accepting the terms, export only Bhubaneswar rows to NDJSON, e.g. with DuckDB:
//   COPY (
//     SELECT fsq_place_id, name, latitude, longitude, address, tel, date_closed, fsq_category_labels
//     FROM read_parquet('<downloaded places parquet files>/*.parquet')
//     WHERE latitude BETWEEN 20.18 AND 20.40 AND longitude BETWEEN 85.70 AND 85.95
//   ) TO 'bbsr_fsq.ndjson' (FORMAT JSON);
import { readFile } from 'node:fs/promises';
import { pool, closeDb } from '../src/config/db.js';
import { osmToRecord, fsqToRecord, overpassQuery, importRecords } from './lib/placeImport.js';

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const fetchOsm = async () => {
  const body = new URLSearchParams({ data: overpassQuery() });
  for (const url of OVERPASS_SERVERS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body,
        headers: { 'User-Agent': 'Khaozo/0.1 (one-time place import)' },
        signal: AbortSignal.timeout(200_000),
      });
      const text = await res.text();
      if (res.ok && text.startsWith('{')) return JSON.parse(text).elements;
      console.warn(`[import] ${url} → HTTP ${res.status}, trying next server`);
    } catch (err) {
      console.warn(`[import] ${url} → ${err.message}, trying next server`);
    }
  }
  throw new Error('All Overpass servers failed — try again later');
};

const readNdjson = async (file) =>
  (await readFile(file, 'utf8'))
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

const main = async () => {
  const [source, file] = process.argv.slice(2);
  let records;
  if (source === 'osm') {
    const elements = await fetchOsm();
    records = elements.map(osmToRecord).filter(Boolean);
    console.log(`[import] OSM: ${elements.length} elements → ${records.length} usable places`);
  } else if (source === 'foursquare' && file) {
    const rows = await readNdjson(file);
    records = rows.map(fsqToRecord).filter(Boolean);
    console.log(`[import] Foursquare: ${rows.length} rows → ${records.length} usable places`);
  } else {
    console.error('Usage: node scripts/import-places.js osm | foursquare <file.ndjson>');
    process.exitCode = 1;
    return;
  }

  const stats = await importRecords(pool, records);
  console.log('[import] done:', stats);
};

try {
  await main();
} finally {
  await closeDb();
}
