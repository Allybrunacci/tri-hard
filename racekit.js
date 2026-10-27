/* Tri Hard — race-day kit: what to pack, race morning hour by hour, and your fuel and pacing plan */
'use strict';

const KIT = [
  { id: 'swim', name: 'Swim', icon: 'swim', cls: 's-swim', items: [
    ['wetsuit', 'Wetsuit (if the water’s cool enough)'],
    ['goggles', 'Goggles, plus a spare pair'],
    ['cap', 'Swim cap from your race pack'],
    ['glide', 'Anti-chafe for your neck'],
    ['chip', 'Timing chip and strap'],
  ] },
  { id: 'bike', name: 'Bike & T1', icon: 'bike', cls: 's-bike', items: [
    ['bike', 'Bike, checked and race-ready'],
    ['helmet', 'Helmet'],
    ['bshoes', 'Bike shoes'],
    ['glasses', 'Sunglasses'],
    ['bottles', 'Bottles, filled'],
    ['bfuel', 'Bike food: gels, bars or chews'],
    ['spares', 'Spare tube, tyre levers and CO2 or a pump'],
    ['computer', 'Bike computer or watch, charged'],
    ['stickers', 'Number stickers on your bike and helmet'],
  ] },
  { id: 'run', name: 'Run & T2', icon: 'run', cls: 's-run', items: [
    ['rshoes', 'Run shoes (elastic laces save time)'],
    ['socks', 'Socks'],
    ['belt', 'Race belt with your number'],
    ['visor', 'Cap or visor'],
    ['rfuel', 'Gels for the run'],
  ] },
  { id: 'morning', name: 'Race morning', icon: 'clock', cls: 's-brick', items: [
    ['trisuit', 'Tri suit'],
    ['sunscreen', 'Sunscreen'],
    ['breakfast', 'Your usual pre-race breakfast'],
    ['pump', 'Track pump'],
    ['warm', 'Warm layer and old shoes for the walk to the start'],
    ['tbag', 'Transition bag'],
    ['towel', 'Small towel'],
  ] },
  { id: 'after', name: 'After the finish', icon: 'race', cls: 's-race', items: [
    ['clothes', 'Dry clothes and comfy shoes'],
    ['recovery', 'Recovery snack and drink'],
    ['phone', 'Phone and charger'],
    ['card', 'Card or some cash'],
  ] },
];

const DAY_BEFORE = [
  'The short shake-out from your plan: 20 min easy on the bike and a 10 min jog.',
  'Bike check-in: most 70.3s rack bikes the day before. Your athlete guide has the times.',
  'Go to the race briefing, then put your feet up.',
  'A big, carb-rich lunch, then a normal dinner you know sits well. Nothing new.',
  'Lay everything out with your packing list. Number on your race belt, stickers on your bike and helmet.',
  'Set two alarms and get to bed early. A restless night is normal and won’t hurt your race.',
];

const RACE_MORNING = [
  [-180, 'Wake up and drink about 500 ml of water or electrolyte drink.'],
  [-165, 'Breakfast: the carb-rich one you’ve had before long rides. Nothing new today.'],
  [-120, 'Head to the venue with your transition bag and pump.'],
  [-105, 'Transition opens: pump your tyres, put your bottles and food on the bike, and leave it in an easy gear.'],
  [-90, 'Lay out your bike and run gear. Walk the routes: swim exit to your bike, and bike in to the run exit.'],
  [-60, 'Body marking and timing chip on (left ankle). Last toilet stop: the queues get long.'],
  [-45, 'Sunscreen, then wetsuit on, with anti-chafe on your neck.'],
  [-30, 'Transition usually closes about now. Warm up: an easy 5–10 min swim if it’s allowed, or arm swings on land.'],
  [-15, 'A gel and a few sips of water. Line up with people who swim your pace.'],
  [0, 'Go! Ease into the first 200 m, find some feet to follow, then settle into your rhythm.'],
];

const PACING = [
  { sport: 'swim', name: 'Swim', rpe: 'RPE 5–6', lines: ['Start at the side or back if you’d like clear water.', 'Ease into the first 200 m, then find some feet to follow.', 'Sight every 6–8 strokes and keep it smooth.'] },
  { sport: 'bike', name: 'Bike', rpe: 'RPE 3–4, then 5–6', lines: ['The first 20 min should feel too easy. Let people go.', 'Then hold race effort: you can talk in short phrases.', 'Keep it steady on hills rather than pushing hard up them.', 'Eat and drink by the clock, and spin easier for the last 5 min.'] },
  { sport: 'run', name: 'Run', rpe: 'RPE 5–6, then all in', lines: ['Run the first 5 km steady, even if you feel amazing.', 'Walking the aid stations to drink is fine, and often faster overall.', 'From 16 km, give it whatever you’ve got left.'] },
];

