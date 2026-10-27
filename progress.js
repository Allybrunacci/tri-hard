/* Tri Hard — Progress: your engine, race readiness and milestones */
'use strict';

const SPORT_LOAD = { swim: 1, bike: 0.85, run: 1.1, strength: 0.6, other: 0.5 };
const EFFORT_LOAD = { easy: 0.9, recovery: 0.75, mixed: 1.05, steady: 1.15, race: 1.2 };
const loadOf = l => l.mins * (SPORT_LOAD[l.sport] || 0.5) * (l.rpe ? 0.5 + l.rpe / 10 : 1);

function plannedDayLoads() {
  return memo('pdl', () => {
    const out = {};
    for (const w of plan().weeks) {
      let tot = 0;
      for (const s of w.sessions) {
        if (s.sport === 'race') continue;
        const ef = EFFORT_LOAD[s.effort] || 1;
        if (s.parts) for (const p of s.parts) tot += p.mins * SPORT_LOAD[p.sport] * ef;
        else tot += s.mins * (SPORT_LOAD[s.sport] || 0.5) * ef;
      }
      for (let i = 0; i < 7; i++) out[addDays(w.key, i)] = tot / 7;
    }
    return out;
  });
}

// Fitness (6-week average load), fatigue (1-week average) and form (the difference).
function engineSeries() {
  return memo('engine', () => {
    const t = today(), P = plan(), pdl = plannedDayLoads();
    const from = addDays(P.start, -42), end = S.race.date;
    let ctl = 0, atl = 0, pctl = 0;
    const you = [], planLine = [];
    for (let k = from; k <= end; k = addDays(k, 1)) {
      if (k <= t) {
        const load = sum(logsOn(k).map(loadOf));
        ctl += (load - ctl) / 42;
        atl += (load - atl) / 7;
      }
      const pl = k < P.start ? (logsOn(k).length ? sum(logsOn(k).map(loadOf)) : 0) : pdl[k] || 0;
      pctl += (pl - pctl) / 42;
      if (k >= P.start) {
        if (k <= t) you.push({ k, ctl, atl });
        planLine.push({ k, ctl: pctl });
      }
    }
    return { you, plan: planLine };
  });
}

function engineChart() {
  const E = engineSeries(), P = plan();
  const W = 340, H = 170, L = 8, R = 8, T = 14, B = 22, ph = H - T - B;
  const n = E.plan.length;
  if (n < 2) return '';
  const top = Math.max(10, ...E.plan.map(p => p.ctl), ...E.you.map(p => Math.max(p.ctl, p.atl))) * 1.1;
  const x = i => L + i * (W - L - R) / (n - 1);
  const y = v => T + ph * (1 - v / top);
  const pts = (arr, f) => arr.map((p, i) => `${x(i).toFixed(1)},${y(p[f]).toFixed(1)}`).join(' ');
  let g = `<polyline points="${pts(E.plan, 'ctl')}" class="eng-plan"/>`;
  if (E.you.length > 1) {
    const area = `${x(0).toFixed(1)},${y(0)} ${pts(E.you, 'ctl')} ${x(E.you.length - 1).toFixed(1)},${y(0)}`;
    g += `<polygon points="${area}" class="eng-area"/><polyline points="${pts(E.you, 'atl')}" class="eng-atl"/><polyline points="${pts(E.you, 'ctl')}" class="eng-ctl"/>`;
  }
  if (E.you.length) { const i = E.you.length - 1; g += `<circle cx="${x(i).toFixed(1)}" cy="${y(E.you[i].ctl).toFixed(1)}" r="4.5" class="eng-now"/>`; }
  g += `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" class="axis"/>`;
  g += `<g transform="translate(${x(n - 1) - 6} ${T - 2})"><path d="M0 0v-12" stroke="#003049" stroke-width="2"/><path d="M0-12h9l-2.5 3 2.5 3H0z" fill="#D62828"/></g>`;
  let lab = '', last = -1;
  E.plan.forEach((p, i) => { const d = fromKey(p.k); if (d.getDate() === 1 && d.getMonth() !== last) { lab += `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="mt">${MON[d.getMonth()]}</text>`; last = d.getMonth(); } });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Your fitness and fatigue over time, against where the plan takes you">${g}${lab}</svg>`;
}

