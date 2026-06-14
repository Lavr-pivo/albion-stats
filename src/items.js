// One-off loader: pulls the ao-bin-dumps item list into the `items` table.
// Run with:  npm run sync:items
import { pathToFileURL } from 'node:url';
import { db } from './db.js';
import { ITEMS_DUMP_URL, LOCALE } from './config.js';

function parseTier(uniqueName) {
  const m = /^T(\d)_/.exec(uniqueName);
  return m ? Number(m[1]) : null;
}
function parseEnchant(uniqueName) {
  const m = /@(\d)$/.exec(uniqueName);
  return m ? Number(m[1]) : 0;
}
function baseName(uniqueName) {
  return uniqueName.replace(/@\d$/, '');
}

export async function loadItems() {
  console.log('Fetching item dump …');
  const res = await fetch(ITEMS_DUMP_URL);
  if (!res.ok) throw new Error(`Item dump HTTP ${res.status}`);
  const data = await res.json();
  console.log(`Got ${data.length} entries, importing …`);

  const stmt = db.prepare(`
    INSERT INTO items (unique_name, ru_name, en_name, tier, enchant, base_name)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(unique_name) DO UPDATE SET
      ru_name = excluded.ru_name,
      en_name = excluded.en_name,
      tier    = excluded.tier,
      enchant = excluded.enchant,
      base_name = excluded.base_name
  `);

  let n = 0;
  db.exec('BEGIN');
  try {
    for (const it of data) {
      const uniqueName = it.UniqueName || it.uniquename;
      if (!uniqueName) continue;
      const names = it.LocalizedNames || null;
      const ru = names ? (names[LOCALE] || null) : null;
      const en = names ? (names['EN-US'] || null) : null;
      // Skip entries with no localized name at all (tokens, internal placeholders).
      if (!ru && !en) continue;
      stmt.run(
        uniqueName, ru, en,
        parseTier(uniqueName), parseEnchant(uniqueName), baseName(uniqueName),
      );
      n++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const total = db.prepare('SELECT COUNT(*) AS c FROM items').get().c;
  console.log(`Imported ${n} items (table now has ${total}).`);
}

// Run directly?
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadItems()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => db.close());
}
