/* Tri Hard — the training plan: phases, steady progression and the workouts themselves */
'use strict';

const PHASES = {
  base: { name: 'Base', tag: 'Build the engine', color: '#FCBF49', ink: '#003049' },
  build: { name: 'Build', tag: 'Go longer, get stronger', color: '#F77F00', ink: '#003049' },
  peak: { name: 'Peak', tag: 'Your biggest weeks', color: '#D62828', ink: '#fffaea' },
  taper: { name: 'Taper', tag: 'Freshen up for race day', color: '#8ca3af', ink: '#003049' },
  race: { name: 'Race week', tag: 'Trust your training', color: '#003049', ink: '#FCBF49' },
};
const PHASE_ORDER = ['base', 'build', 'peak', 'taper', 'race'];

const EFFORT = {
  easy: { name: 'Easy', rpe: 'RPE 3–4', talk: 'You can chat in full sentences. This is where endurance is built.' },
  steady: { name: 'Race effort', rpe: 'RPE 5–6', talk: 'Comfortably hard: you can talk in short phrases. Roughly your 70.3 effort.' },
  mixed: { name: 'Easy + race effort', rpe: 'RPE 3–6', talk: 'Mostly easy and chatty, with some blocks at race effort (short phrases only).' },
  recovery: { name: 'Very easy', rpe: 'RPE 2–3', talk: 'Gentle. You should finish fresher than you started.' },
  race: { name: 'Race day', rpe: 'Your day', talk: 'Start easy, fuel early, finish strong.' },
};

// Mid-week sessions grow from the first number to the second as the season builds.
const VOLUME = {
  6: { ride: 180, run: 95, ride2: [45, 60], ride3: null, run2: [30, 40], run3: [25, 30], str: 20 },
  8: { ride: 210, run: 105, ride2: [60, 75], ride3: [45, 60], run2: [35, 45], run3: [25, 35], str: 30 },
  10: { ride: 210, run: 105, ride2: [60, 90], ride3: [60, 75], run2: [40, 55], run3: [30, 40], str: 30 },
  12: { ride: 225, run: 110, ride2: [75, 105], ride3: [60, 90], run2: [45, 60], run3: [35, 45], str: 30 },
};
// Brick runs straight off the long ride, by weeks to race.
const BRICK_RUN = { 13: 10, 11: 10, 9: 15, 8: 15, 7: 15, 5: 20, 4: 20, 3: 25 };

const FUEL_RIDE = 'Fuel as you go: eat every 30 min (about 40–60 g of carbs an hour) and sip every 10–15 min. Practise what you’ll use on race day, and note how it went when you log the ride.';
const FUEL_RUN = 'For runs over 75 min, carry water and a gel or snack and take it around halfway.';
const swimMins = m => round5(m * 0.021);
const geo = (a, b, f) => a * Math.pow(b / a, f);
const lin = (r, f) => r[0] + (r[1] - r[0]) * f;

/* ---------- distances ---------- */
// Race distances, and how much quicker each effort is than your easy pace.
const RACE_KM = { swim: 1.9, bike: 90, run: 21.1 };
const RIDE_GOAL_KM = 100;
const EFFORT_SPEED = { recovery: 0.92, easy: 1, mixed: 1, steady: 1.07 };

