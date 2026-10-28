/* Tri Hard — the Plan page: the whole road to race day */
'use strict';

const SPORT_COL = { swim: '#003049', bike: '#F77F00', run: '#D62828', strength: '#FCBF49', other: '#8ca3af' };

function niceTop(m) {
  if (m <= 2) return 2;
  const steps = [2, 4, 5, 6, 8, 10, 12, 14, 16, 20, 25, 30];
  return steps.find(s => s >= m) || Math.ceil(m / 10) * 10;
}

function longestKm(key, sport) {
  let best = 0;
  for (let i = 0; i < 7; i++) for (const l of logsOn(addDays(key, i))) if (l.sport === sport) best = Math.max(best, sport === 'swim' ? l.km : logKm(l));
  return best;
}

function monthTicks(weeks, x) {
  let out = '', last = -1;
  weeks.forEach((w, i) => {
    const d = fromKey(w.key);
    const lm = d.getDate() <= 7 ? d.getMonth() : (d.getMonth() + 1) % 12;
    if (lm !== last) { out += `<text x="${x(i).toFixed(1)}" y="0" class="mt">${MON[lm]}</text>`; last = lm; }
  });
  return out;
}

function volumeChart() {
  const P = plan(), n = P.weeks.length, t = today(), cur = mondayOf(t);
  const W = 340, H = 180, L = 24, R = 4, T = 10, B = 22, ph = H - T - B;
  const done = P.weeks.map(w => (w.key <= cur ? weekTotals(w.key).done / 60 : null));
  const planned = P.weeks.map(w => weekTotals(w.key).plan / 60);
  const top = niceTop(Math.max(...planned, ...done.filter(v => v != null)));
  const bw = (W - L - R) / n, gap = Math.max(1, bw * 0.18);
  const x = i => L + i * bw + bw / 2;
  const y = v => T + ph * (1 - v / top);
  let g = '';
  for (const fr of [0.5, 1]) g += `<line x1="${L}" x2="${W - R}" y1="${y(top * fr).toFixed(1)}" y2="${y(top * fr).toFixed(1)}" class="grid"/><text x="${L - 5}" y="${(y(top * fr) + 3.5).toFixed(1)}" class="yl">${top * fr}h</text>`;
  P.weeks.forEach((w, i) => {
    const h = Math.max(2, ph * planned[i] / top);
    const col = PHASES[w.phase].color;
    g += `<rect x="${(L + i * bw + gap / 2).toFixed(1)}" y="${(T + ph - h).toFixed(1)}" width="${(bw - gap).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${col}" ${w.rec ? 'fill-opacity=".45"' : ''} ${w.key === cur ? 'stroke="#003049" stroke-width="2"' : ''}/>`;
  });
  const pts = done.map((v, i) => (v == null ? null : [x(i), y(Math.min(v, top))])).filter(Boolean);
  if (pts.length) {
    g += `<polyline points="${pts.map(p => p.map(c => c.toFixed(1)).join(',')).join(' ')}" class="done-line"/>`;
    g += pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.8" class="done-dot"/>`).join('');
  }
  g += `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" class="axis"/>`;
  g += `<g transform="translate(0 ${H - 6})">${monthTicks(P.weeks, x)}</g>`;
  g += `<g transform="translate(${x(n - 1).toFixed(1)} ${T + 2})">${''}</g>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Planned hours each week, coloured by phase, with the hours you've done">${g}</svg>`;
}

