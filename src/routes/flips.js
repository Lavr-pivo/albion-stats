// GET /api/flips?server=&cities=&quality=&premium=&maxAge=&minProfit=&minRoi=&limit=
import { Router } from 'express';
import { computeFlips } from '../flips.js';
import { CITIES, DEFAULT_SERVER, SERVERS } from '../config.js';

export const router = Router();

router.get('/', (req, res) => {
  const server = (req.query.server || DEFAULT_SERVER).toLowerCase();
  if (!SERVERS[server]) return res.status(400).json({ error: `unknown server "${server}"` });

  const cities = req.query.cities
    ? String(req.query.cities).split(',').map((s) => s.trim()).filter(Boolean)
    : CITIES;

  const flips = computeFlips({
    server,
    cities,
    quality: Number(req.query.quality) || 1,
    premium: req.query.premium !== 'false',
    maxAgeHours: Number(req.query.maxAge) || 12,
    minProfit: Number(req.query.minProfit) || 0,
    minRoi: Number(req.query.minRoi) || 0,
    maxRoi: req.query.maxRoi !== undefined ? Number(req.query.maxRoi) : 10,
    minBuyPrice: req.query.minBuyPrice !== undefined ? Number(req.query.minBuyPrice) : 100,
    limit: Math.min(Number(req.query.limit) || 100, 500),
  });

  res.json({ server, count: flips.length, flips });
});
