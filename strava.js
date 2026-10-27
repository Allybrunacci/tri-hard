/* Tri Hard — Strava: connect, keep the sign-in fresh and bring in your activities.
   Garmin watches sync to Strava automatically once the two are linked in the Garmin Connect app. */
'use strict';

const STRAVA = { auth: 'https://www.strava.com/oauth/authorize', token: 'https://www.strava.com/oauth/token', api: 'https://www.strava.com/api/v3' };
const OAUTH_KEY = 'tri-hard:oauth';
let SYNCING = false;

const redirectUri = () => location.origin + location.pathname;
const stravaReady = () => !!(S.strava.id && S.strava.secret);
const stravaConnected = () => !!(S.strava.refresh && stravaReady());

function stravaConnect() {
  if (!stravaReady()) { toast('Add your Strava Client ID and Secret first'); return; }
  const state = uid();
  try { localStorage.setItem(OAUTH_KEY, state); } catch (e) { /* blocked */ }
  const q = new URLSearchParams({ client_id: S.strava.id, response_type: 'code', redirect_uri: redirectUri(), approval_prompt: 'auto', scope: 'read,activity:read_all', state });
  location.href = `${STRAVA.auth}?${q}`;
}

async function stravaToken(body) {
  const res = await fetch(STRAVA.token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const bad = (j.errors || []).map(e => `${e.field} ${e.code}`).join(', ');
    throw new Error(res.status === 400 || res.status === 401 ? `Strava didn’t accept that${bad ? ` (${bad})` : ''}. Check the Client ID and Secret, then connect again.` : `Strava said ${res.status}`);
  }
  return j;
}

function setTokens(j) {
  S.strava.access = j.access_token || '';
  S.strava.refresh = j.refresh_token || S.strava.refresh;
  S.strava.exp = +j.expires_at || 0;
}

async function stravaExchange(code) {
  const j = await stravaToken({ client_id: S.strava.id, client_secret: S.strava.secret, code, grant_type: 'authorization_code' });
  setTokens(j);
  if (j.athlete) S.strava.athlete = [j.athlete.firstname, j.athlete.lastname].filter(Boolean).join(' ');
  S.strava.last = 0;
  save();
}

async function stravaAccess() {
  if (S.strava.access && S.strava.exp > Date.now() / 1000 + 120) return S.strava.access;
  const j = await stravaToken({ client_id: S.strava.id, client_secret: S.strava.secret, grant_type: 'refresh_token', refresh_token: S.strava.refresh });
  setTokens(j);
  save();
  return S.strava.access;
}

function stravaSport(t) {
  if (t === 'Swim') return 'swim';
  if (['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'Velomobile', 'Handcycle'].includes(t)) return 'bike';
  if (['Run', 'TrailRun', 'VirtualRun'].includes(t)) return 'run';
  if (['WeightTraining', 'Workout', 'Crossfit', 'Yoga', 'Pilates', 'HighIntensityIntervalTraining'].includes(t)) return 'strength';
  return 'other';
}

async function stravaSync() {
  if (!stravaConnected() || SYNCING) return null;
  SYNCING = true;
  paintSync();
  try {
    const tok = await stravaAccess();
    const floor = Math.floor(fromKey(addDays(S.start, -42)).getTime() / 1000);
    const since = S.strava.last ? Math.max(floor, Math.floor(S.strava.last / 1000) - 3 * 86400) : floor;
    let all = [];
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(`${STRAVA.api}/athlete/activities?after=${since}&per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${tok}` } });
      if (res.status === 429) throw new Error('Strava’s busy. Try again in 15 minutes.');
      if (res.status === 401) { S.strava.access = ''; save(); throw new Error('Strava needs you to connect again (Settings, Strava).'); }
      if (!res.ok) throw new Error(`Strava said ${res.status}`);
      const arr = await res.json();
      all = all.concat(Array.isArray(arr) ? arr : []);
      if (!Array.isArray(arr) || arr.length < 100) break;
    }
    const r = importActivities(all);
    S.strava.last = Date.now();
    save();
    return r;
  } finally {
    SYNCING = false;
    paintSync();
  }
}