const FUEL_OPTS = [['good', 'Went well'], ['gut', 'Upset stomach'], ['low', 'Ran low on energy']];
const FUEL_STEP = { bikeG: [10, 30, 120], bikeMl: [50, 300, 1500], bikeMins: [10, 90, 480], gelEvery: [5, 15, 60], runMins: [5, 60, 360] };
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function clockAt(start, off) {
  const [h, m] = start.split(':').map(Number);
  const t = (((h * 60 + m + off) % 1440) + 1440) % 1440;
  return fmtClock(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
}

function kitItems() {
  const out = [];
  for (const g of KIT) for (const [id, t] of g.items) if (!S.kit.hide[id]) out.push({ id, t });
  for (const m of S.kit.mine) out.push({ id: m.id, t: m.t });
  return out;
}

function kitCount() {
  const items = kitItems();
  return { done: items.filter(it => S.kit.done[it.id]).length, total: items.length };
}

const kitBar = c => `<span class="kit-bar"><i style="width:${c.total ? Math.round(100 * c.done / c.total) : 0}%"></i></span>`;

function kitCard(sub) {
  const c = kitCount();
  return `<section class="card kit-card">
    <div class="sc-top"><span class="kit-mark">${icon('bag')}</span><div><b>Race-day kit</b><small>${sub}</small></div></div>
    <div class="kit-mini">${kitBar(c)}<span>${c.done} of ${c.total} packed</span></div>
    <button type="button" class="btn orange block" data-act="kit">${icon('bag')} Open race-day kit</button>
  </section>`;
}

// On the Week page from your rehearsal week until race day.
function kitCardHtml(key) {
  const pw = planWeek(key);
  if (!pw || pw.wtr > 2 || today() > S.race.date) return '';
  return kitCard(pw.wtr === 2 ? 'Try your packing list and fuel plan out on this week’s race rehearsal.'
    : pw.wtr === 1 ? 'Packing list, race morning, and your fuel and pacing plan.' : 'Race week! Everything for the big day in one place.');
}

/* ---------- packing ---------- */
function packHtml() {
  const c = kitCount();
  const groups = KIT.map(g => ({ name: g.name, icon: g.icon, cls: g.cls, items: g.items.filter(([id]) => !S.kit.hide[id]).map(([id, t]) => ({ id, t })) }));
  if (S.kit.mine.length) groups.push({ name: 'Your extras', icon: 'plus', cls: 's-other', items: S.kit.mine });
  const hidden = KIT.reduce((n, g) => n + g.items.filter(([id]) => S.kit.hide[id]).length, 0);
  const row = it => {
    const on = !!S.kit.done[it.id];
    return `<li class="kit-item${on ? ' on' : ''}"><button type="button" class="kit-tick" data-act="pack" data-id="${it.id}" role="checkbox" aria-checked="${on}"><span class="box">${icon('check')}</span><span class="t">${esc(it.t)}</span></button><button type="button" class="kit-x" data-act="hide" data-id="${it.id}" aria-label="Remove ${esc(it.t)}">${icon('x')}</button></li>`;
  };
  return `<div class="kit-prog">${kitBar(c)}<b>${c.done} of ${c.total} packed</b></div>
    <p class="hint">Your race pack has your numbers, stickers, swim cap and timing chip. Tick things off as they go in the bag.</p>
    ${groups.filter(g => g.items.length).map(g => `<div class="kit-group">
      <h4><span class="badge xs ${g.cls}" aria-hidden="true">${icon(g.icon)}</span>${g.name}<small>${g.items.filter(it => S.kit.done[it.id]).length}/${g.items.length}</small></h4>
      <ul class="kit-list">${g.items.map(row).join('')}</ul></div>`).join('')}
    <form class="kit-add" novalidate><input class="input" name="kitadd" maxlength="60" placeholder="Add your own, e.g. spare goggles" autocomplete="off" enterkeyhint="done" aria-label="Add your own item"><button type="submit" class="btn sm orange">${icon('plus')} Add</button></form>
    ${c.done || hidden ? `<div class="btn-row">${c.done ? '<button type="button" class="btn sm ghost" data-act="untick">Untick everything</button>' : ''}${hidden ? `<button type="button" class="btn sm ghost" data-act="unhide">Bring back ${plural(hidden, 'removed item')}</button>` : ''}</div>` : ''}`;
}

/* ---------- race morning ---------- */
function timesHtml() {
  const st = S.race.start;
  return `<div class="kit-when">Alarm <b>${clockAt(st, -180)}</b> · transition opens around <b>${clockAt(st, -105)}</b> · you start at <b>${clockAt(st, 0)}</b></div>
    <h3 class="ss-h">The day before</h3><ul class="tips">${DAY_BEFORE.map(x => `<li>${x}</li>`).join('')}</ul>
    <h3 class="ss-h">Race morning</h3><ol class="timeline">${RACE_MORNING.map(([m, x]) => `<li><time>${clockAt(st, m)}</time><span>${x}</span></li>`).join('')}</ol>`;
}

function morningHtml() {
  return `<div class="set-row kit-start"><span><b>Your start time</b><small>Your wave time is in the athlete guide</small></span><input type="time" class="input time-input" name="rstart" value="${S.race.start}" aria-label="Your start time"></div>
    <div class="kit-times">${timesHtml()}</div>
    <p class="hint">A guide only: your athlete guide has the exact times for transition and your start.</p>`;
}

/* ---------- fuel & pace ---------- */
const kmh = l => (l.km && l.mins ? l.km / (l.mins / 60) : 0);
function paceOf(km, mins) {
  if (!km || !mins) return '';
  const s = Math.round(mins * 60 / km);
  return `${Math.floor(s / 60)}:${pad(s % 60)} /km`;
}
const feltWord = l => { const e = EFFORTS.find(x => x[0] === l.rpe); return e ? e[1].toLowerCase() : ''; };
const newestFirst = (a, b) => (b.d + b.at).localeCompare(a.d + a.at) || b.t - a.t;

// What your race rehearsal says about pacing, once you've logged it.
function rehearsalLines() {
  const rw = plan().weeks.find(w => w.sharpen);
  if (!rw) return [];
  const logs = logsFor(`${rw.key}:longride`);
  const bike = logs.find(l => l.sport === 'bike'), run = logs.find(l => l.sport === 'run');
  if (!bike && !run) {
    return [addDays(rw.key, 6) < today() ? 'No race rehearsal logged, so let your long rides be your guide.'
      : `Your race rehearsal is in week ${rw.i + 1} (${fmtRange(rw.key, addDays(rw.key, 6))}). Log how it felt and your pacing tips show up here.`];
  }
  const out = [];
  if (bike) {
    const sp = kmh(bike);
    const tip = bike.rpe >= 7 ? ' Start the race ride a notch easier.'
      : bike.rpe === 5 ? ' That’s your race effort.'
        : bike.rpe && bike.rpe <= 3 ? ' Hold that for the first hour, then press on a little if you feel good.' : '';
    out.push(`Rehearsal ride: ${fmtDur(bike.mins)}${sp ? ` at ${sp.toFixed(1)} km/h` : ''}${feltWord(bike) ? `, felt ${feltWord(bike)}` : ''}.${tip}`);
  }
  if (run) {
    const tip = run.rpe >= 7 ? ' Run your first 5 km slower than you think you need to.'
      : run.rpe === 5 ? ' Just right off the bike.' : '';
    out.push(`Rehearsal run: ${fmtDur(run.mins)}${run.km ? ` at ${paceOf(run.km, run.mins)}` : ''}${feltWord(run) ? `, felt ${feltWord(run)}` : ''}.${tip}`);
  }
  return out;
}

// Your recent long sessions, as a rough guide.
function trainingLines() {
  const t = today(), from = addDays(t, -56);
  const pick = (sport, min) => S.logs.filter(l => l.sport === sport && l.mins >= min && l.km > 0 && l.d >= from && l.d <= t).sort(newestFirst).slice(0, 3);
  const rides = pick('bike', 90), runs = pick('run', 60);
  const out = [];
  const km = ls => sum(ls.map(l => l.km)), mins = ls => sum(ls.map(l => l.mins));
  if (rides.length) out.push(`Your long rides lately average ${(km(rides) / (mins(rides) / 60)).toFixed(1)} km/h.`);
  if (runs.length) out.push(`Your long runs lately average ${paceOf(km(runs), mins(runs))}.`);
  if (out.length) out.push('Race effort is a little quicker than those easy sessions, but go by feel: hills, wind and heat all change the numbers.');
  return out;
}

function fuelHtml() {
  const F = S.fuel;
  const bikeCarbs = Math.round(F.bikeG * F.bikeMins / 60 / 5) * 5;
  const bikeDrink = Math.round(F.bikeMl * F.bikeMins / 60 / 50) * 50;
  const runGels = Math.max(1, Math.floor((F.runMins - 1) / F.gelEvery));
  const row = (name, title, sub, shown) => `<div class="set-row"><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${stepper(name, F[name], title, shown)}</div>`;
  const notes = S.logs.filter(l => (l.sport === 'bike' || l.sport === 'run') && (l.fuel || l.fuelWhat)).sort(newestFirst);
  const count = v => notes.filter(l => l.fuel === v).length;
  const tally = FUEL_OPTS.filter(([v]) => count(v)).map(([v, t]) => `${t.toLowerCase()} ${count(v) === 1 ? 'once' : `${count(v)} times`}`);
  const label = v => (FUEL_OPTS.find(o => o[0] === v) || [0, 'Noted'])[1];
  const yours = rehearsalLines().concat(trainingLines());
  return `  <h3 class="ss-h">Your race fuel plan</h3>
    <div class="card pad fuel-set">
      ${row('bikeG', 'Carbs an hour on the bike', 'Most people manage 60–90 g with practice', `${F.bikeG} g`)}
      ${row('bikeMl', 'Drink an hour on the bike', 'More on a hot day', `${F.bikeMl} ml`)}
      ${row('bikeMins', 'Your rough bike time', '', fmtDur(F.bikeMins))}
      ${row('gelEvery', 'A gel on the run every', '', `${F.gelEvery} min`)}
      ${row('runMins', 'Your rough run time', '', fmtDur(F.runMins))}
    </div>
    <div class="tiles three fuel-tiles">
      <div class="tile t-orange"><small>Bike carbs</small><b>${bikeCarbs}<small>g</small></b><span>${Math.round(bikeCarbs / 25)} gels’ worth</span></div>
      <div class="tile t-navy"><small>Bike drink</small><b>${(bikeDrink / 1000).toFixed(1)}<small>L</small></b><span>about ${plural(Math.ceil(bikeDrink / 750), 'bottle')}</span></div>
      <div class="tile t-red"><small>Run gels</small><b>${runGels}</b><span>plus water at aid stations</span></div>
    </div>
    <ol class="steps fuel-steps">
      <li><span><b>Breakfast</b>, 2–3 hours before: your usual carb-rich one, like toast with honey and a banana.</span></li>
      <li><span><b>15 min before the start</b>: a gel and a few sips of water.</span></li>
      <li><span><b>On the bike</b>: from 15 min in, about ${F.bikeG} g of carbs and ${F.bikeMl} ml of drink an hour. Set your watch to beep every 20 min. Start with full bottles and top up at aid stations.</span></li>
      <li><span><b>On the run</b>: a gel every ${F.gelEvery} min, with water at the aid stations. Cola late in the run is a classic pick-me-up.</span></li>
      <li><span><b>Hot day?</b> Add electrolytes and drink to thirst, but don’t force down extra.</span></li>
    </ol>
    <p class="hint">Practise this exact plan on your long rides and race rehearsal. Nothing new on race day.</p>
    <h3 class="ss-h">What’s worked in training</h3>
    ${notes.length ? `${tally.length ? `<p class="lead">Your notes: ${tally.join(', ')}.</p>` : ''}
      <ul class="fuel-list">${notes.slice(0, 6).map(l => `<li class="fuel-row f-${l.fuel || 'none'}"><span class="fr-tag">${label(l.fuel)}</span><div><b>${esc(l.name || SPORTS[l.sport].name)} · ${fmtDur(l.mins)}</b><small>${fmtDay(l.d)}${l.fuelWhat ? ` · ${esc(l.fuelWhat)}` : ''}</small></div></li>`).join('')}</ul>
      ${count('gut') ? '<p class="hint">Upset stomach? Try fewer carbs an hour, smaller sips more often, or a different product, then practise again.</p>' : ''}
      ${count('low') ? '<p class="hint">Ran low on energy? Start eating earlier and add 10–20 g of carbs an hour.</p>' : ''}`
      : `<div class="note-box">${icon('bolt')}<span>When you log a ride or run, add what you ate and drank and how it went, under Fuel. Your notes show up here, so race day runs on what’s worked.</span></div>`}
    <h3 class="ss-h">Pacing</h3>
    <div class="pace">${PACING.map(p => `<div class="pace-leg s-${p.sport}">${badge(p.sport)}<div><b>${p.name}</b><em>${p.rpe}</em><ul>${p.lines.map(x => `<li>${x}</li>`).join('')}</ul></div></div>`).join('')}</div>
    ${yours.length ? `<div class="from-you"><b>From your training</b><ul>${yours.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}`;
}

/* ---------- the sheet ---------- */
function openRaceKit(tab) {
  let cur = ['pack', 'morning', 'fuel'].includes(tab) ? tab : 'pack';
  const tpl = () => `${sheetHead('Race-day kit', `${esc(S.race.name)} · ${fmtFull(S.race.date)}`)}
    ${seg([['pack', 'Packing'], ['morning', 'Race morning'], ['fuel', 'Fuel & pace']], cur, 'tab', 'kit-tabs')}
    <div class="kit-body">${cur === 'pack' ? packHtml() : cur === 'morning' ? morningHtml() : fuelHtml()}</div>`;
  let sheet = null;
  const refresh = () => { if (sheet && !sheet.closed) sheet.set(tpl()); else render(); };
  const addItem = sh => {
    const inp = $('input[name="kitadd"]', sh.el);
    const t = (inp ? inp.value : '').trim().slice(0, 60);
    if (!t) { toast('Type what you’d like to add'); return; }
    if (S.kit.mine.length >= 40) { toast('That’s a lot of extras! Remove one first.'); return; }
    S.kit.mine.push({ id: uid(), t });
    save();
    sh.set(tpl());
    const again = $('input[name="kitadd"]', sh.el);
    if (again) again.focus({ preventScroll: true });
  };
  sheet = openSheet(tpl(), {
    cls: 'kit-sheet',
    label: 'Race-day kit',
    act: {
      tab(a, e, sh) { cur = a.dataset.v; sh.set(tpl()); sh.el.scrollTop = 0; },
      pack(a, e, sh) {
        const id = a.dataset.id;
        if (S.kit.done[id]) delete S.kit.done[id]; else S.kit.done[id] = 1;
        save();
        sh.set(tpl());
        const c = kitCount();
        if (S.kit.done[id]) {
          buzz(8);
          if (c.done === c.total) { confetti(60); toast('All packed. You’re race-ready!'); }
        }
      },
      hide(a, e, sh) {
        const id = a.dataset.id;
        const i = S.kit.mine.findIndex(m => m.id === id);
        const was = !!S.kit.done[id];
        let undo;
        if (i >= 0) {
          const [m] = S.kit.mine.splice(i, 1);
          delete S.kit.done[id];
          undo = () => { S.kit.mine.splice(i, 0, m); if (was) S.kit.done[id] = 1; save(); refresh(); };
        } else {
          S.kit.hide[id] = 1;
          undo = () => { delete S.kit.hide[id]; save(); refresh(); };
        }
        save();
        sh.set(tpl());
        toast('Removed from your list', { undo });
      },
      unhide(a, e, sh) { S.kit.hide = {}; save(); sh.set(tpl()); },
      untick(a, e, sh) {
        const before = Object.assign({}, S.kit.done);
        S.kit.done = {};
        save();
        sh.set(tpl());
        toast('Everything unticked', { undo: () => { S.kit.done = before; save(); refresh(); } });
      },
      step(a, e, sh) {
        const n = a.dataset.name, lim = FUEL_STEP[n];
        if (!lim) return;
        S.fuel[n] = clamp(S.fuel[n] + lim[0] * +a.dataset.d, lim[1], lim[2]);
        save();
        sh.set(tpl());
      },
    },
    change(e, sh) {
      const t = e.target;
      if (t.name !== 'rstart' || !TIME_RE.test(t.value)) return;
      S.race.start = t.value;
      save();
      const box = $('.kit-times', sh.el);
      if (box) box.innerHTML = timesHtml();
    },
    submit(e, sh) { addItem(sh); },
    onClose() { render(); },
  });
}
