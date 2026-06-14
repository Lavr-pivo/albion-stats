# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run sync:items     # load the item catalog + RU names into SQLite (run once; start does it automatically if DB is empty)
npm start              # Express server + background price sync → http://localhost:3000
npm run sync:prices    # one-off full price sync without starting the server (honors SYNC_LIMIT)
```

- **No test suite** and no lint/build step — it's plain ESM JavaScript served as-is.
- Disable background sync while developing: `NO_SYNC=1 npm start`.
- Speed up syncs during testing: `SYNC_LIMIT=60 SYNC_SERVERS=europe npm run sync:prices`.

## Hard requirements

- **Node.js ≥ 24.** The app uses the built-in `node:sqlite` with no native build. In Node 22.x that module is experimental and needs `--experimental-sqlite`; only 24+ has it unflagged. `engines` and `.nvmrc` pin this.

## Data source policy (important)

All market data comes from **The Albion Online Data Project (AODP)** public REST API
(`{west,europe,east}.albion-online-data.com`). **Do not scrape albiononline2d.com** — it
returns 403 to bots and AODP is the same upstream source, legal and stable. Item metadata
and Russian names come from the GitHub `ao-data/ao-bin-dumps` `formatted/items.json`; item
images from `render.albiononline.com`. None of these need API keys.

## Architecture

Request/data flow:

```
AODP API ──> aodp.js (throttled serial queue, batches ≤100 item ids/request)
               ├─> cache.js  (on-demand reads with TTL; refreshes stale items)  ──> routes/prices, routes/history
               └─> sync.js   (background: hot set every 60s + full catalog every 30 min)
                         └─> db.js (node:sqlite: items, prices, recipes) ──> flips.js ──> routes/flips
public/ (vanilla ESM frontend) ── fetch /api/* ──> Express (server.js)
```

Key design points that span multiple files:

- **Live vs. cached reads.** `/api/prices` and `/api/history` fetch from AODP on demand
  (via `cache.js`/`aodp.js`) and work for any item. `/api/flips` reads **only the local
  `prices` table** — it never calls AODP — so the flip finder is empty until `sync.js` has
  populated the DB. This split is intentional.
- **Two-tier sync respects AODP rate limits** (180/min AND 300/5min — the 5-min cap binds).
  `aodp.js` throttles every request to `AODP_MIN_INTERVAL_MS` (default 1100ms ≈ 55/min,
  sustained-safe). A full-catalog pass of all 3 servers is ~180 requests, so it runs only
  every `FULL_SYNC_INTERVAL_MS`; a small `HOT_SET_SIZE` "hot set" of the most recently
  active items refreshes every `HOT_SYNC_INTERVAL_MS`. Polling faster than this is pointless —
  AODP data only updates when players visit in-game markets.
- **Timestamp convention.** AODP `*_date` values are UTC strings *without* a `Z`. The DB
  stores the newest one as `observed_at` verbatim; freshness filters compare strings
  lexicographically (same format), and the frontend appends `Z` before `Date.parse`. Keep
  this convention when touching dates.
- **The `prices` table holds only the latest snapshot** per (item, city, quality, server),
  upserted on conflict. There is no local history table — history comes live from AODP.
- **DB location is env-driven.** `DATA_DIR` sets where `albion.db` lives (used for the
  Railway persistent Volume); `db.js` auto-creates the directory.

## Data-quality handling (don't remove these guards)

AODP is crowdsourced, so expect stale entries and single "troll" listings (absurd prices):
- `flips.js` drops stale rows (`maxAge`), sub-floor buys (`minBuyPrice`), and caps `maxRoi`
  (default 10×) to filter the obvious troll listings.
- `public/js/history.js` nulls out per-city outliers (>6× / <⅙ the median) so one bad point
  doesn't flatten the chart.
- The UI always surfaces data age (`observed_at`).

## Frontend

Static files under `public/`, no bundler. Pages are plain HTML loading ESM modules;
`public/js/common.js` holds shared helpers (header/nav, server switcher persisted in
`localStorage`, formatting, the `el()` DOM builder). Charts use Chart.js from a CDN.

## Status

The craft calculator (`/api/craft`, `public/craft.html`) is a **stub** — not yet
implemented. It needs recipe data from the full `ao-bin-dumps` `items.json`.
