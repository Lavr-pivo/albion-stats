// Background price sync.
//  - "hot" pass (default every 60s): refreshes the most active items only —
//    cheap and rate-limit friendly, so prices feel near-real-time.
//  - "full" pass (default every 30 min): refreshes the whole tiered catalog.
import { pathToFileURL } from 'node:url';
import { db, upsertPrices } from './db.js';
import { fetchPrices } from './aodp.js';
import {
  CITIES, DEFAULT_QUALITIES, HOT_SET_SIZE,
  HOT_SYNC_INTERVAL_MS, FULL_SYNC_INTERVAL_MS,
} from './config.js';

const SYNC_SERVERS = (process.env.SYNC_SERVERS || 'europe,west,east').split(',').map((s) => s.trim());
const SYNC_LIMIT = process.env.SYNC_LIMIT ? Number(process.env.SYNC_LIMIT) : null;

let busy = false; // prevent overlapping passes from piling up on the queue

function fullItemIds() {
  const q = SYNC_LIMIT
    ? `SELECT unique_name FROM items WHERE tier IS NOT NULL ORDER BY tier LIMIT ${SYNC_LIMIT}`
    : 'SELECT unique_name FROM items WHERE tier IS NOT NULL';
  return db.prepare(q).all().map((r) => r.unique_name);
}

// Most recently active items (by newest observed price); fall back to the
// catalog head on a cold DB.
function hotItemIds() {
  const hot = db.prepare(
    `SELECT item_id FROM prices WHERE observed_at IS NOT NULL
      GROUP BY item_id ORDER BY MAX(observed_at) DESC LIMIT ?`,
  ).all(HOT_SET_SIZE).map((r) => r.item_id);
  if (hot.length) return hot;
  return db.prepare(
    'SELECT unique_name FROM items WHERE tier IS NOT NULL ORDER BY tier LIMIT ?',
  ).all(HOT_SET_SIZE).map((r) => r.unique_name);
}

async function runPass(label, ids) {
  if (!ids.length) { console.warn(`sync(${label}): no items — run \`npm run sync:items\` first.`); return; }
  if (busy) { console.log(`sync(${label}): skipped, previous pass still running`); return; }
  busy = true;
  try {
    for (const server of SYNC_SERVERS) {
      const t0 = Date.now();
      try {
        const rows = await fetchPrices(server, ids, CITIES, DEFAULT_QUALITIES, 'low');
        if (rows.length) upsertPrices(rows.map((r) => ({ ...r, fetched_at: Date.now() })));
        console.log(`sync(${label}) ${server}: ${rows.length} rows / ${ids.length} items in ${((Date.now() - t0) / 1000) | 0}s`);
      } catch (e) {
        console.warn(`sync(${label}) ${server} failed:`, e.message);
      }
    }
  } finally {
    busy = false;
  }
}

export const syncFull = () => runPass('full', fullItemIds());
export const syncHot = () => runPass('hot', hotItemIds());
export const syncOnce = syncFull; // backwards-compatible alias

export function startSync() {
  syncFull().catch((e) => console.error('sync error:', e));
  const t1 = setInterval(() => syncFull().catch((e) => console.error('sync error:', e)), FULL_SYNC_INTERVAL_MS);
  const t2 = setInterval(() => syncHot().catch((e) => console.error('sync error:', e)), HOT_SYNC_INTERVAL_MS);
  return [t1, t2];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--once')) {
    // Close the DB and let the loop drain naturally — calling process.exit()
    // while node:sqlite is closing trips a libuv assertion on Windows.
    syncFull()
      .catch((e) => { console.error(e); process.exitCode = 1; })
      .finally(() => db.close());
  } else {
    startSync();
  }
}
