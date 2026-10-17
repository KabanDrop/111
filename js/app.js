const WEAR_DESC = { FN:"Factory New (FN) — 0.00–0.07: идеальное состояние, без видимых повреждений.", MW:"Minimal Wear (MW) — 0.07–0.15: едва заметные царапины и потёртости.", FT:"Field-Tested (FT) — 0.15–0.38: износ хорошо заметен, краска местами стёрта.", WW:"Well-Worn (WW) — 0.38–0.45: значительная часть рисунка стёрта.", BS:"Battle-Scarred (BS) — 0.45–1.00: максимальный износ, краска стёрта до металла." };
/* ============================================================
   KabanDrop — CS2 case-opening simulator (Kekser-style)
   ============================================================ */
(function () {
'use strict';

const SKINS = window.KEKSER_SKINS || {};
const CASES = (window.KEKSER_CASES || []).filter(c => c && c.items && c.items.length);
const IMG = 'assets/';
const LS_KEY = 'kabandrop_v2';

const WEAR = { FN:"Прямо с завода", MW:"Немного поношенное", FT:"После полевых испытаний", WW:"Поношенное", BS:"Закалённое в боях" };
const CAT_ORDER = ['Из CS2','Наши сборки','Арсенал','Люкс','Ножевые','Премиум','Коллекции','Редкость','Специальная коллекция','Цветная коллекция','Limited','NEW','Дешевые','Caser Armory Cases'];

/* rarity color class */
function rarityClass(key) {
  const s = SKINS[key]; const c = ((s && s.rarity_color) || '').toLowerCase();
  if (c === '#ffae39') return 'r-gold';
  if (c === '#eb4b4b') return 'r-red';
  if (c === '#d32ce6') return 'r-pink';
  if (c === '#8847ff') return 'r-purple';
  if (c === '#4b69ff') return 'r-blue';
  if (c === '#5e98d9') return 'r-light';
  return 'r-grey';
}

/* ---------- helpers ---------- */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const img = p => p ? IMG + p : '';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const money = n => Math.round(n || 0).toLocaleString('ru-RU');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pick = a => a[Math.floor(Math.random() * a.length)];
const onError = 'onerror="this.style.opacity=0"';
const COIN = '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffa800"/><path d="M12 7v10M9 9.5a3 3 0 013-1.5c1.6 0 3 .8 3 2s-1.4 2-3 2-3 .8-3 2 1.4 2 3 2a3 3 0 003-1.5" fill="none" stroke="#000" stroke-width="1.6"/></svg>';

function rarity(key) {
  const s = SKINS[key];
  return { color: (s && s.rarity_color) || '#4b69ff', name: (s && s.rarity) || '' };
}
function imgOf(key) { const s = SKINS[key]; return s ? s.image : ''; }
function priceOf(key, wear, st, sv) {
  const s = SKINS[key]; if (!s || !s.price) return 0;
  const b = s.price;
  let use = 'nonST';
  if (sv && b.SV && Object.keys(b.SV).length) use = 'SV';
  else if (st && b.ST && Object.keys(b.ST).length) use = 'ST';
  let bucket = b[use] || {};
  let v = null;
  if (wear && bucket[wear] != null) v = bucket[wear];
  if (v == null) { const ks = Object.keys(bucket); if (ks.length) v = bucket[ks[0]]; }
  if (v == null && use !== 'nonST') {
    const b2 = b.nonST || {};
    if (wear && b2[wear] != null) v = b2[wear];
    else { const ks = Object.keys(b2); if (ks.length) v = b2[ks[0]]; }
  }
  return v == null ? 0 : v;
}
function repPrice(key) {
  const s = SKINS[key]; if (!s || !s.price) return 0;
  const b = s.price.nonST || {};
  for (const w of ['FN','MW','FT','WW','BS','NW']) if (b[w] != null) return b[w];
  const ks = Object.keys(b); if (ks.length) return b[ks[0]];
  return 0;
}
function repWear(key) {
  const s = SKINS[key]; const b = (s && s.price && s.price.nonST) || {};
  for (const w of ['FN','MW','FT','WW','BS']) if (b[w] != null) return w;
  return null;
}

/* ---------- sound ---------- */
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
function tone(freq, dur, type, vol, slide) {
  if (!state.sound) return;
  const c = ac(); if (!c) return;
  try {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
  } catch (e) {}
}
const sfx = {
  tick: () => tone(1150, 0.035, 'square', 0.025),
  click: () => tone(520, 0.06, 'triangle', 0.05),
  open: () => tone(300, 0.25, 'sawtooth', 0.05, 900),
  win: () => { tone(660, 0.12, 'triangle', 0.09); setTimeout(() => tone(880, 0.16, 'triangle', 0.09), 110); setTimeout(() => tone(1180, 0.28, 'triangle', 0.09), 240); },
  bigwin: () => { [523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>tone(f,0.3,'triangle',0.1),i*110)); },
  lose: () => { tone(300, 0.3, 'sawtooth', 0.07, 120); },
  sell: () => tone(700, 0.1, 'sine', 0.06, 400),
  upSpin: () => tone(180, 1.4, 'sawtooth', 0.035, 1500)
};

/* ---------- state ---------- */
let state = {
  balance: 10000,
  inv: [],
  stats: { opened: 0, spent: 0, earned: 0, upgraded: 0, upWon: 0, upLossStreak: 0, best: null },
  sound: true
};
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const d = JSON.parse(raw); state = Object.assign(state, d); state.stats = Object.assign({ opened:0,spent:0,earned:0,upgraded:0,upWon:0,upLossStreak:0,best:null }, d.stats || {}); }
  } catch (e) {}
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
function syncBalance() {
  const el = $('#balVal'); if (el) el.textContent = money(state.balance);
  const el2 = $('#balInvCount'); if (el2) el2.textContent = state.inv.length;
}

/* ---------- fx (confetti) ---------- */
const fx = $('#fx'); const fxc = fx ? fx.getContext('2d') : null;
let confs = [], fxRunning = false;
function resizeFx() { if (!fx) return; fx.width = innerWidth; fx.height = innerHeight; }
function burst(n, colors) {
  if (!fxc) return;
  for (let i = 0; i < n; i++) confs.push({
    x: innerWidth / 2 + rnd(-120, 120), y: innerHeight * 0.34 + rnd(-40, 40),
    vx: rnd(-7, 7), vy: rnd(-13, -4), g: 0.32, s: rnd(5, 11), r: rnd(0, 6.28), vr: rnd(-0.3, 0.3),
    c: (colors && colors.length ? pick(colors) : pick(['#44c987','#83d8ff','#ffd700','#ff6b6b','#c084fc'])), life: 1
  });
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(fxLoop); }
}
function fxLoop() {
  fxc.clearRect(0, 0, fx.width, fx.height);
  confs = confs.filter(p => p.life > 0 && p.y < fx.height + 40);
  for (const p of confs) {
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.006;
    fxc.save(); fxc.translate(p.x, p.y); fxc.rotate(p.r); fxc.globalAlpha = Math.max(0, p.life);
    fxc.fillStyle = p.c; fxc.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); fxc.restore();
  }
  if (confs.length) requestAnimationFrame(fxLoop); else { fxRunning = false; fxc.clearRect(0, 0, fx.width, fx.height); }
}

/* ---------- toast ---------- */
function toast(msg, kind) {
  const w = $('#toasts'); if (!w) return;
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.innerHTML = esc(msg);
  w.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s, transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(1rem)'; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

/* ---------- modal ---------- */
function modal(html, opts) {
  opts = opts || {};
  const root = $('#modals');
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = '<div class="modal ' + (opts.cls || '') + '">'
    + (opts.noClose ? '' : '<div class="modal-head"><h2></h2><button class="modal-close" data-close>×</button></div>')
    + '<div class="modal-body">' + html + '</div></div>';
  root.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov && !opts.noClose) close(); });
  const cl = ov.querySelector('[data-close]'); if (cl) cl.onclick = close;
  function close() { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 180); }
  ov.close = close;
  return ov;
}

/* ---------- item card ---------- */
function itemCard(key, wear, st, sv, opts) {
  opts = opts || {};
  const val = priceOf(key, wear, st, sv);
  const parts = String(key).split(' | ');
  const weapon = parts[0] || key, skin = parts[1] || ' ';
  const priceHtml = opts.price === false ? ''
    : '<span class="item-price">' + (opts.price != null ? opts.price : money(val) + COIN) + '</span>';
  const wearHtml = (!opts.hideWear && wear && wear !== 'NW') ? '<span class="item-wear">' + wear + '</span>' : '';
  return '<div class="item ' + rarityClass(key) + (opts.sel ? ' is-selected' : '') + (opts.click ? ' is-click' : '') + '"'
    + ' data-key="' + esc(key) + '" data-wear="' + (wear || '') + '" data-st="' + (st ? 1 : 0) + '" data-sv="' + (sv ? 1 : 0) + '" data-price="' + val + '">'
    + '<div class="item-pic"><img loading="lazy" draggable="false" src="' + img(imgOf(key)) + '" ' + onError + '>'
    + priceHtml + wearHtml
    + '</div>'
    + '<div class="item-name">' + esc(weapon) + '</div>'
    + '<div class="item-skin">' + esc(skin) + '</div>'
    + '</div>';
}