// Your easy riding speed (km/h) and running pace (seconds per km): learned from rides and runs you've
// logged with a distance in the last 8 weeks, otherwise your own numbers from Settings.
function paces() {
  return memo('paces', () => {
    const t = today(), from = addDays(t, -56);
    const learn = (sport, min, lo, hi) => {
      if (!S.pace.auto) return null;
      const ls = S.logs.filter(l => l.sport === sport && l.src !== 'plan' && l.km > 0 && l.mins >= min && l.d >= from && l.d <= t && l.rpe <= 5)
        .filter(l => { const v = l.km / (l.mins / 60); return v >= lo && v <= hi; })
        .sort((a, b) => (b.d + b.at).localeCompare(a.d + a.at)).slice(0, 6);
      return ls.length >= 2 ? { n: ls.length, v: sum(ls.map(l => l.km)) / (sum(ls.map(l => l.mins)) / 60) } : null;
    };
    const r = learn('bike', 40, 12, 45), u = learn('run', 20, 6, 20);
    return {
      ride: r ? clamp(Math.round(r.v * 2) / 2, 12, 45) : S.pace.ride,
      run: u ? clamp(Math.round(3600 / u.v / 5) * 5, 180, 600) : S.pace.run,
      rideN: r ? r.n : 0,
      runN: u ? u.n : 0,
    };
  });
}
const speedFor = (sport, effort) => (sport === 'bike' ? paces().ride : sport === 'run' ? 3600 / paces().run : 0) * (EFFORT_SPEED[effort] || 1);
const kmFor = (sport, mins, effort) => mins / 60 * speedFor(sport, effort);
const minsFor = (sport, km, effort) => Math.max(5, Math.round(km / speedFor(sport, effort) * 60));
const kmNum = (km, sport) => (sport === 'bike' ? Math.round(km) : Math.round(km * 10) / 10);
const fmtKm = (km, sport) => (sport === 'swim' ? `${Math.round(km * 1000).toLocaleString('en-AU')} m` : `${kmNum(km, sport)} km`);
const fmtPace = secs => `${Math.floor(secs / 60)}:${pad(Math.round(secs % 60))} /km`;
const reaches = (sport, km) => (sport === 'swim' ? Math.round(km * 1000) >= 1900 : kmNum(km, sport) >= RACE_KM[sport]);
const runKm = (km, peak) => (km >= peak - 0.25 ? peak : Math.max(3, Math.round(km * 2) / 2));

// How far each part of a session goes: [{ sport, km }]. Swims use their metres.
function legKm(s) {
  if (s.sport === 'swim') return s.metres ? [{ sport: 'swim', km: s.metres / 1000 }] : [];
  if (s.parts) return s.parts.map(p => ({ sport: p.sport, km: kmFor(p.sport, p.mins, s.effort) }));
  return s.sport === 'bike' || s.sport === 'run' ? [{ sport: s.sport, km: kmFor(s.sport, s.mins, s.effort) }] : [];
}
const distLabel = s => legKm(s).map(x => fmtKm(x.km, x.sport)).join(' + ');
// A logged workout's distance, estimated from its time at your easy pace if it has none.
const logKm = l => l.km || (l.sport === 'bike' || l.sport === 'run' ? kmFor(l.sport, l.mins, 'easy') : 0);

function mk(w, role, o) {
  return Object.assign({
    id: `${w.key}:${role}`, role, week: w.key, sport: 'other', title: '', mins: 30, effort: 'easy',
    key: false, opt: false, w: 1, wxk: 'indoor', steps: [], why: '', tips: [], parts: null, metres: 0, cont: 0, fixed: null, prefer: null,
  }, o);
}

/* ---------- the plan ---------- */
let PLAN = null;
function plan() {
  const pc = paces();
  const sig = [S.start, S.race.date, S.race.name, S.base.ride, S.base.run, S.base.hours, pc.ride, pc.run].join('|');
  if (PLAN && PLAN.sig === sig) return PLAN;
  PLAN = buildPlan();
  PLAN.sig = sig;
  return PLAN;
}

