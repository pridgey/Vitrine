/* Vitrine — the weather, and finding a place to ask about.
 *
 * Lifted out of newtab.ts because the settings panel needs lookupPlace and
 * newtab needs the panel: leaving it where it was would have made the two
 * import each other in a circle.
 *
 * One reading is fetched per tab at most, and a stale one is put up while the
 * fresh one is on its way, so the footer never sits empty.
 */

import { $, store } from './base.js';
import { Settings } from './settings.js';
import type { Place } from './settings.js';

const WX_MAX_AGE = 20 * 60 * 1000;   // how long a weather reading keeps

/** A reading, and when it was taken. */
interface Reading {
  at: number;
  key: string;
  text: string;
}

const SKY: Record<number, string | undefined> = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  56: 'freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'showers', 81: 'showers', 82: 'heavy showers',
  85: 'snow showers', 86: 'snow showers',
  95: 'thunderstorms', 96: 'thunderstorms', 99: 'thunderstorms'
};

/* A postcode shape, the country it belongs to, and how to tidy it into the
   form that country's lookup wants. */
interface PostalShape {
  re: RegExp;
  country: string;
  clean: (s: string) => string;
}

const POSTAL: readonly PostalShape[] = [
  { re: /^\d{5}(-\d{4})?$/, country: 'us', clean: (s) => s.slice(0, 5) },
  { re: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, country: 'ca',
    clean: (s) => s.slice(0, 3).toUpperCase() },
  { re: /^[A-Za-z]{1,2}\d[A-Za-z\d]?[ ]?\d[A-Za-z]{2}$/, country: 'gb',
    clean: (s) => s.replace(/\s+/g, ' ').toUpperCase() },
  { re: /^\d{4}$/, country: 'de', clean: (s) => s }
];

interface ZippoPlace {
  'place name'?: string;
  'state abbreviation'?: string;
  latitude?: string;
  longitude?: string;
}

interface GeocodeHit {
  name?: string;
  latitude?: number;
  longitude?: number;
}

/** Accepts a city, a US ZIP, a Canadian or UK postcode, or "Paris, FR". */
export async function lookupPlace(query: string): Promise<Place | null> {
  const q = query.trim();
  if (!q) return null;

  for (const { re, country, clean } of POSTAL) {
    if (!re.test(q)) continue;
    try {
      const res = await fetch(`https://api.zippopotam.us/${country}/${encodeURIComponent(clean(q))}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { places?: ZippoPlace[] };
      const p = data.places?.[0];
      if (!p || !p['place name'] || !p.latitude || !p.longitude) continue;
      const state = p['state abbreviation'] || '';
      return {
        name: p['place name'] + (state ? ', ' + state : ''),
        lat: parseFloat(p.latitude),
        lon: parseFloat(p.longitude)
      };
    } catch { /* fall through to the name lookup */ }
  }

  try {
    const res = await fetch('https://geocoding-api.open-meteo.com/v1/search'
      + `?name=${encodeURIComponent(q)}&count=1`);
    const data = (await res.json()) as { results?: GeocodeHit[] };
    const hit = data.results?.[0];
    if (!hit?.name || hit.latitude === undefined || hit.longitude === undefined) return null;
    return { name: hit.name, lat: hit.latitude, lon: hit.longitude };
  } catch {
    return null;
  }
}

export async function loadWeather(
  { force = false }: { force?: boolean } = {}
): Promise<void> {
  const place = Settings.get('place');
  const units = Settings.get('units');
  const cached = store.get<Reading | null>('wx', null);
  const key = place.name + '|' + units;

  if (!force && cached && cached.key === key &&
      Date.now() - cached.at < WX_MAX_AGE) {
    $('weather').textContent = cached.text;
    return;
  }

  // An hour-old reading is nearer the truth than an em dash, and putting it up
  // now means the fetch below only ever edits a number rather than filling an
  // empty slot as the reader is looking at it.
  if (cached && cached.key === key) $('weather').textContent = cached.text;

  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast'
      + `?latitude=${place.lat}&longitude=${place.lon}`
      + `&current=temperature_2m,weather_code&temperature_unit=${units}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    if (data.current?.temperature_2m === undefined) throw new Error('no reading');

    const temp = Math.round(data.current.temperature_2m);
    const sky = SKY[data.current.weather_code ?? -1] ?? '';
    const text = `${place.name} · ${temp}° ${sky}`.trim();

    $('weather').textContent = text;
    store.set('wx', { at: Date.now(), key, text });
  } catch {
    $('weather').textContent = cached ? cached.text : 'weather unavailable';
  }
}
