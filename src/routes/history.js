// GET /api/history?item=<id>&server=&cities=&quality=&days=&scale= — price history.
import { Router } from 'express';
import { fetchHistory } from '../aodp.js';
import { CITIES, DEFAULT_SERVER, SERVERS } from '../config.js';

export const router = Router();

router.get('/', async (req, res) => {
  const server = (req.query.server || DEFAULT_SERVER).toLowerCase();
  if (!SERVERS[server]) return res.status(400).json({ error: `unknown server "${server}"` });

  const items = String(req.query.item || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!items.length) return res.status(400).json({ error: 'item required' });

  const cities = req.query.cities
    ? String(req.query.cities).split(',').map((s) => s.trim()).filter(Boolean)
    : CITIES;
  const quality = Number(req.query.quality) || 1;
  const days = Math.min(Number(req.query.days) || 7, 30);
  const scale = [1, 6, 24].includes(Number(req.query.scale)) ? Number(req.query.scale) : 6;

  try {
    const data = await fetchHistory(server, items, cities, [quality], days, scale);
    res.json({ server, days, scale, data });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