function buildPlan() {
  const start = S.start, raceMon = mondayOf(S.race.date);
  const n = Math.max(1, Math.round(daysBetween(start, raceMon) / 7) + 1);
  const V = VOLUME[S.base.hours] || VOLUME[8];
  const rideKmh = speedFor('bike', 'easy'), runKmh = speedFor('run', 'easy');
  // The long ride and long run build by distance, to at least race distance three weeks out.
  const timeRide = clamp(Math.max(V.ride, round5(S.base.ride + 30)), 60, 270);
  const timeRun = clamp(Math.max(V.run, round5(S.base.run + 15)), 30, 130);
  let peakRideKm = clamp(Math.max(RIDE_GOAL_KM, timeRide / 60 * rideKmh), RACE_KM.bike, 120);
  if (peakRideKm / rideKmh > 5.5) peakRideKm = Math.max(RACE_KM.bike, 5.5 * rideKmh);
  const peakRunKm = clamp(timeRun / 60 * runKmh, RACE_KM.run, 24);
  const P = {
    V, n, start, raceMon, peakRideKm, peakRunKm,
    ride0Km: Math.min(S.base.ride / 60 * rideKmh, peakRideKm), run0Km: Math.min(S.base.run / 60 * runKmh, peakRunKm),
    peakRide: minsFor('bike', peakRideKm, 'easy'),
    peakRun: minsFor('run', peakRunKm, 'easy'),
  };
  const weeks = [];
  for (let i = 0; i < n; i++) {
    const wtr = n - 1 - i;
    const phase = wtr === 0 ? 'race' : wtr === 1 ? 'taper' : wtr <= 5 ? 'peak' : wtr <= 13 ? 'build' : 'base';
    weeks.push({ i, n, key: addDays(start, 7 * i), wtr, phase, rec: wtr >= 6 && (wtr - 6) % 4 === 0, sharpen: wtr === 2 });
  }
  // Load weeks climb from where you are now (f = 0) to the biggest week three weeks out (f = 1).
  const loads = weeks.filter(w => !w.rec && w.wtr >= 3);
  loads.forEach((w, j) => { w.f = loads.length > 1 ? j / (loads.length - 1) : 1; });
  let prevLoad = null;
  for (const w of weeks) {
    if (w.f == null) w.f = prevLoad ? prevLoad.f : 0;
    w.firstEasy = w.rec && !prevLoad;
    w.k = w.rec ? (prevLoad ? 0.7 : 0.88) : 1;
    w.sessions = makeWeek(w, P).filter(Boolean);
    if (!w.rec && w.wtr >= 3) prevLoad = w;
  }
  // How each session compares with the same one last week (long sessions by distance too).
  for (let i = 1; i < weeks.length; i++) {
    const prev = {};
    for (const s of weeks[i - 1].sessions) prev[s.role] = s;
    for (const s of weeks[i].sessions) {
      const p = prev[s.role];
      if (p && p.sport !== 'race') s.delta = (s.parts ? s.parts[0].mins : s.mins) - (p.parts ? p.parts[0].mins : p.mins);
      if (p && (s.role === 'longride' || s.role === 'longrun')) {
        const a = legKm(s)[0], b = legKm(p)[0];
        if (a && b && a.sport === b.sport) s.deltaKm = kmNum(a.km, a.sport) - kmNum(b.km, b.sport);
      }
    }
  }
  // The first time each discipline reaches race distance: the swim in one go, the long ride and the long run.
  const firsts = {};
  for (const w of weeks) {
    for (const s of w.sessions) {
      const legs = s.role === 'swim' ? [{ sport: 'swim', km: s.cont / 1000 }] : s.role === 'longride' || s.role === 'longrun' ? legKm(s).slice(0, 1) : [];
      for (const x of legs) if (!firsts[x.sport] && reaches(x.sport, x.km)) { firsts[x.sport] = { key: w.key, i: w.i, sid: s.id }; s.milestone = x.sport; }
    }
  }
  const byKey = {};
  for (const w of weeks) {
    byKey[w.key] = w;
    w.total = sum(w.sessions.filter(s => s.sport !== 'race').map(s => s.mins));
  }
  return { P, weeks, byKey, start, raceMon, firsts };
}

function makeWeek(w, P) {
  if (w.phase === 'race') {
    const rd = dayIdx(S.race.date);
    const at = k => (rd - k >= 0 ? rd - k : null);
    return [
      Object.assign(swimSession(w), { prefer: at(5) }),
      mk(w, 'ride2', { sport: 'bike', title: 'Ride openers', mins: 40, effort: 'mixed', w: 1.2, wxk: 'ride', prefer: at(4), steps: ['20 min easy', '3 × 2 min at race effort, 2 min easy between', 'Spin easy to finish, and check your bike is running perfectly'], why: 'Wakes your legs up for race day without tiring them.' }),
      mk(w, 'run2', { sport: 'run', title: 'Run openers', mins: 25, effort: 'mixed', w: 1, wxk: 'run', prefer: at(3), steps: ['15 min easy', '4 × 20 s strides, walking back between', '5 min easy'], why: 'A few quick strides keep your running legs sharp.' }),
      mk(w, 'shake', { sport: 'brick', title: 'Day-before shake-out', mins: 30, parts: [{ sport: 'bike', mins: 20 }, { sport: 'run', mins: 10 }], effort: 'easy', w: 1, wxk: 'ride', prefer: at(1), steps: ['Ride 20 min easy with 3 × 30 s at race effort', 'Run 10 min easy with 3 short strides', 'Check your bike, pack your bags, eat well and get to bed early'], why: 'Short and easy: just enough to feel ready.' }),
      mk(w, 'race', { sport: 'race', title: S.race.name || 'Race day', mins: 0, effort: 'race', key: true, w: 5, fixed: rd, steps: ['1.9 km swim · 90 km bike · 21.1 km run', 'Start the bike easy: the first 20 min should feel too easy', 'Eat and drink early and often on the bike', 'Run the first 5 km steady, then settle in and enjoy it', 'Smile for the finish-line photo!'], why: 'Everything you’ve built comes together today.' }),
    ];
  }
  return [
    swimSession(w),
    longRide(w, P),
    rideTwo(w, P),
    rideThree(w, P),
    longRun(w, P),
    runTwo(w, P),
    runThree(w, P),
    strengthSession(w, P),
  ];
}

