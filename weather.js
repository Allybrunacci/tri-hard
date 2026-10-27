/* Tri Hard — weather from Open-Meteo (free, no key) and how it suits each kind of session */
'use strict';

const WMO = {
  0: ['sun', 'Clear'], 1: ['sun', 'Mostly sunny'], 2: ['partly', 'Partly cloudy'], 3: ['cloud', 'Cloudy'],
  45: ['fog', 'Fog'], 48: ['fog', 'Fog'],
  51: ['rain', 'Light drizzle'], 53: ['rain', 'Drizzle'], 55: ['rain', 'Heavy drizzle'], 56: ['rain', 'Freezing drizzle'], 57: ['rain', 'Freezing drizzle'],
  61: ['rain', 'Light rain'], 63: ['rain', 'Rain'], 65: ['rain', 'Heavy rain'], 66: ['rain', 'Freezing rain'], 67: ['rain', 'Freezing rain'],
  71: ['snow', 'Light snow'], 73: ['snow', 'Snow'], 75: ['snow', 'Heavy snow'], 77: ['snow', 'Snow grains'],
  80: ['rain', 'Showers'], 81: ['rain', 'Showers'], 82: ['rain', 'Heavy showers'], 85: ['snow', 'Snow showers'], 86: ['snow', 'Snow showers'],
  95: ['storm', 'Thunderstorms'], 96: ['storm', 'Storms with hail'], 99: ['storm', 'Storms with hail'],
};
const wmo = c => WMO[c] || WMO[Math.floor(c / 10) * 10] || ['cloud', 'Cloudy'];
const WINDOWS = { morning: [5, 9], evening: [16, 19], any: [6, 18] };
const WHEN_LABEL = { morning: 'mornings', evening: 'evenings', any: 'whenever suits' };

let WX = null;
let WX_BUSY = null;

function wxLoad() {
  try { WX = JSON.parse(localStorage.getItem(WX_KEY)); } catch (e) { WX = null; }
  if (!WX || typeof WX !== 'object' || !WX.days) WX = null;
}

function wxFetch(force) {
  if (!S.loc) return Promise.resolve(null);
  const fresh = WX && WX.lat === S.loc.lat && WX.lon === S.loc.lon && Date.now() - WX.at < 2 * 3600e3;
  if (fresh && !force) return Promise.resolve(WX);
  if (WX_BUSY) return WX_BUSY;
  const q = new URLSearchParams({
    latitude: S.loc.lat, longitude: S.loc.lon, timezone: 'auto', forecast_days: 16, wind_speed_unit: 'kmh',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
  });
  WX_BUSY = fetch(`https://api.open-meteo.com/v1/forecast?${q}`)
    .then(r => { if (!r.ok) throw new Error(`Weather service said ${r.status}`); return r.json(); })
    .then(j => {
      const days = {}, hours = {};
      const D = j.daily, H = j.hourly;
      D.time.forEach((k, i) => {
        days[k] = {
          code: D.weather_code[i], max: D.temperature_2m_max[i], min: D.temperature_2m_min[i],
          rain: D.precipitation_probability_max[i] || 0, mm: D.precipitation_sum[i] || 0,
          wind: D.wind_speed_10m_max[i] || 0, gust: D.wind_gusts_10m_max[i] || 0, uv: D.uv_index_max[i] || 0,
          rise: String(D.sunrise[i] || '').slice(11, 16), set: String(D.sunset[i] || '').slice(11, 16),
        };
      });
      H.time.forEach((ts, i) => {
        const k = ts.slice(0, 10), h = +ts.slice(11, 13);
        (hours[k] || (hours[k] = []))[h] = {
          temp: H.temperature_2m[i], feel: H.apparent_temperature[i], rain: H.precipitation_probability[i] || 0,
          mm: H.precipitation[i] || 0, code: H.weather_code[i], wind: H.wind_speed_10m[i] || 0, gust: H.wind_gusts_10m[i] || 0,
        };
      });
      WX = { lat: S.loc.lat, lon: S.loc.lon, at: Date.now(), days, hours };
      try { localStorage.setItem(WX_KEY, JSON.stringify(WX)); } catch (e) { /* full: keep it in memory */ }
      REV++;
      return WX;
    })
    .finally(() => { WX_BUSY = null; });
  return WX_BUSY;
}

const wxOk = () => !!(WX && S.loc && WX.lat === S.loc.lat && WX.lon === S.loc.lon);
const wxDay = k => (wxOk() && WX.days[k]) || null;

// Rain, wind and heat between two hours of the day (inclusive).
function wxSpan(k, from, to) {
  const hs = wxOk() && WX.hours[k];
  if (!hs) return null;
  const sel = hs.slice(from, to + 1).filter(Boolean);
  if (!sel.length) return null;
  return {
    from, to,
    rain: Math.max(...sel.map(h => h.rain)),
    mm: sum(sel.map(h => h.mm)),
    wind: Math.max(...sel.map(h => h.wind)),
    gust: Math.max(...sel.map(h => h.gust)),
    feel: Math.max(...sel.map(h => h.feel)),
    lo: Math.min(...sel.map(h => h.temp)),
    hi: Math.max(...sel.map(h => h.temp)),
    storm: sel.some(h => h.code >= 95),
    code: Math.max(...sel.map(h => h.code)),
  };
}

