/* Tri Hard — "Suggest my week": places sessions around your time, the weather and recovery */
'use strict';

function dayInfo(key, d) {
  const k = addDays(key, d);
  const st = weekRead(key);
  return { d, k, avail: st.avail[d] != null ? st.avail[d] : S.avail[d], note: st.note[d], past: k < today(), feel: checkinOn() ? st.feel[d] : '' };
}
const availOn = (key, d) => dayInfo(key, d).avail;

const isLongRide = s => s.role === 'longride';
const isKeyS = s => !!s.key && s.sport !== 'race';

// Score for session a on an earlier day than b (gap days apart; 0 = same day).
function pairScore(a, b, gap, phase) {
  if (gap === 0) {
    if (a.sport === 'race' || b.sport === 'race') return -6;
    if (isKeyS(a) && isKeyS(b)) return -4;
    if (a.sport === b.sport && a.sport !== 'strength' && a.sport !== 'other') return a.sport === 'swim' ? -2 : -1.2;
    if (a.sport === 'strength' || b.sport === 'strength') {
      const other = a.sport === 'strength' ? b : a;
      return isKeyS(other) ? -0.4 : 0.05;
    }
    // Two sessions in a day is fine now and then, but spreading them out is easier to fit around life.
    let p = -0.35;
    if ((a.sport === 'run' && b.sport === 'bike') || (a.sport === 'bike' && b.sport === 'run')) p -= 0.15;
    if (isKeyS(a) || isKeyS(b)) p -= 0.15;
    return p;
  }
  if (gap !== 1) return 0;
  let p = 0;
  if (isLongRide(a) && b.role === 'longrun') p += phase === 'base' ? -0.35 : -0.05;
  else if (a.role === 'longrun' && isLongRide(b)) p -= 0.5;
  else if (isKeyS(a) && isKeyS(b)) p -= 0.5;
  if (a.sport === 'run' && b.sport === 'run') p -= a.role === 'longrun' || b.role === 'longrun' ? 0.6 : 0.35;
  if (a.sport === 'strength' && isKeyS(b)) p -= 0.25;
  if (isKeyS(a) && b.sport === 'strength') p -= 0.1;
  if (a.role === 'ride2' && a.effort === 'mixed' && isLongRide(b)) p -= 0.2;
  if (b.sport === 'race' && a.prefer == null) p -= isKeyS(a) ? 1.5 : 0.3;
  return p;
}

function fitScore(s, day, load) {
  let sc = s.w * wxFit(s.wxk, wxFor(day.k, s.wxk, s.mins));
  if (s.key) sc += 0.35 * clamp((day.avail - load) / (s.mins * 1.4), 0, 1);
  if (s.prefer != null) sc += s.prefer === day.d ? 1.2 : -0.6;
  if (day.feel === 'tired' && (s.key || s.effort === 'steady' || s.effort === 'mixed')) sc -= 1.2;
  if (day.feel === 'sore' && (s.sport === 'run' || s.parts)) sc -= 1.2;
  return sc;
}

function extendState(st, s, d, inc) {
  const lists = st.lists.slice(), load = st.load.slice();
  if (d >= 0) { lists[d] = lists[d].concat(s); load[d] += s.mins; }
  return { score: st.score + inc, lists, load, at: Object.assign({}, st.at, { [s.id]: d }) };
}

