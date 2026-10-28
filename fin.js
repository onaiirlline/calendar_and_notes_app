/* Финансы: расходы, аналитика, как пользоваться и справочник на одной вкладке.
   Data per user at data/users/<uid>/finance/items/<id>:
   settings {kind:'s', salary, cats:[{name,type}]}, expense {kind:'x', date, cat, desc, amount, type},
   month {kind:'m', month:'YYYY-MM', salary?, plans:{cat: amount}}. */
(() => {
const KEY = 'my-fin-v1';
const OBL = 'Обязательный', IRR = 'Нерегулярный';
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MON_S = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const root = document.getElementById('appFin');
const pad = n => String(n).padStart(2, '0');
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uid = () => Math.random().toString(36).slice(2, 10);
const nf = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 0});
const rub = v => nf.format(Math.round(v || 0)) + ' ₽';
const nn = v => nf.format(Math.round(v || 0));
const pct = v => (isFinite(v) ? Math.round(v * 100) : 0) + '%';
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const ymNow = () => today().slice(0, 7);
const ymAdd = (ym, k) => { let [y, m] = ym.split('-').map(Number); m += k; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return y + '-' + pad(m); };
const ymLabel = ym => { const [y, m] = ym.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; };
const ymShort = ym => { const [y, m] = ym.split('-').map(Number); return MON_S[m - 1] + ' ' + String(y).slice(2); };
const dLabel = ds => { const [, m, d] = ds.split('-').map(Number); return d + ' ' + MON_S[m - 1]; };

const DEFAULT_CATS = [
  ['Жильё', OBL], ['Коммунальные услуги', OBL], ['Здоровье', OBL], ['Подписки', IRR], ['Поездки', IRR],
  ['Транспорт', IRR], ['Связь', IRR], ['Одежда и обувь', IRR], ['Хобби', IRR], ['Подарки', IRR],
  ['Документы и услуги', IRR], ['Прочее', IRR], ['Кредитная карта', OBL]
].map(([name, type]) => ({name, type}));
// a new account starts with the categories only
function seedItems() { return {settings: {id: 'settings', kind: 's', salary: 0, cats: DEFAULT_CATS, updated: Date.now()}}; }
// what Marie's spreadsheet (окт 2026 — март 2027) held; moved over with one button
function sheetItems() {
  const now = Date.now(), it = {};
  it.settings = Object.assign(JSON.parse(JSON.stringify(settings())), {id: 'settings', kind: 's', salary: 75000});
  const plans = {
    '2026-10': {'Жильё': 20000, 'Коммунальные услуги': 5000, 'Кредитная карта': 10000, 'Здоровье': 4000},
    '2026-11': {'Жильё': 20000, 'Коммунальные услуги': 6500, 'Кредитная карта': 6000, 'Здоровье': 6800},
    '2026-12': {'Жильё': 20000}, '2027-01': {'Жильё': 20000}, '2027-02': {'Жильё': 20000}, '2027-03': {'Жильё': 20000}
  };
  Object.entries(plans).forEach(([m, p]) => { it['m' + m] = {id: 'm' + m, kind: 'm', month: m, plans: p, updated: now}; });
  [['seed-oct-home', 'Жильё', 20000], ['seed-oct-ku', 'Коммунальные услуги', 5900], ['seed-oct-cc', 'Кредитная карта', 10000]]
    .forEach(([id, cat, amount], i) => { it[id] = {id, kind: 'x', date: '2026-10-01', cat, desc: 'из таблицы', amount, type: OBL, created: now + i, updated: now}; });
  return it;
}

let S = null;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!S || !S.items) S = {items: {}};
let cur = ymNow(), period = 'all', editId = null, armed = null, typeTouched = false;
try { const v = JSON.parse(localStorage.getItem('my-fin-ui') || '{}'); if (v.period) period = v.period; } catch (e) {}
const saveUI = () => { try { localStorage.setItem('my-fin-ui', JSON.stringify({period})); } catch (e) {} };

