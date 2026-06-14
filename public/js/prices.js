import { header, footer, state, el, fmt, itemImg, ageInfo, getJSON } from './common.js';

header('/');
footer();

const qEl = document.getElementById('q');
const acEl = document.getElementById('ac');
const resultEl = document.getElementById('result');
let current = null;       // currently shown item id
let acItems = [];
let acSel = -1;
let timer = null;

// --- autocomplete ----------------------------------------------------------
qEl.addEventListener('input', () => {
  clearTimeout(timer);
  const q = qEl.value.trim();
  if (q.length < 2) { closeAc(); return; }
  timer = setTimeout(() => runSearch(q), 180);
});
qEl.addEventListener('keydown', (e) => {
  if (!acEl.classList.contains('open')) return;
  if (e.key === 'ArrowDown') { acSel = Math.min(acSel + 1, acItems.length - 1); paintAc(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { acSel = Math.max(acSel - 1, 0); paintAc(); e.preventDefault(); }
  else if (e.key === 'Enter' && acSel >= 0) { pick(acItems[acSel]); e.preventDefault(); }
  else if (e.key === 'Escape') closeAc();
});
document.addEventListener('click', (e) => { if (!e.target.closest('#search')) closeAc(); });

async function runSearch(q) {
  try {
    acItems = await getJSON(`/api/items?q=${encodeURIComponent(q)}&limit=20`);
    acSel = -1; paintAc();
  } catch { closeAc(); }
}
function paintAc() {
  acEl.innerHTML = '';
  if (!acItems.length) { closeAc(); return; }
  acItems.forEach((it, i) => {
    acEl.append(el('div', { class: 'ac-item' + (i === acSel ? ' sel' : ''), onclick: () => pick(it) },
      el('img', { src: itemImg(it.unique_name), loading: 'lazy' }),
      el('div', {}, el('div', { class: 'nm' }, it.ru_name || it.en_name || it.unique_name),
        el('div', { class: 'id' }, it.unique_name)),
    ));
  });
  acEl.classList.add('open');
}
function closeAc() { acEl.classList.remove('open'); acSel = -1; }
function pick(it) { closeAc(); qEl.value = it.ru_name || it.unique_name; loadItem(it.unique_name); }

// --- price table -----------------------------------------------------------
async function loadItem(id) {
  current = id;
  resultEl.innerHTML = '';
  resultEl.append(el('div', { class: 'empty' }, el('span', { class: 'spin' }), ' Загружаю цены…'));
  try {
    const d = await getJSON(`/api/prices?item=${encodeURIComponent(id)}&server=${state.server}&qualities=1`);
    render(d);
  } catch (e) {
    resultEl.innerHTML = '';
    resultEl.append(el('div', { class: 'empty' }, 'Ошибка: ' + e.message));
  }
}

function render(d) {
  const meta = d.items[0] || { unique_name: current };
  const rows = d.prices.filter((p) => p.quality === 1);

  const head = el('div', { class: 'itemcell', style: 'gap:14px;margin-bottom:16px' },
    el('img', { src: itemImg(current), style: 'width:60px;height:60px' }),
    el('div', {},
      el('div', { style: 'font-size:20px;font-weight:700' }, meta.ru_name || meta.en_name || current),
      el('div', { class: 'sub' }, current,
        ' · ', el('a', { href: `/item.html?item=${encodeURIComponent(current)}`, style: 'color:var(--acc2)' }, 'график истории →')),
    ));

  const table = el('table', {}, el('thead', {}, el('tr', {},
    el('th', {}, 'Город'),
    el('th', { class: 'num' }, 'Продажа (мин)'),
    el('th', { class: 'num' }, 'Продажа (макс)'),
    el('th', { class: 'num' }, 'Скупка (макс)'),
    el('th', {}, 'Обновлено'))));

  const hasData = rows.some((r) => r.sell_price_min || r.sell_price_max || r.buy_price_max);
  const tb = el('tbody');
  if (!hasData) {
    tb.append(el('tr', {}, el('td', { colspan: 5, class: 'empty' }, 'Нет данных по этому предмету на сервере ' + d.server)));
  } else {
    // cheapest sell highlighted.
    const minSell = Math.min(...rows.filter((r) => r.sell_price_min).map((r) => r.sell_price_min));
    for (const r of rows) {
      const a = ageInfo(r.observed_at);
      tb.append(el('tr', {},
        el('td', {}, r.city),
        el('td', { class: 'num', style: r.sell_price_min === minSell ? 'color:var(--good);font-weight:700' : '' }, fmt(r.sell_price_min)),
        el('td', { class: 'num' }, fmt(r.sell_price_max)),
        el('td', { class: 'num' }, fmt(r.buy_price_max)),
        el('td', {}, el('span', { class: 'age ' + a.cls }, a.text)),
      ));
    }
  }
  table.append(tb);
  resultEl.innerHTML = '';
  resultEl.append(head, el('div', { class: 'card', style: 'padding:0;overflow:hidden' }, table));
}

window.addEventListener('server-change', () => { if (current) loadItem(current); });

// Deep-link support: index.html?item=ID
const initial = new URLSearchParams(location.search).get('item');
if (initial) loadItem(initial);