// Finds a good week: a beam search that keeps the best few hundred partial weeks at each step.
function suggestWeek(key) {
  const pw = planWeek(key);
  const phase = pw ? pw.phase : 'base';
  const days = Array.from({ length: 7 }, (_, d) => dayInfo(key, d));
  // Plan with full-length sessions: a check-in only eases what lands on that day.
  const all = sessionsFor(key).filter(s => !s.skip).map(s => (s.orig && !s.done && !s.rest ? Object.assign({}, s.orig, { day: s.day, pin: s.pin }) : s));
  const fixed = [], todo = [];
  for (const s of all) {
    if (s.done || s.rest || s.fixed != null || (s.pin && s.day != null && !days[s.day].past)) fixed.push(s);
    else todo.push(s);
  }
  todo.sort((a, b) => b.w - a.w || b.mins - a.mins);
  const fitCache = new Map();
  const fit = (s, day, load) => {
    const k = `${s.id}|${day.d}|${s.key ? Math.round(load / 15) : 0}`;
    if (!fitCache.has(k)) fitCache.set(k, fitScore(s, day, load));
    return fitCache.get(k);
  };
  const busy = fixed.filter(s => !s.rest);
  const start = { score: 0, at: {}, lists: days.map(d => busy.filter(s => s.day === d.d)), load: days.map(d => sum(busy.filter(s => s.day === d.d).map(s => s.mins))) };
  let beam = [start];
  for (const s of todo) {
    const next = [];
    for (const st of beam) {
      for (const day of days) {
        if (day.past || day.avail <= 0 || day.feel === 'sick') continue;
        if (st.load[day.d] + s.mins > day.avail + 10) continue;
        const list = st.lists[day.d];
        if (list.length >= 3 || (list.length >= 2 && s.sport !== 'strength')) continue;
        let inc = fit(s, day, st.load[day.d]);
        for (const o of list) inc += pairScore(o, s, 0, phase);
        if (day.d > 0) for (const o of st.lists[day.d - 1]) inc += pairScore(o, s, 1, phase);
        if (day.d < 6) for (const o of st.lists[day.d + 1]) inc += pairScore(s, o, 1, phase);
        next.push(extendState(st, s, day.d, inc));
      }
      next.push(extendState(st, s, -1, -4 * s.w - 1));
    }
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, 200);
  }
  for (const st of beam) {
    const empty = days.filter(d => !st.lists[d.d].length).length;
    st.final = st.score + (empty >= 1 ? 0.8 : 0) + (empty >= 2 ? 0.15 : 0);
  }
  beam.sort((a, b) => b.final - a.final);
  const best = beam[0];
  const why = {}, unplaced = [];
  for (const s of todo) {
    const d = best.at[s.id];
    if (d >= 0) why[s.id] = reasonFor(s, d, days, best); else unplaced.push(s);
  }
  return { at: best.at, why, unplaced, days, lists: best.lists, todo, fixed };
}

function reasonFor(s, d, days, best) {
  if (s.prefer != null && s.prefer === d && planWeek(s.week) && planWeek(s.week).phase === 'race') return RACE_DAY_WHY[s.role] || 'Timed for race day.';
  const main = mainReason(s, d, days, best);
  const day = days[d];
  if (!s.key || s.wxk === 'indoor' || s.wxk === 'swim' || /weather|hot|indoors/i.test(main)) return main;
  const w = wxFor(day.k, s.wxk, s.mins);
  if (!w || wxFit(s.wxk, w) >= 0.75) return main;
  const issue = w.storm ? 'storms are forecast' : w.rain >= 40 ? `there’s a ${w.rain}% chance of rain` : w.wind > 25 ? `it’ll be windy (${Math.round(w.wind)} km/h)` : w.feel - S.settings.heat >= 0 ? `it’ll feel like ${Math.round(w.feel)}°` : 'the weather’s so-so';
  const plan = w.storm ? 'Have an indoor plan.' : s.sport === 'bike' || s.parts ? 'Take a rain jacket, or ride indoors.' : 'Dress for it.';
  return `${main.replace(/\.$/, '')}, though ${issue}. ${plan}`;
}