const settings = () => S.items.settings || {cats: DEFAULT_CATS, salary: 0};
const cats = () => settings().cats || [];
const catType = name => (cats().find(c => c.name === name) || {}).type || IRR;
const expenses = () => Object.values(S.items).filter(i => i.kind === 'x');
const monthDoc = ym => S.items['m' + ym];
function salaryFor(ym) {
  const own = Object.values(S.items).filter(i => i.kind === 'm' && i.month <= ym && i.salary != null).sort((a, b) => a.month < b.month ? 1 : -1)[0];
  return own ? +own.salary : +(settings().salary || 0);
}
function stats(ym) {
  const list = expenses().filter(x => x.date.slice(0, 7) === ym);
  const total = list.reduce((s, x) => s + (+x.amount || 0), 0), sal = salaryFor(ym);
  const byCat = {}, byType = {[OBL]: 0, [IRR]: 0};
  list.forEach(x => { byCat[x.cat] = (byCat[x.cat] || 0) + (+x.amount || 0); byType[x.type === OBL ? OBL : IRR] += +x.amount || 0; });
  return {ym, list, total, count: list.length, avg: list.length ? total / list.length : 0, sal, rest: sal - total, share: sal ? total / sal : 0, byCat, byType};
}
function periodMonths() {
  if (period === '6' || period === '12') { const n = +period, out = []; for (let k = n - 1; k >= 0; k--) out.push(ymAdd(cur, -k)); return out; }
  const all = [...expenses().map(x => x.date.slice(0, 7)), ...Object.values(S.items).filter(i => i.kind === 'm').map(i => i.month), cur, ymNow()].sort();
  const out = []; for (let m = all[0]; m <= all[all.length - 1]; m = ymAdd(m, 1)) out.push(m);
  return out;
}

