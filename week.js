/* Tri Hard — the Week page: your pool of sessions, seven days to drop them on, and the details */
'use strict';

const viewWeek = () => {
  const P = plan();
  const k = UI.week || mondayOf(today());
  if (k < P.start) return P.start;
  if (k > P.raceMon) return P.raceMon;
  return k;
};

/* ---------- hero: countdown and the season so far ---------- */
function sunsetArt() {
  return `<svg class="sunset" viewBox="0 0 220 130" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><clipPath id="hero-sun"><circle cx="130" cy="104" r="70"/></clipPath></defs>
    <g clip-path="url(#hero-sun)">
      <rect x="40" y="30" width="190" height="36" fill="#FCBF49"/><rect x="40" y="66" width="190" height="20" fill="#F77F00"/><rect x="40" y="86" width="190" height="40" fill="#D62828"/>
      <g stroke="#003049"><path d="M40 72h190" stroke-width="2.5"/><path d="M40 82h190" stroke-width="3.5"/><path d="M40 92h190" stroke-width="4.5"/><path d="M40 101h190" stroke-width="5.5"/></g>
    </g>
    <path d="M0 106c14 0 14-5 28-5s14 5 28 5 14-5 28-5 14 5 28 5 14-5 28-5 14 5 28 5 14-5 28-5 14 5 28 5V130H0z" fill="#0d4566"/>
    <path d="M0 116c14 0 14-5 28-5s14 5 28 5 14-5 28-5 14 5 28 5 14-5 28-5 14 5 28 5 14-5 28-5 14 5 28 5V130H0z" fill="#EAE2B7" opacity=".9"/>
    <g fill="#FCBF49"><path d="M30 26l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6z"/><path d="M200 18l1.2 2.6 2.6 1.2-2.6 1.2-1.2 2.6-1.2-2.6-2.6-1.2 2.6-1.2z"/></g>
  </svg>`;
}

// The hero's sun sits on the season bar, which doubles as the horizon.
function heroSun() {
  return `<svg class="sunset" viewBox="0 0 180 92" aria-hidden="true">
    <defs><clipPath id="hero-sun"><circle cx="96" cy="92" r="84"/></clipPath></defs>
    <g clip-path="url(#hero-sun)">
      <rect x="0" y="0" width="180" height="50" fill="#FCBF49"/><rect x="0" y="50" width="180" height="18" fill="#F77F00"/><rect x="0" y="68" width="180" height="24" fill="#D62828"/>
      <g stroke="#003049"><path d="M0 55h180" stroke-width="2.5"/><path d="M0 64h180" stroke-width="3.5"/><path d="M0 74h180" stroke-width="4.5"/><path d="M0 84h180" stroke-width="5.5"/></g>
    </g>
    <g fill="#FCBF49"><path d="M14 22l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6z"/><path d="M170 8l1.2 2.6 2.6 1.2-2.6 1.2-1.2 2.6-1.2-2.6-2.6-1.2 2.6-1.2z"/></g>
  </svg>`;
}

function heroHtml(key) {
  const P = plan();
  const dtr = daysToRace();
  const pw = planWeek(key);
  const ph = pw ? PHASES[pw.phase] : PHASES.base;
  let big, small;
  if (dtr > 1) { big = dtr; small = 'days to<br>race day'; } else if (dtr === 1) { big = 1; small = 'day to go.<br>Sleep well!'; } else if (dtr === 0) { big = 'GO'; small = 'It’s race<br>day!'; } else { big = 'DONE'; small = 'You’re a<br>70.3 finisher'; }
  const segs = [];
  for (const p of PHASE_ORDER) {
    const n = P.weeks.filter(w => w.phase === p).length;
    if (n) segs.push(`<span style="flex:${n};background:${PHASES[p].color}" title="${PHASES[p].name}: ${plural(n, 'week')}"></span>`);
  }
  const t = today();
  const at = clamp((daysBetween(P.start, t) + 1) / (P.weeks.length * 7), 0, 1);
  return `<section class="hero">
    ${heroSun()}
    <div class="hero-text">
      <div class="kicker">${esc(S.race.name)} · ${fmtFull(S.race.date)}</div>
      <div class="count"><b>${big}</b><span>${small}</span></div>
      ${pw ? `<span class="phase-pill" style="--pc:${ph.color};--pi:${ph.ink}">${ph.name} · week ${pw.i + 1} of ${pw.n}</span>` : ''}
    </div>
    <div class="season" role="img" aria-label="Season progress: ${Math.round(at * 100)}% of the way to race day">
      <div class="season-bar">${segs.join('')}</div>
      <i class="you" style="left:${(at * 100).toFixed(1)}%"></i>
    </div>
  </section>`;
}

/* ---------- week header and summary ---------- */
function weekLabel(key) {
  const t = mondayOf(today());
  if (key === t) return 'This week';
  if (key === addDays(t, 7)) return 'Next week';
  if (key === addDays(t, -7)) return 'Last week';
  return `Week ${weekNo(key)}`;
}