/* ============================================================
   LIVE DROP — absolute-positioned cells, vertical scroll
   ============================================================ */
const LD_CELL_H = 90;
let ldCells = [], ldOffset = 0, ldAnimating = false, ldLastMove = 0;
function ldRandomItem() {
  const c = CASES[Math.floor(Math.random() * CASES.length)];
  if (!c || !c.items.length) return null;
  const it = c.items[Math.floor(Math.random() * c.items.length)];
  const { weapon, skin } = splitKey(it.key);
  return {
    key: it.key, weapon: weapon, skin: skin,
    val: priceOf(it.key, it.wear, it.st, it.sv) || repPrice(it.key)
  };
}
function splitKey(key) {
  const parts = key.split(' | ');
  return { weapon: parts[0] || key, skin: parts[1] || '' };
}
function ldFillCell(cell, data) {
  cell.card.style.setProperty('--rc', rarityColor(data.key));
  cell.img.src = img(imgOf(data.key));
  cell.name.textContent = data.weapon;
  cell.skin.textContent = data.skin;
}
function rarityColor(key) {
  const s = SKINS[key]; return ((s && s.rarity_color) || '#b0c3d9').toLowerCase();
}
function liveDropInit() {
  const track = $('#ldTrack'); if (!track) return;
  ldCells = [];
  const count = Math.ceil(innerHeight / LD_CELL_H) + 3;
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'ld-cell';
    cell.innerHTML = '<div class="ld-card"><img alt="" draggable="false"></div><div class="ld-text"><b></b><span></span></div>';
    track.appendChild(cell);
    const c = { el: cell, card: cell.querySelector('.ld-card'), img: cell.querySelector('img'), name: cell.querySelector('b'), skin: cell.querySelector('span'), pos: i * LD_CELL_H };
    ldFillCell(c, ldRandomItem() || { key: '', weapon: '', skin: '' });
    cell.style.transform = 'translate3d(0,' + c.pos + 'px,0)';
    ldCells.push(c);
  }
  ldOffset = 0; ldAnimating = false; ldLastMove = performance.now();
  requestAnimationFrame(ldLoop);
}
function ldLoop(now) {
  if (!ldCells.length) return;
  if (now - ldLastMove > 3000) {
    ldLastMove = now;
    const last = ldCells.pop();
    ldCells.unshift(last);
    last.pos = ldCells[1].pos - LD_CELL_H;
    const d = ldRandomItem(); if (d) ldFillCell(last, d);
    last.el.style.transform = 'translate3d(0,' + last.pos + 'px,0)';
  }
  requestAnimationFrame(ldLoop);
}
function liveDropAdd(key, wear, val) {
  if (!ldCells.length) return;
  const last = ldCells.pop();
  ldCells.unshift(last);
  last.pos = ldCells[1].pos - LD_CELL_H;
  const parts = String(key).split(' | ');
  ldFillCell(last, { key: key, weapon: parts[0] || key, skin: parts[1] || '', val: val });
  last.el.style.transform = 'translate3d(0,' + last.pos + 'px,0)';
  ldLastMove = performance.now();
}

/* ============================================================
   ROUTER
   ============================================================ */
function setActiveTab(name) {
  const map = { case: 'cases', cases: 'cases', upgrade: 'upgrade', inventory: 'inventory', profile: 'profile' };
  const cur = map[name] || 'cases';
  $$('#nav .nav-link').forEach(a => a.classList.toggle('is-active', a.getAttribute('data-tab') === cur));
}
function route() {
  const h = (location.hash || '#/cases').slice(2);
  const parts = h.split('/');
  const name = parts[0] || 'cases';
  const arg = parts[1];
  setActiveTab(name);
  const v = $('#view');
  if (name === 'case' && arg) renderCase(v, arg);
  else if (name === 'upgrade') renderUpgrade(v);
  else if (name === 'inventory') renderInventory(v);
  else if (name === 'profile') renderProfile(v);
  else renderCases(v);
  window.scrollTo(0, 0);
  const main = $('.main'); if (main) main.scrollTop = 0;
}

/* ============================================================
   CASES VIEW
   ============================================================ */
