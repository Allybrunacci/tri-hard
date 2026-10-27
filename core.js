/* Tri Hard — core: helpers, dates, storage, UI kit and router */
'use strict';

const APP_VERSION = '1.1.0';
const STORE_KEY = 'tri-hard:v1';
const WX_KEY = 'tri-hard:wx';
const RACE_DEFAULT = '2027-05-02';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const sum = a => a.reduce((t, n) => t + n, 0);
const round5 = n => Math.max(5, Math.round(n / 5) * 5);
const round100 = n => Math.max(100, Math.round(n / 100) * 100);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
const icon = (id, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 32 32" aria-hidden="true"><use href="#${id.startsWith('wx-') ? id : 'i-' + id}"/></svg>`;
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) { /* not supported */ } };
const cleanId = v => String(v || '').replace(/[^\w-]/g, '').slice(0, 40) || uid();
const cleanSid = v => String(v || '').replace(/[^\w:-]/g, '').slice(0, 60);

/* ---------- dates (local, as YYYY-MM-DD keys; weeks start on Monday) ---------- */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => dkey(new Date());
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);
const dayIdx = k => (fromKey(k).getDay() + 6) % 7;
const mondayOf = k => addDays(k, -dayIdx(k));
const isKey = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !isNaN(fromKey(k));
const fmtDay = k => { const d = fromKey(k); return `${DAYS[dayIdx(k)]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtShort = k => { const d = fromKey(k); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtLong = k => { const d = fromKey(k); return `${DAYS_LONG[dayIdx(k)]} ${d.getDate()} ${MON_LONG[d.getMonth()]}`; };
const fmtFull = k => { const d = fromKey(k); return `${DAYS[dayIdx(k)]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
function fmtRange(a, b) {
  const A = fromKey(a), B = fromKey(b);
  if (A.getMonth() === B.getMonth()) return `${A.getDate()}–${B.getDate()} ${MON[B.getMonth()]}`;
  return `${fmtShort(a)} – ${fmtShort(b)}`;
}
function relDay(k) {
  const t = today();
  if (k === t) return 'today';
  if (k === addDays(t, -1)) return 'yesterday';
  if (k === addDays(t, 1)) return 'tomorrow';
  return fmtDay(k);
}
const fmtDur = m => { m = Math.round(m || 0); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h ${r}m` : `${h}h`; };
const fmtHM = m => { m = Math.round(m || 0); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
const fmtDist = (km, sport) => (sport === 'swim' ? `${Math.round(km * 1000).toLocaleString('en-AU')} m` : `${km >= 100 ? Math.round(km) : (Math.round(km * 10) / 10).toFixed(1)} km`);
const fmtHour = h => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

/* ---------- sports ---------- */
const SPORTS = {
  swim: { name: 'Swim', icon: 'swim' },
  bike: { name: 'Bike', icon: 'bike' },
  run: { name: 'Run', icon: 'run' },
  brick: { name: 'Brick', icon: 'brick' },
  strength: { name: 'Strength', icon: 'strength' },
  other: { name: 'Other', icon: 'other' },
  race: { name: 'Race', icon: 'race' },
};
const LOG_SPORTS = ['swim', 'bike', 'run', 'strength', 'other'];
const badge = (sport, cls) => `<span class="badge s-${sport}${cls ? ' ' + cls : ''}" aria-hidden="true">${icon(SPORTS[sport] ? SPORTS[sport].icon : 'other')}</span>`;

const AVAIL_OPTS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 600];
const fmtAvail = m => (m <= 0 ? 'Off' : m >= 600 ? 'All day' : fmtDur(m));

/* ---------- state ---------- */
function freshState() {
  return {
    v: 1,
    created: today(),
    onboarded: false,
    name: '',
    race: { name: 'IRONMAN 70.3', date: RACE_DEFAULT, place: '', start: '06:30' },
    start: mondayOf(today()),
    base: { ride: 90, run: 45, hours: 8 },
    avail: [60, 90, 60, 90, 45, 300, 240],
    when: 'morning',
    loc: null,
    weeks: {},
    logs: [],
    strava: { id: '', secret: '', access: '', refresh: '', exp: 0, athlete: '', last: 0 },
    settings: { fx: true, heat: 28, adapt: true, checkin: true },
    kit: { done: {}, hide: {}, mine: [] },
    fuel: { bikeG: 60, bikeMl: 750, gelEvery: 30, bikeMins: 180, runMins: 135 },
    savedAt: 0,
  };
}

const FEELS = ['fresh', 'tired', 'sore', 'sick'];
const newWeek = () => ({ avail: Array(7).fill(null), note: Array(7).fill(''), feel: Array(7).fill(''), feelAt: Array(7).fill(0), at: {}, pin: {}, skip: {}, full: {}, custom: [], why: {}, mins: {} });
const EMPTY_WEEK = Object.freeze(newWeek());

function normWeek(w) {
  const o = newWeek();
  if (!w || typeof w !== 'object') return o;
  for (let i = 0; i < 7; i++) {
    const v = Array.isArray(w.avail) ? w.avail[i] : null;
    o.avail[i] = v === null || v === undefined || v === '' ? null : clamp(Math.round(+v || 0), 0, 600);
    o.note[i] = Array.isArray(w.note) ? String(w.note[i] || '').slice(0, 60) : '';
    o.feel[i] = Array.isArray(w.feel) && FEELS.includes(w.feel[i]) ? w.feel[i] : '';
    o.feelAt[i] = o.feel[i] && Array.isArray(w.feelAt) ? Math.max(0, Math.round(+w.feelAt[i] || 0)) : 0;
  }
  if (w.at && typeof w.at === 'object') for (const [k, d] of Object.entries(w.at)) { const n = Math.round(+d); if (n >= 0 && n <= 6) o.at[cleanSid(k)] = n; }
  for (const f of ['pin', 'skip', 'full']) if (w[f] && typeof w[f] === 'object') for (const [k, v] of Object.entries(w[f])) if (v) o[f][cleanSid(k)] = 1;
  if (w.why && typeof w.why === 'object') for (const [k, v] of Object.entries(w.why)) o.why[cleanSid(k)] = String(v || '').slice(0, 140);
  if (w.mins && typeof w.mins === 'object') for (const [k, v] of Object.entries(w.mins)) { const n = Math.round(+v); if (n >= 5 && n <= 600) o.mins[cleanSid(k)] = n; }
  if (Array.isArray(w.custom)) {
    o.custom = w.custom.filter(c => c && typeof c === 'object').slice(0, 20).map(c => ({
      id: cleanId(c.id),
      sport: LOG_SPORTS.includes(c.sport) ? c.sport : 'other',
      title: String(c.title || 'My session').slice(0, 50),
      mins: clamp(Math.round(+c.mins || 30), 5, 600),
    }));
  }
  return o;
}

function normLog(l) {
  return {
    id: cleanId(l.id),
    src: ['manual', 'strava', 'plan'].includes(l.src) ? l.src : 'manual',
    ext: String(l.ext || '').replace(/[^\w-]/g, '').slice(0, 30),
    d: isKey(l.d) ? l.d : today(),
    at: /^\d{2}:\d{2}$/.test(l.at || '') ? l.at : '',
    sport: LOG_SPORTS.includes(l.sport) ? l.sport : 'other',
    mins: clamp(Math.round(+l.mins || 0), 0, 1440),
    km: clamp(Math.round((+l.km || 0) * 1000) / 1000, 0, 1000),
    name: String(l.name || '').slice(0, 80),
    rpe: clamp(Math.round(+l.rpe || 0), 0, 10),
    hr: clamp(Math.round(+l.hr || 0), 0, 250),
    sid: cleanSid(l.sid || ''),
    fixed: !!l.fixed,
    note: String(l.note || '').slice(0, 500),
    fuel: ['good', 'gut', 'low'].includes(l.fuel) ? l.fuel : '',
    fuelWhat: String(l.fuelWhat || '').slice(0, 120),
    t: +l.t || Date.now(),
  };
}

function migrate(d) {
  const s = freshState();
  if (!d || typeof d !== 'object') return s;
  s.created = isKey(d.created) ? d.created : s.created;
  s.onboarded = !!d.onboarded;
  s.name = String(d.name || '').slice(0, 40);
  const r = d.race && typeof d.race === 'object' ? d.race : {};
  s.race.name = String(r.name || s.race.name).slice(0, 50);
  s.race.date = isKey(r.date) ? r.date : s.race.date;
  s.race.place = String(r.place || '').slice(0, 50);
  s.race.start = /^([01]\d|2[0-3]):[0-5]\d$/.test(r.start || '') ? r.start : s.race.start;
  s.start = isKey(d.start) ? mondayOf(d.start) : s.start;
  if (s.start > mondayOf(s.race.date)) s.start = mondayOf(s.race.date);
  const b = d.base && typeof d.base === 'object' ? d.base : {};
  s.base.ride = clamp(Math.round(+b.ride || 90), 20, 300);
  s.base.run = clamp(Math.round(+b.run || 45), 10, 180);
  s.base.hours = [6, 8, 10, 12].includes(+b.hours) ? +b.hours : 8;
  if (Array.isArray(d.avail) && d.avail.length === 7) s.avail = d.avail.map(v => clamp(Math.round(+v || 0), 0, 600));
  s.when = ['morning', 'evening', 'any'].includes(d.when) ? d.when : 'morning';
  if (d.loc && typeof d.loc === 'object' && isFinite(+d.loc.lat) && isFinite(+d.loc.lon)) {
    s.loc = { name: String(d.loc.name || 'My spot').slice(0, 60), lat: clamp(+d.loc.lat, -90, 90), lon: clamp(+d.loc.lon, -180, 180) };
  }
  if (d.weeks && typeof d.weeks === 'object') for (const [k, w] of Object.entries(d.weeks)) if (isKey(k)) s.weeks[mondayOf(k)] = normWeek(w);
  s.logs = Array.isArray(d.logs) ? d.logs.filter(l => l && typeof l === 'object').map(normLog) : [];
  const st = d.strava && typeof d.strava === 'object' ? d.strava : {};
  s.strava.id = String(st.id || '').replace(/\D/g, '').slice(0, 12);
  s.strava.secret = String(st.secret || '').replace(/[^\w]/g, '').slice(0, 64);
  s.strava.access = String(st.access || '').replace(/[^\w]/g, '').slice(0, 80);
  s.strava.refresh = String(st.refresh || '').replace(/[^\w]/g, '').slice(0, 80);
  s.strava.exp = +st.exp || 0;
  s.strava.athlete = String(st.athlete || '').slice(0, 60);
  s.strava.last = +st.last || 0;
  const se = d.settings && typeof d.settings === 'object' ? d.settings : {};
  s.settings.fx = se.fx !== false;
  s.settings.heat = clamp(Math.round(+se.heat || 28), 22, 38);
  s.settings.adapt = se.adapt !== false;
  s.settings.checkin = se.checkin !== false;
  const kit = d.kit && typeof d.kit === 'object' ? d.kit : {};
  const keys = o => (o && typeof o === 'object' ? Object.keys(o).filter(k => o[k]).map(k => k.replace(/[^\w-]/g, '').slice(0, 40)).filter(Boolean) : []);
  for (const k of keys(kit.done)) s.kit.done[k] = 1;
  for (const k of keys(kit.hide)) s.kit.hide[k] = 1;
  if (Array.isArray(kit.mine)) {
    s.kit.mine = kit.mine.filter(m => m && typeof m === 'object' && String(m.t || '').trim()).slice(0, 40)
      .map(m => ({ id: cleanId(m.id), t: String(m.t).trim().slice(0, 60) }));
  }
  const fu = d.fuel && typeof d.fuel === 'object' ? d.fuel : {};
  const step = (v, by, def, lo, hi) => clamp(Math.round((+v || def) / by) * by, lo, hi);
  s.fuel = {
    bikeG: step(fu.bikeG, 10, 60, 30, 120),
    bikeMl: step(fu.bikeMl, 50, 750, 300, 1500),
    gelEvery: step(fu.gelEvery, 5, 30, 15, 60),
    bikeMins: step(fu.bikeMins, 5, 180, 90, 480),
    runMins: step(fu.runMins, 5, 135, 60, 360),
  };
  s.savedAt = +d.savedAt || 0;
  return s;
}

let S = freshState();
let REV = 0;
let SAVE_OK = true;

function load() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { SAVE_OK = false; }
  if (!raw) return freshState();
  try {
    return migrate(JSON.parse(raw));
  } catch (e) {
    try { localStorage.setItem(`${STORE_KEY}:unreadable-${Date.now()}`, raw); } catch (_) { /* full */ }
    return freshState();
  }
}

function save() {
  REV++;
  S.savedAt = Date.now();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
    SAVE_OK = true;
  } catch (e) {
    SAVE_OK = false;
    toast('Couldn’t save on this device. Storage may be full — try a backup in Settings.', { ms: 6000 });
  }
}

function replaceState(next) { S = next; REV++; }

// The week's saved choices, created when first changed.
const weekRead = k => S.weeks[k] || EMPTY_WEEK;
const weekEdit = k => S.weeks[k] || (S.weeks[k] = normWeek(null));

/* ---------- derived data, rebuilt whenever anything changes ---------- */
let C = { rev: -1 };
function calc() {
  if (C.rev === REV) return C;
  const bySid = {}, byDay = {};
  for (const l of S.logs) {
    if (l.sid) (bySid[l.sid] || (bySid[l.sid] = [])).push(l);
    (byDay[l.d] || (byDay[l.d] = [])).push(l);
  }
  C = { rev: REV, bySid, byDay, memo: {} };
  return C;
}
function memo(key, fn) {
  const m = calc().memo;
  return key in m ? m[key] : (m[key] = fn());
}
const logsFor = sid => calc().bySid[sid] || [];
const logsOn = d => calc().byDay[d] || [];

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg, opts = {}) {
  const root = $('#toast-root');
  clearTimeout(toastTimer);
  root.innerHTML = '';
  const action = opts.action || (opts.undo ? { label: 'Undo', fn: opts.undo } : null);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${msg}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  root.append(el);
  const hide = () => { clearTimeout(toastTimer); el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  toastTimer = setTimeout(hide, opts.ms || (action ? 6500 : 3200));
  if (action) el.querySelector('button').addEventListener('click', () => { hide(); action.fn(); });
  return hide;
}

/* ---------- celebrations ---------- */
const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const fxOn = () => S.settings.fx && !reduceMotion();
const PALETTE = ['#003049', '#D62828', '#F77F00', '#FCBF49', '#EAE2B7'];

function confetti(n = 70) {
  if (!fxOn()) return;
  const root = $('#fx-root');
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    const w = 7 + Math.random() * 7;
    p.style.left = `${Math.random() * 100}vw`;
    p.style.width = `${w}px`;
    p.style.height = `${w * (Math.random() < 0.5 ? 1 : 1.8)}px`;
    p.style.background = PALETTE[i % PALETTE.length];
    p.style.borderRadius = Math.random() < 0.35 ? '50%' : '2px';
    p.style.setProperty('--dx', `${Math.random() * 200 - 100}px`);
    p.style.setProperty('--rot', `${Math.random() * 1000 - 500}deg`);
    p.style.setProperty('--dur', `${1.9 + Math.random() * 1.5}s`);
    p.style.setProperty('--delay', `${Math.random() * 0.45}s`);
    root.append(p);
    setTimeout(() => p.remove(), 4200);
  }
}

function popAt(el, text) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'pop';
  p.style.left = `${r.left + r.width / 2}px`;
  p.style.top = `${r.top}px`;
  p.textContent = text;
  $('#fx-root').append(p);
  setTimeout(() => p.remove(), 1100);
}

/* ---------- bottom sheets ---------- */
let SHEET = null;
function openSheet(html, opts = {}) {
  closeSheet(true);
  const root = $('#sheet-root');
  const back = document.createElement('div');
  back.className = 'backdrop';
  const el = document.createElement('div');
  el.className = 'sheet' + (opts.cls ? ' ' + opts.cls : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  if (opts.label) el.setAttribute('aria-label', opts.label);
  el.tabIndex = -1;
  root.append(back, el);
  document.body.classList.add('locked');
  const sh = {
    el, back, opts, closed: false,
    close: () => closeSheet(),
    set(content) {
      const top = el.scrollTop;
      el.innerHTML = `<div class="grab"></div>${content}`;
      el.scrollTop = top;
    },
  };
  sh.set(html);
  SHEET = sh;
  back.addEventListener('click', () => closeSheet());
  el.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { e.preventDefault(); closeSheet(); return; }
    const a = e.target.closest('[data-act]');
    if (a && opts.act && opts.act[a.dataset.act] && !a.disabled) { e.preventDefault(); opts.act[a.dataset.act](a, e, sh); }
  });
  if (opts.input) el.addEventListener('input', e => opts.input(e, sh));
  if (opts.change) el.addEventListener('change', e => opts.change(e, sh));
  el.addEventListener('submit', e => { e.preventDefault(); if (opts.submit) opts.submit(e, sh); });
  el.focus({ preventScroll: true });
  if (opts.onOpen) opts.onOpen(sh);
  return sh;
}

function closeSheet(instant) {
  const sh = SHEET;
  if (!sh) return;
  SHEET = null;
  sh.closed = true;
  document.body.classList.remove('locked');
  if (sh.opts.onClose) sh.opts.onClose(sh);
  if (instant) { sh.el.remove(); sh.back.remove(); return; }
  sh.el.classList.add('closing');
  sh.back.classList.add('closing');
  setTimeout(() => { sh.el.remove(); sh.back.remove(); }, 230);
}

const sheetHead = (title, sub) => `<div class="sheet-head"><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>`;

function confirmSheet({ title, body, yes = 'Yes', no = 'Cancel', danger = false, onYes }) {
  openSheet(`${sheetHead(title)}<p class="lead">${body}</p>
    <div class="btn-row"><button type="button" class="btn ghost" data-close>${no}</button><button type="button" class="btn ${danger ? 'red' : 'orange'}" data-act="yes">${yes}</button></div>`,
  { label: title, act: { yes: (a, e, sh) => { sh.close(); onYes(); } } });
}

/* ---------- small form widgets ---------- */
function stepper(name, val, label, shown) {
  return `<div class="stepper" role="group" aria-label="${esc(label || name)}">
    <button type="button" data-act="step" data-name="${name}" data-d="-1" aria-label="Less">${icon('minus')}</button>
    <output aria-live="polite">${shown != null ? shown : val}</output>
    <button type="button" data-act="step" data-name="${name}" data-d="1" aria-label="More">${icon('plus')}</button></div>`;
}
const seg = (items, cur, act, cls) => `<div class="seg${cls ? ' ' + cls : ''}" role="radiogroup">${items.map(([v, l]) => `<button type="button" role="radio" class="${String(v) === String(cur) ? 'on' : ''}" aria-checked="${String(v) === String(cur)}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
const switchRow = (name, title, sub, on) => `<label class="switch-row"><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="switch"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><span></span></span></label>`;
const sectionTitle = (title, hand) => `<div class="section-title"><h2>${title}</h2>${hand ? `<span class="hand">${hand}</span>` : ''}</div>`;
const stripes = () => '<span class="stripes" aria-hidden="true"><i></i><i></i><i></i></span>';

/* ---------- router ---------- */
const VIEWS = {};
const UI = { week: null, planOpen: null, logLimit: 40, progRange: 12, feelEdit: false };
let CUR = null;

function routeName() {
  const r = (location.hash || '').replace(/^#\/?/, '').split(/[?/]/)[0];
  return VIEWS[r] ? r : 'week';
}

function render(fresh) {
  const name = routeName();
  if (name !== CUR) fresh = true;
  CUR = name;
  const v = VIEWS[name];
  const view = $('#view');
  const y = window.scrollY;
  view.classList.remove('view-in');
  view.innerHTML = v.render();
  if (fresh) {
    void view.offsetWidth;
    view.classList.add('view-in');
    window.scrollTo(0, 0);
  } else window.scrollTo(0, y);
  if (v.after) v.after(view);
  for (const t of $$('.tab')) {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  }
  paintSync();
  document.title = name === 'week' ? 'Tri Hard' : `${v.title} · Tri Hard`;
}

const GLOBAL_ACT = {
  settings: () => openSettings(),
  sync: () => syncNow(),
};

function onViewClick(e) {
  const a = e.target.closest('[data-act]');
  if (!a || a.disabled || !$('#view').contains(a)) return;
  const v = VIEWS[CUR];
  const fn = (v && v.act && v.act[a.dataset.act]) || GLOBAL_ACT[a.dataset.act];
  if (fn) { e.preventDefault(); fn(a, e); }
}

let DAY = null;
function checkDay() {
  const t = today();
  if (t === DAY) return;
  DAY = t;
  UI.week = null;
  UI.feelEdit = false;
  REV++;
  if (!SHEET && !DRAG_ACTIVE()) render();
}

function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}

function askPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
  } catch (e) { /* not supported */ }
}

function boot() {
  replaceState(load());
  wxLoad();
  DAY = today();
  $('#view').addEventListener('click', onViewClick);
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (a && GLOBAL_ACT[a.dataset.action]) { e.preventDefault(); GLOBAL_ACT[a.dataset.action](a, e); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && SHEET) { closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('hashchange', () => { closeSheet(true); render(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    checkDay();
    autoRefresh();
  });
  setInterval(checkDay, 30000);
  window.addEventListener('storage', e => {
    if (e.key !== STORE_KEY) return;
    replaceState(load());
    if (!SHEET) render();
  });
  initDrag();
  const oauth = handleOAuthReturn();
  render(true);
  if (!S.onboarded && !oauth) startOnboarding();
  else { askPersist(); autoRefresh(); }
  registerSW();
}

// Fresh weather and Strava activities when the app opens (at most every few minutes).
let LAST_AUTO = 0;
function autoRefresh() {
  if (!S.onboarded || Date.now() - LAST_AUTO < 3 * 60e3) return;
  LAST_AUTO = Date.now();
  if (S.loc) wxFetch().then(w => { if (w && !SHEET && !DRAG_ACTIVE()) render(); }).catch(() => {});
  if (stravaConnected() && Date.now() - S.strava.last > 15 * 60e3) {
    stravaSync().then(r => { if (r && (r.added || r.updated)) { if (!SHEET && !DRAG_ACTIVE()) render(); toast(syncMsg(r)); } }).catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