function weekNav(key) {
  const P = plan(), pw = planWeek(key);
  const ph = pw ? PHASES[pw.phase] : null;
  return `<div class="week-nav">
    <button type="button" class="icon-btn" data-act="wk" data-d="-7" aria-label="Previous week" ${key <= P.start ? 'disabled' : ''}>${icon('chev-l')}</button>
    <div class="wn-mid"><b>${weekLabel(key)}</b><span>${fmtRange(key, addDays(key, 6))}${ph ? ` · <em style="--pc:${ph.color};--pi:${ph.ink}">${pw.rec ? 'Easy week' : pw.sharpen ? 'Rehearsal week' : ph.name}</em>` : ''}</span></div>
    <button type="button" class="icon-btn" data-act="wk" data-d="7" aria-label="Next week" ${key >= P.raceMon ? 'disabled' : ''}>${icon('chev-r')}</button>
  </div>${key !== mondayOf(today()) && mondayOf(today()) >= P.start && mondayOf(today()) <= P.raceMon ? '<button type="button" class="link-btn back-now" data-act="now">Back to this week</button>' : ''}`;
}

const SPORT_ORDER = ['swim', 'bike', 'run', 'strength', 'other'];
function summaryHtml(key) {
  const t = weekTotals(key), pw = planWeek(key);
  const segs = SPORT_ORDER.filter(s => t.by[s] && t.by[s].plan).map(s => {
    const o = t.by[s];
    const pct = Math.round(100 * Math.min(1, o.done / o.plan));
    return `<span class="sb s-${s}" style="flex:${o.plan}"><i style="width:${pct}%"></i></span>`;
  }).join('');
  const legend = SPORT_ORDER.filter(s => t.by[s] && (t.by[s].plan || t.by[s].done)).map(s => `<span>${badge(s, 'xs')}${fmtDur(t.by[s].done)}<small>/${fmtDur(t.by[s].plan)}</small></span>`).join('');
  const note = !pw ? '' : pw.rec && pw.i === 0 ? 'An easy first week to find your rhythm. The build starts next week.'
    : pw.rec ? 'Easy week: lighter on purpose, so your body soaks up the training.'
      : pw.sharpen ? 'Race rehearsal week: practise everything you’ll do on the day.'
        : pw.phase === 'taper' ? 'Taper: less training, more freshness. Trust it.'
          : pw.phase === 'race' ? 'Race week! Short sessions, lots of rest and good food.' : '';
  return `<section class="card summary">
    <div class="sum-top">
      <div><small>Planned</small><b>${fmtHM(t.plan)}</b></div>
      <div><small>Done</small><b>${fmtHM(t.done)}</b></div>
      <div><small>Sessions</small><b>${t.doneSessions}<i>/${t.sessions}</i></b></div>
    </div>
    ${segs ? `<div class="sportbar" aria-hidden="true">${segs}</div><div class="sum-legend">${legend}</div>` : ''}
    ${note ? `<p class="sum-note">${note}</p>` : ''}
  </section>`;
}

/* ---------- session cards ---------- */
function woCard(s, key, past) {
  const k = s.day != null ? addDays(key, s.day) : null;
  const resting = s.rest && !s.done;
  const warn = k && !s.done && !resting ? wxWarn(s, k) : null;
  const drag = !s.done && s.fixed == null;
  const sub = [];
  if (s.sport === 'swim' && s.metres) sub.push(`${s.metres.toLocaleString('en-AU')} m`);
  sub.push(resting ? 'Rest today' : EFFORT[s.effort] ? EFFORT[s.effort].name : 'Easy');
  if (s.opt && !resting) sub.push('optional');
  let delta = '';
  if (resting) delta = '<em class="delta unwell">unwell</em>';
  else if (s.eased) delta = `<em class="delta eased">eased</em>`;
  else if (!s.done && s.capped) delta = '<em class="delta held">held back</em>';
  else if (!s.done && s.delta && s.delta > 0) delta = `<em class="delta up">+${s.delta}m</em>`;
  else if (!s.done && s.delta && s.delta < 0 && s.key) delta = `<em class="delta down">${s.delta}m</em>`;
  const side = s.done ? `<span class="tick">${icon('check')}</span>`
    : resting ? `<span class="pin">${icon('rest')}</span>`
      : warn ? `<span class="warn ${warn.cls}">${icon(warn.icon)}${warn.text}</span>`
        : s.pin && s.day != null ? `<span class="pin" title="You put this here">${icon('pin')}</span>` : '';
  const state = s.done ? ', done' : resting ? ', resting today' : s.eased ? ', eased for today' : '';
  return `<div class="wo s-${s.sport}${s.key ? ' key' : ''}${s.done ? ' done' : ''}${resting ? ' resting' : ''}${past && !s.done && !resting ? ' missed' : ''}" data-sid="${s.id}"${drag ? ' data-drag="1"' : ''} data-act="wo" role="button" tabindex="0" aria-label="${esc(s.title)}, ${durLabel(s)}${state}">
    ${badge(s.sport)}
    <span class="wo-main"><b>${esc(s.title)}</b><small>${sub.join(' · ')} ${delta}</small>${s.why && !s.done && !resting ? `<span class="why">${esc(s.why)}</span>` : ''}</span>
    <span class="wo-side"><span class="dur">${durHtml(s)}</span>${side}</span>
  </div>`;
}