/* ---------- storage + sync (same scheme as the calendar) ---------- */
const dirty = new Set();
let saveT = null;
const sync = {col: null, busy: new Set(), again: new Set(), wait: 0, timer: 0, first: false, unsub: null, pending: false, err: ''};
function touch(it) { it.updated = Date.now(); S.items[it.id] = it; dirty.add(it.id); schedule(); }
function drop(id) { delete S.items[id]; dirty.add(id); schedule(); }
function schedule() { clearTimeout(saveT); saveT = setTimeout(persist, 300); }
function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function persist() { clearTimeout(saveT); saveT = null; saveLocal(); pushRemote(); }
addEventListener('beforeunload', () => { if (saveT) persist(); });
function pushRemote() {
  if (!sync.col) return;
  [...dirty].forEach(id => {
    dirty.delete(id);
    if (sync.busy.has(id)) { sync.again.add(id); return; }
    const it = S.items[id];
    sync.busy.add(id);
    (it ? sync.col.doc(id).set(JSON.parse(JSON.stringify(it))) : sync.col.doc(id).delete())
      .then(() => { sync.err = ''; sync.wait = 0; })
      .catch(e => { dirty.add(id); sync.err = (e && e.code) || 'ошибка'; clearTimeout(sync.timer); sync.wait = Math.min(30000, (sync.wait || 1000) * 2); sync.timer = setTimeout(pushRemote, sync.wait); })
      .finally(() => { sync.busy.delete(id); if (sync.again.delete(id)) dirty.add(id); if (dirty.size && !sync.err) setTimeout(pushRemote, 800); });
  });
}
const editing = () => { const a = document.activeElement; return !!a && root.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName); };
function applyRemote(snap, full) {
  // a new device sees an empty cache first: wait for the server before deciding the account is empty
  if (!sync.first && snap.metadata && snap.metadata.fromCache && !snap.docs.length) return;
  let changed = false;
  const seen = new Set();
  snap.docs.forEach(d => {
    seen.add(d.id);
    if (d.metadata && d.metadata.hasPendingWrites) return;
    const v = d.data();
    if (!v || !v.kind || dirty.has(d.id) || sync.busy.has(d.id)) return;
    const l = S.items[d.id];
    if (l && l.updated === v.updated) return;
    if (l && !sync.first && (l.updated || 0) > (v.updated || 0)) { dirty.add(d.id); return; }
    S.items[d.id] = Object.assign({}, v, {id: d.id}); changed = true;
  });
  if (!sync.first || full) {
    const firstRun = !sync.first;
    sync.first = true;
    Object.keys(S.items).forEach(id => {
      if (seen.has(id) || dirty.has(id) || sync.busy.has(id)) return;
      if (firstRun) { dirty.add(id); return; }
      delete S.items[id]; changed = true;
    });
    if (firstRun && !snap.docs.length && !Object.keys(S.items).length) {
      Object.values(seedItems()).forEach(it => { S.items[it.id] = it; dirty.add(it.id); }); changed = true;
    }
  } else if (snap.docChanges) {
    snap.docChanges().forEach(c => { const id = c.doc.id; if (c.type === 'removed' && S.items[id] && !dirty.has(id) && !sync.busy.has(id)) { delete S.items[id]; changed = true; } });
  }
  if (changed) { saveLocal(); if (editing()) sync.pending = true; else render(); }
  pushRemote();
}
root.addEventListener('focusout', () => setTimeout(() => { if (sync.pending && !editing()) { sync.pending = false; render(); } }, 50));
function subscribe() {
  if (sync.unsub) try { sync.unsub(); } catch (e) {}
  sync.unsub = sync.col.onSnapshot(snap => applyRemote(snap), () => setTimeout(subscribe, 3000));
}
function refresh() { if (sync.col) sync.col.get().then(s => applyRemote(s, true)).catch(() => {}); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
addEventListener('focus', refresh);
async function startSync() {
  const local = () => { if (!Object.keys(S.items).length) { S.items = seedItems(); saveLocal(); render(); } };
  if (!window.claude || !claude.use) return local();
  try {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    const id = db && user && await user.id();
    if (!id) return local();
    sync.col = db.collection('data/users/' + id).doc('finance').collection('items');
    subscribe();
  } catch (e) { local(); }
}

/* ---------- layout ---------- */
root.innerHTML = `
<div class="fin">
  <div class="fhead">
    <h1 id="fTitle"></h1>
    <button class="nb arrow" id="fPrev" title="Предыдущий месяц">‹</button>
    <button class="nb" id="fToday">Сегодня</button>
    <button class="nb arrow" id="fNext" title="Следующий месяц">›</button>
  </div>
  <div class="fkpi" id="fKpi"></div>
  <div class="fgrid">
    <section class="fcard" id="fExp">
      <div class="fch"><h3>Расходы</h3><span class="fsub" id="fExpSub"></span></div>
      <form class="fform" id="fForm" autocomplete="off">
        <label class="fl fdate"><span>Дата</span><input type="date" id="fDate" required></label>
        <label class="fl fcat"><span>Категория</span><select id="fCat"></select></label>
        <label class="fl fsum"><span>Сумма, ₽</span><input id="fAmt" inputmode="decimal" placeholder="0" required></label>
        <label class="fl fdesc"><span>Описание</span><input id="fDesc" placeholder="необязательно"></label>
        <label class="fl ftype"><span>Тип</span><select id="fType"><option>${OBL}</option><option>${IRR}</option></select></label>
        <div class="fbtns"><button type="submit" class="fpri" id="fOk">Добавить</button><button type="button" class="fsec" id="fCancel" hidden>Отмена</button><button type="button" class="fdel" id="fDel" hidden>Удалить</button></div>
      </form>
      <div id="fList" class="flist"></div>
    </section>
    <section class="fcard" id="fMon">
      <div class="fch"><h3>Аналитика месяца</h3></div>
      <h4>По категориям</h4>
      <div id="fCats" class="fbars"></div>
      <h4>По типу расходов</h4>
      <div id="fTypes"></div>
      <div class="fch2"><h4>Обязательные расходы — план / факт</h4><button class="flink" id="fCopyPlan" type="button">взять план прошлого месяца</button></div>
      <div class="ftw"><table class="ft" id="fPlan"></table></div>
    </section>
  </div>
  <section class="fcard">
    <div class="fch"><h3>Обзор по месяцам</h3>
      <div class="fseg" id="fPeriod"><button data-p="6">6 мес</button><button data-p="12">12 мес</button><button data-p="all">Всё время</button></div>
    </div>
    <div class="fkpi fkpi2" id="fKpi2"></div>
    <div class="fchart" id="fChart" role="img"></div>
    <div class="ftw"><table class="ft fnum" id="fMonths"></table></div>
  </section>
  <section class="fcard">
    <div class="fch"><h3>Расходы по категориям</h3><span class="fsub" id="fMatSub"></span></div>
    <div class="ftw"><table class="ft fnum fmat" id="fMatrix"></table></div>
  </section>
  <div class="fgrid">
    <section class="fcard" id="fRef">
      <div class="fch"><h3>Справочник</h3></div>
      <label class="fl fsal"><span>Зарплата / месяц по умолчанию, ₽</span><input id="fSalDef" inputmode="decimal"></label>
      <div id="fCatList" class="fcats"></div>
      <form class="fadd" id="fCatAdd"><input id="fCatNew" placeholder="Новая категория"><button class="fsec" type="submit">Добавить</button></form>
      <div class="fimport" id="fImport" hidden><p>Можно перенести данные из таблицы «Финансы» (окт 2026 — март 2027): зарплату 75 000 ₽, планы обязательных расходов и расходы октября.</p><button class="fsec" id="fImportBtn" type="button">Перенести данные из таблицы</button></div>
    </section>
    <section class="fcard fhelp">
      <div class="fch"><h3>Как пользоваться</h3></div>
      <ol>
        <li><b>Внесение расхода.</b> В блоке «Расходы» укажите дату, категорию, сумму, при желании короткое описание, и нажмите «Добавить». Чтобы исправить или удалить запись, нажмите на неё.</li>
        <li><b>Дата.</b> Любая, без ограничения периода. Расход попадает в свой месяц, и вкладка переключается на него.</li>
        <li><b>Категория.</b> Выбирается из списка. Еду и мелкие ежедневные покупки добавлять не нужно: раздел рассчитан на заметные расходы.</li>
        <li><b>Тип.</b> «Обязательный» — жильё, КУ, кредитная карта и другие необходимые платежи. «Нерегулярный» — поездки, лечение, крупные покупки и т.п. Подставляется из справочника, но его можно поменять.</li>
        <li><b>Аналитика.</b> Считается сама: расходы, остаток от зарплаты, доля зарплаты, количество операций и средний чек. Зарплату за конкретный месяц можно поменять в карточке «Зарплата».</li>
        <li><b>Месяцы.</b> Стрелки ‹ › листают месяцы. В «Обзоре по месяцам» можно смотреть последние 6 или 12 месяцев либо всё время.</li>
        <li><b>План обязательных расходов.</b> В таблице «План / факт» впишите план на месяц. «Факт» считается по внесённым расходам. Кнопка «взять план прошлого месяца» переносит цифры.</li>
        <li><b>Справочник.</b> Здесь зарплата по умолчанию и категории: их можно переименовать, поменять тип, добавить или удалить.</li>
      </ol>
    </section>
  </div>
</div>
<div id="fTip" hidden></div>`;
const $ = id => document.getElementById(id);

/* ---------- render ---------- */
function render() {
  const st = stats(cur);
  const [y, m] = cur.split('-');
  $('fTitle').innerHTML = MONTHS[+m - 1] + ' <span>' + y + '</span>';
  renderKpi(st); renderForm(); renderList(st); renderCats(st); renderTypes(st); renderPlan(st);
  renderOverview(); renderMatrix(); renderRef();
}
function tile(label, value, sub, extra = '') { return `<div class="ftile${extra}"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`; }
function renderKpi(st) {
  const md = monthDoc(cur), own = md && md.salary != null;
  $('fKpi').innerHTML =
    tile('Расходы за месяц', rub(st.total), st.count ? st.count + ' ' + plural(st.count, 'операция', 'операции', 'операций') : 'пока нет записей') +
    tile('Остаток', rub(st.rest), 'от зарплаты', st.rest < 0 ? ' neg' : '') +
    `<div class="ftile"><span>Доля зарплаты</span><b>${pct(st.share)}</b><div class="fmeter"><i style="width:${Math.min(100, st.share * 100)}%"></i></div></div>` +
    tile('Средний чек', rub(st.avg), '') +
    `<div class="ftile fsalt"><span>Зарплата за месяц</span><input id="fSal" inputmode="decimal" value="${nf.format(st.sal)}" aria-label="Зарплата за месяц"><small>${own ? 'своя для этого месяца' : 'как обычно'}</small></div>`;
  $('fSal').onchange = e => {
    const v = num(e.target.value), d = monthDoc(cur) || {id: 'm' + cur, kind: 'm', month: cur, plans: {}};
    if (v == null) delete d.salary; else d.salary = v;
    touch(d); render();
  };
}
const plural = (n, a, b, c) => { const k = n % 100, j = n % 10; return k > 10 && k < 20 ? c : j === 1 ? a : j > 1 && j < 5 ? b : c; };
const num = s => { const v = parseFloat(String(s).replace(/\s|₽/g, '').replace(',', '.')); return isFinite(v) ? v : null; };
function renderForm() {
  const sel = $('fCat'), v = sel.value;
  const names = cats().map(c => c.name);
  const used = [...new Set(expenses().map(x => x.cat))].filter(n => !names.includes(n));
  sel.innerHTML = [...names, ...used].map(n => `<option>${esc(n)}</option>`).join('');
  if (v && [...names, ...used].includes(v)) sel.value = v;
  if (!editId) {
    const d = $('fDate'); if (!d.value || d.value.slice(0, 7) !== cur) d.value = cur === ymNow() ? today() : cur + '-01';
    if (!typeTouched) $('fType').value = catType(sel.value);
  }
}
function renderList(st) {
  const list = st.list.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  $('fExpSub').textContent = list.length ? rub(st.total) : '';
  $('fList').innerHTML = list.length ? list.map(x => `
    <div class="frow${x.id === editId ? ' on' : ''}" data-id="${x.id}" tabindex="0">
      <span class="fd">${dLabel(x.date)}</span>
      <span class="fdot ${x.type === OBL ? 'obl' : 'irr'}" title="${esc(x.type)}"></span>
      <span class="fc"><b>${esc(x.cat)}</b>${x.desc ? `<small>${esc(x.desc)}</small>` : ''}</span>
      <span class="fa">${rub(x.amount)}</span>
    </div>`).join('') : '<div class="fempty">В этом месяце расходов пока нет.</div>';
}
function bars(rows, max) {
  return rows.map(([label, v, sub]) => `<div class="fbar" data-tip="${esc(label)}: ${rub(v)}${sub ? ' · ' + sub : ''}">
    <span class="fbl">${esc(label)}</span><span class="fbt"><i style="width:${max ? Math.max(1.5, v / max * 100) : 0}%"></i></span><span class="fbv">${rub(v)}</span></div>`).join('');
}
function renderCats(st) {
  const rows = Object.entries(st.byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, pct(st.total ? v / st.total : 0) + ' расходов']);
  $('fCats').innerHTML = rows.length ? bars(rows, rows[0][1]) : '<div class="fempty">Нет данных за месяц.</div>';
}
function renderTypes(st) {
  const o = st.byType[OBL], r = st.byType[IRR], t = o + r;
  $('fTypes').innerHTML = `
    <div class="fstack" data-tip="${OBL}: ${rub(o)} · ${IRR}: ${rub(r)}">${t ? `<i class="obl" style="flex:${o}"></i><i class="irr" style="flex:${r}"></i>` : '<i class="none"></i>'}</div>
    <div class="flegend"><span><i class="obl"></i>${OBL} <b>${rub(o)}</b> <small>${pct(t ? o / t : 0)}</small></span><span><i class="irr"></i>${IRR} <b>${rub(r)}</b> <small>${pct(t ? r / t : 0)}</small></span></div>`;
}
function oblCats() {
  const md = monthDoc(cur), names = cats().filter(c => c.type === OBL).map(c => c.name);
  Object.keys((md && md.plans) || {}).forEach(n => { if (!names.includes(n)) names.push(n); });
  return names;
}
function renderPlan(st) {
  const md = monthDoc(cur), plans = (md && md.plans) || {};
  let P = 0, F = 0;
  const rows = oblCats().map(n => {
    const p = plans[n], f = st.byCat[n] || 0; P += +p || 0; F += f;
    const dv = (+p || 0) - f;
    return `<tr><td>${esc(n)}</td><td><input class="fpin" data-cat="${esc(n)}" inputmode="decimal" value="${p != null ? nf.format(p) : ''}" placeholder="—" aria-label="План: ${esc(n)}"></td><td>${nn(f)}</td><td class="${p != null && dv < 0 ? 'over' : ''}">${p != null ? (dv < 0 ? '−' : '') + nn(Math.abs(dv)) : '—'}</td></tr>`;
  }).join('');
  const D = P - F;
  $('fPlan').innerHTML = `<thead><tr><th>Категория</th><th>План, ₽</th><th>Факт</th><th>Разница</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td>Итого</td><td>${nn(P)}</td><td>${nn(F)}</td><td class="${D < 0 ? 'over' : ''}">${(D < 0 ? '−' : '') + nn(Math.abs(D))}</td></tr></tfoot>`;
  $('fPlan').querySelectorAll('.fpin').forEach(inp => inp.onchange = () => {
    const d = monthDoc(cur) || {id: 'm' + cur, kind: 'm', month: cur, plans: {}};
    d.plans = Object.assign({}, d.plans); const v = num(inp.value);
    if (v == null) delete d.plans[inp.dataset.cat]; else d.plans[inp.dataset.cat] = v;
    touch(d); render();
  });
}
function renderOverview() {
  const months = periodMonths(), now = ymNow();
  const S2 = months.map(stats), past = S2.filter(s => s.ym <= now);
  const total = S2.reduce((a, s) => a + s.total, 0), cnt = S2.reduce((a, s) => a + s.count, 0);
  const avgM = past.length ? past.reduce((a, s) => a + s.total, 0) / past.length : 0;
  const avgSh = past.length ? past.reduce((a, s) => a + s.share, 0) / past.length : 0;
  $('fPeriod').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === period));
  $('fKpi2').innerHTML = tile('Средние расходы / месяц', rub(avgM), past.length + ' ' + plural(past.length, 'месяц', 'месяца', 'месяцев')) +
    tile('Средний чек', rub(cnt ? total / cnt : 0), '') + tile('Всего расходов', rub(total), ymShort(months[0]) + ' — ' + ymShort(months[months.length - 1])) + tile('Средняя доля зарплаты', pct(avgSh), '');
  // monthly bars, salary as a reference line on the same scale
  const max = Math.max(1, ...S2.map(s => Math.max(s.total, s.sal)));
  $('fChart').setAttribute('aria-label', 'Расходы по месяцам');
  $('fChart').innerHTML = `<div class="fcols" style="--n:${S2.length}">${S2.map(s => `
    <button class="fcol${s.ym === cur ? ' on' : ''}" data-ym="${s.ym}" data-tip="${ymLabel(s.ym)}: ${rub(s.total)} · ${pct(s.share)} зарплаты">
      <span class="fcolp"><i class="fsl" style="bottom:${s.sal / max * 100}%"></i><i class="fbv2" style="height:${s.total / max * 100}%"></i></span>
      <span class="fcoll">${ymShort(s.ym)}</span></button>`).join('')}</div>
    <div class="flegend small"><span><i class="fbk"></i>Расходы</span><span><i class="salk"></i>Зарплата</span></div>`;
  const rows = S2.map(s => `<tr data-ym="${s.ym}" class="${s.ym === cur ? 'on' : ''}"><td>${ymLabel(s.ym)}</td><td>${rub(s.total)}</td><td class="${s.rest < 0 ? 'over' : ''}">${rub(s.rest)}</td><td>${pct(s.share)}</td><td>${s.count}</td><td>${rub(s.avg)}</td><td>${rub(s.byType[OBL])}</td><td>${rub(s.byType[IRR])}</td></tr>`).join('');
  const rest = S2.reduce((a, s) => a + s.rest, 0);
  $('fMonths').innerHTML = `<thead><tr><th>Месяц</th><th>Расходы</th><th>Остаток</th><th>% зарплаты</th><th>Кол-во</th><th>Средний чек</th><th>Обязательные</th><th>Нерегулярные</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td>Итого</td><td>${rub(total)}</td><td>${rub(rest)}</td><td></td><td>${cnt}</td><td>${rub(cnt ? total / cnt : 0)}</td><td>${rub(S2.reduce((a, s) => a + s.byType[OBL], 0))}</td><td>${rub(S2.reduce((a, s) => a + s.byType[IRR], 0))}</td></tr></tfoot>`;
}
function renderMatrix() {
  const months = periodMonths(), S2 = months.map(stats);
  const names = cats().map(c => c.name);
  expenses().forEach(x => { if (!names.includes(x.cat)) names.push(x.cat); });
  $('fMatSub').textContent = ymShort(months[0]) + ' — ' + ymShort(months[months.length - 1]);
  const cell = v => v ? nf.format(Math.round(v)) : '<span class="z">—</span>';
  $('fMatrix').innerHTML = `<thead><tr><th>Категория</th>${months.map(m => `<th class="${m === cur ? 'on' : ''}">${ymShort(m)}</th>`).join('')}<th>Всего</th></tr></thead><tbody>${
    names.map(n => { const vs = S2.map(s => s.byCat[n] || 0), t = vs.reduce((a, v) => a + v, 0);
      return `<tr><td>${esc(n)}</td>${vs.map((v, i) => `<td class="${months[i] === cur ? 'on' : ''}">${cell(v)}</td>`).join('')}<td><b>${cell(t)}</b></td></tr>`; }).join('')
  }</tbody><tfoot><tr><td>Итого</td>${S2.map(s => `<td class="${s.ym === cur ? 'on' : ''}">${cell(s.total)}</td>`).join('')}<td>${cell(S2.reduce((a, s) => a + s.total, 0))}</td></tr></tfoot>`;
}
function renderRef() {
  $('fImport').hidden = expenses().length > 0 || Object.values(S.items).some(i => i.kind === 'm');
  const sd = $('fSalDef'); if (document.activeElement !== sd) sd.value = nf.format(settings().salary || 0);
  const box = $('fCatList');
  if (box.contains(document.activeElement)) return;
  box.innerHTML = cats().map((c, i) => `<div class="fcatr" data-i="${i}">
    <input class="fcn" value="${esc(c.name)}" aria-label="Название категории">
    <button type="button" class="ftp ${c.type === OBL ? 'obl' : 'irr'}" title="Поменять тип"><i></i>${c.type}</button>
    <button type="button" class="fx" title="Удалить категорию">×</button></div>`).join('');
}