function swimSession(w) {
  const o = { sport: 'swim', wxk: 'swim', w: 1, effort: 'steady', why: 'One good swim a week keeps your swim strong while the bike and run get the extra time.' };
  let title, metres, steps, cont, tips = [];
  if (w.phase === 'race') {
    title = 'Pre-race swim'; metres = 1200; cont = 400; o.effort = 'easy'; o.why = 'Loosens you up and reminds your body of race effort, without tiring you.';
    steps = ['400 m easy', '4 × 100 m at race effort, 20 s rest', '4 × 50 m easy, 15 s rest', '200 m easy'];
    tips = ['If you can, have a swim in your wetsuit at the race venue.'];
  } else if (w.phase === 'taper') {
    title = 'Sharp swim'; metres = 2000; cont = 400; o.why = 'Keeps your feel for the water while you freshen up.';
    steps = ['400 m easy', '8 × 100 m at race effort, 15 s rest', '4 × 50 m building to strong, 15 s rest', '400 m easy with a pull buoy', '200 m easy'];
  } else if (w.sharpen) {
    title = 'Race-distance swim'; metres = 2700; cont = 2000; o.why = 'A full race-distance swim at race effort: proof you’re ready for the 1.9 km.';
    steps = ['400 m easy warm-up', '2,000 m continuous at race effort, sighting every 6–8 strokes', '300 m easy'];
    tips = ['Do this one in open water in your wetsuit if you can.'];
  } else {
    const m0 = 2000 + 1000 * w.f;
    if (w.rec) {
      const reps = Math.max(4, Math.round((m0 * 0.8 - 700) / 100));
      title = 'Easy swim'; o.effort = 'easy'; metres = 700 + reps * 100; cont = 300; o.why = 'A lighter swim in a lighter week. Stay smooth and relaxed.';
      steps = ['300 m easy, mixing strokes', `${reps} × 100 m smooth and easy, 15 s rest`, '200 m with a pull buoy', '200 m easy'];
    } else if (w.phase === 'base') {
      const reps = Math.max(2, Math.round((m0 - 700) / 400));
      title = 'Endurance swim'; metres = 700 + reps * 400; cont = 400;
      steps = ['300 m easy warm-up', '4 × 50 m drills (catch-up, fingertip drag), 15 s rest', `${reps} × 400 m steady, 20 s rest`, '200 m easy'];
    } else if (w.phase === 'build') {
      // Longer repeats through the build, so the distance you swim in one go grows towards 1.9 km.
      const len = round100(500 + 1000 * clamp((13 - w.wtr) / 6, 0, 1));
      const reps = Math.max(1, Math.floor((m0 - 600) / len));
      const extra = round100(m0 - 600 - reps * len);
      title = 'Steady swim'; cont = len; metres = 600 + reps * len + (extra >= 300 ? extra : 0);
      steps = ['400 m easy warm-up', reps > 1 ? `${reps} × ${len.toLocaleString('en-AU')} m at race effort, 30 s rest. Sight every 6–8 strokes` : `${len.toLocaleString('en-AU')} m continuous at race effort, sighting every 6–8 strokes`];
      if (extra >= 300) steps.push(`${extra.toLocaleString('en-AU')} m easy with a pull buoy`);
      steps.push('200 m easy');
    } else {
      const c = clamp(round100(m0 - 600), 1900, round100(1900 + 250 * (5 - w.wtr)));
      title = 'Long continuous swim'; metres = 600 + c; cont = c;
      steps = ['400 m easy warm-up', `${c.toLocaleString('en-AU')} m continuous at race effort, sighting every 6–8 strokes`, '200 m easy'];
      tips = ['Open water in your wetsuit is perfect for this one if you can.'];
    }
  }
  return mk(w, 'swim', Object.assign(o, { title, metres, cont, mins: swimMins(metres), steps, tips }));
}