function poolHtml(key, list) {
  const pool = list.filter(s => s.day == null && !s.skip);
  const skipped = list.filter(s => s.skip);
  const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  return `<section class="pool" data-drop="pool">
    <div class="pool-head"><h2>To schedule</h2><span class="count">${pool.length}</span>
      <button type="button" class="btn sm ghost" data-act="custom">${icon('plus')} Add</button></div>
    ${pool.length ? `<p class="pool-tip">${touch ? 'Press and hold a session, then drag it onto a day.' : 'Drag a session onto a day.'} Or tap it for the details.</p>
      <div class="pool-list">${pool.map(s => woCard(s, key)).join('')}</div>`
      : `<div class="pool-empty">${icon('check')} Everything’s on a day. Drag one back here to unschedule it.</div>`}
    ${skipped.length ? `<div class="skipped">Skipped: ${skipped.map(s => `<button type="button" class="chip" data-act="unskip" data-sid="${s.id}">${esc(s.title)} ${icon('undo')}</button>`).join('')}</div>` : ''}
  </section>`;
}

function dayLane(key, d, list) {
  const info = dayInfo(key, d);
  const t = today();
  const isToday = info.k === t;
  const mine = list.filter(s => s.day === d && !s.skip);
  const extra = logsOn(info.k).filter(l => !l.sid && l.mins);
  const hasKey = mine.some(isKeyS);
  const date = fromKey(info.k);
  let empty = '';
  if (!mine.length && !extra.length) {
    empty = info.past ? ''
      : info.avail <= 0 ? `<div class="rest">${icon('rest')} No training planned</div>`
        : `<div class="drop-hint">Drop a session here</div>`;
  }
  const quiet = info.past && !mine.length && !extra.length;
  return `<section class="day${isToday ? ' today' : ''}${info.past ? ' past no-drop' : ''}${quiet ? ' quiet' : ''}${hasKey ? ' big' : ''}" data-drop="day" data-d="${d}">
    <div class="day-head">
      <div class="dname"><b>${DAYS[d]}</b><span>${date.getDate()}</span>${isToday ? '<em>Today</em>' : ''}</div>
      ${quiet ? '<span class="quiet-note">Nothing logged</span>' : wxMini(info.k)}
      <button type="button" class="avail${info.avail <= 0 ? ' off' : ''}" data-act="avail" data-d="${d}" ${info.past ? 'disabled' : ''} aria-label="Time to train on ${DAYS_LONG[d]}: ${fmtAvail(info.avail)}">${icon('clock')}${fmtAvail(info.avail)}</button>
    </div>
    ${info.note ? `<div class="day-note">${esc(info.note)}</div>` : ''}
    ${quiet ? '' : `<div class="slots">${mine.map(s => woCard(s, key, info.past)).join('')}${extra.map(l => `<button type="button" class="extra" data-act="extra" data-id="${l.id}">${badge(l.sport, 'xs')}<span>Extra: ${esc(l.name || SPORTS[l.sport].name)}</span><b>${fmtHM(l.mins)}</b></button>`).join('')}${empty}</div>`}
  </section>`;
}

