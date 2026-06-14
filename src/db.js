// SQLite access via the built-in node:sqlite (no native build, no Python).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DB_PATH } from './config.js';

// Ensure the DB directory exists (node:sqlite won't create it; matters on
// fresh checkouts and ephemeral hosts like Railway).
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

// Pragmas for a snappy local server.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    unique_name      TEXT PRIMARY KEY,
    ru_name          TEXT,
    en_name          TEXT,
    tier             INTEGER,
    enchant          INTEGER DEFAULT 0,
    base_name        TEXT          -- unique_name without @enchant, for grouping
  );

  CREATE INDEX IF NOT EXISTS idx_items_ru   ON items(ru_name);
  CREATE INDEX IF NOT EXISTS idx_items_en   ON items(en_name);

  CREATE TABLE IF NOT EXISTS prices (
    item_id          TEXT NOT NULL,
    city             TEXT NOT NULL,
    quality          INTEGER NOT NULL,
    server           TEXT NOT NULL,
    sell_price_min   INTEGER,
    sell_price_max   INTEGER,
    buy_price_min    INTEGER,
    buy_price_max    INTEGER,
    observed_at      TEXT,         -- newest of the AODP *_date fields (UTC ISO)
    fetched_at       INTEGER,      -- epoch ms when we stored it
    PRIMARY KEY (item_id, city, quality, server)
  );

  CREATE INDEX IF NOT EXISTS idx_prices_lookup ON prices(server, item_id, quality);

  CREATE TABLE IF NOT EXISTS recipes (
    item_unique_name      TEXT NOT NULL,
    resource_unique_name  TEXT NOT NULL,
    count                 INTEGER NOT NULL,
    max_return_rate       REAL,
    PRIMARY KEY (item_unique_name, resource_unique_name)
  );
`);

// Helpers ------------------------------------------------------------------

const upsertPriceStmt = db.prepare(`
  INSERT INTO prices
    (item_id, city, quality, server, sell_price_min, sell_price_max,
     buy_price_min, buy_price_max, observed_at, fetched_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(item_id, city, quality, server) DO UPDATE SET
    sell_price_min = excluded.sell_price_min,
    sell_price_max = excluded.sell_price_max,
    buy_price_min  = excluded.buy_price_min,
    buy_price_max  = excluded.buy_price_max,
    observed_at    = excluded.observed_at,
    fetched_at     = excluded.fetched_at
`);

export function upsertPrice(row) {
  upsertPriceStmt.run(
    row.item_id, row.city, row.quality, row.server,
    row.sell_price_min ?? null, row.sell_price_max ?? null,
    row.buy_price_min ?? null, row.buy_price_max ?? null,
    row.observed_at ?? null, row.fetched_at ?? Date.now(),
  );
}

export function upsertPrices(rows) {
  // node:sqlite has no .transaction() helper; batch manually for speed.
  db.exec('BEGIN');
  try {
    for (const r of rows) upsertPrice(r);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