let caseFilter = { q: '' };
function renderCases(v) {
  let list = CASES.slice();
  if (caseFilter.q) { const q = caseFilter.q.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q)); }

  const present = [];
  CAT_ORDER.forEach(c => { if (CASES.some(x => x.category === c)) present.push(c); });
  CASES.forEach(c => { const cat = c.category || 'Другое'; if (!present.includes(cat)) present.push(cat); });

  const groups = present.map(cat => {
    const items = list.filter(c => (c.category || 'Другое') === cat);
    return { cat: cat, items: items };
  }).filter(g => g.items.length);

  v.innerHTML =
    '<div class="page cases">'
    + '<div class="cases-search">'
    +   '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>'
    +   '<input id="caseSearch" placeholder="Поиск..." maxlength="40" value="' + esc(caseFilter.q) + '">'
    + '</div>'
    + '<div class="cases-body">'
    + (groups.length === 0 ? '<div class="empty"><b>Кейсы не найдены</b></div>' : '')
    + groups.map(g =>
        '<section class="cases-section">'
        + '<h2>' + esc(g.cat) + '</h2>'
        + '<div class="cases-grid">' + g.items.map(caseCard).join('') + '</div>'
        + '</section>'
      ).join('')
    + '</div></div>';

  let t; $('#caseSearch').oninput = e => { clearTimeout(t); const val = e.target.value; t = setTimeout(() => { caseFilter.q = val; renderCases(v); const el = $('#caseSearch'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); };
}
function caseCard(c) {
  return '<button class="case-card" onclick="location.hash=\'#/case/' + esc(c.slug) + '\'">'
    + '<span class="case-card-pic"><img loading="lazy" draggable="false" src="' + img(c.image) + '" ' + onError + '></span>'
    + '<span class="case-card-info">'
    +   '<span class="case-card-name">' + esc(c.name) + '</span>'
    +   '<span class="case-card-price">' + money(c.price) + '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5a3 3 0 013-1.5c1.6 0 3 .8 3 2s-1.4 2-3 2-3 .8-3 2 1.4 2 3 2a3 3 0 003-1.5" fill="none" stroke="#ffa800" stroke-width="1.5"/></svg></span>'
    + '</span></button>';
}

/* ============================================================
   CASE OPEN VIEW
   ============================================================ */
let openBusy = false, openFast = false, openCount = 1, resultTimer = null;

/* ---- magnifying-lens roulette (Kekser-style) ---- */
const RL = { preDelay: 1200, spin: 6500, easing: 'cubic-bezier(0.2, 0.3, 0.15, 1)', tail: 11, startIdx: 4 };
const CR = {
  L: { W: 154, H: 28, cw: 23,    ch: 17.35, gap: .986, lens: 50,    lw: 27,      lh: 21, lgap: 1.15, rw: 36 },
  M: { W: 75,  H: 24, cw: 26.8,  ch: 20.2,  gap: .986, lens: 50,    lw: 27,      lh: 21, lgap: 1.15, rw: 30.857 },
  S: { W: 50,  H: 18, cw: 20.4,  ch: 16.4,  gap: .751, lens: 38.095,lw: 20.571,  lh: 16, lgap: .876, rw: 23.143 }
};
const crPick = n => n === 1 ? CR.L : (n <= 4 ? CR.M : CR.S);
const rlWinIdx = (c, n) => n === 1 ? clamp(c.items.length * 5, 45, 90) : 40;

function icoSoundOn() { return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>'; }
function icoSoundOff() { return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>'; }
function icoBolt() { return '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>'; }

function renderCase(v, slug) {
  const c = CASES.find(x => x.slug === slug);
  if (!c) { v.innerHTML = '<div class="page"><div class="empty"><b>Кейс не найден</b></div></div>'; return; }
  const maxOpens = Math.max(1, c.max_opens || 1);
  if (openCount > maxOpens) openCount = 1;
  const total = c.items.reduce((s, it) => s + (it.chance || 1), 0);
  const drops = c.items.slice().sort((a, b) => (b.chance || 0) - (a.chance || 0));

  v.innerHTML =
    '<div class="page casepage">'
    + '<div class="case-hero">'
    +   '<a class="case-back" href="#/cases">← Кейсы</a>'
    +   '<button class="icon-btn case-sound" id="caseSnd" aria-label="Звук" title="Звук">' + (state.sound ? icoSoundOn() : icoSoundOff()) + '</button>'
    +   '<div class="case-stage">'
    +     '<div class="case-hero-img"><img draggable="false" src="' + img(c.image) + '" ' + onError + '></div>'
    +     '<div class="case-roulette" id="reel"></div>'
    +   '</div>'
    + '</div>'
    + '<div class="case-below">'
    +   '<div class="case-panel">'
    +     '<h1>' + esc(c.name) + '</h1>'
    +     '<div class="case-controls">'
    +       '<label class="btn btn-dark case-count">открыть за раз <select id="openCountSel">'
    +         Array.from({ length: maxOpens }, (_, i) => '<option value="' + (i + 1) + '"' + (openCount === i + 1 ? ' selected' : '') + '>' + (i + 1) + '</option>').join('')
    +       '</select></label>'
    +       '<button class="icon-btn case-fast' + (openFast ? ' is-on' : '') + '" id="fastTgl" aria-label="Быстрое открытие" title="Быстрое открытие">' + icoBolt() + '</button>'
    +       '<button class="btn btn-green case-open" id="openBtn">Открыть за ' + money(c.price * openCount) + ' ₽</button>'
    +     '</div>'
    +     '<div class="case-lacks" id="lacks"></div>'
    +   '</div>'
    +   '<div class="case-contents">'
    +     drops.map(it => itemCard(it.key, it.wear, it.st, it.sv, { hideWear: true, price: ((it.chance / total) * 100).toFixed(2) + '%' })).join('')
    +   '</div>'
    + '</div></div>';

  $('#openCountSel').onchange = e => { openCount = clamp(parseInt(e.target.value, 10) || 1, 1, maxOpens); updateOpenBtn(c); };  $('#fastTgl').onclick = () => { openFast = !openFast; $('#fastTgl').classList.toggle('is-on', openFast); sfx.click(); };
  $('#caseSnd').onclick = () => { state.sound = !state.sound; save(); $('#caseSnd').innerHTML = state.sound ? icoSoundOn() : icoSoundOff(); };
  $('#openBtn').onclick = () => openCase(c);
  updateLacks(c); updateOpenBtn(c);
}
function updateOpenBtn(c) { const b = $('#openBtn'); if (b) b.textContent = 'Открыть за ' + money(c.price * openCount) + ' ₽'; }
function updateLacks(c) {
  const el = $('#lacks'); if (!el) return;
  const cost = c.price * openCount;
  el.innerHTML = state.balance < cost
    ? 'Не хватает ' + money(cost - state.balance) + COIN
    : '';
}
function rlCardHtml(it) {
  const kn = /^(★|Karambit|M9 Bayonet|Bayonet|Butterfly|Flip|Gut|Huntsman|Falchion|Bowie|Shadow Daggers|Navaja|Stiletto|Talon|Ursus|Classic|Paracord|Survival|Nomad|Kukri)/.test(it.key);
  return '<div class="rl-card ' + rarityClass(it.key) + '"><img draggable="false" src="' + img(imgOf(it.key)) + '" ' + onError + (kn ? ' class="is-knife"' : '') + '></div>';
}
function rlBuildTrack(c, winItem, winIdx) {
  const r = winIdx + RL.tail + 1, arr = [];
  for (let i = 0; i < r; i++) arr.push(i === winIdx ? winItem : randomCaseItem(c));
  return arr;
}
function rlCellHtml(d, sell) {
  return '<div class="rl-cell">'
    + '<div class="rl" style="width:' + d.W + 'rem;height:' + d.H + 'rem;--lens:' + d.lens + 'rem">'
    +   '<div class="rl-window"><div class="rl-track"></div></div>'
    +   '<div class="rl-lens" style="width:' + d.lens + 'rem;height:' + d.lens + 'rem"><div class="rl-track"></div></div>'
    +   '<div class="rl-marker" style="height:' + d.lh + 'rem"></div>'
    + '</div>'
    + (sell ? '<button class="btn btn-dark rl-sell" type="button" style="width:' + d.rw + 'rem" disabled></button>' : '')
    + '</div>';
}
function rlSetPos(rl, d, m, ms) {
  const wt = $('.rl-window .rl-track', rl), lt = $('.rl-lens .rl-track', rl);
  if (!wt || !lt) return;
  const offW = d.W / 2 - (m * (d.cw + d.gap) + d.cw / 2);
  const offL = d.lens / 2 - (m * (d.lw + d.lgap) + d.lw / 2);
  const tr = ms ? 'transform ' + ms + 'ms ' + RL.easing : 'none';
  wt.style.transition = tr; lt.style.transition = tr;
  wt.style.transform = 'translate3d(' + offW + 'rem,0,0)';
  lt.style.transform = 'translate3d(' + offL + 'rem,0,0)';
}
let rlFitRO = null;
function rlFit(box, inner, wRem) {
  if (rlFitRO) { rlFitRO.disconnect(); rlFitRO = null; }
  if (!box || !inner) return;
  inner.style.width = wRem + 'rem';
  function apply() {
    if (!box.isConnected || !inner.isConnected) return;
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    const need = wRem * fs;
    const s = need > 0 ? Math.min(1, box.clientWidth / need) : 1;
    inner.style.transform = 'translateX(-50%) scale(' + s + ')';
    box.style.height = (inner.offsetHeight * s) + 'px';
  }
  apply();
  if (window.ResizeObserver) { rlFitRO = new ResizeObserver(apply); rlFitRO.observe(box); rlFitRO.observe(inner); }
}
function buildRoulette(c, n, winners) {
  const reel = $('#reel'); if (!reel) return { els: [], d: crPick(n), infos: [] };
  const d = crPick(n);
  const infos = [];
  for (let i = 0; i < n; i++) infos.push({ win: winners ? winners[i] : randomCaseItem(c), idx: rlWinIdx(c, n) });
  reel.innerHTML = '<div class="fitbox"><div class="fitbox-inner"><div class="rl-grid' + (n > 1 ? ' is-2' : '') + '">'
    + infos.map(() => rlCellHtml(d, n > 1)).join('') + '</div></div></div>';
  const els = $$('.rl', reel);
  els.forEach((rl, i) => {
    const arr = rlBuildTrack(c, infos[i].win, infos[i].idx);
    const html = arr.map(rlCardHtml).join('');
    const wt = $('.rl-window .rl-track', rl), lt = $('.rl-lens .rl-track', rl);
    wt.innerHTML = html; lt.innerHTML = html;
    wt.style.gap = d.gap + 'rem'; wt.style.height = d.ch + 'rem'; wt.style.setProperty('--cw', d.cw + 'rem');
    lt.style.gap = d.lgap + 'rem'; lt.style.height = d.lh + 'rem'; lt.style.setProperty('--cw', d.lw + 'rem');
    rlSetPos(rl, d, RL.startIdx, 0);
  });
  rlFit($('.fitbox', reel), $('.fitbox-inner', reel), 154);
  return { els: els, d: d, infos: infos };
}

function randomCaseItem(c) {
  const total = c.items.reduce((s, it) => s + (it.chance || 1), 0);
  let r = Math.random() * total;
  for (const it of c.items) { r -= (it.chance || 1); if (r <= 0) return it; }
  return c.items[c.items.length - 1];
}

function openCase(c) {
  if (openBusy) return;
  const n = openCount, cost = c.price * n;
  if (state.balance < cost) { toast('Недостаточно средств для открытия кейса', 'err'); return; }
  openBusy = true;
  clearTimeout(resultTimer);
  state.balance -= cost; state.stats.spent += cost; state.stats.opened += n;
  syncBalance(); save(); sfx.open(); updateLacks(c); updateOpenBtn(c);

  const winners = [];
  for (let i = 0; i < n; i++) winners.push(randomCaseItem(c));
  const instant = openFast;
  const st = buildRoulette(c, n, winners);
  const page = $('.casepage');
  if (page) page.classList.add('phase-pre');

  const startSpin = () => {
    if (page) { page.classList.remove('phase-pre'); page.classList.add('phase-spin'); }
    st.els.forEach((rl, i) => rlSetPos(rl, st.d, st.infos[i].idx, instant ? 0 : RL.spin));
    if (instant) { finish(); return; }
    const t0 = performance.now();
    (function tickLoop() {
      const dt = performance.now() - t0;
      if (dt > RL.spin) return;
      const p = dt / RL.spin;
      if (Math.random() > p * 0.85) sfx.tick();
      setTimeout(tickLoop, 40 + p * 300);
    })();
    setTimeout(finish, RL.spin + 450);
  };
  setTimeout(startSpin, instant ? 0 : RL.preDelay);

  function finish() {
    openBusy = false;
    if (page) { page.classList.remove('phase-pre', 'phase-spin'); page.classList.add('phase-result'); }
    const sellBtns = $$('.rl-sell');
    st.els.forEach((rl, i) => {
      rl.classList.add('is-done');
      const win = st.infos[i].win, val = priceOf(win.key, win.wear, win.st, win.sv);
      const parts = String(win.key).split(' | ');
      const rEl = document.createElement('div');
      rEl.className = 'rl-result ' + rarityClass(win.key);
      rEl.style.width = st.d.rw + 'rem';
      rEl.innerHTML = '<img draggable="false" src="' + img(imgOf(win.key)) + '" ' + onError + '>'
        + '<div class="rl-result-name"><b>' + esc(parts[0] || win.key) + '</b><span>' + esc(parts[1] || '') + '</span></div>';
      rl.appendChild(rEl);

      const item = { uid: uid(), key: win.key, wear: win.wear, st: win.st, sv: win.sv, value: val, t: Date.now() };
      addInv(item);
      liveDropAdd(win.key, win.wear, val);
      if (!state.stats.best || val > state.stats.best.value) state.stats.best = { key: win.key, value: val };
      const r = rarity(win.key);
      if (val >= 2000) { sfx.bigwin(); burst(140, [r.color, '#ffd700', '#44c987']); }
      else if (val >= 300) { sfx.win(); burst(60, [r.color, '#83d8ff']); }
      else sfx.win();
      if (i === 0 && n === 1) resultTimer = setTimeout(() => showResult(item), 1200);

      const btn = sellBtns[i];
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Продать ' + money(val) + ' ₽';
        setTimeout(() => btn.classList.add('is-shown'), 120);
        btn.onclick = () => {
          const it = state.inv.find(x => x.uid === item.uid);
          if (!it) return;
          state.balance += it.value; state.stats.earned += it.value;
          state.inv = state.inv.filter(x => x.uid !== it.uid);
          sfx.sell(); syncBalance(); save();
          btn.textContent = 'Продано';
          btn.disabled = true;
          btn.classList.add('is-sold');
        };
      }
    });
    save();
  }
}

function showResult(item) {
  const rclass = rarityClass(item.key);
  const wearLbl = WEAR[item.wear] || '';
  const m = modal(
    '<div style="text-align:center">'
    + '<div style="font-size:1.2rem;color:#ffffff8c;text-transform:uppercase;margin-bottom:1rem">' + (item.value >= 2000 ? 'Джекпот!' : 'Вы получили') + '</div>'
    + '<div class="item-pic ' + rclass + '" style="width:20rem;height:16rem;margin:0 auto 1rem;border-radius:.2rem"><img src="' + img(imgOf(item.key)) + '" ' + onError + '></div>'
    + '<div style="font-family:var(--head);font-size:1.8rem;font-weight:600">' + esc(item.key) + '</div>'
    + '<div style="color:#ffffff8c;font-size:1.2rem;margin:.3rem 0 1rem">' + (item.st ? 'StatTrak™ · ' : '') + esc(wearLbl) + '</div>'
    + '<div style="font-family:var(--head);font-size:2.4rem;color:#ffa800;margin-bottom:1.6rem">' + money(item.value) + ' ₽</div>'
    + '<div style="display:flex;gap:1rem">'
    +   '<button class="btn btn-green btn-block" data-keep>Забрать в инвентарь</button>'
    +   '<button class="btn btn-dark btn-block" data-sell>Продать ' + money(item.value) + ' ₽</button>'
    + '</div></div>', { cls: 'result-modal' });
  m.querySelector('[data-keep]').onclick = () => m.close();
  m.querySelector('[data-sell]').onclick = () => {
    const it = state.inv.find(x => x.uid === item.uid);
    if (it) { state.balance += it.value; state.stats.earned += it.value; state.inv = state.inv.filter(x => x.uid !== it.uid); sfx.sell(); syncBalance(); save(); toast('Продано за ' + money(it.value) + ' ₽'); }
    m.close();
  };
}

/* ============================================================
   INVENTORY
   ============================================================ */
let invSort = 'new';
function renderInventory(v) {
  const total = state.inv.reduce((s, it) => s + (it.value || priceOf(it.key, it.wear, it.st, it.sv)), 0);
  let list = state.inv.slice();
  if (invSort === 'price-desc') list.sort((a, b) => b.value - a.value);
  else if (invSort === 'price-asc') list.sort((a, b) => a.value - b.value);
  else list.sort((a, b) => b.t - a.t);

  v.innerHTML =
    '<div class="page">'
    + '<div class="inv-bar">'
    +   '<div class="stat"><div class="k">Предметов: </div><div class="v">' + state.inv.length + '</div></div>'
    +   '<div class="stat"><div class="k">Стоимость инвентаря</div><div class="v">' + money(total) + ' ₽</div></div>'
    +   '<div class="inv-sort">'
    +     '<select id="invSort">'
    +       '<option value="new"' + (invSort === 'new' ? ' selected' : '') + '>По новизне</option>'
    +       '<option value="price-desc"' + (invSort === 'price-desc' ? ' selected' : '') + '>По цене</option>'
    +       '<option value="price-asc"' + (invSort === 'price-asc' ? ' selected' : '') + '>Дешевле</option>'
    +     '</select>'
    +     '<button class="btn btn-dark btn-sm" id="sellAll"' + (state.inv.length ? '' : ' disabled') + '>Продать все предметы</button>'
    +   '</div>'
    + '</div>'
    + (state.inv.length
        ? '<div class="inv-grid" id="invGrid">' + list.map(it => itemCard(it.key, it.wear, it.st, it.sv)).join('') + '</div>'
        : '<div class="empty"><b>Ваш инвентарь пуст</b><p>Открой свой первый кейс</p></div>')
    + '</div>';

  const ss = $('#invSort'); if (ss) ss.onchange = e => { invSort = e.target.value; renderInventory(v); };
  const sa = $('#sellAll'); if (sa) sa.onclick = () => {
    if (!state.inv.length) return;
    state.balance += total; state.stats.earned += total; state.inv = []; sfx.sell(); syncBalance(); save();
    toast('Продано всё за ' + money(total) + ' ₽'); renderInventory(v);
  };
  const g = $('#invGrid'); if (g) g.onclick = e => {
    const card = e.target.closest('.item'); if (!card) return;
    const key = card.dataset.key, wear = card.dataset.wear || null, st = card.dataset.st === '1', sv = card.dataset.sv === '1';
    const item = list.find(x => x.key === key && (x.wear || '') === (wear || '') && !!x.st === st && !!x.sv === sv);
    if (item) itemActionModal(item, v);
  };
}
function itemActionModal(item, v) {
  const rclass = rarityClass(item.key);
  const m = modal(
    '<div style="text-align:center">'
    + '<div class="item-pic ' + rclass + '" style="width:18rem;height:14rem;margin:0 auto 1rem;border-radius:.2rem"><img src="' + img(imgOf(item.key)) + '" ' + onError + '></div>'
    + '<div style="font-family:var(--head);font-size:1.8rem;font-weight:600">' + esc(item.key) + '</div>'
    + '<div style="color:#ffffff8c;font-size:1.2rem;margin:.3rem 0 1rem">' + (item.st ? 'StatTrak™ · ' : '') + esc(WEAR[item.wear] || '') + '</div>'
    + '<div style="font-family:var(--head);font-size:2.2rem;color:#ffa800;margin-bottom:1.6rem">' + money(item.value) + ' ₽</div>'
    + '<div style="display:flex;gap:1rem">'
    +   '<button class="btn btn-green btn-block" data-upg>В апгрейд</button>'
    +   '<button class="btn btn-dark btn-block" data-sell>Продать</button>'
    + '</div></div>', { cls: 'result-modal' });
  m.querySelector('[data-sell]').onclick = () => {
    state.balance += item.value; state.stats.earned += item.value;
    state.inv = state.inv.filter(x => x.uid !== item.uid); sfx.sell(); syncBalance(); save();
    toast('Продано за ' + money(item.value) + ' ₽'); m.close(); renderInventory(v);
  };
  m.querySelector('[data-upg]').onclick = () => { m.close(); UP.sel = [item.uid]; UP.target = null; UP.multLabel = null; UP.manual = false; upResolveTarget(); location.hash = '#/upgrade'; };
}

/* ============================================================
   UPGRADE (Kekser-style)
   ============================================================ */
const UP_CFG = { maxItems: 6, maxChance: 80, maxBalanceShare: 0.8 };
const UP_SPIN = {
  normal: { duration: 7000, turns: 6, easing: 'cubic-bezier(0.25, 0.1, 0.2, 1)' },
  turbo:  { duration: 1500, turns: 3, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' }
};
const UP_MULT = [['x2', 2], ['x5', 5], ['x10', 10], ['30%', 1 / 0.3], ['50%', 2], ['75%', 1 / 0.75]];
const UP_AI = [25, 60];
const UP_PAGE = 16;
const WHEEL_BL = 291.67;
const WHEEL_R = (WHEEL_BL - 42) / 2;
const WHEEL_CIRC = 2 * Math.PI * WHEEL_R;
const UP_COLORS = {
  idle: ['#691A00', '#FFA800', '#FFA800'],
  win:  ['#0A2E1E', '#2A9B6B', '#44C987'],
  lose: ['#2F110E', '#D55548', '#D55548']
};
const UP_GLOW = {
  idle: 'drop-shadow(0 0 15px rgba(255,168,0,.55))',
  win:  'drop-shadow(0 0 10.4px rgba(68,201,135,.45))',
  lose: 'drop-shadow(0 0 10.4px rgba(213,85,72,.45))'
};
const UP_ICO = {
  sort: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h13M3 12h9M3 18h5"/></svg>',
  users: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/></svg>',
  grid: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  lock: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 116 0v3H9z"/></svg>',
  turbo: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
  snd: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>',
  sndOff: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  search: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  auto: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 019-9 9 9 0 018 5M21 3v5h-5M21 12a9 9 0 01-9 9 9 9 0 01-8-5M3 21v-5h5"/></svg>'
};

const UP = {
  sel: [], add: 0, target: null, multLabel: null, multNum: 0, manual: false,
  pf: '', pu: '', ps: '', mySort: false, catSort: true,
  myPage: 0, catPage: 0, turbo: false,
  phase: 'idle', angle: 180, spin: null, pending: null, lastChance: 0
};
let UP_CAT = null;

function upCatalog() {
  if (UP_CAT) return UP_CAT;
  const arr = [];
  for (const key in SKINS) {
    const s = SKINS[key]; if (!s || !s.price) continue;
    const buckets = [['nonST', s.price.nonST, false, false], ['ST', s.price.ST, true, false], ['SV', s.price.SV, false, true]];
    for (const b of buckets) {
      const bp = b[1]; if (!bp) continue;
      for (const w in bp) {
        const v = bp[w]; if (v == null || !(v > 0)) continue;
        arr.push({ key: key, wear: w, st: b[2], sv: b[3], val: v });
      }
    }
  }
  arr.sort((a, b) => a.val - b.val);
  UP_CAT = arr;
  return arr;
}
function upSame(a, b) {
  return !!a && !!b && a.key === b.key && a.wear === b.wear && !!a.st === !!b.st && !!a.sv === !!b.sv;
}
function upSelItems() {
  const ids = {};
  UP.sel.forEach(id => { ids[id] = 1; });
  return state.inv.filter(it => ids[it.uid]);
}
function upBetValue() { return upSelItems().reduce((s, it) => s + (it.value || 0), 0); }
function upTargetValue() { return UP.target ? UP.target.val : 0; }
function upMaxAdd() {
  const bet = upBetValue();
  if (!UP.target || !UP.sel.length || UP.sel.length > UP_CFG.maxItems) return 0;
  return Math.max(0, Math.floor(Math.min(UP_CFG.maxBalanceShare * UP.target.val - bet, state.balance)));
}
function upAddUsed() { return Math.min(UP.add, upMaxAdd()); }
function upStake() { return upBetValue() + upAddUsed(); }
function upChance(stake, price) {
  return (!(stake > 0) || !(price > 0)) ? 0 : Math.max(0.01, Math.min(100, stake / price * 100));
}
function upShownChance() {
  if (UP.pending) return UP.pending.chance;
  if (UP.phase === 'win' || UP.phase === 'lose') return UP.lastChance;
  return UP.target ? upChance(upStake(), UP.target.val) : 0;
}
function upCanGo() {
  return UP.phase !== 'spin' && !!UP.target && UP.sel.length > 0 && UP.sel.length <= UP_CFG.maxItems && upShownChance() <= UP_CFG.maxChance && upStake() > 0;
}
function upArcLen(c) { return Math.min(c, 100) / 100 * WHEEL_CIRC; }
function upPointerPct(shown, win) {
  const n = shown / 2;
  if (win) { const s = Math.min(2, n / 2); return 50 - n + s + Math.random() * Math.max(0, shown - s * 2); }
  const r = Math.max(0, 50 - n - 1 - 2);
  const left = Math.random() < 0.5, o = Math.random() * (r > 0 ? r : 0.5);
  return left ? 2 + o : 98 - o;
}
function upChanceLabel(c) {
  return c >= 80 ? 'Очень высокий шанс' : c >= 60 ? 'Высокий шанс' : c >= 40 ? 'Средний шанс' : c >= 20 ? 'Низкий шанс' : 'Очень низкий шанс';
}
function upPriceFactor(price) {
  const t = Math.log10(Math.max(1, price));
  const tbl = [[4.3, 1], [5, 0.85], [6, 0.65]];
  if (t <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) {
    if (t <= tbl[i][0]) { const a = tbl[i - 1], b = tbl[i]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); }
  }
  return tbl[tbl.length - 1][1];
}
function upRoll(stake, price) {
  const shown = Math.min(upChance(stake, price), UP_CFG.maxChance);
  const real = Math.min(1, (shown / 100) * upPriceFactor(price) * Math.max(0.55, 1 - 0.06 * (state.stats.upLossStreak || 0)));
  return { shown: shown, win: Math.random() < real };
}
function upSetTargetFromMult(mult) {
  const bet = upBetValue();
  if (!(bet > 0)) return null;
  const desired = bet * mult;
  let lo = Math.round(0.95 * desired), hi = Math.round(1.05 * desired);
  if (hi <= lo) hi = lo + 1;
  UP.pf = String(lo); UP.pu = String(hi); UP.ps = '';
  const minPrice = Math.max(lo, bet / (UP_CFG.maxChance / 100));
  let best = null;
  const cat = upCatalog();
  for (let i = 0; i < cat.length; i++) {
    const it = cat[i];
    if (it.val < minPrice) continue;
    if (it.val > hi) break;
    if (!best || Math.abs(it.val - desired) < Math.abs(best.val - desired)) best = it;
  }
  return best;
}
function upResolveTarget() {
  const bet = upBetValue();
  if (!(bet > 0) || !UP.sel.length) { UP.target = null; UP.multLabel = null; UP.multNum = 0; UP.add = 0; return; }
  UP.manual = false;
  const label = UP.multLabel;
  let mult;
  if (label && label !== 'auto') {
    const m = UP_MULT.filter(x => x[0] === label)[0];
    mult = m ? m[1] : (1 + 9 * Math.random());
  } else { mult = 1 + 9 * Math.random(); UP.multLabel = 'auto'; }
  UP.multNum = mult;
  UP.target = upSetTargetFromMult(mult);
  UP.catPage = 0;
  if (!UP.target) toast('В этом диапазоне цен нет предметов', 'err');
}
function upApplyMultiplier(mult, label) {
  if (!(upBetValue() > 0)) { toast('Сначала выберите предметы из инвентаря', 'err'); return; }
  if (UP.phase !== 'idle') { UP.phase = 'idle'; UP.pending = null; }
  UP.multLabel = label; UP.multNum = mult;
  UP.manual = false;
  UP.target = upSetTargetFromMult(mult);
  UP.add = 0; UP.catPage = 0;
  if (!UP.target) toast('В этом диапазоне цен нет предметов', 'err');
}
function upToggleItem(id, v) {
  if (UP.phase === 'spin') return;
  if (UP.sel.indexOf(id) >= 0) UP.sel = UP.sel.filter(x => x !== id);
  else {
    if (UP.sel.length >= UP_CFG.maxItems) { toast('Максимум ' + UP_CFG.maxItems + ' предметов', 'err'); return; }
    UP.sel.push(id);
  }
  sfx.click && sfx.click();
  if (UP.sel.length) {
    if (UP.phase !== 'idle') UP.phase = 'idle';
    if (UP.manual && UP.target && upShownChance() <= UP_CFG.maxChance) { /* keep manual target */ }
    else upResolveTarget();
  } else { UP.target = null; UP.multLabel = null; UP.manual = false; UP.add = 0; }
  renderUpgrade(v);
}
function upCardHtml(item, price, opts) {
  opts = opts || {};
  const parts = String(item.key).split(' | ');
  return '<div class="upc ' + rarityClass(item.key) + (opts.sel ? ' is-selected' : '') + (opts.locked ? ' is-locked' : '') + (opts.click ? ' is-click' : '') + '" data-uid="' + (item.uid || '') + '" data-key="' + esc(item.key) + '" data-wear="' + esc(item.wear || '') + '" data-st="' + (item.st ? 1 : 0) + '" data-sv="' + (item.sv ? 1 : 0) + '">'
    + '<img loading="lazy" draggable="false" src="' + img(imgOf(item.key)) + '" ' + onError + '>'
    + '<span class="upc-price">' + money(price) + COIN + '</span>'
    + (item.wear && item.wear !== 'NW' ? '<span class="upc-wear">' + esc(item.wear) + '</span>' : '')
    + (opts.locked ? '<span class="upc-lock">' + UP_ICO.lock + '</span>' : '')
    + '<span class="upc-name"><b>' + esc(parts[0] || item.key) + '</b><span>' + esc(parts[1] || ' ') + '</span></span>'
    + '</div>';
}
function upSlotHtml(items, total, placeholder, glow) {
  if (!items.length) return '<div class="up-slot is-empty">' + esc(placeholder) + '</div>';
  if (items.length > 1) {
    return '<div class="up-slot is-multi"><div class="up-slot-cards">'
      + items.map(it => upCardHtml(it, it.value || 0)).join('')
      + '</div><span class="up-slot-total">' + money(total) + COIN + '</span></div>';
  }
  const it = items[0], parts = String(it.key).split(' | ');
  return '<div class="up-slot ' + rarityClass(it.key) + (glow ? ' is-won' : '') + '">'
    + '<span class="up-slot-price">' + money(total) + COIN + '</span>'
    + (it.wear && it.wear !== 'NW' ? '<span class="up-slot-wear">' + esc(it.wear) + '</span>' : '')
    + '<img draggable="false" src="' + img(imgOf(it.key)) + '" ' + onError + '>'
    + '<div class="up-slot-name"><b>' + esc(parts[0] || it.key) + '</b><span>' + esc(parts[1] || ' ') + '</span></div>'
    + '</div>';
}
function upWheelHtml() {
  const shown = upShownChance();
  const phase = UP.phase === 'win' ? 'win' : UP.phase === 'lose' ? 'lose' : 'idle';
  const col = UP_COLORS[phase];
  const arc = upArcLen(shown);
  const dash = arc + ' ' + (WHEEL_CIRC - arc);
  const off = arc / 2 - WHEEL_CIRC / 4;
  const cx = WHEEL_BL / 2;
  const centerTxt = phase === 'win' ? 'Победа' : phase === 'lose' ? 'Проиграл' : (shown > 0 && UP.target ? upChanceLabel(shown) : 'Выберите предмет');
  const ptrTransition = (UP.phase === 'spin' && UP.spin) ? ('transform ' + UP.spin.duration + 'ms ' + UP.spin.easing) : 'none';
  return '<div class="wheel-box"><div class="wheel is-' + phase + '">'
    + '<div class="wheel-plate"></div>'
    + '<svg class="wheel-ring" viewBox="0 0 ' + WHEEL_BL + ' ' + WHEEL_BL + '">'
    +   '<defs><linearGradient id="upGrad" x1="50%" y1="100%" x2="50%" y2="0%"><stop offset="0%" stop-color="' + col[0] + '"/><stop offset="74%" stop-color="' + col[1] + '"/><stop offset="100%" stop-color="' + col[2] + '"/></linearGradient>'
    +   '<filter id="upGlow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="' + col[2] + '" flood-opacity="' + (phase === 'idle' ? '0.55' : '0.45') + '"/></filter></defs>'
    +   '<circle cx="' + cx + '" cy="' + cx + '" r="' + WHEEL_R + '" fill="none" stroke="#00000073" stroke-width="42"/>'
    +   '<g filter="url(#upGlow)"><circle cx="' + cx + '" cy="' + cx + '" r="' + WHEEL_R + '" fill="none" stroke="url(#upGrad)" stroke-width="42" stroke-linecap="butt" stroke-dasharray="' + dash + '" stroke-dashoffset="' + off + '"/></g>'
    + '</svg>'
    + '<span class="wheel-label is-top">100%</span>'
    + '<span class="wheel-label is-left">50%</span>'
    + '<span class="wheel-label is-right">50%</span>'
    + '<span class="wheel-label is-bottom">0%</span>'
    + '<div class="wheel-center"><b>' + shown.toFixed(2) + '%</b><span>' + esc(centerTxt) + '</span></div>'
    + '<div class="wheel-pointer" id="wheelPtr" style="transform:rotate(' + UP.angle + 'deg)' + (ptrTransition !== 'none' ? ';transition:' + ptrTransition : '') + '"><svg class="wheel-arrow" viewBox="0 0 40 40"><path d="M20 3l9 26-9-6-9 6z" fill="#ffcf6b" stroke="#5c3d00" stroke-width="1.4" stroke-linejoin="round"/></svg></div>'
    + '</div></div>';
}
function upBalanceHtml(cur, maxAdd) {
  return '<div class="up-balance">'
    + '<span class="up-balance-title">' + COIN + 'Добавить баланс</span>'
    + '<div class="up-balance-range"><input type="range" id="upBalRange" min="0" max="' + maxAdd + '" step="1" value="' + cur + '"' + (maxAdd <= 0 ? ' disabled' : '') + '></div>'
    + '<button class="up-balance-max" id="upBalMax"' + (maxAdd <= 0 ? ' disabled' : '') + '>Макс. <span>' + COIN + money(maxAdd) + '</span></button>'
    + '</div>';
}
function upPresetsHtml() {
  return '<div class="up-presets">'
    + '<button class="btn btn-dark' + (UP.multLabel === 'auto' ? ' is-on' : '') + '" id="upAuto" aria-label="Случайный множитель">' + UP_ICO.auto + '</button>'
    + UP_MULT.map(m => '<button class="btn btn-dark' + (UP.multLabel === m[0] ? ' is-on' : '') + '" data-mult="' + esc(m[0]) + '">' + esc(m[0]) + '</button>').join('')
    + '</div>';
}
function upPagerHtml(which, cur, pages) {
  const span = 4;
  let a = Math.max(0, cur - span), b = Math.min(pages - 1, cur + span);
  let h = '<div class="up-pager">';
  h += '<button data-pg="' + which + '" data-i="' + Math.max(0, cur - 1) + '"' + (cur <= 0 ? ' disabled' : '') + '>‹</button>';
  if (a > 0) h += '<button data-pg="' + which + '" data-i="0">1</button>' + (a > 1 ? '<span class="up-pager-dots">…</span>' : '');
  for (let i = a; i <= b; i++) h += '<button data-pg="' + which + '" data-i="' + i + '"' + (i === cur ? ' class="on"' : '') + '>' + (i + 1) + '</button>';
  if (b < pages - 1) h += (b < pages - 2 ? '<span class="up-pager-dots">…</span>' : '') + '<button data-pg="' + which + '" data-i="' + (pages - 1) + '">' + pages + '</button>';
  h += '<button data-pg="' + which + '" data-i="' + Math.min(pages - 1, cur + 1) + '"' + (cur >= pages - 1 ? ' disabled' : '') + '>›</button>';
  return h + '</div>';
}
function upGhosts(shown, pageSize) {
  if (!shown || shown >= pageSize) return '';
  return Array(pageSize - shown).fill('<div class="upc is-ghost"></div>').join('');
}
function renderUpgrade(v) {
  if (!v) return;
  UP.sel = UP.sel.filter(id => state.inv.some(x => x.uid === id)).slice(0, UP_CFG.maxItems);
  const selItems = upSelItems();
  const bet = upBetValue();
  const maxAdd = upMaxAdd();
  if (UP.add > maxAdd) UP.add = maxAdd;
  const spinning = UP.phase === 'spin';
  const done = UP.phase === 'win' || UP.phase === 'lose';
  const shown = upShownChance();
  const overMax = !!UP.target && !done && shown > UP_CFG.maxChance;

  let myList = state.inv.slice();
  if (UP.mySort) myList.sort((a, b) => (b.value || 0) - (a.value || 0));
  const myPages = Math.max(1, Math.ceil(myList.length / UP_PAGE));
  UP.myPage = clamp(UP.myPage, 0, myPages - 1);
  const myShown = myList.slice(UP.myPage * UP_PAGE, (UP.myPage + 1) * UP_PAGE);

  const lo = parseFloat(UP.pf) || 0;
  const hi = UP.pu === '' || UP.pu == null ? Infinity : (parseFloat(UP.pu) || Infinity);
  const q = UP.ps.trim().toLowerCase();
  let cat = upCatalog().filter(it => it.val >= lo && it.val <= hi && (!q || it.key.toLowerCase().indexOf(q) >= 0));
  if (!UP.catSort) cat = cat.slice().reverse();
  const minTarget = upStake() > 0 ? upStake() / (UP_CFG.maxChance / 100) : 0;
  const catPages = Math.max(1, Math.ceil(cat.length / UP_PAGE));
  UP.catPage = clamp(UP.catPage, 0, catPages - 1);
  const catShown = cat.slice(UP.catPage * UP_PAGE, (UP.catPage + 1) * UP_PAGE);

  const selTitle = !selItems.length
    ? 'Выберите предметы и/или баланс для использования'
    : 'Выбран' + (selItems.length === 1 ? '' : 'о') + ' ' + selItems.length + ' предмет' + (selItems.length === 1 ? '' : (selItems.length < 5 ? 'а' : 'ов'));

  const html = '<div class="page"><div class="upgrade">'
    + '<div class="up-tools">'
    +   '<button class="icon-btn' + (UP.turbo ? ' is-on' : '') + '" id="upTurbo" title="Турбо-режим"' + (spinning ? ' disabled' : '') + '>' + UP_ICO.turbo + '</button>'
    +   '<button class="icon-btn" id="upSound" title="Звук">' + (state.sound ? UP_ICO.snd : UP_ICO.sndOff) + '</button>'
    + '</div>'
    + '<div class="up-top">'
    +   '<div class="up-col">'
    +     '<div class="up-col-head"><span>' + esc(selTitle) + '</span><button class="btn btn-dark" id="upClearSel"' + (spinning ? ' disabled' : '') + '>Очистить</button></div>'
    +     upSlotHtml(selItems, bet, 'Выбранные предметы появятся здесь', false)
    +     upBalanceHtml(upAddUsed(), maxAdd)
    +   '</div>'
    +   '<div class="up-mid">'
    +     upWheelHtml()
    +     (overMax ? '<div class="up-chance-warn">Шанс не может превышать ' + UP_CFG.maxChance + '% — выберите предмет дороже</div>' : '')
    +     '<button class="btn btn-green up-go" id="upGo"' + (upCanGo() ? '' : ' disabled') + '>' + (spinning ? 'Апгрейд...' : 'Апгрейд') + '</button>'
    +   '</div>'
    +   '<div class="up-col">'
    +     '<div class="up-col-head"><span>Предмет для апгрейда</span><button class="btn btn-dark" id="upClearTgt"' + (spinning ? ' disabled' : '') + '>Очистить</button></div>'
    +     upSlotHtml(UP.target ? [UP.target] : [], UP.target ? UP.target.val : 0, 'Выберите предмет из списка ниже', UP.phase === 'win')
    +     upPresetsHtml()
    +   '</div>'
    + '</div>'
    + '<div class="up-lists">'
    +   '<div class="up-list">'
    +     '<div class="up-list-head"><span>' + UP_ICO.users + 'Мои предметы</span>'
    +       (state.inv.length ? '<button class="icon-btn' + (UP.mySort ? ' is-on' : '') + '" id="upMySort" title="Сортировка по цене">' + UP_ICO.sort + '</button>' : '')
    +     '</div>'
    +     (state.inv.length === 0
          ? '<div class="up-empty">Ваш инвентарь пуст<button class="btn btn-green" data-go="cases">Открой первый кейс</button></div>'
          : '<div class="up-grid" id="upMyGrid">' + myShown.map(it => upCardHtml(it, it.value || 0, { sel: UP.sel.indexOf(it.uid) >= 0, click: true })).join('') + upGhosts(myShown.length, UP_PAGE) + '</div>'
            + (myPages > 1 ? upPagerHtml('my', UP.myPage, myPages) : ''))
    +   '</div>'
    +   '<div class="up-list">'
    +     '<div class="up-list-head"><span>' + UP_ICO.grid + 'Выбрать предмет</span></div>'
    +     '<div class="up-filters">'
    +       '<button class="icon-btn' + (UP.catSort ? ' is-on' : '') + '" id="upCatSort" title="Сортировка по цене">' + UP_ICO.sort + '</button>'
    +       '<div class="up-price"><input inputmode="numeric" maxlength="8" id="upPF" placeholder="От" value="' + esc(UP.pf) + '"><span>—</span><input inputmode="numeric" maxlength="8" id="upPU" placeholder="До" value="' + esc(UP.pu) + '"></div>'
    +       '<label class="up-search">' + UP_ICO.search + '<input maxlength="40" id="upPS" placeholder="Поиск..." value="' + esc(UP.ps) + '"></label>'
    +     '</div>'
    +     (catShown.length === 0
          ? '<div class="up-empty">Ничего не найдено</div>'
          : '<div class="up-grid" id="upCatGrid">' + catShown.map(it => upCardHtml(it, it.val, { sel: upSame(it, UP.target), locked: it.val < minTarget, click: true })).join('') + upGhosts(catShown.length, UP_PAGE) + '</div>'
            + (catPages > 1 ? upPagerHtml('cat', UP.catPage, catPages) : ''))
    +   '</div>'
    + '</div>'
    + '</div></div>';
  v.innerHTML = html;
  attachUpgrade(v);
}
function attachUpgrade(v) {
  const click = (sel, fn) => { const el = $(sel, v); if (el) el.onclick = fn; };
  click('#upTurbo', () => { if (UP.phase === 'spin') return; UP.turbo = !UP.turbo; sfx.click && sfx.click(); renderUpgrade(v); });
  click('#upSound', () => { state.sound = !state.sound; save(); renderUpgrade(v); });
  click('#upClearSel', () => { if (UP.phase === 'spin') return; UP.sel = []; UP.target = null; UP.multLabel = null; UP.manual = false; UP.add = 0; UP.phase = 'idle'; renderUpgrade(v); });
  click('#upClearTgt', () => { if (UP.phase === 'spin') return; UP.target = null; UP.multLabel = null; UP.manual = false; UP.pf = ''; UP.pu = ''; UP.ps = ''; renderUpgrade(v); });
  click('#upAuto', () => { if (UP.phase === 'spin') return; upApplyMultiplier(1 + 9 * Math.random(), 'auto'); renderUpgrade(v); });
  click('#upBalMax', () => { if (UP.phase === 'spin') return; UP.add = upMaxAdd(); renderUpgrade(v); });
  click('#upGo', () => upGo(v));
  click('#upMySort', () => { UP.mySort = !UP.mySort; UP.myPage = 0; renderUpgrade(v); });
  click('#upCatSort', () => { UP.catSort = !UP.catSort; UP.catPage = 0; renderUpgrade(v); });
  const go = $('[data-go]', v); if (go) go.onclick = () => { location.hash = '#/' + go.dataset.go; };

  $$('[data-mult]', v).forEach(b => b.onclick = () => {
    if (UP.phase === 'spin') return;
    const m = UP_MULT.filter(x => x[0] === b.dataset.mult)[0];
    if (m) { upApplyMultiplier(m[1], m[0]); renderUpgrade(v); }
  });
  const rng = $('#upBalRange', v);
  if (rng) rng.oninput = e => { UP.add = clamp(parseInt(e.target.value, 10) || 0, 0, upMaxAdd()); renderUpgrade(v); };

  const mg = $('#upMyGrid', v);
  if (mg) mg.onclick = e => { const c = e.target.closest('.upc.is-click'); if (c && c.dataset.uid) upToggleItem(c.dataset.uid, v); };
  const cg = $('#upCatGrid', v);
  if (cg) cg.onclick = e => {
    if (UP.phase === 'spin') return;
    const c = e.target.closest('.upc.is-click'); if (!c) return;
    const key = c.dataset.key, wear = c.dataset.wear, st = c.dataset.st === '1', sv = c.dataset.sv === '1';
    if (c.classList.contains('is-locked')) { toast('Шанс выше ' + UP_CFG.maxChance + '% — выберите предмет дороже', 'err'); return; }
    const found = upCatalog().filter(x => x.key === key && x.wear === wear && !!x.st === st && !!x.sv === sv)[0];
    if (!found) return;
    if (UP.phase !== 'idle') UP.phase = 'idle';
    UP.target = { key: found.key, wear: found.wear, st: found.st, sv: found.sv, val: found.val };
    UP.multLabel = null; UP.multNum = 0; UP.manual = true;
    sfx.click && sfx.click();
    renderUpgrade(v);
  };
  const pf = $('#upPF', v); if (pf) pf.oninput = e => { UP.pf = e.target.value.replace(/[^\d]/g, ''); UP.catPage = 0; debounceUp(v, e.target, 'pf'); };
  const pu = $('#upPU', v); if (pu) pu.oninput = e => { UP.pu = e.target.value.replace(/[^\d]/g, ''); UP.catPage = 0; debounceUp(v, e.target, 'pu'); };
  const ps = $('#upPS', v); if (ps) ps.oninput = e => { UP.ps = e.target.value; UP.catPage = 0; debounceUp(v, e.target, 'ps'); };
  const pgr = $('.up-pager', v);
  if (pgr) pgr.onclick = e => { const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return; if (b.dataset.pg === 'my') UP.myPage = parseInt(b.dataset.i, 10) || 0; else UP.catPage = parseInt(b.dataset.i, 10) || 0; renderUpgrade(v); };
}
let upDeb = null;
function debounceUp(v, input, field) {
  clearTimeout(upDeb);
  upDeb = setTimeout(() => {
    const focused = document.activeElement;
    renderUpgrade(v);
    const el = $('#' + (field === 'pf' ? 'upPF' : field === 'pu' ? 'upPU' : 'upPS'), v);
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    else if (focused) focused.blur();
  }, 260);
}
function upGo(v) {
  if (UP.phase === 'spin' || !upCanGo()) {
    if (UP.target && upShownChance() > UP_CFG.maxChance) toast('Шанс не может превышать ' + UP_CFG.maxChance + '%', 'err');
    return;
  }
  const sel = upSelItems();
  const stake = upStake();
  const roll = upRoll(stake, UP.target.val);
  UP.pending = { items: sel, stake: stake, add: upAddUsed(), target: UP.target, chance: roll.shown, win: roll.win };
  const cfg = UP.turbo ? UP_SPIN.turbo : UP_SPIN.normal;
  const pct = upPointerPct(roll.shown, roll.win);
  const targetAngle = pct / 100 * 360;
  const delta = ((targetAngle - UP.angle) % 360 + 360) % 360;
  const newAngle = UP.angle + 360 * cfg.turns + delta;

  UP.phase = 'spin'; UP.spin = cfg;
  renderUpgrade(v);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const ptr = document.getElementById('wheelPtr');
    if (!ptr) return;
    ptr.style.transition = 'transform ' + cfg.duration + 'ms ' + cfg.easing;
    ptr.style.transform = 'rotate(' + newAngle + 'deg)';
  }));
  UP.angle = newAngle;
  sfx.upSpin && sfx.upSpin();

  setTimeout(() => {
    UP.lastChance = roll.shown;
    upApplyResult(roll.win);
    UP.pending = null; UP.spin = null;
    UP.phase = roll.win ? 'win' : 'lose';
    UP.sel = []; UP.add = 0;
    UP.angle = ((UP.angle % 360) + 360) % 360;
    const onPage = (location.hash || '').replace('#', '') === '/upgrade';
    if (roll.win) { sfx.bigwin(); burst(110, [rarity(UP.target.key).color, '#44c987', '#ffd700']); }
    else sfx.lose();
    if (onPage) renderUpgrade(v);
  }, cfg.duration + 80);
}
function upApplyResult(win) {
  const p = UP.pending; if (!p) return;
  const ids = {}; p.items.forEach(i => { ids[i.uid] = 1; });
  state.inv = state.inv.filter(i => !ids[i.uid]);
  state.balance -= p.add;
  state.stats.upgraded = (state.stats.upgraded || 0) + 1;
  if (win) {
    const t = p.target;
    state.inv.push({ uid: uid(), key: t.key, wear: t.wear, st: t.st, sv: t.sv, value: t.val, t: Date.now() });
    state.stats.upWon = (state.stats.upWon || 0) + 1;
    state.stats.upLossStreak = 0;
    state.stats.earned += t.val;
    if (!state.stats.best || t.val > state.stats.best.value) state.stats.best = { key: t.key, value: t.val };
    liveDropAdd(t.key, t.wear, t.val);
  } else {
    state.stats.upLossStreak = (state.stats.upLossStreak || 0) + 1;
  }
  save(); syncBalance();
}