/* ---------- the page ---------- */
VIEWS.week = {
  title: 'Week',
  render() {
    const key = viewWeek();
    const list = sessionsFor(key);
    const isPastWeek = addDays(key, 6) < today();
    let html = heroHtml(key) + weekNav(key) + summaryHtml(key) + checkinHtml(key) + kitCardHtml(key);
    if (!isPastWeek) {
      html += `<section class="suggest">
        <button type="button" class="btn orange big" data-act="suggest">${icon('spark')} Suggest my week</button>
        <p>Sorts your sessions around your free time, the weather and recovery. Anything you’ve dragged yourself stays put.</p>
        ${S.loc ? '' : `<button type="button" class="link-btn" data-act="loc">${icon('loc')} Add your location for weather-smart picks</button>`}
      </section>`;
    }
    html += poolHtml(key, list);
    html += `<div class="days">${Array.from({ length: 7 }, (_, d) => dayLane(key, d, list)).join('')}</div>`;
    if (S.loc && wxOk()) html += `<p class="credit">Forecast for ${esc(S.loc.name)} by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>. ${WHEN_LABEL[S.when] === 'whenever suits' ? 'Best hours of each day.' : `Based on ${WHEN_LABEL[S.when]}.`}</p>`;
    return html;
  },
  after(view) {
    for (const el of $$('.wo[data-sid]', view)) {
      if (FLASH.has(el.dataset.sid)) el.classList.add('landed');
    }
    FLASH.clear();
  },
  act: {
    wk(a) { UI.week = addDays(viewWeek(), +a.dataset.d); render(); window.scrollTo({ top: $('.week-nav').offsetTop - 70, behavior: 'smooth' }); },
    now() { UI.week = null; render(); },
    wo(a) { openSession(a.dataset.sid); },
    avail(a) { openAvail(viewWeek(), +a.dataset.d); },
    custom() { openCustom(viewWeek()); },
    loc() { openSettings('weather'); },
    extra(a) { const l = S.logs.find(x => x.id === a.dataset.id); if (l) openLogSheet(l); },
    unskip(a) {
      const st = weekEdit(viewWeek());
      delete st.skip[a.dataset.sid];
      save();
      render();
    },
    feel(a) { setFeel(viewWeek(), dayIdx(today()), a.dataset.v); },
    feeledit() { UI.feelEdit = true; render(); },
    feelkeep() { UI.feelEdit = false; render(); },
    feelclear() { setFeel(viewWeek(), dayIdx(today()), ''); },
    feelmove(a) {
      const sid = a.dataset.sid, d = +a.dataset.d;
      const undo = moveSession(viewWeek(), sid, d);
      FLASH.add(sid);
      render();
      toast(`Moved to ${DAYS_LONG[d]}, at full length`, { undo });
    },
    kit() { openRaceKit(); },
    suggest() {
      const key = viewWeek();
      const go = () => {
        const res = suggestWeek(key);
        const undo = applySuggestion(key, res);
        for (const id of Object.keys(res.at)) FLASH.add(id);
        render();
        const placed = Object.values(res.at).filter(d => d >= 0).length;
        let msg = placed ? `Planned ${plural(placed, 'session')}` : 'Nothing left to place';
        if (res.unplaced.length) msg += `. ${res.unplaced.map(s => esc(s.title)).join(', ')} didn’t fit: add time on a day or skip ${res.unplaced.length > 1 ? 'them' : 'it'}`;
        toast(msg, { undo, ms: 7000 });
        buzz([10, 30, 10]);
      };
      if (S.loc && !wxOk()) wxFetch().then(go, go); else go();
    },
  },
};

const FLASH = new Set();

/* ---------- drag and drop (mouse, pen and touch) ---------- */
let DRAG = null;
let SUPPRESS_CLICK = 0;
const DRAG_ACTIVE = () => !!(DRAG && DRAG.active);

function initDrag() {
  document.addEventListener('pointerdown', dragDown, { passive: true });
  document.addEventListener('pointermove', dragMove, { passive: false });
  document.addEventListener('pointerup', dragUp);
  document.addEventListener('pointercancel', dragCancel);
  document.addEventListener('touchmove', e => { if (DRAG && DRAG.active) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('[data-drag]')) e.preventDefault(); });
  document.addEventListener('click', e => { if (Date.now() < SUPPRESS_CLICK) { e.stopPropagation(); e.preventDefault(); } }, true);
}

function dragDown(e) {
  if (CUR !== 'week' || SHEET || DRAG) return;
  const card = e.target.closest && e.target.closest('.wo[data-drag]');
  if (!card || (e.pointerType === 'mouse' && e.button !== 0)) return;
  DRAG = { card, sid: card.dataset.sid, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, pid: e.pointerId, type: e.pointerType, active: false, timer: null, over: null };
  if (e.pointerType !== 'mouse') {
    card.classList.add('pressing');
    DRAG.timer = setTimeout(startDrag, 280);
  }
}

function dragMove(e) {
  if (!DRAG || e.pointerId !== DRAG.pid) return;
  DRAG.x = e.clientX;
  DRAG.y = e.clientY;
  if (!DRAG.active) {
    const dist = Math.hypot(e.clientX - DRAG.x0, e.clientY - DRAG.y0);
    if (DRAG.type === 'mouse') { if (dist > 6) startDrag(); } else if (dist > 12) dragForget();
    return;
  }
  e.preventDefault();
  placeGhost();
  dragHover();
}

function dragForget() {
  if (!DRAG) return;
  clearTimeout(DRAG.timer);
  DRAG.card.classList.remove('pressing');
  DRAG = null;
}

function startDrag() {
  const d = DRAG;
  if (!d || d.active) return;
  d.active = true;
  d.card.classList.remove('pressing');
  const r = d.card.getBoundingClientRect();
  d.dx = d.x0 - r.left;
  d.dy = d.y0 - r.top;
  const g = d.card.cloneNode(true);
  g.classList.add('ghost');
  g.removeAttribute('data-act');
  g.removeAttribute('data-drag');
  g.style.width = `${r.width}px`;
  document.body.append(g);
  d.ghost = g;
  d.card.classList.add('lifted');
  document.body.classList.add('dragging');
  buzz(15);
  placeGhost();
  dragHover();
  d.raf = requestAnimationFrame(dragScroll);
}

function placeGhost() {
  const d = DRAG;
  d.ghost.style.transform = `translate(${d.x - d.dx}px, ${d.y - d.dy}px) rotate(-2.5deg) scale(1.04)`;
}

