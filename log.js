/* Tri Hard — your log: matching workouts to the plan, logging by hand and the Log page */
'use strict';

const sportFits = (s, sport) => s.sport === sport || (!!s.parts && s.parts.some(p => p.sport === sport));
const targetMins = (s, sport) => { if (!s.parts) return s.mins; const p = s.parts.find(x => x.sport === sport); return p ? p.mins : s.mins; };
const EFFORTS = [[3, 'Easy'], [5, 'Steady'], [7, 'Hard'], [9, 'Flat out']];

// Matches each workout to the planned session it most likely was, and moves that session to the day you did it.
function autoMatch(weekKeys) {
  for (const wk of weekKeys) {
    const logs = S.logs.filter(l => mondayOf(l.d) === wk).sort((a, b) => (a.d + a.at).localeCompare(b.d + b.at));
    for (const l of logs) if (!l.fixed) l.sid = '';
    REV++;
    const sessions = baseSessions(wk).filter(s => !s.skip && s.sport !== 'race');
    if (!sessions.length) continue;
    const taken = new Set(logs.filter(l => l.fixed && l.sid).map(l => `${l.sid}|${l.sport}`));
    const moves = {};
    for (const l of logs) {
      if (l.fixed || !['swim', 'bike', 'run', 'strength', 'other'].includes(l.sport)) continue;
      const di = dayIdx(l.d);
      let best = null, bestSc = -Infinity;
      for (const s of sessions) {
        if (!sportFits(s, l.sport) || taken.has(`${s.id}|${l.sport}`)) continue;
        const target = targetMins(s, l.sport);
        const ratio = target ? l.mins / target : 1;
        let sc = -Math.abs(Math.log(clamp(ratio, 0.2, 5))) * 2;
        const day = moves[s.id] != null ? moves[s.id] : s.day;
        if (day === di) sc += 3;
        else if (day == null) sc += 1.5;
        else { if (ratio < 0.7 || ratio > 1.45) continue; sc -= 0.5 + Math.abs(day - di) * 0.1; }
        if (s.key && ratio < 0.5) sc -= 2.5;
        if (s.parts && l.sport === 'run') {
          if (!logs.some(o => o !== l && o.sport === 'bike' && o.d === l.d)) continue;
          sc += 0.5;
        }
        if (sc > bestSc) { bestSc = sc; best = s; }
      }
      if (best && bestSc > -3) {
        l.sid = best.id;
        taken.add(`${best.id}|${l.sport}`);
        const day = moves[best.id] != null ? moves[best.id] : best.day;
        if (day !== di) moves[best.id] = di;
      }
    }
    if (Object.keys(moves).length) { const w = weekEdit(wk); Object.assign(w.at, moves); }
  }
  REV++;
}

// One tap "I did this as planned".
function quickDone(s, d) {
  const added = [];
  const parts = s.sport === 'race' ? [{ sport: 'other', mins: 0 }] : s.parts || [{ sport: s.sport, mins: s.mins }];
  for (const p of parts) {
    const l = normLog({ id: uid(), src: 'plan', d, sport: p.sport, mins: p.mins, km: p.sport === 'swim' && s.metres ? s.metres / 1000 : 0, name: s.title, sid: s.id, fixed: true });
    S.logs.push(l);
    added.push(l.id);
  }
  if (mondayOf(d) === s.week) weekEdit(s.week).at[s.id] = dayIdx(d);
  save();
  return () => { S.logs = S.logs.filter(l => !added.includes(l.id)); save(); render(); };
}

function undoneSession(s) {
  const gone = S.logs.filter(l => l.sid === s.id);
  const keepIds = new Set(gone.filter(l => l.src !== 'plan').map(l => l.id));
  S.logs = S.logs.filter(l => l.sid !== s.id || keepIds.has(l.id));
  for (const l of S.logs) if (keepIds.has(l.id)) { l.sid = ''; l.fixed = true; }
  save();
  return () => { for (const g of gone) { const ex = S.logs.find(l => l.id === g.id); if (ex) Object.assign(ex, g); else S.logs.push(g); } save(); render(); };
}

/* ---------- Log page ---------- */
function stravaCard() {
  if (stravaConnected()) {
    const when = S.strava.last ? relTime(S.strava.last) : 'not yet';
    return `<section class="card strava-card on">
      <div class="sc-top"><span class="strava-mark" aria-hidden="true">S</span><div><b>Strava connected</b><small>${S.strava.athlete ? esc(S.strava.athlete) + ' · ' : ''}synced ${when}</small></div>
      <button type="button" class="btn sm" data-action="sync">${icon('sync')} Sync</button></div>
    </section>`;
  }
  return `<section class="card strava-card">
    <div class="sc-top"><span class="strava-mark" aria-hidden="true">S</span><div><b>Bring in your workouts</b><small>Connect Strava and your rides, runs and swims arrive by themselves. Garmin works too, through Strava.</small></div></div>
    <button type="button" class="btn orange block" data-act="strava">${icon('link')} Set up Strava</button>
  </section>`;
}