function longRide(w, P) {
  if (w.phase === 'race') return null;
  const o = { key: true, w: 3, wxk: 'longride', tips: [FUEL_RIDE], why: 'The engine builder. Long, easy time in the saddle is what grows your endurance for the 90 km.' };
  if (w.phase === 'taper') {
    return mk(w, 'longride', Object.assign(o, { sport: 'bike', title: 'Taper ride', mins: round5(P.peakRide * 0.55), effort: 'mixed', steps: ['20 min easy', '3 × 10 min at race effort, 5 min easy between', 'Easy to finish'], why: 'Shorter, with a few race-effort blocks to keep you sharp.' }));
  }
  if (w.sharpen) {
    const km = Math.round(P.peakRideKm * 0.85);
    const ride = minsFor('bike', km, 'steady');
    return mk(w, 'longride', Object.assign(o, {
      sport: 'brick', title: 'Race rehearsal', mins: ride + 30, parts: [{ sport: 'bike', mins: ride }, { sport: 'run', mins: 30 }], effort: 'steady',
      steps: [`Ride ${km} km (about ${fmtDur(ride)}): 30 min easy, then race effort for the rest`, 'Use your race-day bike set-up, kit and nutrition', `Straight into a 30 min run (about ${fmtKm(kmFor('run', 30, 'steady'), 'run')}): 10 min easy, then race effort`, 'Note what worked. Nothing new on race day'],
      why: 'Your dress rehearsal: practise pacing, fuelling and the change from bike to run.',
    }));
  }
  const km = Math.max(10, Math.round(geo(P.ride0Km, P.peakRideKm, w.f) * w.k));
  const ride = minsFor('bike', km, 'easy');
  const dist = `${km} km (about ${fmtDur(ride)})`;
  if (w.rec) {
    return mk(w, 'longride', Object.assign(o, { sport: 'bike', title: w.firstEasy ? 'Easy-start long ride' : 'Easy long ride', mins: ride, effort: 'easy', steps: [`Ride ${dist} easy and relaxed`, 'Keep it chatty the whole way', 'Fuel like a normal long ride'], why: w.firstEasy ? 'An easy first week to find your rhythm before the build starts.' : 'A lighter week lets your body absorb the training and come back stronger.' }));
  }
  const steps = [];
  let effort = 'easy';
  if (w.phase === 'base') {
    steps.push('First 15 min very easy to warm up', `Ride ${dist} at an easy, chatty effort`, 'Keep pedalling smooth (about 80–95 rpm) and stay relaxed on the hills');
  } else {
    const n = w.phase === 'peak' ? 3 : 2, len = w.phase === 'peak' ? 25 : w.wtr <= 9 ? 20 : 15;
    if (n * (len + 5) <= ride - 40) { effort = 'mixed'; steps.push(`Ride ${dist} in total`, 'Start with 20 min easy', `${n} × ${len} min at race effort, 5 min easy between`, 'The rest easy and steady'); } else steps.push(`Ride ${dist} at an easy, chatty effort`);
  }
  steps.push('Eat every 30 min and sip every 10–15 min');
  const brick = BRICK_RUN[w.wtr] || 0;
  if (brick) {
    steps.push(`Straight off the bike, run ${brick} min easy (about ${fmtKm(kmFor('run', brick, effort), 'run')}). Change quickly: it’s transition practice too`);
    return mk(w, 'longride', Object.assign(o, { sport: 'brick', title: 'Long ride + brick run', mins: ride + brick, parts: [{ sport: 'bike', mins: ride }, { sport: 'run', mins: brick }], effort, steps, why: o.why + ' The brick run teaches your legs to run off the bike.' }));
  }
  return mk(w, 'longride', Object.assign(o, { sport: 'bike', title: 'Long ride', mins: ride, effort, steps }));
}