// How well the weather suits a kind of session, 0 (awful) to 1 (perfect).
function wxFit(kind, w) {
  if (kind === 'indoor') return 1;
  if (!w) return 0.75;
  if (kind === 'swim') return w.storm ? 0.55 : 1;
  const ride = kind === 'longride' || kind === 'ride';
  const run = kind === 'longrun' || kind === 'run';
  let s = 1;
  s -= (w.rain / 100) * (ride ? 0.55 : 0.3);
  if (w.mm >= 1) s -= ride ? 0.25 : 0.12;
  if (w.storm) s -= ride ? 0.6 : 0.5;
  if (ride) {
    if (w.wind > 35 || w.gust > 55) s -= 0.4;
    else if (w.wind > 25 || w.gust > 45) s -= 0.2;
  } else if (w.wind > 40) s -= 0.1;
  const hot = w.feel - S.settings.heat;
  if (hot > 0) s -= Math.min(0.75, hot * (run ? 0.13 : 0.08));
  if (w.lo < 6) s -= 0.15;
  if (kind === 'ride') s = Math.max(s, 0.62);      // the trainer is always there
  if (kind === 'run') s = Math.max(s, 0.45);
  if (kind === 'longride') s = Math.max(s, 0.25);
  return clamp(s, 0, 1);
}

// The weather at your usual training time (or the best few hours, if any time suits).
function wxFor(k, kind, mins) {
  const day = wxDay(k);
  if (!day) return null;
  if (S.when !== 'any') {
    const [a, b] = WINDOWS[S.when];
    const len = Math.max(1, Math.ceil((mins || 60) / 60));
    return wxSpan(k, a, Math.max(b, a + len - 1));
  }
  return bestTime(k, kind, mins);
}

// The best block of hours in the day for a session.
function bestTime(k, kind, mins) {
  const len = clamp(Math.ceil((mins || 60) / 60), 1, 5);
  let best = null, bestScore = -1;
  for (let h = 5; h + len - 1 <= 19; h++) {
    const w = wxSpan(k, h, h + len - 1);
    if (!w) continue;
    const sc = wxFit(kind === 'swim' || kind === 'indoor' ? 'run' : kind, w) - h * 0.002;
    if (sc > bestScore) { bestScore = sc; best = w; }
  }
  return best;
}

// "22°, dry, light winds"
function wxWords(w) {
  if (!w) return '';
  const bits = [`${Math.round(w.hi)}°`];
  if (w.storm) bits.push('storms');
  else if (w.rain >= 60 || w.mm >= 2) bits.push(`rain likely (${w.rain}%)`);
  else if (w.rain >= 30) bits.push(`${w.rain}% chance of rain`);
  else bits.push('dry');
  if (w.wind > 35) bits.push(`very windy (${Math.round(w.wind)} km/h)`);
  else if (w.wind > 25) bits.push(`windy (${Math.round(w.wind)} km/h)`);
  else if (w.wind < 15) bits.push('light winds');
  if (w.feel - S.settings.heat >= 0) bits.push(`feels like ${Math.round(w.feel)}°`);
  return bits.join(', ');
}

// Problems worth flagging on a session card.
function wxWarn(s, k) {
  if (s.wxk === 'indoor' || s.done) return null;
  const w = wxFor(k, s.wxk, s.mins);
  if (!w) return null;
  if (w.storm) return { cls: 'storm', text: 'Storms', icon: 'bolt' };
  if (s.wxk !== 'swim') {
    if (w.feel - S.settings.heat >= 2) return { cls: 'hot', text: `${Math.round(w.feel)}°`, icon: 'thermo' };
    if (w.rain >= 60 || w.mm >= 2) return { cls: 'wet', text: `${w.rain}%`, icon: 'drop' };
    if ((s.wxk === 'longride' || s.wxk === 'ride') && (w.wind > 30 || w.gust > 50)) return { cls: 'windy', text: `${Math.round(w.wind)}`, icon: 'wind' };
  }
  return null;
}

function wxMini(k) {
  const d = wxDay(k);
  if (!d) return '';
  const [ic, label] = wmo(d.code);
  return `<span class="wx" title="${label}, ${Math.round(d.max)}° / ${Math.round(d.min)}°, ${d.rain}% chance of rain, wind up to ${Math.round(d.wind)} km/h">${icon('wx-' + ic)}<b>${Math.round(d.max)}°</b><small>${d.rain >= 10 ? `${icon('drop')}${d.rain}%` : `${icon('wind')}${Math.round(d.wind)}`}</small></span>`;
}

function wxSearch(name) {
  const q = new URLSearchParams({ name, count: 6, language: 'en', format: 'json' });
  return fetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`)
    .then(r => { if (!r.ok) throw new Error('Search failed'); return r.json(); })
    .then(j => (j.results || []).map(p => ({
      name: [p.name, p.admin1, p.country_code].filter(Boolean).join(', '),
      lat: Math.round(p.latitude * 1000) / 1000,
      lon: Math.round(p.longitude * 1000) / 1000,
    })));
}

function wxLocate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location isn’t available in this browser')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ name: 'My location', lat: Math.round(p.coords.latitude * 1000) / 1000, lon: Math.round(p.coords.longitude * 1000) / 1000 }),
      e => reject(new Error(e.code === 1 ? 'Location permission was declined' : 'Couldn’t get your location')),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 3600e3 },
    );
  });
}

function setLocation(loc) {
  S.loc = loc;
  WX = null;
  try { localStorage.removeItem(WX_KEY); } catch (e) { /* blocked */ }
  save();
  return wxFetch(true);
}
