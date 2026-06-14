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

  // Which items have a recent snapshot already?
  const ph = itemIds.map(() => '?').join(',');
  const freshRows = db.prepare(
    `SELECT item_id, MAX(fetched_at) AS f
       FROM prices WHERE server = ? AND item_id IN (${ph})
      GROUP BY item_id`,
  ).all(server, ...itemIds);
  const fresh = new Map(freshRows.map((r) => [r.item_id, r.f]));
  const stale = itemIds.filter((id) => !(fresh.get(id) > now - PRICE_TTL_MS));

  if (stale.length) {
    try {
      const rows = await fetchPrices(server, stale, cities, qualities);
      if (rows.length) upsertPrices(rows.map((r) => ({ ...r, fetched_at: now })));
    } catch (e) {
      // Network/AODP hiccup: fall back to whatever we have cached.
      console.warn('getPrices refresh failed:', e.message);
    }
  }

  const cityPh = cities.map(() => '?').join(',');
  const qualPh = qualities.map(() => '?').join(',');
  return db.prepare(
    `SELECT * FROM prices
      WHERE server = ? AND item_id IN (${ph})
        AND city IN (${cityPh}) AND quality IN (${qualPh})
      ORDER BY item_id, city, quality`,
  ).all(server, ...itemIds, ...cities, ...qualities);
}
