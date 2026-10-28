/* Tri Hard — daily check-in: say how you feel and today's training adjusts to suit */
'use strict';

const FEEL = {
  fresh: { name: 'Fresh', icon: 'bolt', line: 'Feeling fresh' },
  tired: { name: 'Tired', icon: 'rest', line: 'Feeling tired' },
  sore: { name: 'Sore', icon: 'sore', line: 'Feeling sore' },
  sick: { name: 'Sick', icon: 'thermo', line: 'Feeling unwell' },
};
const checkinOn = () => S.settings.checkin !== false;
const feelWord = f => (f === 'sick' ? 'unwell' : f);

// When a workout happened: its start time if Strava sent one, otherwise when it was logged.
function logTime(l) {
  if (!l.at) return l.t || 0;
  const [h, m] = l.at.split(':').map(Number);
  const d = fromKey(l.d);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// The check-in that applies to a session on its day, if any. Sessions already done before
// you checked in stay as they were, and a sick day doesn't apply to anything you did anyway.
function feelFor(s, st) {
  if (!checkinOn() || s.day == null || s.sport === 'race' || st.full[s.id]) return '';
  const f = st.feel[s.day];
  if (!f || f === 'fresh') return '';
  const logs = logsFor(s.id);
  if (!logs.length) return f;
  if (f === 'sick') return '';
  const at = st.feelAt[s.day] || 0;
  return logs.some(l => logTime(l) < at) ? '' : f;
}

// Rewrites a session for how you feel. What the plan had stays in s.orig.
function feelAdjust(s, f) {
  s.orig = Object.assign({}, s, { parts: s.parts ? s.parts.map(p => Object.assign({}, p)) : null });
  s.feel = f;
  if (f === 'sick') { s.rest = true; return; }
  s.eased = true;
  const longOne = s.role === 'longride' || s.role === 'longrun';
  const hard = s.effort === 'steady' || s.effort === 'mixed';
  if (s.sport === 'strength' || s.sport === 'other') {
    Object.assign(s, {
      title: s.custom ? s.title : 'Mobility & stretching', mins: Math.min(15, s.mins), effort: 'recovery', opt: true,
      steps: ['10 min of gentle mobility: hips, hamstrings, calves and back', '5 min of easy stretching', 'Leave the harder work for another day'],
      why: f === 'sore' ? 'Gentle mobility instead, to loosen sore muscles.' : 'Gentle mobility instead, while you’re tired.',
    });
    return;
  }
  if (s.sport === 'swim') {
    if (f === 'tired') setMins(s, Math.max(15, round5(s.mins * 0.7)));
    Object.assign(s, {
      title: s.custom ? s.title : 'Easy swim', effort: 'easy',
      steps: [s.metres ? `About ${s.metres.toLocaleString('en-AU')} m, all easy and smooth` : 'All easy and smooth', f === 'sore' ? 'Use a pull buoy to rest your legs' : 'Mix in drills or backstroke if you like', 'Get out early if you still feel flat'],
      why: f === 'sore' ? 'Kept easy, with a pull buoy to rest sore legs.' : 'Shorter and easy while you’re tired.',
    });
    return;
  }
  if (f === 'sore' && s.sport === 'run') {
    Object.assign(s, {
      sport: 'bike', wxk: 'ride', effort: 'easy', tips: [],
      title: s.custom ? `${s.title}: easy spin instead` : longOne ? 'Easy ride instead of your long run' : 'Easy spin instead of your run',
      steps: [`Spin ${fmtDur(s.mins)} easy (about ${fmtKm(kmFor('bike', s.mins, 'easy'), 'bike')}), indoors or on a flat route`, 'Light gears and a quick cadence to loosen your legs', 'Run again once walking and jogging feel normal'],
      why: 'Swapped for an easy spin to give sore legs a break.',
    });
    return;
  }
  // A ride, run or brick: easy all the way, shorter, and no run off the bike.
  const sport = s.parts ? 'bike' : s.sport;
  const m = Math.max(20, round5((s.parts ? s.parts[0].mins : s.mins) * (f === 'tired' ? 0.7 : 0.85)));
  const effort = s.effort === 'recovery' ? 'recovery' : 'easy';
  Object.assign(s, {
    sport, parts: null, mins: m, effort,
    title: s.custom ? s.title : longOne ? `Shorter, easy long ${sport === 'bike' ? 'ride' : 'run'}` : hard || s.orig.parts ? (sport === 'bike' ? 'Easy ride' : 'Easy run') : s.title,
    steps: [
      `${sport === 'bike' ? 'Ride' : 'Run'} ${fmtDur(m)} easy and relaxed (about ${fmtKm(kmFor(sport, m, effort), sport)})`,
      hard ? 'Skip the race-effort blocks today' : null,
      s.orig.parts ? 'Skip the run off the bike today' : null,
      longOne && sport === 'bike' ? 'Eat and drink like a normal long ride' : null,
      f === 'sore' ? 'Stop if anything hurts more as you go' : 'Cut it short if you still feel flat after 15 min',
    ].filter(Boolean),
    why: f === 'sore' ? 'Kept easy and a bit shorter for sore legs.' : 'Eased off because you’re tired. Easy time still builds your endurance.',
  });
}

/* ---------- the card on the Week page ---------- */
function checkinHtml(key) {
  const t = today();
  if (!checkinOn() || key !== mondayOf(t) || t >= S.race.date || !inPlan(key)) return '';
  const d = dayIdx(t), f = weekRead(key).feel[d];
  if (!f || UI.feelEdit) {
    return `<section class="card checkin">
      <h3 class="card-title">How do you feel today?</h3>
      <p class="card-sub">Tap one and today’s training adjusts to suit.</p>
      <div class="feel-row" role="group" aria-label="How you feel today">${FEELS.map(v => `<button type="button" class="feel f-${v}${f === v ? ' on' : ''}" data-act="feel" data-v="${v}" aria-pressed="${f === v}">${icon(FEEL[v].icon)}<span>${FEEL[v].name}</span></button>`).join('')}</div>
      ${f ? `<div class="ci-foot"><button type="button" class="link-btn" data-act="feelkeep">Cancel</button><button type="button" class="link-btn" data-act="feelclear">Clear today’s check-in</button></div>` : ''}
    </section>`;
  }
  const care = f === 'sore' ? 'Sharp pain, or pain that gets worse as you go? Stop, and see a physio if it doesn’t settle.'
    : f === 'sick' ? 'Fever, a chesty cough or aching all over? Rest until it’s gone. A head cold? A gentle walk is fine.' : '';
  return `<section class="card checkin set f-${f}">
    <div class="ci-top"><span class="ci-ic">${icon(FEEL[f].icon)}</span><div><b>${FEEL[f].line}</b><small>${feelSummary(key, d, f)}</small></div>
      <button type="button" class="btn sm ghost" data-act="feeledit">Change</button></div>
    ${moveOffer(key, d, f)}
    ${care ? `<p class="hint">${care}</p>` : ''}
  </section>`;
}

function feelSummary(key, d, f) {
  const mine = sessionsFor(key).filter(s => s.day === d && !s.skip && s.sport !== 'race');
  const left = mine.filter(s => !s.done);
  const names = list => list.map(s => esc(s.title)).join(', ');
  if (f === 'fresh') return left.length ? 'Enjoy today’s training.' : mine.length ? 'Today’s training is done. Nice work.' : 'Nothing on today. Enjoy it.';
  if (f === 'sick') {
    const r = mine.filter(s => s.rest);
    return r.length ? `Rest day: ${names(r)} ${r.length > 1 ? 'are' : 'is'} off. Feel better later in the week? Drag ${r.length > 1 ? 'one' : 'it'} to another day.` : 'Rest up and get well soon.';
  }
  const e = mine.filter(s => s.eased && !s.done);
  if (e.length) return `Easier today: ${e.map(s => `${esc(s.title)} (${fmtDur(s.mins)})`).join(', ')}.`;
  return left.length ? 'Take it easy today.' : 'Nothing left to do today. Rest up.';
}

// Tired or sore with a long session today? Offer to move it, at full length, to a later day with room.
function moveOffer(key, d, f) {
  if (f !== 'tired' && f !== 'sore') return '';
  const list = sessionsFor(key);
  const s = list.find(x => x.day === d && x.eased && x.key && !x.done && x.fixed == null);
  if (!s) return '';
  for (let d2 = d + 1; d2 < 7; d2++) {
    const info = dayInfo(key, d2);
    const others = list.filter(x => x.day === d2 && !x.skip && !x.rest && x.id !== s.id);
    if (info.avail <= 0 || others.some(isKeyS) || sum(others.map(x => x.mins)) + s.orig.mins > info.avail + 10) continue;
    const what = s.role === 'longrun' ? 'long run' : s.orig.title === 'Race rehearsal' ? 'race rehearsal' : 'long ride';
    return `<div class="ci-move"><button type="button" class="btn sm" data-act="feelmove" data-sid="${s.id}" data-d="${d2}">${icon('clock')} Do your ${what} on ${DAYS_LONG[d2]} instead</button>
      <p class="hint">It moves at full length, and today stays easy.</p></div>`;
  }
  return '';
}

function setFeel(key, d, v) {
  const st = weekEdit(key);
  const before = { feel: st.feel[d], at: st.feelAt[d], full: Object.assign({}, st.full) };
  for (const s of sessionsFor(key)) if (s.day === d) delete st.full[s.id];
  st.feel[d] = v;
  st.feelAt[d] = v ? Date.now() : 0;
  UI.feelEdit = false;
  save();
  render();
  const mine = sessionsFor(key).filter(s => s.day === d && !s.skip);
  const eased = mine.filter(s => s.eased).length, rested = mine.filter(s => s.rest).length;
  const swapped = mine.some(s => s.eased && s.orig.sport === 'run' && s.sport === 'bike');
  const msg = !v ? 'Check-in cleared'
    : v === 'fresh' ? 'Love it. Go get it!'
      : v === 'sick' ? (rested ? 'Rest day. Get well soon!' : 'Noted. Get well soon!')
        : v === 'sore' && swapped ? 'Running swapped for an easy spin today'
          : eased ? `Eased ${plural(eased, 'session')} for today` : 'Noted. Take it easy today.';
  buzz(10);
  toast(msg, { undo: () => { const w = weekEdit(key); w.feel[d] = before.feel; w.feelAt[d] = before.at; w.full = before.full; save(); render(); } });
}
