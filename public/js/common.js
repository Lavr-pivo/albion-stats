// Shared frontend helpers: header, server state, formatting.
export const RENDER = 'https://render.albiononline.com/v1/item';
export const SERVER_LABEL = { west: 'Americas (West)', europe: 'Europe', east: 'Asia (East)' };

export const state = {
  get server() { return localStorage.getItem('server') || 'europe'; },
  set server(v) { localStorage.setItem('server', v); },
  get premium() { return localStorage.getItem('premium') !== '0'; },
  set premium(v) { localStorage.setItem('premium', v ? '1' : '0'); },
};

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
}

export const fmt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('ru-RU'));
export const itemImg = (id, q = 1) => `${RENDER}/${encodeURIComponent(id)}.png?quality=${q}&size=64`;

// observed_at is UTC without a Z suffix; treat it as UTC.
export function ageInfo(observedAt) {
  if (!observedAt) return { text: 'нет данных', cls: 'old' };
  const t = Date.parse(observedAt.endsWith('Z') ? observedAt : observedAt + 'Z');
  const ms = Date.now() - t;
  const min = ms / 60000;
  let text;
  if (min < 60) text = `${Math.max(1, Math.round(min))} мин`;
  else if (min < 1440) text = `${Math.round(min / 60)} ч`;
  else text = `${Math.round(min / 1440)} дн`;
  const cls = min < 60 ? 'fresh' : min < 720 ? 'mid' : 'old';
  return { text, cls };
}

export async function getJSON(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

// Build the shared top navigation with a server switcher.
export function header(active) {
  const links = [['/', 'Цены'], ['/flips.html', 'Перепродажи'], ['/item.html', 'История'], ['/craft.html', 'Крафт']];
  const sel = el('select', {
    onchange: (e) => { state.server = e.target.value; window.dispatchEvent(new Event('server-change')); },
  }, ...Object.keys(SERVER_LABEL).map((k) =>
    el('option', { value: k, ...(k === state.server ? { selected: '' } : {}) }, SERVER_LABEL[k])));

  const nav = el('nav', {}, el('div', { class: 'wrap nav-in' },
    el('a', { href: '/', class: 'logo' }, el('span', { class: 'dot' }), 'Albion Market'),
    el('div', { class: 'nav-links' }, ...links.map(([h, t]) =>
      el('a', { href: h, ...(active === h ? { class: 'active' } : {}) }, t))),
    el('div', { class: 'nav-right' }, el('span', { style: 'color:var(--muted);font-size:13px' }, 'Сервер:'), sel),
  ));
  document.body.prepend(nav);
}

export function footer() {
  document.body.append(el('footer', { class: 'wrap' },
    'Данные: ', el('a', { href: 'https://www.albion-online-data.com/', target: '_blank' }, 'The Albion Online Data Project'),
    ' · краудсорс, возможны устаревшие и единичные «троллинг»-цены.'));
}