function rideTwo(w, P) {
  const o = { sport: 'bike', w: 1.4, wxk: 'ride', why: 'Mid-week riding adds to your bike endurance. Indoors on a trainer is fine.' };
  if (w.phase === 'taper') return mk(w, 'ride2', Object.assign(o, { title: 'Short ride with openers', mins: 60, effort: 'mixed', steps: ['15 min easy', '4 × 3 min at race effort, 3 min easy between', 'Easy to finish'], why: 'Keeps your legs sharp while you freshen up.' }));
  const m = round5(lin(P.V.ride2, w.f) * w.k);
  if (w.rec) return mk(w, 'ride2', Object.assign(o, { title: 'Easy ride', mins: m, effort: 'easy', steps: ['Indoors or out', `Spin ${fmtDur(m)} easy`] }));
  if (w.phase === 'base') return mk(w, 'ride2', Object.assign(o, { title: 'Endurance ride', mins: m, effort: 'easy', steps: ['Indoors or out', `Ride ${fmtDur(m)} easy and smooth`, 'Add 4 × 1 min fast spin (100+ rpm) in the middle'] }));
  const mm = w.sharpen ? Math.min(m, 75) : m;
  const len = clamp(Math.floor((mm - 25) / 3) - 4, 6, 15);
  return mk(w, 'ride2', Object.assign(o, { title: 'Ride with race-effort blocks', mins: mm, effort: 'mixed', steps: ['15 min easy', `3 × ${len} min at race effort, 4 min easy between`, 'Easy to finish'], why: 'Practises holding race effort so it feels natural on the day.' }));
}

function rideThree(w, P) {
  if (!P.V.ride3 || w.phase === 'taper' || w.phase === 'race') return null;
  const m = w.sharpen ? 45 : round5(lin(P.V.ride3, w.f) * w.k);
  return mk(w, 'ride3', { sport: 'bike', title: 'Easy spin', mins: m, effort: 'recovery', w: 0.8, wxk: 'ride', steps: ['Light gears, very easy', '6 × 1 min fast spin (100+ rpm), 2 min easy between', 'A trainer ride is perfect for this one'], why: 'Easy extra time on the bike, and smoother pedalling.' });
}

function longRun(w, P) {
  if (w.phase === 'race') return null;
  const o = { sport: 'run', key: true, w: 2.5, wxk: 'longrun', why: 'Builds the running endurance for the half marathon at the end of your day.' };
  if (w.phase === 'taper') return mk(w, 'longrun', Object.assign(o, { title: 'Taper run', mins: Math.min(60, round5(P.peakRun * 0.6)), effort: 'mixed', steps: ['15 min easy', '3 × 5 min at race effort, 3 min easy between', 'Easy to finish'], why: 'Shorter, with a touch of race effort to stay sharp.' }));
  if (w.sharpen) {
    const km = runKm(P.peakRunKm * 0.75, P.peakRunKm);
    const m = minsFor('run', km, 'easy');
    return mk(w, 'longrun', Object.assign(o, { title: 'Last long run', mins: m, effort: 'easy', steps: [`Run ${fmtKm(km, 'run')} easy (about ${fmtDur(m)})`, 'Your last long one: keep it relaxed and enjoy it'], tips: m >= 75 ? [FUEL_RUN] : [] }));
  }
  const km = runKm(geo(P.run0Km, P.peakRunKm, w.f) * w.k, P.peakRunKm);
  const m = minsFor('run', km, 'easy');
  const dist = `${fmtKm(km, 'run')} (about ${fmtDur(m)})`;
  const tips = m >= 75 ? [FUEL_RUN] : [];
  if (m >= 140) tips.push('This is a long time on your feet. Walk breaks are fine and won’t stop you finishing the distance.');
  if (w.rec) return mk(w, 'longrun', Object.assign(o, { title: w.firstEasy ? 'Easy-start long run' : 'Easy long run', mins: m, effort: 'easy', tips, steps: [`Run ${dist} easy`, 'Walk breaks are fine', 'Finish feeling like you could do more'] }));
  if (w.phase === 'base') {
    return mk(w, 'longrun', Object.assign(o, { title: 'Long run', mins: m, effort: 'easy', tips, steps: ['Start slower than feels natural', `Run ${dist} at an easy, chatty effort`, 'Walk breaks are fine: try 9 min run, 1 min walk if you need them', 'Time on your feet matters more than pace'] }));
  }
  if (w.phase === 'peak' && w.wtr % 2 === 1 && m >= 70) {
    return mk(w, 'longrun', Object.assign(o, { title: 'Long run, race-effort middle', mins: m, effort: 'mixed', tips, steps: [`Run ${dist} in total`, '20 min easy', '30 min at race effort', `${fmtDur(m - 50)} easy to finish`] }));
  }
  const fin = w.wtr >= 10 ? 10 : 15;
  return mk(w, 'longrun', Object.assign(o, { title: 'Long run, steady finish', mins: m, effort: 'mixed', tips, steps: [`Run ${dist} in total`, 'Easy for most of it', `Last ${fin} min at race effort`, 'Walk 5 min to cool down'] }));
}

