import { header, footer, state, el, fmt, itemImg, getJSON } from './common.js';

header('/item.html');
footer();

const resultEl = document.getElementById('result');
const qEl = document.getElementById('q');
const acEl = document.getElementById('ac');
let current = new URLSearchParams(location.search).get('item');
let chart = null;
let acItems = [], acSel = -1, timer = null;

const PALETTE = {
  Caerleon: '#ff7ac6', Bridgewatch: '#e0b341', Lymhurst: '#46d39a', Martlock: '#4ad9e4',
  Thetford: '#a78bfa', 'Fort Sterling': '#cbd5e1', Brecilien: '#7c6cff', 'Black Market': '#e0556b',
};

// --- minimal autocomplete (navigates within this page) ----------------------
qEl.addEventListener('input', () => {
  clearTimeout(timer);
  const q = qEl.value.trim();
  if (q.length < 2) { acEl.classList.remove('open'); return; }
  timer = setTimeout(async () => {
    try {
      acItems = await getJSON(`/api/items?q=${encodeURIComponent(q)}&limit=20`); acSel = -1; paintAc();
    } catch { acEl.classList.remove('open'); }
  }, 180);
});
document.addEventListener('click', (e) => { if (!e.target.closest('#search')) acEl.classList.remove('open'); });
function paintAc() {
  acEl.innerHTML = '';
  acItems.forEach((it) => acEl.append(el('div', { class: 'ac-item', onclick: () => { acEl.classList.remove('open'); qEl.value = it.ru_name || it.unique_name; current = it.unique_name; history.replaceState(null, '', `?item=${encodeURIComponent(current)}`); load(); } },
    el('img', { src: itemImg(it.unique_name), loading: 'lazy' }),
    el('div', {}, el('div', { class: 'nm' }, it.ru_name || it.en_name || it.unique_name), el('div', { class: 'id' }, it.unique_name)))));
  acEl.classList.toggle('open', acItems.length > 0);
}

async function load() {
  if (!current) { resultEl.innerHTML = '<div class="empty">Выбери предмет выше, чтобы увидеть график.</div>'; return; }
  resultEl.innerHTML = '<div class="empty"><span class="spin"></span> Загружаю историю…</div>';
  const days = document.getElementById('days').value;
  const scale = document.getElementById('scale').value;
  try {
    const d = await getJSON(`/api/history?item=${encodeURIComponent(current)}&server=${state.server}&days=${days}&scale=${scale}&quality=1`);
    render(d);
  } catch (e) {
    resultEl.innerHTML = `<div class="empty">Ошибка: ${e.message}</div>`;
  }
}

function render(d) {
  const series = d.data || [];
  if (!series.length) {
    resultEl.innerHTML = `<div class="empty">Нет истории по «${current}» на сервере ${d.server}.</div>`;
    return;
  }
  // Union of timestamps across cities.
  const tset = new Set();
  series.forEach((s) => s.data.forEach((p) => tset.add(p.timestamp)));
  const labels = [...tset].sort();
  const fmtLabel = (t) => new Date(t + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  // Drop extreme outliers (bad/troll data points) relative to each city's median
  // so a single absurd value doesn't flatten the whole chart.
  const median = (arr) => {
    const a = arr.filter((v) => v > 0).sort((x, y) => x - y);
    return a.length ? a[Math.floor(a.length / 2)] : 0;
  };

  const datasets = series.map((s) => {
    const med = median(s.data.map((p) => p.avg_price));
    const clean = (v) => (med && (v > med * 6 || v < med / 6) ? null : v);
    const map = new Map(s.data.map((p) => [p.timestamp, clean(p.avg_price)]));
    const color = PALETTE[s.location] || '#9a9aae';
    return {
      label: s.location,
      data: labels.map((t) => map.get(t) ?? null),
      borderColor: color, backgroundColor: color, tension: 0.25,
      spanGaps: true, pointRadius: 0, borderWidth: 2,
    };
  });

  resultEl.innerHTML = '';
  resultEl.append(
    el('div', { class: 'itemcell', style: 'gap:14px;margin-bottom:16px' },
      el('img', { src: itemImg(current), style: 'width:54px;height:54px' }),
      el('div', {}, el('div', { style: 'font-size:19px;font-weight:700' }, current),
        el('div', { class: 'sub' }, el('a', { href: `/?item=${encodeURIComponent(current)}`, style: 'color:var(--acc2)' }, '← текущие цены по городам')))),
  );
  const wrap = el('div', { class: 'card' });
  const canvas = el('canvas', { id: 'chart', height: 110 });
  wrap.append(canvas);
  resultEl.append(wrap);

  if (chart) chart.destroy();
  chart = new Chart(canvas, {
    type: 'line',
    data: { labels: labels.map(fmtLabel), datasets },
    options: {
      responsive: true, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#9a9aae', usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
      scales: {
        x: { ticks: { color: '#9a9aae', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { ticks: { color: '#9a9aae', callback: (v) => fmt(v) }, grid: { color: 'rgba(255,255,255,.05)' } },
      },
    },
  });
}

document.getElementById('days').addEventListener('change', load);
document.getElementById('scale').addEventListener('change', load);
window.addEventListener('server-change', load);
if (current) qEl.value = current;
load();