function mainReason(s, d, days, best) {
  const day = days[d];
  if (s.prefer != null && s.prefer === d) return 'The day before the race: short and easy.';
  const kind = s.wxk;
  const w = wxFor(day.k, kind, s.mins);
  if (w && kind === 'swim') {
    const out = wxFor(day.k, 'longride', 120);
    if (out && wxFit('ride', out) < 0.7) return `Pool day while it’s ${out.storm ? 'stormy' : out.rain >= 50 ? 'wet' : 'rough'} outside.`;
  } else if (w && kind !== 'indoor') {
    const open = days.filter(x => !x.past && x.avail >= s.mins);
    const fits = open.map(x => wxFit(kind, wxFor(x.k, kind, s.mins)));
    const mine = wxFit(kind, w), top = Math.max(...fits), low = Math.min(...fits);
    if (kind === 'ride' && mine < 0.7) return `${cap(wxWords(w))}: ride indoors on the trainer.`;
    if (mine >= top - 0.02 && top - low > 0.12) return `Best ${kind.includes('ride') ? 'riding' : 'running'} weather this week: ${wxWords(w)}.`;
    if (w.feel - S.settings.heat >= 0) {
      const bt = bestTime(day.k, kind, s.mins);
      if (bt) return `It’ll be hot. Go at ${fmtHour(bt.from)} while it’s ${Math.round(bt.hi)}°.`;
    }
  }
  if (s.key) {
    const most = Math.max(...days.filter(x => !x.past).map(x => x.avail));
    if (day.avail >= most) return `Your most free time this week (${fmtAvail(day.avail)}).`;
    if (s.role === 'longrun') {
      const lr = Object.entries(best.at).find(([id]) => id.endsWith(':longride'));
      if (lr && lr[1] >= 0 && Math.abs(lr[1] - d) >= 2) return 'Kept apart from your long ride so your legs are fresh.';
    }
  }
  if (s.sport === 'run') {
    const lr = Object.entries(best.at).find(([id]) => id.endsWith(':longrun'));
    if (lr && lr[1] >= 0 && Math.abs(lr[1] - d) >= 2) return 'Spaced away from your long run.';
  }
  if (s.sport === 'strength') return 'Paired with an easier day.';
  return `Fits your ${fmtAvail(day.avail)} on ${DAYS_LONG[d]}.`;
}
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const RACE_DAY_WHY = {
  swim: 'Five days out: a short, sharp swim.',
  ride2: 'Four days out: wake your legs up.',
  run2: 'Three days out: a few strides, then put your feet up.',
  shake: 'The day before: short and easy, then pack your bags.',
};

function applySuggestion(key, res) {
  const st = weekEdit(key);
  const before = JSON.stringify(st);
  for (const [sid, d] of Object.entries(res.at)) {
    if (d >= 0) st.at[sid] = d; else delete st.at[sid];
    delete st.pin[sid];
  }
  st.why = Object.assign({}, res.why);
  save();
  return () => { S.weeks[key] = normWeek(JSON.parse(before)); save(); render(); };
}

// A short heads-up when you drag a session somewhere it may not suit.
function placementNote(key, s, d) {
  const day = dayInfo(key, d);
  if (day.avail <= 0) return `${DAYS_LONG[d]} is marked as no training.`;
  if (s && s.rest) return `You checked in unwell on ${DAYS_LONG[d]}, so it’s a rest there.`;
  if (s && s.eased) return `You’re ${s.feel} on ${DAYS_LONG[d]}, so it’s been eased.`;
  const others = sessionsFor(key).filter(o => o.id !== s.id && o.day === d && !o.skip);
  const load = sum(others.map(o => o.mins)) + s.mins;
  if (load > day.avail + 10) return `That’s ${fmtDur(load)} on ${DAYS[d]}, but you’ve only got ${fmtAvail(day.avail)}.`;
  if (isKeyS(s) && others.some(isKeyS)) return `Two long sessions on ${DAYS[d]} is a big day.`;
  const warn = wxWarn(s, day.k);
  if (warn) {
    const w = wxFor(day.k, s.wxk, s.mins);
    if (warn.cls === 'storm') return `Storms forecast ${DAYS[d]}. Have an indoor plan.`;
    if (warn.cls === 'hot') { const bt = bestTime(day.k, s.wxk, s.mins); return `Hot on ${DAYS[d]} (feels like ${Math.round(w.feel)}°)${bt ? `. Go at ${fmtHour(bt.from)}` : ''}.`; }
    if (warn.cls === 'wet') return `${w.rain}% chance of rain ${DAYS[d]}${s.sport === 'bike' || s.parts ? ': maybe the trainer' : ''}.`;
    if (warn.cls === 'windy') return `Windy on ${DAYS[d]} (${Math.round(w.wind)} km/h).`;
  }
  return '';
}
