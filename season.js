/* Tri Hard — the Plan page: the whole road to race day */
'use strict';

const SPORT_COL = { swim: '#003049', bike: '#F77F00', run: '#D62828', strength: '#FCBF49', other: '#8ca3af' };

function niceTop(m) {
  if (m <= 2) return 2;
  const steps = [2, 4, 5, 6, 8, 10, 12, 14, 16, 20, 25, 30];
  return steps.find(s => s >= m) || Math.ceil(m / 10) * 10;
}

function longestOn(key, sport) {
  let best = 0;
  for (let i = 0; i < 7; i++) for (const l of logsOn(addDays(key, i))) if (l.sport === sport && l.mins > best) best = l.mins;
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

function ladderChart() {
  const P = plan(), n = P.weeks.length, cur = mondayOf(today());
  const W = 340, H = 170, L = 30, R = 6, T = 10, B = 22, ph = H - T - B;
  const ride = P.weeks.map(w => { const s = w.sessions.find(x => x.role === 'longride'); return s ? (s.parts ? s.parts[0].mins : s.mins) : null; });
  const run = P.weeks.map(w => { const s = w.sessions.find(x => x.role === 'longrun'); return s ? s.mins : null; });
  const dRide = P.weeks.map(w => (w.key <= cur ? longestOn(w.key, 'bike') : null));
  const dRun = P.weeks.map(w => (w.key <= cur ? longestOn(w.key, 'run') : null));
  const top = niceTop(Math.max(...ride.filter(Boolean), ...dRide.filter(Boolean), 60) / 60) * 60;
  const x = i => L + (i + 0.5) * (W - L - R) / n;
  const y = v => T + ph * (1 - v / top);
  const line = (arr, cls) => {
    const pts = arr.map((v, i) => (v ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : null)).filter(Boolean);
    return pts.length ? `<polyline points="${pts.join(' ')}" class="${cls}"/>` : '';
  };
  const dots = (arr, cls) => arr.map((v, i) => (v ? `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2" class="${cls}"/>` : '')).join('');
  let g = '';
  for (let h = 1; h * 60 <= top; h++) g += `<line x1="${L}" x2="${W - R}" y1="${y(h * 60).toFixed(1)}" y2="${y(h * 60).toFixed(1)}" class="grid"/><text x="${L - 5}" y="${(y(h * 60) + 3.5).toFixed(1)}" class="yl">${h}h</text>`;
  g += line(ride, 'pl-ride') + line(run, 'pl-run') + dots(dRide, 'dn-ride') + dots(dRun, 'dn-run');
  const ci = P.weeks.findIndex(w => w.key === cur);
  if (ci >= 0) g += `<line x1="${x(ci).toFixed(1)}" x2="${x(ci).toFixed(1)}" y1="${T}" y2="${T + ph}" class="now-line"/>`;
  g += `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" class="axis"/>`;
  g += `<g transform="translate(0 ${H - 6})">${monthTicks(P.weeks, x)}</g>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Long ride and long run durations each week, planned and done">${g}</svg>`;
}

function weekRow(w) {
  const t = today(), cur = mondayOf(t);
  const ph = PHASES[w.phase];
  const tot = weekTotals(w.key);
  const ss = sessionsFor(w.key);
  const lr = ss.find(s => s.role === 'longride'), ln = ss.find(s => s.role === 'longrun');
  const bits = [];
  if (lr) bits.push(`${lr.sport === 'brick' ? 'Brick' : 'Ride'} ${durLabel(lr)}`);
  if (ln) bits.push(`Run ${durLabel(ln)}`);
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
    const lrPeak = Math.max(...P.weeks.map(w => { const s = w.sessions.find(x => x.role === 'longride'); return s ? (s.parts ? s.parts[0].mins : s.mins) : 0; }));
    const lnPeak = Math.max(...P.weeks.map(w => { const s = w.sessions.find(x => x.role === 'longrun'); return s ? s.mins : 0; }));
    const bigWeek = Math.max(...P.weeks.map(w => w.total));
    let html = `<div class="page-head"><h1>The plan</h1>${stripes()}</div>
      <p class="page-sub">${plural(P.weeks.length, 'week')} to ${esc(S.race.name)}. Mostly easy endurance, building a little each week, with an easier week every fourth week so it sticks.</p>
      <div class="tiles three">
        <div class="tile t-orange"><small>Longest ride</small><b>${fmtHM(lrPeak)}</b><span>from ${fmtHM(S.base.ride)}</span></div>
        <div class="tile t-red"><small>Longest run</small><b>${fmtHM(lnPeak)}</b><span>from ${fmtHM(S.base.run)}</span></div>
        <div class="tile t-navy"><small>Biggest week</small><b>${fmtHM(bigWeek)}</b><span>hours</span></div>
      </div>`;
    html += `<section class="card">
      <h3 class="card-title">Phases</h3>
      <div class="phase-ribbon">${PHASE_ORDER.map(p => { const ws = P.weeks.filter(w => w.phase === p); return ws.length ? `<div style="flex:${ws.length} 1 0;--pc:${PHASES[p].color};--pi:${PHASES[p].ink}"><b>${p === 'race' ? 'Race' : PHASES[p].name}</b><small>${ws.length > 1 ? `${ws.length} wks` : '1 wk'}</small></div>` : ''; }).join('')}</div>
      <ul class="phase-notes">${PHASE_ORDER.map(p => { const ws = P.weeks.filter(w => w.phase === p); return ws.length ? `<li><i style="background:${PHASES[p].color}"></i><b>${PHASES[p].name}</b> ${PHASES[p].tag.toLowerCase()} · ${fmtShort(ws[0].key)}–${fmtShort(addDays(ws[ws.length - 1].key, 6))}</li>` : ''; }).join('')}</ul>
    </section>`;
    html += `<section class="card"><h3 class="card-title">Hours each week</h3><p class="card-sub">Bars are the plan (paler bars are easy weeks). Dots are what you’ve done.</p>${volumeChart()}</section>`;
    html += `<section class="card"><h3 class="card-title">Long ride &amp; long run</h3><p class="card-sub">Your two most important sessions, building to the peak three weeks out.</p>${ladderChart()}
      <div class="chart-key"><span><i class="k-ride"></i>Long ride</span><span><i class="k-run"></i>Long run</span><span><i class="k-dot"></i>Your longest</span></div></section>`;
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
    kit() { openRaceKit(); },
  },
};