/* ---------- actions ---------- */
function setSettings(fn) { const s = JSON.parse(JSON.stringify(settings())); s.id = 'settings'; s.kind = 's'; fn(s); touch(s); render(); }
$('fPrev').onclick = () => { cur = ymAdd(cur, -1); resetForm(); render(); };
$('fNext').onclick = () => { cur = ymAdd(cur, 1); resetForm(); render(); };
$('fToday').onclick = () => { cur = ymNow(); resetForm(); render(); };
$('fPeriod').onclick = e => { const b = e.target.closest('button'); if (!b) return; period = b.dataset.p; saveUI(); render(); };
$('fCat').onchange = () => { if (!typeTouched) $('fType').value = catType($('fCat').value); };
$('fType').onchange = () => { typeTouched = true; };
function resetForm() {
  editId = null; typeTouched = false; armed = null;
  $('fAmt').value = ''; $('fDesc').value = ''; $('fDate').value = '';
  $('fOk').textContent = 'Добавить'; $('fCancel').hidden = $('fDel').hidden = true; $('fDel').textContent = 'Удалить'; $('fDel').classList.remove('armed');
}
$('fForm').onsubmit = e => {
  e.preventDefault();
  const amount = num($('fAmt').value), date = $('fDate').value;
  if (!amount || amount <= 0) { $('fAmt').focus(); toast2('Введите сумму'); return; }
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) { $('fDate').focus(); return; }
  const it = editId && S.items[editId] ? Object.assign({}, S.items[editId]) : {id: uid(), kind: 'x', created: Date.now()};
  Object.assign(it, {date, cat: $('fCat').value, desc: $('fDesc').value.trim(), amount, type: $('fType').value});
  touch(it);
  const was = editId; resetForm();
  if (date.slice(0, 7) !== cur) { cur = date.slice(0, 7); toast2('Добавлено в: ' + ymLabel(cur).toLowerCase()); }
  else toast2(was ? 'Сохранено' : 'Добавлено');
  render();
  if (!was) $('fAmt').focus({preventScroll: true});
};
$('fCancel').onclick = () => { resetForm(); render(); };
$('fDel').onclick = () => {
  if (armed !== editId) { armed = editId; $('fDel').textContent = 'Точно удалить?'; $('fDel').classList.add('armed'); return; }
  drop(editId); resetForm(); render(); toast2('Удалено');
};
function openEdit(id) {
  const x = S.items[id]; if (!x) return;
  editId = id; armed = null; typeTouched = true;
  $('fDate').value = x.date; renderForm(); $('fCat').value = x.cat; $('fAmt').value = nf.format(x.amount); $('fDesc').value = x.desc || ''; $('fType').value = x.type;
  $('fOk').textContent = 'Сохранить'; $('fCancel').hidden = $('fDel').hidden = false; $('fDel').textContent = 'Удалить'; $('fDel').classList.remove('armed');
  renderList(stats(cur));
  $('fForm').scrollIntoView({block: 'nearest', behavior: 'smooth'});
}
$('fList').onclick = e => { const r = e.target.closest('.frow'); if (r) openEdit(r.dataset.id); };
$('fList').onkeydown = e => { if (e.key === 'Enter') { const r = e.target.closest('.frow'); if (r) openEdit(r.dataset.id); } };
$('fCopyPlan').onclick = () => {
  let src = null; for (let m = ymAdd(cur, -1), k = 0; k < 120 && !src; m = ymAdd(m, -1), k++) { const d = monthDoc(m); if (d && d.plans && Object.keys(d.plans).length) src = d; }
  if (!src) { toast2('Нет плана в прошлых месяцах'); return; }
  const d = monthDoc(cur) || {id: 'm' + cur, kind: 'm', month: cur, plans: {}};
  d.plans = Object.assign({}, src.plans, d.plans); touch(d); render(); toast2('План взят из: ' + ymLabel(src.month).toLowerCase());
};
$('fChart').onclick = e => { const b = e.target.closest('.fcol'); if (b) { cur = b.dataset.ym; resetForm(); render(); } };
$('fMonths').onclick = e => { const r = e.target.closest('tr[data-ym]'); if (r) { cur = r.dataset.ym; resetForm(); render(); root.scrollTo({top: 0, behavior: 'smooth'}); } };
$('fSalDef').onchange = e => { const v = num(e.target.value); setSettings(s => { s.salary = v || 0; }); };
$('fCatList').addEventListener('change', e => {
  if (!e.target.classList.contains('fcn')) return;
  const i = +e.target.closest('.fcatr').dataset.i, old = cats()[i].name, nn = e.target.value.trim();
  if (!nn || nn === old) { e.target.value = old; return; }
  if (cats().some(c => c.name === nn)) { toast2('Такая категория уже есть'); e.target.value = old; return; }
  setSettings(s => { s.cats[i].name = nn; });
  expenses().filter(x => x.cat === old).forEach(x => touch(Object.assign({}, x, {cat: nn})));
  Object.values(S.items).filter(d => d.kind === 'm' && d.plans && old in d.plans).forEach(d => { const p = Object.assign({}, d.plans); p[nn] = p[old]; delete p[old]; touch(Object.assign({}, d, {plans: p})); });
  render();
});
$('fCatList').addEventListener('click', e => {
  const row = e.target.closest('.fcatr'); if (!row) return; const i = +row.dataset.i;
  if (e.target.closest('.ftp')) setSettings(s => { s.cats[i].type = s.cats[i].type === OBL ? IRR : OBL; });
  else if (e.target.closest('.fx')) {
    const b = e.target.closest('.fx');
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'удалить?'; return; }
    setSettings(s => { s.cats.splice(i, 1); });
  }
});
$('fCatAdd').onsubmit = e => {
  e.preventDefault(); const n = $('fCatNew').value.trim(); if (!n) return;
  if (cats().some(c => c.name === n)) { toast2('Такая категория уже есть'); return; }
  setSettings(s => { s.cats.push({name: n, type: IRR}); }); $('fCatNew').value = '';
};
$('fImportBtn').onclick = () => {
  Object.values(sheetItems()).forEach(it => touch(it));
  cur = '2026-10'; render(); toast2('Данные из таблицы перенесены');
};
function toast2(t) { if (typeof window.appToast === 'function') window.appToast(t); }

// hover tooltip for bars and months
const tip = $('fTip');
root.addEventListener('pointermove', e => {
  const t = e.target.closest('[data-tip]');
  if (!t || e.pointerType === 'touch') { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false;
  const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 8, e.clientX + 12) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
});
root.addEventListener('pointerleave', () => { tip.hidden = true; });
root.addEventListener('scroll', () => { tip.hidden = true; }, true);

render();
startSync();
})();
