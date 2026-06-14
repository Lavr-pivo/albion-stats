// GET /api/craft?item=<id>&server=&city=&premium=&returnRate=
// Implemented in a later phase (needs recipe data from the full ao-bin dump).
import { Router } from 'express';

export const router = Router();

router.get('/', (req, res) => {
  res.status(501).json({ error: 'craft calculator not implemented yet (phase 7)' });
});
