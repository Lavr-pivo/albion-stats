// Albion Market Stats — Express server (static frontend + JSON API).
import express from 'express';
import { join } from 'node:path';
import { PORT, ROOT, SERVERS, CITIES, DEFAULT_SERVER } from './config.js';
import { db } from './db.js';
import { router as items } from './routes/items.js';
import { router as prices } from './routes/prices.js';
import { router as history } from './routes/history.js';
import { router as flips } from './routes/flips.js';
import { router as craft } from './routes/craft.js';
import { startSync } from './sync.js';
import { loadItems } from './items.js';

const app = express();

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Expose static config the frontend needs.
app.get('/api/meta', (_req, res) => {
  const itemCount = db.prepare('SELECT COUNT(*) AS c FROM items').get().c;
  const priceRows = db.prepare('SELECT COUNT(*) AS c FROM prices').get().c;
  res.json({
    servers: Object.keys(SERVERS),
    defaultServer: DEFAULT_SERVER,
    cities: CITIES,
    itemCount,
    priceRows,
  });
});

app.use('/api/items', items);
app.use('/api/prices', prices);
app.use('/api/history', history);
app.use('/api/flips', flips);
app.use('/api/craft', craft);

app.use(express.static(join(ROOT, 'public')));

app.listen(PORT, async () => {
  console.log(`Albion Market Stats → http://localhost:${PORT}`);
  // Cold start (e.g. fresh Railway container): make sure items exist.
  if (db.prepare('SELECT COUNT(*) AS c FROM items').get().c === 0) {
    console.log('No items in DB — loading the catalog …');
    try { await loadItems(); } catch (e) { console.error('item load failed:', e.message); }
  }
  if (process.env.NO_SYNC !== '1') {
    console.log('Starting background price sync (set NO_SYNC=1 to disable) …');
    startSync();
  }
});
