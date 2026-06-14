// Flip finder: scan cached prices and rank profitable city-to-city resells.
import { db } from './db.js';

// observed_at is stored as an AODP UTC string "YYYY-MM-DDThh:mm:ss" (no Z),
// so a same-format cutoff string compares correctly with lexicographic >=.
function utcCutoff(maxAgeHours) {
  return new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString().slice(0, 19);
}

/**
 * Buy at the cheapest sell offer in one city, sell via a sell order in another.
 * profit = sell_price_min(dest) * (1 - salesTax - setupFee) - sell_price_min(src)
 */
export function computeFlips({
  server, cities, quality = 1, premium = true,
  maxAgeHours = 12, minProfit = 0, minRoi = 0,
  maxRoi = 10, minBuyPrice = 100, limit = 100,
}) {
  const salesTax = premium ? 0.04 : 0.08;
  const setupFee = 0.025;
  const net = 1 - salesTax - setupFee;
  const cutoff = utcCutoff(maxAgeHours);

  const cityPh = cities.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT item_id, city, sell_price_min AS price, observed_at
       FROM prices
      WHERE server = ? AND quality = ? AND city IN (${cityPh})
        AND sell_price_min IS NOT NULL AND sell_price_min > 0
        AND observed_at IS NOT NULL AND observed_at >= ?`,
  ).all(server, quality, ...cities, cutoff);

  // Group by item: find cheapest (buy) and dearest (sell) city.
  const byItem = new Map();
  for (const r of rows) {
    let g = byItem.get(r.item_id);
    if (!g) { g = { min: r, max: r }; byItem.set(r.item_id, g); }
    if (r.price < g.min.price) g.min = r;
    if (r.price > g.max.price) g.max = r;
  }

  const out = [];
  for (const [itemId, g] of byItem) {
    if (g.min.city === g.max.city) continue;
    const buyCost = g.min.price;
    if (buyCost < minBuyPrice) continue;           // skip sub-floor noise
    const sellNet = Math.round(g.max.price * net);
    const profit = sellNet - buyCost;
    const roi = profit / buyCost;
    // maxRoi guards against troll/outlier listings (e.g. 50 → 10,000,000).
    if (profit < minProfit || roi < minRoi || roi > maxRoi) continue;
    out.push({
      item_id: itemId,
      buy_city: g.min.city,
      buy_price: buyCost,
      sell_city: g.max.city,
      sell_price: g.max.price,
      sell_net: sellNet,
      profit,
      roi,
      buy_observed_at: g.min.observed_at,
      sell_observed_at: g.max.observed_at,
    });
  }

  out.sort((a, b) => b.profit - a.profit);
  const top = out.slice(0, limit);

  // Attach item names.
  if (top.length) {
    const ph = top.map(() => '?').join(',');
    const names = db.prepare(
      `SELECT unique_name, ru_name, en_name, tier, enchant FROM items WHERE unique_name IN (${ph})`,
    ).all(...top.map((t) => t.item_id));
    const nameMap = new Map(names.map((n) => [n.unique_name, n]));
    for (const t of top) {
      const m = nameMap.get(t.item_id);
      t.name = m ? (m.ru_name || m.en_name || t.item_id) : t.item_id;
      t.tier = m?.tier ?? null;
      t.enchant = m?.enchant ?? 0;
    }
  }
  return top;
}
