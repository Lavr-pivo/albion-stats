// Central configuration for the Albion Market Stats app.
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');

// Where the SQLite file lives. On Railway, mount a Volume and set DATA_DIR
// (e.g. /data) so the DB survives redeploys; locally it defaults to ./data.
const DATA_DIR = process.env.DATA_DIR
  ? (isAbsolute(process.env.DATA_DIR) ? process.env.DATA_DIR : join(ROOT, process.env.DATA_DIR))
  : join(ROOT, 'data');

export const PORT = Number(process.env.PORT) || 3000;

// AODP regional servers. The `server` query param selects one of these keys.
export const SERVERS = {
  west:   'https://west.albion-online-data.com',
  europe: 'https://europe.albion-online-data.com',
  east:   'https://east.albion-online-data.com',
};
export const DEFAULT_SERVER = 'europe';

// Royal cities + special markets tracked by default.
export const CITIES = [
  'Caerleon',
  'Bridgewatch',
  'Lymhurst',
  'Martlock',
  'Thetford',
  'Fort Sterling',
  'Brecilien',
  'Black Market',
];

// Item qualities (1 = Normal ... 5 = Masterpiece). v1 focuses on Normal.
export const QUALITIES = [1, 2, 3, 4, 5];
export const DEFAULT_QUALITIES = [1];

// Cache / freshness.
export const PRICE_TTL_MS = 10 * 60 * 1000;   // serve cached prices for 10 min
export const STALE_MAX_MS = 12 * 60 * 60 * 1000; // ignore data older than 12h in flips/craft

// AODP rate limits: 180 req/min AND 300 req/5min. The 5-min cap is the binding
// one for an always-on server, so for *sustained* polling we keep ~55 req/min
// (1100ms spacing → 275 per 5 min). Override with AODP_MIN_INTERVAL_MS if needed.
export const AODP_MIN_INTERVAL_MS = Number(process.env.AODP_MIN_INTERVAL_MS) || 1100;
export const MAX_ITEMS_PER_REQUEST = 100;      // keep URL well under 4096 chars

// Sync scheduling. A "hot set" of the most active items refreshes every minute
// (cheap, fits limits); the full catalog refreshes less often.
export const HOT_SYNC_INTERVAL_MS = Number(process.env.HOT_SYNC_INTERVAL_MS) || 60 * 1000;
export const FULL_SYNC_INTERVAL_MS = Number(process.env.FULL_SYNC_INTERVAL_MS) || 30 * 60 * 1000;
export const HOT_SET_SIZE = Number(process.env.HOT_SET_SIZE) || 500;

// Data sources.
export const ITEMS_DUMP_URL =
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';
export const ITEMS_FULL_DUMP_URL =
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
export const RENDER_URL = 'https://render.albiononline.com/v1/item';

export const DB_PATH = join(DATA_DIR, 'albion.db');
export const LOCALE = 'RU-RU';