// Each week's longest swim (in one go), ride and run, as a share of race distance.
function raceChart() {
  const P = plan(), n = P.weeks.length, cur = mondayOf(today());
  const W = 340, H = 180, L = 34, R = 6, T = 14, B = 22, ph = H - T - B;
  const SP = ['swim', 'bike', 'run'];
  const planned = { swim: [], bike: [], run: [] }, done = { swim: [], bike: [], run: [] };
  for (const w of P.weeks) {
    const sw = w.sessions.find(x => x.role === 'swim'), lr = w.sessions.find(x => x.role === 'longride'), ln = w.sessions.find(x => x.role === 'longrun');
    planned.swim.push(sw && sw.cont ? sw.cont / 1000 / RACE_KM.swim : null);
    planned.bike.push(lr ? legKm(lr)[0].km / RACE_KM.bike : null);
    planned.run.push(ln ? legKm(ln)[0].km / RACE_KM.run : null);
    for (const sp of SP) { const km = w.key <= cur ? longestKm(w.key, sp) : 0; done[sp].push(km ? km / RACE_KM[sp] : null); }
  }
  const all = SP.flatMap(sp => planned[sp].concat(done[sp])).filter(v => v != null);
  const top = Math.max(1.2, Math.ceil(Math.max(...all) * 5) / 5);
  const x = i => L + (i + 0.5) * (W - L - R) / n;
  const y = v => T + ph * (1 - Math.min(v, top) / top);
  const line = (arr, cls) => {
    const pts = arr.map((v, i) => (v != null ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : null)).filter(Boolean);
    return pts.length ? `<polyline points="${pts.join(' ')}" class="${cls}"/>` : '';
  };
  const dots = (arr, cls) => arr.map((v, i) => (v != null ? `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2" class="${cls}"/>` : '')).join('');
  let g = `<line x1="${L}" x2="${W - R}" y1="${y(0.5).toFixed(1)}" y2="${y(0.5).toFixed(1)}" class="grid"/><text x="${L - 5}" y="${(y(0.5) + 3.5).toFixed(1)}" class="yl">50%</text>`;
  g += `<line x1="${L}" x2="${W - R}" y1="${y(1).toFixed(1)}" y2="${y(1).toFixed(1)}" class="race-line"/><text x="${L - 5}" y="${(y(1) + 3.5).toFixed(1)}" class="yl">100%</text>`;
  g += `<text x="${L + 4}" y="${(y(1) - 5).toFixed(1)}" class="race-lbl">RACE DISTANCE</text>`;
  g += line(planned.swim, 'pl-swim') + line(planned.bike, 'pl-ride') + line(planned.run, 'pl-run');
  g += dots(done.swim, 'dn-swim') + dots(done.bike, 'dn-ride') + dots(done.run, 'dn-run');
  const ci = P.weeks.findIndex(w => w.key === cur);
  if (ci >= 0) g += `<line x1="${x(ci).toFixed(1)}" x2="${x(ci).toFixed(1)}" y1="${T}" y2="${T + ph}" class="now-line"/>`;
  g += `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" class="axis"/>`;
  g += `<g transform="translate(0 ${H - 6})">${monthTicks(P.weeks, x)}</g>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Your longest swim, ride and run each week as a share of race distance, building past 100 percent before the taper">${g}</svg>`;
}

const FIRST_LABEL = { swim: '1.9 km swim in one go', bike: '90 km ride', run: '21.1 km run' };
const longest = (P, role) => Math.max(0, ...P.weeks.map(w => { const s = w.sessions.find(x => x.role === role); return !s ? 0 : role === 'swim' ? s.cont / 1000 : legKm(s)[0].km; }));

function weekRow(w) {
  const t = today(), cur = mondayOf(t);
  const ph = PHASES[w.phase];
  const tot = weekTotals(w.key);
  const ss = sessionsFor(w.key);
  const lr = ss.find(s => s.role === 'longride'), ln = ss.find(s => s.role === 'longrun');
  const bits = [];
  if (lr) { const k = legKm(lr); bits.push(lr.parts ? `Brick ${fmtKm(k[0].km, 'bike')} + ${fmtKm(k[1].km, 'run')}` : `Ride ${fmtKm(k[0].km, 'bike')}`); }
  if (ln) bits.push(`Run ${fmtKm(legKm(ln)[0].km, 'run')}`);
  if (w.phase === 'race') bits.push('Race day!');
  const past = addDays(w.key, 6) < t;
  const pct = tot.plan ? Math.round(100 * Math.min(1, tot.done / tot.plan)) : 0;
  const side = past ? `<span class="wr-pct${pct >= 80 ? ' good' : ''}">${pct}%</span>` : w.key === cur ? '<span class="wr-now">Now</span>' : '';
  const tag = w.rec ? 'Easy week' : w.sharpen ? 'Rehearsal' : ph.name;
  return `<button type="button" class="wrow${w.key === cur ? ' now' : ''}${past ? ' past' : ''}${w.rec ? ' rec' : ''}" data-act="open" data-k="${w.key}" style="--pc:${ph.color};--pi:${ph.ink}">
    <span class="wr-no"><small>WK</small>${w.i + 1}</span>
    <span class="wr-main"><b>${fmtRange(w.key, addDays(w.key, 6))} <em>${tag}</em></b><small>${bits.join(' · ')} · ${fmtDur(tot.plan)}</small></span>
    ${side}
  </button>`;
}