// Adds or updates Strava activities, swaps out quick ticks they replace, then matches them to your plan.
function importActivities(list) {
  const r = { added: 0, updated: 0, replaced: 0 };
  const weeks = new Set();
  for (const a of list) {
    if (!a || !a.id) continue;
    const ext = String(a.id);
    const loc = String(a.start_date_local || a.start_date || '');
    const d = loc.slice(0, 10);
    if (!isKey(d)) continue;
    const entry = {
      src: 'strava', ext, d, at: loc.slice(11, 16), sport: stravaSport(a.sport_type || a.type),
      mins: Math.round((a.moving_time || a.elapsed_time || 0) / 60), km: (a.distance || 0) / 1000,
      name: a.name || '', hr: a.average_heartrate || 0,
    };
    const old = S.logs.find(l => l.src === 'strava' && l.ext === ext);
    if (old) {
      const next = normLog(Object.assign({}, old, entry));
      if (JSON.stringify(next) !== JSON.stringify(old)) { Object.assign(old, next); r.updated++; weeks.add(mondayOf(d)); }
      continue;
    }
    let sid = '', fixed = false;
    const tick = S.logs.findIndex(l => l.src === 'plan' && l.d === d && l.sport === entry.sport);
    if (tick >= 0) { sid = S.logs[tick].sid; fixed = !!sid; S.logs.splice(tick, 1); r.replaced++; }
    S.logs.push(normLog(Object.assign({ id: uid(), t: Date.now(), sid, fixed }, entry)));
    r.added++;
    weeks.add(mondayOf(d));
  }
  REV++;
  autoMatch([...weeks]);
  return r;
}

function syncMsg(r) {
  if (!r) return '';
  if (!r.added && !r.updated) return 'Strava’s up to date';
  const bits = [];
  if (r.added) bits.push(`${plural(r.added, 'new activity', 'new activities')}`);
  if (r.updated) bits.push(`${r.updated} updated`);
  return `From Strava: ${bits.join(', ')}${r.replaced ? `, replacing ${plural(r.replaced, 'quick tick')}` : ''}`;
}

function syncNow() {
  if (!stravaConnected()) { openSettings('strava'); return; }
  stravaSync()
    .then(r => { render(); toast(syncMsg(r)); })
    .catch(e => toast(esc(e.message)));
}

function paintSync() {
  const b = $('.sync-btn');
  if (!b) return;
  b.hidden = !stravaConnected();
  b.classList.toggle('spin', SYNCING);
  b.title = S.strava.last ? `Last synced ${new Date(S.strava.last).toLocaleString('en-AU', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Sync with Strava';
}

// Strava sends you back here with ?code=… after you approve.
function handleOAuthReturn() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return false;
  const code = q.get('code') || '', err = q.get('error'), state = q.get('state'), scope = q.get('scope') || '';
  history.replaceState(null, '', location.pathname + (location.hash || '#/week'));
  if (err) { setTimeout(() => toast('Strava connection cancelled'), 300); return true; }
  let expect = null;
  try { expect = localStorage.getItem(OAUTH_KEY); } catch (e) { /* blocked */ }
  if (!stravaReady() || !expect) { setTimeout(() => showCodeSheet(code), 300); return true; }
  if (state !== expect) { setTimeout(() => toast('That Strava sign-in didn’t match. Try Connect again.'), 300); return true; }
  if (!scope.includes('activity:read')) { setTimeout(() => toast('Please allow “View data about your activities” so your workouts can come in.', { ms: 6000 }), 300); return true; }
  try { localStorage.removeItem(OAUTH_KEY); } catch (e) { /* blocked */ }
  finishConnect(code);
  return true;
}

function finishConnect(code) {
  toast('Connecting to Strava…');
  stravaExchange(code)
    .then(() => stravaSync())
    .then(r => { render(); toast(`Connected to Strava${S.strava.athlete ? ` as ${esc(S.strava.athlete)}` : ''}! ${r && r.added ? syncMsg(r) : ''}`, { ms: 5000 }); confetti(40); })
    .catch(e => toast(esc(e.message), { ms: 6000 }));
}

// iPhone Home Screen apps sometimes open the Strava sign-in in a separate browser that can't see the app's settings.
function showCodeSheet(code) {
  openSheet(`${sheetHead('Almost connected')}
    <p class="lead">This page opened outside Tri Hard, so it can’t finish connecting here. Copy this code, open Tri Hard from your Home Screen, then go to <b>Settings › Strava › Paste a code</b>.</p>
    <div class="code-box"><code>${esc(code)}</code></div>
    <div class="btn-row"><button type="button" class="btn orange" data-act="copy">${icon('check')} Copy code</button></div>
    <p class="hint">Codes only work once and expire after a few minutes.</p>`, {
    label: 'Finish connecting Strava',
    act: {
      copy() {
        const done = () => toast('Copied. Now open Tri Hard from your Home Screen.');
        if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => toast('Press and hold the code to copy it'));
        else toast('Press and hold the code to copy it');
      },
    },
  });
}

function stravaPasteCode(text) {
  let code = String(text || '').trim();
  const m = code.match(/[?&]code=([\w]+)/);
  if (m) code = m[1];
  if (!/^\w{10,}$/.test(code)) { toast('That doesn’t look like a Strava code'); return; }
  closeSheet();
  finishConnect(code);
}

function stravaDisconnect() {
  const tok = S.strava.access;
  if (tok) fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }).catch(() => {});
  Object.assign(S.strava, { access: '', refresh: '', exp: 0, athlete: '', last: 0 });
  save();
}