function runTwo(w, P) {
  const o = { sport: 'run', w: 1, wxk: 'run', why: 'Regular easy running builds your durability for race day.' };
  if (w.phase === 'taper') return mk(w, 'run2', Object.assign(o, { title: 'Easy run + strides', mins: 35, effort: 'easy', steps: ['Easy and relaxed', 'Finish with 6 × 20 s strides: quick, tall and relaxed, walking back between'] }));
  const m = round5(lin(P.V.run2, w.f) * w.k);
  if (w.rec || w.phase === 'base') return mk(w, 'run2', Object.assign(o, { title: 'Easy run', mins: m, effort: 'easy', steps: ['Relaxed and conversational', 'Finish feeling like you could keep going'] }));
  return mk(w, 'run2', Object.assign(o, { title: 'Easy run + strides', mins: w.sharpen ? Math.min(m, 40) : m, effort: 'easy', steps: ['Easy and relaxed', 'Finish with 6 × 20 s strides: quick, tall and relaxed, walking back between'] }));
}

function runThree(w, P) {
  if (w.phase === 'taper' || w.phase === 'race') return null;
  const m = w.sharpen ? 25 : round5(lin(P.V.run3, w.f) * w.k);
  const easy = w.phase === 'base' || w.rec;
  return mk(w, 'run3', { sport: 'run', title: easy ? 'Short easy run' : 'Recovery run', mins: m, effort: easy ? 'easy' : 'recovery', w: 0.8, wxk: 'run', steps: easy ? [`Run ${fmtDur(m)} easy`, 'Soft surfaces like grass or trails are kind to your legs'] : [`Jog ${fmtDur(m)} very easy`, 'Slower than you think. It’s about time on your feet'], why: 'Extra easy running builds durability without much fatigue.' });
}

function strengthSession(w, P) {
  if (w.phase === 'taper' || w.phase === 'race' || w.sharpen) return null;
  const m = w.phase === 'peak' || w.rec ? 20 : P.V.str;
  return mk(w, 'strength', {
    sport: 'strength', title: 'Strength & mobility', mins: m, effort: 'easy', opt: true, w: 0.5, wxk: 'indoor',
    steps: [m >= 30 ? '3 rounds of:' : '2 rounds of:', '10 squats and 8 reverse lunges each leg', '10 single-leg deadlifts each leg (or glute bridges)', '15 calf raises, 30 s plank, 20 s side plank each side', 'Finish with 5 min of stretching: hips, calves, hamstrings'],
    why: 'Keeps your body robust for all that running and riding: the best injury insurance.',
  });
}

/* ---------- a week's sessions, with your changes ---------- */
const planWeek = key => plan().byKey[key] || null;
const inPlan = key => !!planWeek(key);
const weekNo = key => { const w = planWeek(key); return w ? w.i + 1 : 0; };

function setMins(s, m) {
  m = clamp(Math.round(m), 5, 600);
  if (s.parts) {
    const run = s.parts[1].mins;
    const bike = Math.max(10, m - run);
    s.parts = [{ sport: 'bike', mins: bike }, { sport: 'run', mins: run }];
    s.mins = bike + run;
  } else {
    if (s.metres) s.metres = round100(s.metres * m / s.mins);
    s.mins = m;
  }
}