/* ============================================================
   PROFILE
   ============================================================ */
function inventoryValue() { return state.inv.reduce((s, it) => s + (it.value || 0), 0); }
function achievements() {
  const inv = state.inv.length, opened = state.stats.opened, best = state.stats.best ? state.stats.best.value : 0;
  return [
    { id: 'first', icon: '🎁', t: 'Первый кейс', d: 'Откройте свой первый кейс', done: opened >= 1 },
    { id: 'ten', icon: '📦', t: 'Коллекционер', d: 'Откройте 10 кейсов', done: opened >= 10 },
    { id: 'fifty', icon: '💰', t: 'Азартный', d: 'Откройте 50 кейсов', done: opened >= 50 },
    { id: 'inv10', icon: '🎉', t: 'Богач', d: '10 предметов в инвентаре', done: inv >= 10 },
    { id: 'best1k', icon: '💎', t: 'Ценный улов', d: 'Получите предмет дороже 1 000 ₽', done: best >= 1000 },
    { id: 'best10k', icon: '🎰', t: 'Джекпот', d: 'Получите предмет дороже 10 000 ₽', done: best >= 10000 },
    { id: 'upg', icon: '⬆️', t: 'Апгрейдер', d: 'Сделайте 5 апгрейдов', done: state.stats.upgraded >= 5 },
    { id: 'upgwin', icon: '🏆', t: 'Удачный апгрейд', d: 'Выиграйте апгрейд', done: state.stats.upWon >= 1 }
  ];
}
function renderProfile(v) {
  const ach = achievements();
  const best = state.stats.best;
  v.innerHTML =
    '<div class="page"><div class="profile">'
    + '<div class="profile-top">'
    +   '<div class="profile-avatar"><img src="assets/logo.png" style="width:100%;height:100%;object-fit:cover"></div>'
    +   '<div class="profile-user">'
    +     '<div class="profile-user-name">Гость</div>'
    +     '<div class="profile-user-sub">Гостевой режим: прогресс хранится на этом устройстве</div>'
    +     '<div class="profile-balance"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v10M9 9.5a3 3 0 013-1.5c1.6 0 3 .8 3 2s-1.4 2-3 2-3 .8-3 2 1.4 2 3 2a3 3 0 003-1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>' + money(state.balance) + '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="profile-counters">'
    +   '<div class="profile-card"><div class="profile-label">Баланс</div><div class="big">' + money(state.balance) + ' ₽</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Стоимость инвентаря</div><div class="big">' + money(inventoryValue()) + ' ₽</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Открыто кейсов</div><div class="big">' + state.stats.opened + '</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Потрачено</div><div class="big">' + money(state.stats.spent) + ' ₽</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Заработано</div><div class="big">' + money(state.stats.earned) + ' ₽</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Сделано апгрейдов</div><div class="big">' + state.stats.upgraded + '</div></div>'
    + '</div>'
    + (best
        ? '<div class="section-h">Лучший дроп</div><div class="profile-best ' + rarityClass(best.key) + '"><div class="profile-best-pic"><img src="' + img(imgOf(best.key)) + '" ' + onError + '></div><div class="profile-best-info"><div class="nm">' + esc(best.key) + '</div><div class="pr">' + money(best.value) + ' ₽</div></div></div>'
        : '')
    + '<div class="section-h">Достижения</div>'
    + '<div class="ach-grid">' + ach.map(a => '<div class="ach' + (a.done ? ' done' : '') + '"><div class="ico">' + a.icon + '</div><div><div class="t">' + esc(a.t) + '</div><div class="d">' + esc(a.d) + '</div></div></div>').join('') + '</div>'
    + '<div style="margin-top:3rem"><button class="btn btn-dark" id="resetBtn">Сбросить прогресс</button></div>'
    + '</div></div>';
  $('#resetBtn').onclick = () => {
    const m = modal(
      '<h2 style="font-family:var(--head);font-size:2.4rem;text-transform:uppercase;margin-bottom:1rem">Сбросить прогресс?</h2>'
      + '<div class="m-sub">Баланс, инвентарь и статистика будут удалены.</div>'
      + '<div style="display:flex;gap:1rem;margin-top:2rem"><button class="btn btn-dark btn-block" data-close>Отмена</button><button class="btn btn-green btn-block" id="doReset">Сбросить</button></div>');
    m.querySelector('#doReset').onclick = () => {
      state = { balance: 10000, inv: [], stats: { opened: 0, spent: 0, earned: 0, upgraded: 0, upWon: 0, best: null }, sound: state.sound };
      save(); syncBalance(); toast('Прогресс сброшен'); m.close(); location.hash = '#/cases';
    };
  };
}