function dragHover() {
  const d = DRAG;
  const el = document.elementFromPoint(d.x, d.y);
  let zone = el && el.closest('[data-drop]');
  if (zone && zone.classList.contains('no-drop')) zone = null;
  if (zone !== d.over) {
    if (d.over) d.over.classList.remove('over');
    d.over = zone;
    if (zone) zone.classList.add('over');
  }
}

function dragScroll() {
  const d = DRAG;
  if (!d || !d.active) return;
  const H = window.innerHeight, top = 110, bottom = H - 130;
  let v = 0;
  if (d.y < top) v = -Math.ceil((top - d.y) / 5);
  else if (d.y > bottom) v = Math.ceil((d.y - bottom) / 5);
  if (v) { window.scrollBy(0, v); dragHover(); }
  d.raf = requestAnimationFrame(dragScroll);
}

function dragUp(e) {
  if (!DRAG || e.pointerId !== DRAG.pid) return;
  if (!DRAG.active) { dragForget(); return; }
  dragHover();
  const sid = DRAG.sid, zone = DRAG.over;
  dragEnd();
  SUPPRESS_CLICK = Date.now() + 400;
  if (zone) dropOn(sid, zone);
}

function dragCancel(e) {
  if (!DRAG || e.pointerId !== DRAG.pid) return;
  if (DRAG.active) dragEnd(); else dragForget();
}

function dragEnd() {
  const d = DRAG;
  DRAG = null;
  clearTimeout(d.timer);
  cancelAnimationFrame(d.raf);
  if (d.ghost) d.ghost.remove();
  d.card.classList.remove('lifted', 'pressing');
  if (d.over) d.over.classList.remove('over');
  document.body.classList.remove('dragging');
}

function moveSession(key, sid, d) {
  const st = weekEdit(key);
  const before = { at: st.at[sid], pin: st.pin[sid], why: st.why[sid] };
  if (d == null) { delete st.at[sid]; delete st.pin[sid]; } else { st.at[sid] = d; st.pin[sid] = 1; }
  delete st.why[sid];
  save();
  return () => {
    const w = weekEdit(key);
    if (before.at == null) delete w.at[sid]; else w.at[sid] = before.at;
    if (before.pin) w.pin[sid] = 1; else delete w.pin[sid];
    if (before.why) w.why[sid] = before.why;
    save();
    render();
  };
}

function dropOn(sid, zone) {
  const key = viewWeek();
  const s = findSession(sid);
  if (!s) return;
  const to = zone.dataset.drop === 'pool' ? null : +zone.dataset.d;
  if (to === s.day || (to == null && s.day == null)) return;
  const undo = moveSession(key, sid, to);
  FLASH.add(sid);
  render();
  if (to == null) { toast(`${esc(s.title)} is back in the pool`, { undo }); return; }
  const note = placementNote(key, findSession(sid), to);
  toast(note ? `Heads up: ${esc(note)}` : `${esc(s.title)} pinned to ${DAYS_LONG[to]}`, { undo, ms: note ? 6500 : 3500 });
}

