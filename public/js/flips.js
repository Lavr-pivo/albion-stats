import { header, footer, state, el, fmt, itemImg, ageInfo, getJSON } from './common.js';

header('/flips.html');
footer();

const resultEl = document.getElementById('result');
const $ = (id) => document.getElementById(id);

async function run() {
  const params = new URLSearchParams({
    server: state.server,
    quality: $('quality').value,
    maxAge: $('maxAge').value,
    minProfit: $('minProfit').value || 0,
    maxRoi: $('maxRoi').value || 10,
    premium: $('premium').checked ? 'true' : 'false',
    limit: 100,
  });
  resultEl.innerHTML = '';
  resultEl.append(el('div', { class: 'empty' }, el('span', { class: 'spin' }), ' Считаю перепродажи…'));
  try {
    const d = await getJSON(`/api/flips?${params}`);
    render(d);
  } catch (e) {
    resultEl.innerHTML = '';
    resultEl.append(el('div', { class: 'empty' }, 'Ошибка: ' + e.message));
  }
}

function render(d) {
  if (!d.flips.length) {
    resultEl.innerHTML = '';
    resultEl.append(el('div', { class: 'empty' },
      'Ничего не найдено. Если база ещё наполняется фоновым sync — подожди пару минут и обнови.'));
    return;
  }
  const table = el('table', {}, el('thead', {}, el('tr', {},
    el('th', {}, 'Предмет'),
    el('th', {}, 'Купить'),
    el('th', {}, 'Продать'),
    el('th', { class: 'num' }, 'Чистыми'),
    el('th', { class: 'num' }, 'Прибыль'),
    el('th', { class: 'num' }, 'ROI'),
    el('th', {}, 'Свежесть'))));
  const tb = el('tbody');
  for (const f of d.flips) {
    const ab = ageInfo(f.buy_observed_at), as = ageInfo(f.sell_observed_at);
    const worst = ab.cls === 'old' || as.cls === 'old' ? 'old' : (ab.cls === 'mid' || as.cls === 'mid' ? 'mid' : 'fresh');
    tb.append(el('tr', {},
      el('td', {}, el('a', { class: 'itemcell', href: `/item.html?item=${encodeURIComponent(f.item_id)}` },
        el('img', { src: itemImg(f.item_id), loading: 'lazy' }),
        el('div', {}, el('div', {}, f.name || f.item_id),
          el('div', { class: 'sub' }, `${f.item_id}${f.enchant ? ' ·@' + f.enchant : ''}`)))),
      el('td', {}, el('div', {}, f.buy_city), el('div', { class: 'sub' }, fmt(f.buy_price))),
      el('td', {}, el('div', {}, f.sell_city), el('div', { class: 'sub' }, fmt(f.sell_price))),
      el('td', { class: 'num' }, fmt(f.sell_net)),
      el('td', { class: 'num pos' }, '+' + fmt(f.profit)),
      el('td', { class: 'num' }, el('span', { class: 'tag' }, (f.roi * 100).toFixed(0) + '%')),
      el('td', {}, el('span', { class: 'age ' + worst }, `${ab.text} / ${as.text}`)),
    ));
  }
  table.append(tb);
  resultEl.innerHTML = '';
  resultEl.append(
    el('p', { style: 'color:var(--muted);font-size:14px;margin:16px 0 8px' }, `Найдено ${d.count} вариантов на сервере ${d.server}:`),
    el('div', { class: 'card', style: 'padding:0;overflow:hidden' }, table));
}

$('go').addEventListener('click', run);
window.addEventListener('server-change', run);
run();