function stats() {
  return memo('stats', () => {
    const P = plan(), t = today();
    const logs = S.logs.filter(l => l.d >= addDays(P.start, -42) && l.d <= t);
    const c = { mins: 0, sessions: 0, maxRide: 0, maxRideKm: 0, maxRun: 0, maxRunKm: 0, maxSwimKm: 0, swimKm: 0, bricks: 0, maxWeek: 0, streak: 0 };
    const recent = addDays(t, -42);
    c.recent = { ride: 0, run: 0, swimKm: 0, swim: 0 };
    for (const l of logs) {
      if (l.d < P.start) continue;
      c.mins += l.mins;
      if (l.sid) c.sessions++;
      if (l.sport === 'bike') { c.maxRide = Math.max(c.maxRide, l.mins); c.maxRideKm = Math.max(c.maxRideKm, l.km); }
      if (l.sport === 'run') { c.maxRun = Math.max(c.maxRun, l.mins); c.maxRunKm = Math.max(c.maxRunKm, l.km); }
      if (l.sport === 'swim') { c.maxSwimKm = Math.max(c.maxSwimKm, l.km); c.swimKm += l.km; }
    }
    for (const l of logs) {
      if (l.d < recent) continue;
      if (l.sport === 'bike') c.recent.ride = Math.max(c.recent.ride, l.mins);
      if (l.sport === 'run') c.recent.run = Math.max(c.recent.run, l.mins);
      if (l.sport === 'swim') { c.recent.swimKm = Math.max(c.recent.swimKm, l.km); c.recent.swim = Math.max(c.recent.swim, l.mins); }
    }
    const days = new Set(logs.filter(l => l.sport === 'bike').map(l => l.d));
    c.bricks = new Set(logs.filter(l => l.sport === 'run' && days.has(l.d)).map(l => l.d)).size;
    const done = [];
    for (const w of P.weeks) {
      if (addDays(w.key, 6) >= t) break;
      const tot = weekTotals(w.key);
      c.maxWeek = Math.max(c.maxWeek, tot.done);
      done.push(tot.plan ? tot.done / tot.plan : 1);
    }
    c.weeksDone = done.length;
    c.consistency = done.length ? Math.round(100 * sum(done.slice(-4).map(v => Math.min(1, v))) / Math.min(4, done.length)) : null;
    for (let i = done.length - 1; i >= 0 && done[i] >= 0.8; i--) c.streak++;
    return c;
  });
}

const BADGES = [
  { title: 'First one done', sub: 'Your first session', icon: 'check', test: c => c.sessions >= 1 },
  { title: 'First brick', sub: 'Run off the bike', icon: 'brick', test: c => c.bricks >= 1 },
  { title: '2-hour ride', sub: '120 min in the saddle', icon: 'bike', test: c => c.maxRide >= 120 },
  { title: '90-minute run', sub: 'Serious time on feet', icon: 'run', test: c => c.maxRun >= 90 },
  { title: 'Race-distance swim', sub: '1.9 km in one go', icon: 'swim', test: c => c.maxSwimKm >= 1.9 },
  { title: '3-hour ride', sub: 'Race-day ready', icon: 'bike', test: c => c.maxRide >= 180 },
  { title: '90 km ride', sub: 'The full bike leg', icon: 'route', test: c => c.maxRideKm >= 90 },
  { title: 'Half marathon', sub: '21.1 km run', icon: 'route', test: c => c.maxRunKm >= 21.1 },
  { title: '10-hour week', sub: 'A big one', icon: 'clock', test: c => c.maxWeek >= 600 },
  { title: 'On a roll', sub: '4 strong weeks in a row', icon: 'bolt', test: c => c.streak >= 4 },
];

