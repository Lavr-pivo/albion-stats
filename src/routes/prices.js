// GET /api/prices?item=<id[,id]>&server=&cities=&qualities= — current prices.
import { Router } from 'express';
import { db } from '../db.js';
import { getPrices } from '../cache.js';
import { CITIES, DEFAULT_SERVER, DEFAULT_QUALITIES, SERVERS } from '../config.js';

export const router = Router();

router.get('/', async (req, res) => {
  const server = (req.query.server || DEFAULT_SERVER).toLowerCase();
  if (!SERVERS[server]) return res.status(400).json({ error: `unknown server "${server}"` });

  const items = String(req.query.item || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!items.length) return res.status(400).json({ error: 'item required' });

  const cities = req.query.cities
    ? String(req.query.cities).split(',').map((s) => s.trim()).filter(Boolean)
    : CITIES;
  const qualities = req.query.qualities
    ? String(req.query.qualities).split(',').map(Number).filter((n) => n >= 1 && n <= 5)
    : DEFAULT_QUALITIES;

  try {
    const rows = await getPrices(server, items, cities, qualities);
    // Attach item meta for convenience.
    const ph = items.map(() => '?').join(',');
    const meta = db.prepare(
      `SELECT unique_name, ru_name, en_name, tier, enchant FROM items WHERE unique_name IN (${ph})`,
    ).all(...items);
    res.json({ server, cities, qualities, items: meta, prices: rows });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
