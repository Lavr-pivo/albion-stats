// GET /api/items?q=<query>&limit=<n> — search items by RU/EN name or item id.
import { Router } from 'express';
import { db } from '../db.js';

export const router = Router();

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  if (!q) return res.json([]);

  const like = `%${q}%`;
  const rows = db.prepare(
    `SELECT unique_name, ru_name, en_name, tier, enchant
       FROM items
      WHERE ru_name LIKE ? OR en_name LIKE ? OR unique_name LIKE ?
      ORDER BY (unique_name = ?) DESC, tier, length(unique_name)
      LIMIT ?`,
  ).all(like, like, like, q.toUpperCase(), limit);

  res.json(rows);
});
