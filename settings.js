/* Tri Hard — settings, backups, Strava set-up and first-run setup */
'use strict';

const RIDE_OPTS = [[45, 'Under 1h'], [75, '1–1.5h'], [105, '1.5–2h'], [135, '2–2.5h'], [165, '2.5h+']];
const RUN_OPTS = [[25, 'Under 30m'], [40, '30–45m'], [55, '45–60m'], [70, '1–1.25h'], [85, '1.25h+']];
const HOUR_OPTS = [[6, '5–6 h'], [8, '7–8 h'], [10, '9–10 h'], [12, '11 h+']];
const WHEN_OPTS = [['morning', 'Mornings'], ['evening', 'Evenings'], ['any', 'Whenever']];
const nearest = (opts, v) => opts.reduce((a, b) => (Math.abs(b[0] - v) < Math.abs(a[0] - v) ? b : a))[0];
const availSelect = (name, v) => `<select class="input sm" name="${name}">${AVAIL_OPTS.map(m => `<option value="${m}"${m === v ? ' selected' : ''}>${fmtAvail(m)}</option>`).join('')}</select>`;

function exportData() {
  const copy = JSON.parse(JSON.stringify(S));
  copy.strava = { id: S.strava.id, secret: '', access: '', refresh: '', exp: 0, athlete: '', last: 0 };
  const json = JSON.stringify(copy, null, 1);
  const name = `tri-hard-backup-${today()}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  const standalone = !!(window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  if (standalone && navigator.canShare && typeof File === 'function') {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Tri Hard backup' }).then(() => toast('Backup shared')).catch(() => {}); return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Backup saved to your downloads');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let obj = null;
    try { obj = JSON.parse(reader.result); } catch (e) { obj = null; }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.logs) || !obj.race) { toast('That file doesn’t look like a Tri Hard backup'); return; }
    confirmSheet({
      title: 'Restore this backup?',
      body: `It has ${plural(obj.logs.length, 'workout')} and your plan for ${esc((obj.race && obj.race.name) || 'race day')}. It replaces everything on this device. Your Strava connection stays as it is.`,
      yes: 'Restore it', danger: true,
      onYes: () => {
        const keep = Object.assign({}, S.strava);
        const next = migrate(obj);
        next.onboarded = true;
        next.strava = Object.assign(next.strava, keep);
        replaceState(next);
        UI.week = null;
        save();
        render(true);
        toast('Backup restored');
      },
    });
  };
  reader.onerror = () => toast('Couldn’t read that file');
  reader.readAsText(file);
}

/* ---------- settings ---------- */
function openSettings(section) {
  let results = [], searching = false, paste = false;
  const tpl = () => {
    const host = location.hostname || 'localhost';
    const strava = stravaConnected()
      ? `<div class="set-row"><span><b>Connected${S.strava.athlete ? ` as ${esc(S.strava.athlete)}` : ''}</b><small>${S.strava.last ? `Last synced ${relTime(S.strava.last)}` : 'Not synced yet'}</small></span><button type="button" class="btn sm orange" data-act="sync">${icon('sync')} Sync</button></div>
        <div class="btn-row"><button type="button" class="btn ghost" data-act="disconnect">Disconnect Strava</button></div>`
      : `<div class="note up first">${icon('link')}<span><b>Needs a Strava subscription.</b> Strava only lets subscribers create the app below. Connecting costs nothing on top of that. No subscription? Tick off or log your workouts instead.</span></div>
        <ol class="howto">
          <li>In a browser, open <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">strava.com/settings/api</a> and create an app. Name it anything (say “Tri Hard”), pick any category, and use <b>${esc(location.origin + location.pathname)}</b> as the website.</li>
          <li>Set <b>Authorization Callback Domain</b> to <code>${esc(host)}</code>.</li>
          <li>Copy the <b>Client ID</b> and <b>Client Secret</b> into the boxes below, then tap Connect.</li>
        </ol>
        <div class="two-col"><div class="field"><label for="st-id">Client ID</label><input id="st-id" class="input" name="sid" inputmode="numeric" autocomplete="off" value="${esc(S.strava.id)}" placeholder="12345"></div>
          <div class="field"><label for="st-sec">Client Secret</label><input id="st-sec" class="input" name="ssecret" type="password" autocomplete="off" value="${esc(S.strava.secret)}" placeholder="••••••"></div></div>
        <div class="btn-row"><button type="button" class="btn orange" data-act="connect" ${stravaReady() ? '' : 'disabled'}>${icon('link')} Connect with Strava</button></div>
        <button type="button" class="link-btn" data-act="paste">Paste a code</button>
        ${paste ? `<div class="field"><input class="input" name="code" placeholder="Paste the code or the whole web address"><div class="btn-row"><button type="button" class="btn sm" data-act="usecode">Use code</button></div></div>` : ''}
        <p class="hint">Your Client Secret stays on this phone. It’s only sent to Strava.</p>`;
    return `${sheetHead('Settings')}
      <div class="set-group" id="set-race"><h3>You &amp; your race</h3><div class="card pad">
        <div class="field first"><label for="st-name">Your name</label><input id="st-name" class="input" name="name" maxlength="40" value="${esc(S.name)}" placeholder="For your hellos"></div>
        <div class="field"><label for="st-race">Race</label><input id="st-race" class="input" name="race" maxlength="50" value="${esc(S.race.name)}"></div>
        <div class="field"><label for="st-date">Race day</label><input id="st-date" class="input" type="date" name="rdate" min="${addDays(S.start, 28)}" value="${S.race.date}"></div>
      </div></div>
      <div class="set-group" id="set-plan"><h3>Your starting point</h3><div class="card pad">
        <p class="hint first">Changing these rebuilds the plan from ${fmtShort(S.start)}. What you’ve logged stays.</p>
        <div class="set-row"><span><b>Longest ride lately</b><small>Where your long ride starts</small></span>${stepper('ride', S.base.ride, 'Longest ride lately', fmtDur(S.base.ride))}</div>
        <div class="set-row"><span><b>Longest run lately</b><small>Where your long run starts</small></span>${stepper('run', S.base.run, 'Longest run lately', fmtDur(S.base.run))}</div>
        <div class="field"><span class="label">Hours a week you can train, on average</span>${seg(HOUR_OPTS, S.base.hours, 'hours')}</div>
        ${switchRow('adapt', 'Safe build-up', 'Holds the long ride and run back if you’ve fallen behind, then builds up again', S.settings.adapt)}
      </div></div>
      <div class="set-group" id="set-week"><h3>Your usual week</h3><div class="card pad">
        <p class="hint first">How much time you usually have to train each day. Change any single week by tapping its clock on the Week page.</p>
        <div class="avail-rows">${DAYS_LONG.map((d, i) => `<label><span>${d}</span>${availSelect(`av${i}`, S.avail[i])}</label>`).join('')}</div>
        <div class="field"><span class="label">You usually train</span>${seg(WHEN_OPTS, S.when, 'when')}</div>
        <div class="set-row"><span><b>Too hot above</b><small>Suggests earlier starts or a cooler day</small></span>${stepper('heat', S.settings.heat, 'Heat limit', `${S.settings.heat}°`)}</div>
      </div></div>
      <div class="set-group" id="set-weather"><h3>Weather</h3><div class="card pad">
        <div class="set-row first"><span><b>${S.loc ? esc(S.loc.name) : 'No location yet'}</b><small>${S.loc ? `${S.loc.lat}, ${S.loc.lon}` : 'Add one for weather-smart suggestions'}</small></span><button type="button" class="btn sm" data-act="locate">${icon('loc')} Use mine</button></div>
        <div class="field"><div class="search-row"><input class="input" name="place" placeholder="Or search for a suburb or town" autocomplete="off" enterkeyhint="search"><button type="button" class="btn sm orange" data-act="search">Search</button></div>
          ${searching ? '<p class="hint">Searching…</p>' : ''}${results.length ? `<div class="results">${results.map((r, i) => `<button type="button" class="chip" data-act="pickloc" data-i="${i}">${esc(r.name)}</button>`).join('')}</div>` : ''}</div>
        <p class="hint">Forecasts come from Open-Meteo, a free weather service. Only your location is sent to it.</p>
      </div></div>
      <div class="set-group" id="set-strava"><h3>Strava</h3><div class="card pad">${strava}
        <p class="hint">Got a Garmin? Link Strava in the Garmin Connect app (under Settings, Connected Apps) and your Garmin workouts flow through to Strava, then here.</p>
      </div></div>
      <div class="set-group"><h3>Look &amp; feel</h3><div class="card pad">${switchRow('fx', 'Celebrations', 'Confetti when you tick things off', S.settings.fx)}</div></div>
      <div class="set-group"><h3>Your data</h3><div class="card pad">
        <p class="hint first">Everything is saved on this phone only. Back up now and then, especially before changing phones.</p>
        <div class="btn-row"><button type="button" class="btn" data-act="export">${icon('down')} Back up</button><button type="button" class="btn" data-act="import">${icon('up')} Restore</button></div>
        <input type="file" name="file" accept="application/json,.json" hidden>
        <div class="btn-row"><button type="button" class="btn ghost" data-act="reset">Start over</button></div>
      </div></div>
      <p class="disclaimer">Tri Hard ${APP_VERSION} · weather by Open-Meteo.com<br>A training guide, not medical advice. Check with a doctor before starting something new, and listen to your body.</p>`;
  };
  const rebuilt = () => { PLAN = null; REV++; save(); render(); };
  const sh = openSheet(tpl(), {
    label: 'Settings',
    act: {
      step(a, e, s) {
        const n = a.dataset.name, d = +a.dataset.d;
        if (n === 'ride') { S.base.ride = clamp(S.base.ride + 15 * d, 30, 240); rebuilt(); }
        if (n === 'run') { S.base.run = clamp(S.base.run + 5 * d, 15, 150); rebuilt(); }
        if (n === 'heat') { S.settings.heat = clamp(S.settings.heat + d, 22, 38); save(); render(); }
        s.set(tpl());
      },
      hours(a, e, s) { S.base.hours = +a.dataset.v; rebuilt(); s.set(tpl()); },
      when(a, e, s) { S.when = a.dataset.v; save(); render(); s.set(tpl()); },
      locate(a, e, s) {
        toast('Finding you…');
        wxLocate().then(loc => setLocation(loc)).then(() => { render(); s.set(tpl()); toast('Weather’s in'); }).catch(err => toast(esc(err.message)));
      },
      search(a, e, s) {
        const q = ($('input[name="place"]', s.el).value || '').trim();
        if (q.length < 2) { toast('Type a suburb or town'); return; }
        searching = true; s.set(tpl());
        wxSearch(q).then(r => { results = r; searching = false; s.set(tpl()); if (!r.length) toast('No places found'); })
          .catch(() => { searching = false; s.set(tpl()); toast('Search isn’t working right now'); });
      },
      pickloc(a, e, s) {
        const r = results[+a.dataset.i];
        results = [];
        setLocation(r).then(() => { render(); s.set(tpl()); toast(`Weather for ${esc(r.name)}`); }).catch(() => toast('Couldn’t get the forecast'));
        s.set(tpl());
      },
      connect() { stravaConnect(); },
      paste(a, e, s) { paste = !paste; s.set(tpl()); },
      usecode(a, e, s) { stravaPasteCode($('input[name="code"]', s.el).value); },
      sync(a, e, s) { stravaSync().then(r => { render(); s.set(tpl()); toast(syncMsg(r)); }).catch(err => toast(esc(err.message))); },
      disconnect(a, e, s) { confirmSheet({ title: 'Disconnect Strava?', body: 'Workouts already brought in stay in your log.', yes: 'Disconnect', danger: true, onYes: () => { stravaDisconnect(); render(); toast('Strava disconnected'); } }); },
      export() { exportData(); },
      import(a, e, s) { $('input[name="file"]', s.el).click(); },
      reset() {
        confirmSheet({
          title: 'Start over?', danger: true, yes: 'Delete everything',
          body: 'This deletes your plan, your log and your settings on this phone. Back up first if you might want them.',
          onYes: () => {
            try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(WX_KEY); } catch (err) { /* blocked */ }
            replaceState(freshState());
            WX = null;
            UI.week = null;
            location.hash = '#/week';
            render(true);
            startOnboarding();
          },
        });
      },
    },
    input(e) {
      const t = e.target;
      if (t.name === 'name') S.name = t.value.trim().slice(0, 40);
      else if (t.name === 'race') S.race.name = t.value.trim().slice(0, 50) || 'IRONMAN 70.3';
      else if (t.name === 'sid') S.strava.id = t.value.replace(/\D/g, '');
      else if (t.name === 'ssecret') S.strava.secret = t.value.replace(/[^\w]/g, '');
      else return;
      save();
      const b = $('[data-act="connect"]', sh.el);
      if (b) b.disabled = !stravaReady();
    },
    change(e, s) {
      const t = e.target;
      if (t.name === 'file') { if (t.files && t.files[0]) importData(t.files[0]); t.value = ''; return; }
      if (t.name === 'rdate' && isKey(t.value) && t.value > addDays(S.start, 27)) { S.race.date = t.value; rebuilt(); s.set(tpl()); return; }
      if (/^av\d$/.test(t.name)) { S.avail[+t.name[2]] = +t.value; save(); render(); return; }
      if (t.name === 'adapt') { S.settings.adapt = t.checked; rebuilt(); return; }
      if (t.name === 'fx') { S.settings.fx = t.checked; save(); }
      if (t.name === 'race') render();
    },
    onClose() { save(); render(); },
  });
  if (section) {
    const el = $(`#set-${section}`, sh.el);
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
  }
}