/* ---------- a session's details ---------- */
function openSession(sid) {
  const tpl = () => {
    const s = findSession(sid);
    if (!s) return `${sheetHead('Session')}<p class="lead">This session isn’t in the plan any more.</p>`;
    const key = s.week, t = today();
    const k = s.day != null ? addDays(key, s.day) : null;
    const ef = EFFORT[s.effort] || EFFORT.easy;
    const outdoor = s.wxk !== 'indoor' && s.wxk !== 'swim';
    const wx = k ? wxFor(k, s.wxk, s.mins) : null;
    const bt = k && outdoor ? bestTime(k, s.wxk, s.mins) : null;
    const tips = s.tips.slice();
    if (wx && outdoor && wx.feel - S.settings.heat >= 0) tips.unshift(`Hot one: ${bt ? `go at ${fmtHour(bt.from)} while it’s ${Math.round(bt.hi)}°, ` : ''}carry extra fluid with electrolytes, and slow down if you need to.`);
    if (wx && wx.storm) tips.unshift('Storms are forecast. Have an indoor option (trainer or treadmill) and stay off the road if there’s lightning.');
    const parts = s.parts ? `<div class="parts">${s.parts.map(p => `<span>${badge(p.sport, 'xs')}${SPORTS[p.sport].name} ${fmtDur(p.mins)}</span>`).join('<i>then</i>')}</div>` : '';
    const days = Array.from({ length: 7 }, (_, d) => dayInfo(key, d));
    const canDone = !s.done && key <= mondayOf(t);
    const doneDays = days.filter(x => x.k <= t);
    const defDone = s.day != null && days[s.day].k <= t ? days[s.day].k : doneDays.length ? doneDays[doneDays.length - 1].k : t;
    const logs = s.logs.map(l => `<button type="button" class="mini-log" data-act="openlog" data-id="${l.id}">${badge(l.sport, 'xs')}<span>${esc(l.name || SPORTS[l.sport].name)}<small>${fmtDay(l.d)} · ${l.src === 'strava' ? 'Strava' : l.src === 'plan' ? 'Ticked off' : 'Logged'}</small></span><b>${fmtHM(l.mins)}</b></button>`).join('');
    const planMins = (() => { const p = planWeek(key); const o = p && p.sessions.find(x => x.id === s.id); return o ? (o.parts ? o.parts[0].mins : o.mins) : null; })();
    const adjustable = s.sport !== 'race' && !s.done && !s.eased && !s.rest;
    const st = weekRead(key);
    const dayFeel = s.day != null && checkinOn() ? st.feel[s.day] : '';
    let feelNote = '';
    if (s.rest && !s.done) {
      feelNote = `<div class="note feel-note f-sick">${icon('thermo')}<span><b>Rest day.</b> You checked in unwell, so this one’s off: rest is what gets you better. <button type="button" class="link-btn" data-act="fullon">Do it anyway</button></span></div>`;
    } else if (s.eased) {
      feelNote = `<div class="note feel-note f-${s.feel}">${icon(FEEL[s.feel].icon)}<span><b>Eased for today.</b> You checked in ${feelWord(s.feel)}. The plan had ${esc(s.orig.title)}: ${fmtDur(s.orig.mins)}, ${(EFFORT[s.orig.effort] || EFFORT.easy).name.toLowerCase()}. ${s.done ? '' : '<button type="button" class="link-btn" data-act="fullon">Do the full session</button>'}</span></div>`;
    } else if (st.full[s.id] && dayFeel && dayFeel !== 'fresh' && s.sport !== 'race' && !s.done) {
      feelNote = `<div class="note feel-note f-${dayFeel}">${icon(FEEL[dayFeel].icon)}<span><b>The full session</b>, even though you’re ${feelWord(dayFeel)} today. Listen to your body. <button type="button" class="link-btn" data-act="fulloff">${dayFeel === 'sick' ? 'Rest instead' : 'Ease it again'}</button></span></div>`;
    }
    const kitLink = s.sport === 'race' || s.role === 'shake' || (s.role === 'longride' && planWeek(key) && planWeek(key).sharpen);
    return `<div class="ss-head s-${s.sport}">
        ${badge(s.sport, 'lg')}
        <div><div class="kicker">${s.sport === 'race' ? fmtLong(S.race.date) : `${weekLabel(key)}${s.day != null ? ` · ${DAYS_LONG[s.day]}` : ' · not on a day yet'}`}</div><h2>${esc(s.title)}</h2></div>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="ss-stats">
        <div><small>Time</small><b>${s.sport === 'race' ? '70.3' : durHtml(s)}</b></div>
        ${s.metres ? `<div><small>Distance</small><b>${(s.metres / 1000).toFixed(1)}<i>km</i></b></div>` : ''}
        <div><small>Effort</small><b class="eff">${ef.name}</b></div>
      </div>
      ${parts}
      ${feelNote}
      ${s.capped && !s.eased && !s.rest ? `<div class="note held">${icon('heart')}<span>Held back to <b>${fmtDur(s.capped.mins)}</b> (the plan says ${fmtDur(s.capped.plan)}). Your longest ${s.role === 'longrun' ? 'run' : 'ride'} in the last 4 weeks was ${fmtDur(s.capped.best)}, so this builds back up safely. Log a longer one and the plan catches up.</span></div>` : ''}
      ${s.delta && s.delta > 0 && !s.done && !s.eased && !s.rest ? `<div class="note up">${icon('progress')}<span><b>${s.delta} min more</b> than last week. Small steps add up to race day.</span></div>` : ''}
      <div class="effort-box"><b>${ef.rpe}</b> ${ef.talk}</div>
      ${s.steps.length ? `<h3 class="ss-h">The session</h3><ol class="steps">${s.steps.map(x => `<li>${x}</li>`).join('')}</ol>` : ''}
      ${s.why ? `<p class="ss-why">${icon('spark')}<span>${esc(s.why)}</span></p>` : ''}
      ${kitLink ? `<button type="button" class="btn yellow block kit-btn" data-act="kit">${icon('bag')} ${s.sport === 'race' ? 'Your race morning, fuel and pacing' : 'Your race-day kit and packing list'}</button>` : ''}
      ${tips.length ? `<h3 class="ss-h">Tips</h3><ul class="tips">${tips.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
      ${k && wx ? `<div class="ss-wx">${icon('wx-' + wmo(wxDay(k).code)[0])}<span><b>${fmtDay(k)}${S.when !== 'any' ? `, ${S.when}` : bt ? `, from ${fmtHour(bt.from)}` : ''}</b>${cap(wxWords(wx))}${bt && S.when !== 'any' && bt.from !== wx.from ? `. Best time: ${fmtHour(bt.from)}` : ''}</span></div>` : ''}
      ${logs ? `<h3 class="ss-h">Done</h3><div class="mini-logs">${logs}</div>` : ''}
      ${canDone ? `<h3 class="ss-h">Did it?</h3><div class="chips done-days">${doneDays.map(x => `<button type="button" class="chip${x.k === defDone ? ' on' : ''}" data-act="doneon" data-k="${x.k}">${x.k === t ? 'Today' : DAYS[x.d]}</button>`).join('')}</div>
        <div class="btn-row"><button type="button" class="btn red" data-act="done" data-k="${defDone}">${icon('check')} Done</button><button type="button" class="btn ghost" data-act="logit">Log details</button></div>` : ''}
      ${s.done ? `<div class="btn-row"><button type="button" class="btn ghost" data-act="undone">${icon('undo')} Not done</button></div>` : ''}
      ${s.fixed == null && !s.done ? `<h3 class="ss-h">Move to</h3><div class="chips move-days">${days.map(x => `<button type="button" class="chip${s.day === x.d ? ' on' : ''}" data-act="move" data-d="${x.d}" ${x.past ? 'disabled' : ''}>${DAYS[x.d]}</button>`).join('')}<button type="button" class="chip${s.day == null ? ' on' : ''}" data-act="move" data-d="">Pool</button></div>` : ''}
      ${adjustable ? `<div class="adjust"><span><b>${s.parts ? 'Ride time' : 'Time'}</b>${planMins != null && s.edited ? `<small>Plan: ${fmtDur(planMins)} · <button type="button" class="link-btn" data-act="reset">reset</button></small>` : ''}</span>${stepper('mins', 0, 'Session time', fmtDur(s.parts ? s.parts[0].mins : s.mins))}</div>` : ''}
      <div class="btn-row foot-actions">
        ${s.fixed == null && !s.done && s.day != null ? `<button type="button" class="btn sm ghost" data-act="pin">${icon('pin')} ${s.pin ? 'Unpin' : 'Pin to this day'}</button>` : ''}
        ${s.custom ? `<button type="button" class="btn sm ghost" data-act="delcustom">${icon('trash')} Delete</button>` : s.sport !== 'race' && !s.done ? `<button type="button" class="btn sm ghost" data-act="skip">${s.skip ? 'Bring it back' : 'Skip this week'}</button>` : ''}
      </div>`;
  };
  let doneKey = null;
  openSheet(tpl(), {
    cls: 'session-sheet',
    label: 'Session details',
    act: {
      doneon(a, e, sh) {
        doneKey = a.dataset.k;
        for (const c of $$('.done-days .chip', sh.el)) c.classList.toggle('on', c === a);
        $('[data-act="done"]', sh.el).dataset.k = doneKey;
      },
      done(a, e, sh) {
        const s = findSession(sid);
        if (!s) return;
        const undo = quickDone(s, a.dataset.k);
        sh.close();
        FLASH.add(sid);
        render();
        if (s.key) confetti(); else confetti(28);
        buzz([15, 40, 15]);
        toast(s.sport === 'race' ? 'YOU DID IT! Congratulations, finisher!' : `${esc(s.title)}: done!${s.key ? ' Big one ticked off.' : ''}`, { undo });
      },
      logit(a, e, sh) {
        const s = findSession(sid);
        const k = $('[data-act="done"]', sh.el).dataset.k;
        const sport = s.parts ? 'bike' : LOG_SPORTS.includes(s.sport) ? s.sport : 'other';
        const mins = s.parts ? s.parts[0].mins : s.mins;
        openLogSheet(null, { sport, d: k, h: Math.floor(mins / 60), m: mins % 60, name: s.title, match: s.id, km: s.metres ? String(s.metres) : '' });
      },
      undone(a, e, sh) {
        const s = findSession(sid);
        const undo = undoneSession(s);
        sh.close();
        render();
        toast('Marked as not done', { undo });
      },
      openlog(a) { const l = S.logs.find(x => x.id === a.dataset.id); if (l) openLogSheet(l); },
      move(a, e, sh) {
        const d = a.dataset.d === '' ? null : +a.dataset.d;
        const s = findSession(sid);
        if (s.day === d) return;
        const undo = moveSession(s.week, sid, d);
        FLASH.add(sid);
        sh.close();
        render();
        const note = d == null ? '' : placementNote(s.week, findSession(sid), d);
        toast(d == null ? `${esc(s.title)} is back in the pool` : note ? `Heads up: ${esc(note)}` : `Moved to ${DAYS_LONG[d]}`, { undo });
      },
      pin(a, e, sh) {
        const s = findSession(sid);
        const st = weekEdit(s.week);
        if (st.pin[sid]) delete st.pin[sid]; else st.pin[sid] = 1;
        save();
        sh.set(tpl());
        render();
      },
      skip(a, e, sh) {
        const s = findSession(sid);
        const st = weekEdit(s.week);
        if (st.skip[sid]) delete st.skip[sid]; else { st.skip[sid] = 1; delete st.at[sid]; delete st.pin[sid]; }
        save();
        sh.close();
        render();
        if (st.skip[sid]) toast(`Skipped ${esc(s.title)} this week`, { undo: () => { delete weekEdit(s.week).skip[sid]; save(); render(); } });
      },
      step(a, e, sh) {
        const s = findSession(sid);
        const st = weekEdit(s.week);
        const cur = s.parts ? s.parts[0].mins : s.mins;
        const step = cur >= 60 ? 10 : 5;
        const next = clamp(Math.round((cur + step * +a.dataset.d) / step) * step, 10, 480);
        st.mins[sid] = next;
        save();
        sh.set(tpl());
        render();
      },
      reset(a, e, sh) {
        const s = findSession(sid);
        delete weekEdit(s.week).mins[sid];
        save();
        sh.set(tpl());
        render();
      },
      fullon(a, e, sh) {
        const s = findSession(sid);
        weekEdit(s.week).full[sid] = 1;
        save();
        sh.set(tpl());
        render();
      },
      fulloff(a, e, sh) {
        const s = findSession(sid);
        delete weekEdit(s.week).full[sid];
        save();
        sh.set(tpl());
        render();
      },
      kit() { const s = findSession(sid); openRaceKit(s && s.sport === 'race' ? 'morning' : 'pack'); },
      delcustom(a, e, sh) {
        const s = findSession(sid);
        const st = weekEdit(s.week);
        const c = st.custom.find(x => x.id === s.custom);
        st.custom = st.custom.filter(x => x.id !== s.custom);
        delete st.at[sid];
        save();
        sh.close();
        render();
        toast(`Deleted ${esc(s.title)}`, { undo: () => { weekEdit(s.week).custom.push(c); save(); render(); } });
      },
    },
  });
}

/* ---------- your time on a day ---------- */
function openAvail(key, d) {
  const info = dayInfo(key, d);
  let v = info.avail, note = info.note, every = false;
  const tpl = () => `${sheetHead(`Time to train on ${fmtDay(info.k)}`, 'Suggestions only use the time you have.')}
    <div class="avail-grid">${AVAIL_OPTS.map(m => `<button type="button" class="chip${m === v ? ' on' : ''}" data-act="pick" data-v="${m}">${fmtAvail(m)}</button>`).join('')}</div>
    <div class="field"><label for="av-note">Other plans <span class="faint">(optional)</span></label><input id="av-note" class="input" name="note" maxlength="60" value="${esc(note)}" placeholder="e.g. Night shift, club ride, dinner"></div>
    <label class="check-row"><input type="checkbox" name="every" ${every ? 'checked' : ''}> Make this my usual ${DAYS_LONG[d]}</label>
    <div class="btn-row"><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn orange" data-act="ok">${icon('check')} Save</button></div>`;
  openSheet(tpl(), {
    label: `Time to train on ${DAYS_LONG[d]}`,
    act: {
      pick(a, e, sh) { v = +a.dataset.v; for (const c of $$('.avail-grid .chip', sh.el)) c.classList.toggle('on', c === a); },
      ok(a, e, sh) {
        const st = weekEdit(key);
        if (every) { S.avail[d] = v; st.avail[d] = null; } else st.avail[d] = v === S.avail[d] ? null : v;
        st.note[d] = note.trim();
        save();
        sh.close();
        render();
        toast(every ? `Saved as your usual ${DAYS_LONG[d]}` : 'Saved');
      },
    },
    input(e) { if (e.target.name === 'note') note = e.target.value; },
    change(e) { if (e.target.name === 'every') every = e.target.checked; },
  });
}

/* ---------- add your own session (a club ride, a gym class…) ---------- */
function openCustom(key) {
  const f = { sport: 'run', title: '', mins: 45 };
  const tpl = () => `${sheetHead('Add a session', 'Other training you do, like a club ride or a gym class.')}
    <form novalidate>
      <div class="field"><span class="label">Sport</span>${seg(LOG_SPORTS.map(s => [s, SPORTS[s].name]), f.sport, 'sport', 'sports')}</div>
      <div class="field"><label for="cu-t">Name</label><input id="cu-t" class="input" name="title" maxlength="50" value="${esc(f.title)}" placeholder="e.g. Club ride"></div>
      <div class="field"><span class="label">How long?</span>${stepper('mins', f.mins, 'Minutes', fmtDur(f.mins))}</div>
      <div class="btn-row"><button type="submit" class="btn orange">${icon('plus')} Add to this week</button></div>
    </form>`;
  openSheet(tpl(), {
    label: 'Add a session',
    act: {
      sport(a, e, sh) { f.sport = a.dataset.v; sh.set(tpl()); },
      step(a, e, sh) { f.mins = clamp(f.mins + (f.mins >= 60 ? 15 : 5) * +a.dataset.d, 10, 480); sh.set(tpl()); },
    },
    input(e) { if (e.target.name === 'title') f.title = e.target.value; },
    submit(e, sh) {
      const st = weekEdit(key);
      const c = { id: uid(), sport: f.sport, title: f.title.trim() || `${SPORTS[f.sport].name} session`, mins: f.mins };
      st.custom.push(c);
      save();
      sh.close();
      FLASH.add(`${key}:c-${c.id}`);
      render();
      toast(`Added ${esc(c.title)}. Drag it onto a day.`);
    },
  });
}
