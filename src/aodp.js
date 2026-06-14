// Client for the Albion Online Data Project REST API, with a simple
// rate-limited queue (the public API allows 180 req/min).
import {
  SERVERS, AODP_MIN_INTERVAL_MS, MAX_ITEMS_PER_REQUEST,
} from './config.js';

// --- serial, throttled request queue ---------------------------------------
let chain = Promise.resolve();
let lastAt = 0;

function throttled(fn) {
  const run = async () => {
    const wait = Math.max(0, lastAt + AODP_MIN_INTERVAL_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  };
  chain = chain.then(run, run);
  return chain;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const EPOCH_ZERO = '0001-01-01T00:00:00';

// Newest non-empty AODP *_date on a row -> ISO string (or null).
function observedAt(r) {
  const dates = [
    r.sell_price_min_date, r.sell_price_max_date,
    r.buy_price_min_date, r.buy_price_max_date,
  ].filter((d) => d && d !== EPOCH_ZERO);
  if (!dates.length) return null;
  return dates.reduce((a, b) => (a > b ? a : b));
}

function baseUrl(server) {
  const url = SERVERS[server];
  if (!url) throw new Error(`Unknown server "${server}"`);
  return url;
}

/**
 * Fetch current prices for many items across cities/qualities.
 * Returns normalized rows: {item_id, city, quality, server,
 *   sell_price_min, sell_price_max, buy_price_min, buy_price_max, observed_at}.
 */
export async function fetchPrices(server, itemIds, cities, qualities) {
  const base = baseUrl(server);
  const loc = cities.map(encodeURIComponent).join(',');
  const qual = qualities.join(',');
  const all = [];

  for (const ids of chunk([...new Set(itemIds)], MAX_ITEMS_PER_REQUEST)) {
    const url = `${base}/api/v2/stats/prices/${ids.map(encodeURIComponent).join(',')}`
      + `?locations=${loc}&qualities=${qual}`;
    const rows = await throttled(async () => {
      const res = await fetch(url, { headers: { 'User-Agent': 'albion-stats/0.1' } });
      if (!res.ok) throw new Error(`AODP prices HTTP ${res.status} for ${ids.length} items`);
      return res.json();
    });
    for (const r of rows) {
      all.push({
        item_id: r.item_id,
        city: r.city,
        quality: r.quality,
        server,
        sell_price_min: r.sell_price_min || null,
        sell_price_max: r.sell_price_max || null,
        buy_price_min: r.buy_price_min || null,
        buy_price_max: r.buy_price_max || null,
        observed_at: observedAt(r),
      });
    }
  }
  return all;
}

/**
 * Fetch price history for one or more items.
 * timeScale: 1 | 6 | 24 (hours per data point).
 */
export async function fetchHistory(server, itemIds, cities, qualities, days = 7, timeScale = 6) {
  const base = baseUrl(server);
  const loc = cities.map(encodeURIComponent).join(',');
  const qual = qualities.join(',');
  const ids = [...new Set(itemIds)].map(encodeURIComponent).join(',');

  // AODP expects date as MM-DD-YYYY.
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;

  const url = `${base}/api/v2/stats/history/${ids}`
    + `?date=${fmt(start)}&end_date=${fmt(end)}`
    + `&locations=${loc}&qualities=${qual}&time-scale=${timeScale}`;

  return throttled(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': 'albion-stats/0.1' } });
    if (!res.ok) throw new Error(`AODP history HTTP ${res.status}`);
    return res.json();
  });
}