/* ---------- first-run setup ---------- */
function startOnboarding() {
  const root = $('#onboard-root');
  const st = {
    step: 0, name: S.name, race: S.race.name, date: S.race.date,
    ride: nearest(RIDE_OPTS, S.base.ride), run: nearest(RUN_OPTS, S.base.run), hours: S.base.hours,
    avail: S.avail.slice(), when: S.when, loc: S.loc, results: [], busy: false,
  };
  const chipRow = (opts, cur, act) => `<div class="chips big">${opts.map(([v, l]) => `<button type="button" class="chip${String(v) === String(cur) ? ' on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const body = () => {
    if (st.step === 0) {
      const weeks = Math.round(daysBetween(mondayOf(today()), mondayOf(isKey(st.date) ? st.date : RACE_DEFAULT)) / 7) + 1;
      return `<div class="ob-art">${sunsetArt()}</div>
        <h1 class="ob-logo">Tri Hard</h1>
        <p class="ob-tag">Your road to 70.3</p>
        <p class="lead">A plan that builds your endurance week by week, a week you can drag and drop, weather-smart suggestions, and your workouts from Strava or logged by hand.</p>
        <div class="field"><label for="ob-name">What should we call you?</label><input id="ob-name" class="input" name="name" maxlength="40" value="${esc(st.name)}" placeholder="Your name (optional)" autocomplete="given-name"></div>
        <div class="two-col">
          <div class="field"><label for="ob-race">Race</label><input id="ob-race" class="input" name="race" maxlength="50" value="${esc(st.race)}"></div>
          <div class="field"><label for="ob-date">Race day</label><input id="ob-date" class="input" type="date" name="date" min="${addDays(today(), 28)}" value="${st.date}"></div>
        </div>
        <p class="hint center">${weeks > 0 ? `That’s ${plural(weeks, 'week')} of training, starting this week.` : ''}</p>`;
    }
    if (st.step === 1) {
      return `<h1>Where are you starting?</h1>
        <p class="lead">Be honest: the plan builds steadily from here so your endurance grows without injury.</p>
        <div class="field"><span class="label">${icon('bike')} Your longest ride in the last month</span>${chipRow(RIDE_OPTS, st.ride, 'ride')}</div>
        <div class="field"><span class="label">${icon('run')} Your longest run in the last month</span>${chipRow(RUN_OPTS, st.run, 'run')}</div>
        <div class="field"><span class="label">${icon('clock')} Hours a week you can train, on average</span>${chipRow(HOUR_OPTS, st.hours, 'hours')}</div>
        <p class="note-box">${icon('swim')}<span>Your swimming’s already strong, so the plan keeps it to <b>one swim a week</b> and puts the extra time into the bike and run.</span></p>`;
    }
    if (st.step === 2) {
      return `<h1>Your usual week</h1>
        <p class="lead">How much time do you normally have to train each day? Suggestions only use this time, and you can change any week later.</p>
        <div class="avail-rows">${DAYS_LONG.map((d, i) => `<label><span>${d}</span>${availSelect(`av${i}`, st.avail[i])}</label>`).join('')}</div>
        <div class="field"><span class="label">You usually train</span>${seg(WHEN_OPTS, st.when, 'when')}</div>`;
    }
    return `<h1>Where do you train?</h1>
      <p class="lead">With a location, Tri Hard checks the forecast and suggests which day suits which session: long rides on the calm, dry days, the pool when it’s stormy.</p>
      ${st.loc ? `<div class="note-box ok">${icon('loc')}<span><b>${esc(st.loc.name)}</b> ✓</span></div>` : ''}
      <div class="btn-row"><button type="button" class="btn" data-act="locate">${icon('loc')} Use my location</button></div>
      <div class="field"><div class="search-row"><input class="input" name="place" placeholder="Or search a suburb or town" autocomplete="off" enterkeyhint="search"><button type="button" class="btn sm orange" data-act="search">Search</button></div>
        ${st.busy ? '<p class="hint">Searching…</p>' : ''}${st.results.length ? `<div class="results">${st.results.map((r, i) => `<button type="button" class="chip" data-act="pickloc" data-i="${i}">${esc(r.name)}</button>`).join('')}</div>` : ''}</div>
      <p class="hint">You can skip this and add it later in Settings.</p>`;
  };
  const foot = () => {
    const back = st.step ? '<button type="button" class="link-btn" data-act="back">Back</button>' : '';
    if (st.step < 3) return `<button type="button" class="btn orange big block" data-act="next">${st.step === 0 ? 'Let’s build my plan' : 'Next'} ${icon('chev-r')}</button>${back}`;
    return `<button type="button" class="btn red big block" data-act="finish">${icon('flag')} Build my plan</button>${back}`;
  };
  const draw = keep => {
    const old = $('.onboard', root);
    const top = keep && old ? old.scrollTop : 0;
    root.innerHTML = `<div class="onboard" role="dialog" aria-modal="true" aria-label="Set up Tri Hard"><div class="ob-inner">
      <div class="dots" aria-hidden="true">${[0, 1, 2, 3].map(i => `<i class="${i === st.step ? 'on' : i < st.step ? 'done' : ''}"></i>`).join('')}</div>
      <div class="ob-body">${body()}</div><div class="ob-foot">${foot()}</div></div></div>`;
    $('.onboard', root).scrollTop = top;
  };
  const finish = () => {
    S.name = st.name.trim().slice(0, 40);
    S.race.name = st.race.trim().slice(0, 50) || 'IRONMAN 70.3';
    S.race.date = isKey(st.date) && st.date > addDays(today(), 27) ? st.date : RACE_DEFAULT;
    S.start = mondayOf(today());
    S.base = { ride: st.ride, run: st.run, hours: st.hours };
    S.avail = st.avail.slice();
    S.when = st.when;
    S.onboarded = true;
    PLAN = null;
    save();
    const ob = $('.onboard', root);
    ob.classList.add('closing');
    document.body.classList.remove('locked');
    setTimeout(() => { root.innerHTML = ''; }, 320);
    UI.week = null;
    location.hash = '#/week';
    const plan0 = () => {
      const key = mondayOf(today());
      applySuggestion(key, suggestWeek(key));
      render(true);
      confetti();
      toast(`Your plan’s ready${S.name ? `, ${esc(S.name)}` : ''}: ${plural(plan().weeks.length, 'week')} to race day. This week’s already sorted.`, { ms: 6000 });
    };
    if (st.loc) setLocation(st.loc).then(plan0, plan0); else plan0();
    askPersist();
  };
  document.body.classList.add('locked');
  draw();
  root.onclick = e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'next') {
      if (st.step === 0 && !(isKey(st.date) && st.date > addDays(today(), 27))) { toast('Pick a race day at least 4 weeks away'); return; }
      st.step++; draw();
    } else if (act === 'back') { st.step--; draw(); } else if (act === 'finish') finish();
    else if (act === 'ride' || act === 'run' || act === 'hours') { st[act] = +a.dataset.v; draw(true); } else if (act === 'when') { st.when = a.dataset.v; draw(true); } else if (act === 'locate') {
      toast('Finding you…');
      wxLocate().then(loc => { st.loc = loc; draw(true); }).catch(err => toast(esc(err.message)));
    } else if (act === 'search') {
      const q = ($('input[name="place"]', root).value || '').trim();
      if (q.length < 2) { toast('Type a suburb or town'); return; }
      st.busy = true; draw(true);
      wxSearch(q).then(r => { st.results = r; st.busy = false; draw(true); if (!r.length) toast('No places found'); }).catch(() => { st.busy = false; draw(true); toast('Search isn’t working right now'); });
    } else if (act === 'pickloc') { st.loc = st.results[+a.dataset.i]; st.results = []; draw(true); }
  };
  root.oninput = e => {
    const t = e.target;
    if (t.name === 'name') st.name = t.value;
    if (t.name === 'race') st.race = t.value;
  };
  root.onchange = e => {
    const t = e.target;
    if (t.name === 'date') { st.date = t.value; draw(true); }
    if (/^av\d$/.test(t.name)) st.avail[+t.name[2]] = +t.value;
  };
  root.onkeydown = e => {
    if (e.key === 'Enter' && e.target.name === 'place') { e.preventDefault(); const b = $('[data-act="search"]', root); if (b) b.click(); }
  };
}