function relTime(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function logRow(l) {
  const s = l.sid ? findSession(l.sid) : null;
  const src = l.src === 'strava' ? 'Strava' : l.src === 'plan' ? 'Ticked off' : 'Added by you';
  const dist = l.km ? fmtDist(l.km, l.sport) : '';
  return `<button type="button" class="log-row" data-act="log" data-id="${l.id}">
    ${badge(l.sport)}
    <span class="lr-main"><b>${esc(l.name || SPORTS[l.sport].name)}</b><small>${fmtDay(l.d)}${l.at ? ` · ${fmtClock(l.at)}` : ''} · ${src}</small>
      ${s ? `<span class="matched">${icon('check')} ${esc(s.title)}</span>` : l.sport !== 'other' && l.mins ? '<span class="matched extra">Extra session</span>' : ''}</span>
    <span class="lr-num"><b>${l.mins ? fmtHM(l.mins) : '–'}</b>${dist ? `<small>${dist}</small>` : ''}</span>
  </button>`;
}
const fmtClock = at => { const [h, m] = at.split(':').map(Number); return `${h % 12 || 12}:${pad(m)}${h < 12 ? 'am' : 'pm'}`; };

VIEWS.log = {
  title: 'Log',
  render() {
    let html = `<div class="page-head"><h1>Log</h1>${stripes()}</div>${stravaCard()}
      <button type="button" class="btn red block add-log" data-act="add">${icon('plus')} Log a workout</button>`;
    const logs = S.logs.slice().sort((a, b) => (b.d + b.at).localeCompare(a.d + a.at) || b.t - a.t);
    if (!logs.length) {
      return html + `<div class="card empty">${icon('log', 'big')}<h3>Nothing logged yet</h3><p>Tick sessions off on the Week page, log one here, or connect Strava to bring them in automatically.</p></div>`;
    }
    const shown = logs.slice(0, UI.logLimit);
    const groups = new Map();
    for (const l of shown) { const k = mondayOf(l.d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l); }
    for (const [k, ls] of groups) {
      const t = weekTotals(k);
      const no = weekNo(k);
      html += `<div class="log-week"><div class="lw-head"><span>${no ? `Week ${no} · ` : ''}${fmtRange(k, addDays(k, 6))}</span><b>${fmtDur(t.done)}${t.plan ? ` of ${fmtDur(t.plan)}` : ''}</b></div>
        <div class="card list">${ls.map(logRow).join('')}</div></div>`;
    }
    if (logs.length > shown.length) html += `<button type="button" class="btn ghost block" data-act="more">Show older</button>`;
    return html;
  },
  act: {
    add() { openLogSheet(null); },
    log(a) { const l = S.logs.find(x => x.id === a.dataset.id); if (l) openLogSheet(l); },
    more() { UI.logLimit += 60; render(); },
    strava() { openSettings('strava'); },
  },
};

/* ---------- log a workout by hand, or look at one ---------- */
function openLogSheet(l, preset) {
  const isNew = !l;
  const ro = !!l && l.src === 'strava';
  const f = l
    ? { sport: l.sport, d: l.d, h: Math.floor(l.mins / 60), m: l.mins % 60, km: l.km ? String(l.sport === 'swim' ? Math.round(l.km * 1000) : Math.round(l.km * 100) / 100) : '', rpe: l.rpe, name: l.name, note: l.note, match: l.fixed ? l.sid || 'none' : 'auto' }
    : Object.assign({ sport: 'run', d: today(), h: 0, m: 45, km: '', rpe: 3, name: '', note: '', match: 'auto' }, preset || {});
  const tpl = () => {
    const wk = mondayOf(f.d);
    const opts = baseSessions(wk).filter(s => !s.skip && s.sport !== 'race' && sportFits(s, f.sport));
    const matchSel = `<select class="input" name="match">
      <option value="auto"${f.match === 'auto' ? ' selected' : ''}>Work it out for me</option>
      ${opts.map(s => `<option value="${s.id}"${f.match === s.id ? ' selected' : ''}>${esc(s.title)} (${durLabel(s)})</option>`).join('')}
      <option value="none"${f.match === 'none' ? ' selected' : ''}>An extra session, not in the plan</option></select>`;
    const facts = ro ? `<div class="facts">
        <div><small>Date</small><b>${fmtDay(l.d)}${l.at ? `, ${fmtClock(l.at)}` : ''}</b></div>
        <div><small>Time</small><b>${fmtHM(l.mins)}</b></div>
        ${l.km ? `<div><small>Distance</small><b>${fmtDist(l.km, l.sport)}</b></div>` : ''}
        ${l.hr ? `<div><small>Avg heart rate</small><b>${l.hr} bpm</b></div>` : ''}
      </div>` : '';
    const form = ro ? '' : `
      <div class="field"><span class="label">What did you do?</span>${seg(LOG_SPORTS.map(s => [s, SPORTS[s].name]), f.sport, 'sport', 'sports')}</div>
      <div class="two-col">
        <div class="field"><label for="lg-d">Date</label><input id="lg-d" class="input" type="date" name="d" max="${today()}" value="${f.d}"></div>
        <div class="field"><span class="label">Time</span><div class="hm"><input class="input" name="h" type="number" inputmode="numeric" min="0" max="23" value="${f.h}" aria-label="Hours"><span>h</span><input class="input" name="m" type="number" inputmode="numeric" min="0" max="59" value="${f.m}" aria-label="Minutes"><span>m</span></div></div>
      </div>
      <div class="field"><label for="lg-km">Distance <span class="faint">(optional, in ${f.sport === 'swim' ? 'metres' : 'km'})</span></label><input id="lg-km" class="input" name="km" type="number" inputmode="decimal" min="0" step="any" value="${esc(f.km)}" placeholder="${f.sport === 'swim' ? 'e.g. 2000' : 'e.g. 42.5'}"></div>
      <div class="field"><label for="lg-name">Name <span class="faint">(optional)</span></label><input id="lg-name" class="input" name="name" maxlength="80" value="${esc(f.name)}" placeholder="e.g. Saturday hills"></div>`;
    return `${sheetHead(isNew ? 'Log a workout' : esc(l.name || SPORTS[l.sport].name), ro ? 'From Strava' : l && l.src === 'plan' ? 'Ticked off from your plan' : '')}
      <form novalidate>${facts}${form}
        <div class="field"><span class="label">How did it feel?</span>${seg(EFFORTS, f.rpe, 'rpe', 'efforts')}</div>
        <div class="field"><span class="label">Counts as</span>${matchSel}</div>
        <div class="field"><label for="lg-note">Notes <span class="faint">(optional)</span></label><textarea id="lg-note" class="input" name="note" maxlength="500" placeholder="Legs, fuel, weather…">${esc(f.note)}</textarea></div>
        <div class="btn-row"><button type="submit" class="btn orange">${icon('check')} ${isNew ? 'Save' : 'Save changes'}</button></div>
        ${isNew ? '' : `<div class="btn-row"><button type="button" class="btn ghost" data-act="del">${icon('trash')} ${ro ? 'Remove from Tri Hard' : 'Delete'}</button></div>`}
      </form>`;
  };
  openSheet(tpl(), {
    label: isNew ? 'Log a workout' : 'Workout',
    act: {
      sport(a, e, sh) { f.sport = a.dataset.v; if (f.match !== 'auto' && f.match !== 'none') f.match = 'auto'; sh.set(tpl()); },
      rpe(a, e, sh) { f.rpe = +a.dataset.v; sh.set(tpl()); },
      del(a, e, sh) {
        const i = S.logs.indexOf(l);
        if (i < 0) return;
        S.logs.splice(i, 1);
        autoMatch([mondayOf(l.d)]);
        save();
        sh.close();
        render();
        toast('Workout removed', { undo: () => { S.logs.push(l); autoMatch([mondayOf(l.d)]); save(); render(); } });
      },
    },
    input(e) {
      const t = e.target;
      if (t.name in f && t.name !== 'match') f[t.name] = t.value;
    },
    change(e, sh) {
      const t = e.target;
      if (t.name === 'd' && isKey(t.value)) { f.d = t.value > today() ? today() : t.value; f.match = 'auto'; sh.set(tpl()); }
      if (t.name === 'match') f.match = t.value;
    },
    submit(e, sh) {
      const mins = ro ? l.mins : clamp((parseInt(f.h, 10) || 0) * 60 + (parseInt(f.m, 10) || 0), 0, 1440);
      if (!ro && !mins) { toast('Add how long it took'); return; }
      const kmIn = parseFloat(f.km);
      const km = ro ? l.km : isFinite(kmIn) && kmIn > 0 ? (f.sport === 'swim' ? kmIn / 1000 : kmIn) : 0;
      const fixed = f.match !== 'auto';
      const sid = f.match === 'auto' || f.match === 'none' ? '' : f.match;
      const before = l ? Object.assign({}, l) : null;
      const target = l || {};
      Object.assign(target, normLog(Object.assign({}, l || { id: uid(), src: 'manual', t: Date.now() }, ro ? {} : { sport: f.sport, d: f.d, mins, km, name: f.name.trim() }, { rpe: f.rpe, note: f.note.trim(), sid, fixed })));
      if (!l) S.logs.push(target);
      const weeks = new Set([mondayOf(target.d)]);
      if (before) weeks.add(mondayOf(before.d));
      if (sid) { const s = findSession(sid); if (s && mondayOf(target.d) === s.week) weekEdit(s.week).at[s.id] = dayIdx(target.d); }
      autoMatch([...weeks]);
      save();
      sh.close();
      render();
      const m = target.sid ? findSession(target.sid) : null;
      if (m && m.key) confetti(50);
      toast(isNew ? `Logged${m ? `: ${esc(m.title)} ticked off` : ''}` : 'Saved');
    },
  });
}