function gauge(label, have, need, fmt, cls) {
  const pct = need ? clamp(have / need, 0, 1) : 0;
  return `<div class="gauge ${cls}"><div class="g-top"><b>${label}</b><span>${have ? fmt(have) : '–'} <small>of ${fmt(need)}</small></span></div>
    <div class="g-bar"><i style="width:${(pct * 100).toFixed(0)}%"></i></div></div>`;
}

const weeksHaveOther = () => plan().weeks.filter(w => w.key <= mondayOf(today())).slice(-8).some(w => (weekTotals(w.key).by.other || {}).done);

function lastWeeksChart() {
  const P = plan(), t = today();
  const weeks = P.weeks.filter(w => w.key <= mondayOf(t)).slice(-8);
  if (!weeks.length) return '';
  const W = 340, H = 150, L = 24, R = 4, T = 10, B = 22, ph = H - T - B;
  const tots = weeks.map(w => weekTotals(w.key));
  const top = niceTop(Math.max(...tots.map(o => Math.max(o.plan, o.done))) / 60);
  const bw = (W - L - R) / weeks.length, gap = bw * 0.28;
  let g = '';
  for (const fr of [0.5, 1]) g += `<line x1="${L}" x2="${W - R}" y1="${(T + ph * (1 - fr)).toFixed(1)}" y2="${(T + ph * (1 - fr)).toFixed(1)}" class="grid"/><text x="${L - 5}" y="${(T + ph * (1 - fr) + 3.5).toFixed(1)}" class="yl">${top * fr}h</text>`;
  weeks.forEach((w, i) => {
    const x0 = L + i * bw + gap / 2, wd = bw - gap;
    const o = tots[i];
    const hp = ph * (o.plan / 60) / top;
    g += `<rect x="${x0.toFixed(1)}" y="${(T + ph - hp).toFixed(1)}" width="${wd.toFixed(1)}" height="${hp.toFixed(1)}" rx="3" class="plan-box"/>`;
    let yy = T + ph;
    for (const s of SPORT_ORDER) {
      const m = o.by[s] ? o.by[s].done : 0;
      if (!m) continue;
      const h = ph * (m / 60) / top;
      yy -= h;
      g += `<rect x="${(x0 + 3).toFixed(1)}" y="${yy.toFixed(1)}" width="${(wd - 6).toFixed(1)}" height="${h.toFixed(1)}" fill="${SPORT_COL[s]}"/>`;
    }
    g += `<text x="${(x0 + wd / 2).toFixed(1)}" y="${H - 6}" class="mt">${w.key === mondayOf(t) ? 'Now' : `W${w.i + 1}`}</text>`;
  });
  g += `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" class="axis"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Hours done each week by sport, inside the planned hours">${g}</svg>`;
}

