// Price cache: read from SQLite, refresh stale/missing items from AODP on demand.
import { db, upsertPrices } from './db.js';
import { fetchPrices } from './aodp.js';
import { PRICE_TTL_MS } from './config.js';

/**
 * Return current price rows for the requested items, refreshing any that are
 * older than PRICE_TTL_MS (or absent) from the live AODP API first.
 */
export async function getPrices(server, itemIds, cities, qualities) {
  itemIds = [...new Set(itemIds)];
  if (!itemIds.length) return [];
  const now = Date.now();

  const ph = itemIds.map(() => '?').join(',');
  const cityPh = cities.map(() => '?').join(',');
  const qualPh = qualities.map(() => '?').join(',');

  // Freshness must be tracked per (item, quality): an item is only "fresh" if
  // every requested quality has a recent row. Keying by item_id alone meant a
  // request for an uncached quality saw the item as fresh, skipped the fetch
  // and returned empty.
  const freshRows = db.prepare(
    `SELECT item_id, quality, MAX(fetched_at) AS f
       FROM prices WHERE server = ? AND item_id IN (${ph}) AND quality IN (${qualPh})
      GROUP BY item_id, quality`,
  ).all(server, ...itemIds, ...qualities);
  const freshQ = new Map(); // item_id -> Set of qualities with a fresh row
  for (const r of freshRows) {
    if (r.f > now - PRICE_TTL_MS) {
      if (!freshQ.has(r.item_id)) freshQ.set(r.item_id, new Set());
      freshQ.get(r.item_id).add(r.quality);
    }
  }
  const stale = itemIds.filter((id) => {
    const have = freshQ.get(id);
    return !have || qualities.some((q) => !have.has(q));
  });

  if (stale.length) {
    try {
      const rows = await fetchPrices(server, stale, cities, qualities);
      if (rows.length) upsertPrices(rows.map((r) => ({ ...r, fetched_at: now })));
    } catch (e) {
      // Network/AODP hiccup: fall back to whatever we have cached.
      console.warn('getPrices refresh failed:', e.message);
    }
  }

  return db.prepare(
    `SELECT * FROM prices
      WHERE server = ? AND item_id IN (${ph})
        AND city IN (${cityPh}) AND quality IN (${qualPh})
      ORDER BY item_id, city, quality`,
  ).all(server, ...itemIds, ...cities, ...qualities);
}