// Holds the long ride and long run back if what you've logged lately is well short of the plan.
function safeCap(s) {
  if (!S.settings.adapt || (s.role !== 'longride' && s.role !== 'longrun')) return null;
  const t = today(), wk = mondayOf(t);
  if (s.week < wk || s.week > addDays(wk, 7) || daysBetween(S.start, t) < 14) return null;
  const sport = s.role === 'longrun' ? 'run' : 'bike';
  const from = addDays(t, -28);
  const recent = S.logs.filter(l => l.sport === sport && l.d >= from && l.d <= t);
  if (!recent.length) return null;
  const best = Math.max(...recent.map(l => l.mins));
  const cap = sport === 'bike' ? round5(Math.max(best * 1.25, best + 20)) : round5(Math.max(best * 1.2, best + 10));
  const cur = s.parts ? s.parts[0].mins : s.mins;
  return cur > cap ? { mins: cap, best, plan: cur } : null;
}

function baseSessions(key) {
  return memo('bs' + key, () => {
    const pw = planWeek(key);
    const st = weekRead(key);
    const list = (pw ? pw.sessions : []).map(s => Object.assign({}, s, { parts: s.parts ? s.parts.map(p => Object.assign({}, p)) : null }));
    for (const c of st.custom) {
      list.push(mk({ key }, `c-${c.id}`, {
        sport: c.sport, title: c.title, mins: c.mins, custom: c.id, w: 0.8,
        wxk: c.sport === 'bike' ? 'ride' : c.sport === 'run' ? 'run' : c.sport === 'swim' ? 'swim' : 'indoor',
        why: 'Your own session. It counts towards your week.',
      }));
    }
    for (const s of list) {
      if (st.mins[s.id]) { setMins(s, st.mins[s.id] + (s.parts ? s.parts[1].mins : 0)); s.edited = true; } else {
        const cap = safeCap(s);
        if (cap) {
          setMins(s, cap.mins + (s.parts ? s.parts[1].mins : 0));
          s.capped = cap;
        }
      }
      s.day = s.fixed != null ? s.fixed : st.at[s.id] != null ? st.at[s.id] : null;
      s.pin = !!st.pin[s.id];
      s.skip = !!st.skip[s.id];
      s.why = st.why[s.id] || '';
      const f = feelFor(s, st);
      if (f) feelAdjust(s, f);
    }
    return list;
  });
}

function sessionsFor(key) {
  return memo('ss' + key, () => baseSessions(key).map(b => {
    const s = Object.assign({}, b);
    s.logs = logsFor(s.id).slice().sort((a, c) => (a.d + a.at).localeCompare(c.d + c.at));
    s.done = s.logs.length > 0;
    s.doneMins = sum(s.logs.map(l => l.mins));
    if (s.done && mondayOf(s.logs[0].d) === key) s.day = dayIdx(s.logs[0].d);
    return s;
  }));
}

const findSession = sid => { const k = String(sid).split(':')[0]; return isKey(k) ? sessionsFor(k).find(s => s.id === sid) || null : null; };

// Planned and done minutes for a week, by sport (a brick counts towards bike and run).
function weekTotals(key) {
  return memo('wt' + key, () => {
    const out = { plan: 0, done: 0, by: {}, sessions: 0, doneSessions: 0 };
    const add = (sport, f, m) => { const o = out.by[sport] || (out.by[sport] = { plan: 0, done: 0 }); o[f] += m; };
    for (const s of sessionsFor(key)) {
      if (s.skip || s.rest || s.sport === 'race') continue;
      out.plan += s.mins;
      out.sessions++;
      if (s.done) out.doneSessions++;
      if (s.parts) for (const p of s.parts) add(p.sport, 'plan', p.mins); else add(s.sport, 'plan', s.mins);
    }
    for (let i = 0; i < 7; i++) {
      for (const l of logsOn(addDays(key, i))) { out.done += l.mins; add(l.sport, 'done', l.mins); }
    }
    return out;
  });
}

const daysToRace = () => daysBetween(today(), S.race.date);
const durLabel = s => (s.sport === 'race' ? 'Race' : s.parts ? `${fmtHM(s.parts[0].mins)} + ${s.parts[1].mins}m` : s.mins >= 60 ? fmtHM(s.mins) : `${s.mins}m`);
const durHtml = s => {
  if (s.sport === 'race') return 'Race';
  if (s.parts) return `${fmtHM(s.parts[0].mins)}<small>+${s.parts[1].mins}</small>`;
  return s.mins >= 60 ? fmtHM(s.mins) : `${s.mins}<small>min</small>`;
};