VIEWS.progress = {
  title: 'Progress',
  render() {
    const c = stats(), P = plan(), E = engineSeries();
    const last = E.you[E.you.length - 1];
    let html = `<div class="page-head"><h1>Progress</h1>${stripes()}</div>`;
    if (!S.logs.length) {
      html += `<div class="card empty">${icon('progress', 'big')}<h3>Your progress shows up here</h3><p>Tick off sessions on the Week page, log them, or connect Strava. Your fitness, race readiness and badges will build as you train.</p></div>`;
    }
    html += `<div class="tiles">
      <div class="tile t-navy"><small>Hours trained</small><b>${fmtHM(c.mins)}</b><span>since ${fmtShort(P.start)}</span></div>
      <div class="tile t-red"><small>Sessions done</small><b>${c.sessions}</b><span>from your plan</span></div>
      <div class="tile t-orange"><small>Longest ride</small><b>${c.maxRide ? fmtHM(c.maxRide) : '–'}</b><span>${c.maxRideKm ? fmtDist(c.maxRideKm, 'bike') : 'so far'}</span></div>
      <div class="tile t-yellow"><small>Longest run</small><b>${c.maxRun ? fmtHM(c.maxRun) : '–'}</b><span>${c.maxRunKm ? fmtDist(c.maxRunKm, 'run') : 'so far'}</span></div>
    </div>`;
    const ready = Math.round(100 * (0.4 * clamp(c.recent.ride / P.P.peakRide, 0, 1) + 0.4 * clamp(c.recent.run / P.P.peakRun, 0, 1) + 0.2 * clamp(c.recent.swimKm ? c.recent.swimKm / 1.9 : c.recent.swim / 40, 0, 1)));
    html += `<section class="card ready">
      <div class="ready-top"><div><h3 class="card-title">Race readiness</h3><p class="card-sub">Your longest sessions in the last 6 weeks against what race day needs.</p></div><div class="ready-num"><b>${ready}</b><small>%</small></div></div>
      ${gauge('Long ride', c.recent.ride, P.P.peakRide, fmtHM, 'g-bike')}
      ${gauge('Long run', c.recent.run, P.P.peakRun, fmtHM, 'g-run')}
      ${c.recent.swimKm ? gauge('Swim', c.recent.swimKm, 1.9, v => fmtDist(v, 'swim'), 'g-swim') : gauge('Swim', c.recent.swim, 40, fmtDur, 'g-swim')}
    </section>`;
    if (last) {
      const form = last.ctl - last.atl, ratio = last.ctl > 1 ? form / last.ctl : 0;
      const early = !S.logs.length || daysBetween(P.start, today()) < 21;
      const mood = early ? ['Getting started', 'Fitness takes a few weeks to show up here. Keep ticking sessions off and watch the orange line climb.'] : ratio < -0.3 ? ['Tired', 'Lots of training lately. Sleep, eat well and keep easy days easy.'] : ratio < -0.08 ? ['Building', 'Training is adding up. This is exactly how fitness grows.'] : ratio < 0.12 ? ['Fresh', 'Nicely balanced. A good place to be.'] : ['Very fresh', 'Well rested. Great before a race, but keep training ticking along.'];
      html += `<section class="card">
        <h3 class="card-title">Your engine</h3>
        <p class="card-sub">Fitness grows slowly from consistent training. The dashed line is where the plan takes you by race day.</p>
        <div class="engine-nums"><div><small>Fitness</small><b>${Math.round(last.ctl)}</b></div><div><small>Fatigue</small><b>${Math.round(last.atl)}</b></div><div class="mood"><small>Right now</small><b>${mood[0]}</b></div></div>
        ${engineChart()}
        <div class="chart-key"><span><i class="k-ctl"></i>Fitness</span><span><i class="k-atl"></i>Fatigue</span><span><i class="k-plan"></i>Plan</span></div>
        <p class="mood-note">${mood[1]}</p>
      </section>`;
    }
    const lw = lastWeeksChart();
    if (lw) {
      html += `<section class="card"><h3 class="card-title">Recent weeks</h3><p class="card-sub">What you did (colours by sport) inside what was planned.${c.consistency != null ? ` Last ${Math.min(4, c.weeksDone)} weeks: <b>${c.consistency}%</b> done.` : ''}</p>${lw}
        <div class="chart-key">${SPORT_ORDER.filter(s => s !== 'other' || weeksHaveOther()).map(s => `<span><i style="background:${SPORT_COL[s]}"></i>${SPORTS[s].name}</span>`).join('')}</div></section>`;
    }
    const got = BADGES.filter(b => b.test(c)).length;
    html += sectionTitle('Badges', `${got} of ${BADGES.length}`);
    html += `<div class="badges">${BADGES.map(b => { const on = b.test(c); return `<div class="bdg${on ? ' on' : ''}">${icon(b.icon)}<b>${b.title}</b><small>${b.sub}</small></div>`; }).join('')}</div>`;
    return html;
  },
};