/* ============================================================
   TOP UP
   ============================================================ */
function topUpModal() {
  const m = modal(
    '<div style="font-family:var(--head);font-size:2.4rem;text-transform:uppercase;margin-bottom:1rem">Пополнение</div>'
    + '<div class="m-sub" style="margin-bottom:1.6rem">Выберите способ пополнения баланса</div>'
    + '<div class="adv" id="advBox" style="padding:1.6rem;background:var(--accent-bg);border:1px solid var(--accent);border-radius:.2rem;cursor:pointer;text-align:center;margin-bottom:1.6rem;transition:.2s">'
    +   'Посмотреть рекламу<br><span style="font-size:1.2rem;opacity:.8" id="advSub">+1 000 ₽</span>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">'
    +   '<button class="btn btn-dark" data-add="5000">+5 000 ₽</button>'
    +   '<button class="btn btn-dark" data-add="25000">+25 000 ₽</button>'
    +   '<button class="btn btn-dark" data-add="100000">+100 000 ₽</button>'
    +   '<button class="btn btn-dark" data-add="1000000">+1 000 000 ₽</button>'
    + '</div>');
  $$('[data-add]', m).forEach(b => b.onclick = () => { const n = parseInt(b.dataset.add); state.balance += n; syncBalance(); save(); sfx.click(); toast('Баланс пополнен на ' + money(n) + ' ₽'); updateLacksAll(); });
  let busy = false;
  const adv = $('#advBox', m);
  adv.onclick = () => {
    if (busy) return; busy = true;
    let s = 4; const sub = $('#advSub', m);
    adv.style.pointerEvents = 'none'; adv.style.opacity = '.7';
    sub.textContent = 'Реклама… ' + s;
    const iv = setInterval(() => { s--; sub.textContent = 'Реклама… ' + s; if (s <= 0) { clearInterval(iv); state.balance += 1000; syncBalance(); save(); sfx.win(); toast('Награда: +1 000 ₽'); adv.style.opacity = ''; adv.style.pointerEvents = ''; sub.textContent = '+1 000 ₽'; busy = false; updateLacksAll(); } }, 1000);
  };
}
function updateLacksAll() {
  const h = (location.hash || '').slice(2);
  const parts = h.split('/');
  if (parts[0] === 'case' && parts[1]) { const c = CASES.find(x => x.slug === parts[1]); if (c) updateLacks(c); }
}

/* ============================================================
   MISC
   ============================================================ */
function addInv(item) {
  state.inv.push(item);
  if (state.inv.length > 500) state.inv.shift();
  syncBalance();
}

/* ---------- init ---------- */
function init() {
  load();
  if (typeof state.sound !== 'boolean') state.sound = true;
  syncBalance();
  resizeFx(); addEventListener('resize', resizeFx);

  const sndOn = $('#sndOn'), sndOff = $('#sndOff');
  if (sndOn) sndOn.style.display = state.sound ? '' : 'none';
  if (sndOff) sndOff.style.display = state.sound ? 'none' : '';
  $('#soundBtn').onclick = () => {
    state.sound = !state.sound; save();
    if (sndOn) sndOn.style.display = state.sound ? '' : 'none';
    if (sndOff) sndOff.style.display = state.sound ? 'none' : '';
    if (state.sound) sfx.click();
  };
  $('#topupBtn').onclick = topUpModal;

  liveDropInit();
  addEventListener('hashchange', route);
  route();

  const boot = $('#boot');
  if (boot) { setTimeout(() => { boot.style.opacity = '0'; setTimeout(() => boot.remove(), 500); }, 500); }
}
document.addEventListener('DOMContentLoaded', init);

})();