VIEWS.plan = {
  title: 'Plan',
  render() {
    const P = plan(), cur = mondayOf(today());
    const bigWeek = Math.max(...P.weeks.map(w => w.total));
    const pc = paces();
    const learned = pc.rideN || pc.runN;
    let html = `<div class="page-head"><h1>The plan</h1>${stripes()}</div>
      <p class="page-sub">${plural(P.weeks.length, 'week')} to ${esc(S.race.name)}. Mostly easy endurance, building a little each week to the full race distance in each sport, with an easier week every fourth week so it sticks.</p>
      <div class="tiles three">
        <div class="tile t-navy"><small>Longest swim</small><b>${kmNum(longest(P, 'swim'), 'run')}<small>km</small></b><span>in one go · race 1.9</span></div>
        <div class="tile t-orange"><small>Longest ride</small><b>${kmNum(longest(P, 'longride'), 'bike')}<small>km</small></b><span>from ${kmNum(P.P.ride0Km, 'bike')} · race 90</span></div>
        <div class="tile t-red"><small>Longest run</small><b>${kmNum(longest(P, 'longrun'), 'run')}<small>km</small></b><span>from ${kmNum(P.P.run0Km, 'run')} · race 21.1</span></div>
      </div>
      <p class="pace-line">${icon('route')}<span>Distances use your easy pace: <b>${pc.ride} km/h</b> riding and <b>${fmtPace(pc.run)}</b> running${learned ? ', learned from what you’ve logged' : ''}. <button type="button" class="link-btn" data-act="pace">${learned || S.pace.set ? 'Change' : 'Set yours'}</button></span></p>`;
    html += `<section class="card">
      <h3 class="card-title">Phases</h3>
      <div class="phase-ribbon">${PHASE_ORDER.map(p => { const ws = P.weeks.filter(w => w.phase === p); return ws.length ? `<div style="flex:${ws.length} 1 0;--pc:${PHASES[p].color};--pi:${PHASES[p].ink}"><b>${p === 'race' ? 'Race' : PHASES[p].name}</b><small>${ws.length > 1 ? `${ws.length} wks` : '1 wk'}</small></div>` : ''; }).join('')}</div>
      <ul class="phase-notes">${PHASE_ORDER.map(p => { const ws = P.weeks.filter(w => w.phase === p); return ws.length ? `<li><i style="background:${PHASES[p].color}"></i><b>${PHASES[p].name}</b> ${PHASES[p].tag.toLowerCase()} · ${fmtShort(ws[0].key)}–${fmtShort(addDays(ws[ws.length - 1].key, 6))}</li>` : ''; }).join('')}</ul>
    </section>`;
    html += `<section class="card"><h3 class="card-title">Building to race distance</h3><p class="card-sub">Your longest swim (in one go), ride and run each week, against race distance. Dots are what you’ve done.</p>${raceChart()}
      <div class="chart-key"><span><i class="k-swim"></i>Swim</span><span><i class="k-ride"></i>Ride</span><span><i class="k-run"></i>Run</span><span><i class="k-dot"></i>Done</span></div>
      <ul class="firsts">${['swim', 'bike', 'run'].map(sp => { const f = P.firsts[sp]; return `<li>${badge(sp, 'xs')}<span><b>${FIRST_LABEL[sp]}</b><small>${f ? `First in week ${f.i + 1} (${fmtRange(f.key, addDays(f.key, 6))})` : 'Not reached yet'}</small></span></li>`; }).join('')}</ul></section>`;
    html += `<section class="card"><h3 class="card-title">Hours each week</h3><p class="card-sub">Bars are the plan (paler bars are easy weeks). Dots are what you’ve done. Biggest week: ${fmtDur(bigWeek)}.</p>${volumeChart()}</section>`;
    if (today() <= S.race.date) html += kitCard('Packing list, race-morning timeline, and a fuel and pacing plan that builds on your long sessions.');
    html += sectionTitle('Week by week', 'tap one to open it');
    html += `<div class="week-list">${P.weeks.map(weekRow).join('')}</div>`;
    html += `<button type="button" class="btn ghost block" data-act="settings" style="margin-top:16px">${icon('gear')} Change your starting point or hours</button>`;
    return html;
  },
  after(view) {
    const now = $('.wrow.now', view);
    if (now && UI.planScroll !== false) UI.planScroll = false;
  },
  act: {
    open(a) { UI.week = a.dataset.k; location.hash = '#/week'; },
    settings() { openSettings('plan'); },
    pace() { openSettings('pace'); },
    kit() { openRaceKit(); },
  },
};
