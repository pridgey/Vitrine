/* Vitrine — what the reader has chosen.
 *
 * One object, held in localStorage, with a listener list so the page can
 * redraw the parts a change actually touches. This module is deliberately
 * only the state: the panel that edits it is src/panel.ts, which keeps the
 * settings readable by everything without everything depending on the UI.
 */

import { store } from './base.js';

/** How often something moves on: a number of hours, or once per new tab. */
export type Cadence = 'tab' | number;

/** Where the weather is asked about. */
export interface Place {
  name: string;
  lat: number;
  lon: number;
}

/** One subscribed feed. */
export interface Feed {
  url: string;
  /** The feed's own title, or whatever the reader renamed it to. */
  name: string;
  /** Drop this feed's text posts and keep only the pictures. */
  imagesOnly: boolean;
}

/** Where the ground comes from. 'ambient' is the drifting bloom, and local. */
export type BackdropMode = 'ambient' | 'apod' | 'unsplash' | 'subreddit' | 'custom';

/** Every setting, and the values each one is allowed to take. */
export interface SettingsData {
  align: 'left' | 'center';
  size: 'small' | 'medium' | 'large';
  /** How long the main piece stays up. */
  periodHours: Cadence;
  /** How often the second card moves: every tab, or with the piece. */
  feedCadence: 'tab' | 'piece';
  backdropCadence: Cadence;
  units: 'fahrenheit' | 'celsius';
  /** Where feed items go, or 'off' to run on the collection alone. */
  feedMode: 'companion' | 'mixed' | 'off';
  feeds: Feed[];
  imageStyle: 'plain' | 'muted' | 'duotone';
  imageEdge: 'dissolve' | 'framed';
  place: Place;
  backdrop: BackdropMode;
  /** How hard a backdrop photo is dimmed behind the text. */
  veil: 'light' | 'medium' | 'heavy';
  nasaKey: string;
  unsplashKey: string;
  unsplashQuery: string;
  /** ['EarthPorn', 'ExposurePorn'] */
  backdropSubs: string[];
  /** 0 takes them all and stretches to fit. */
  minImageWidth: number;
  /** Full image URLs. */
  customImages: string[];
}

const DEFAULTS: SettingsData = {
  align:       'left',
  size:        'medium',
  periodHours: 3,
  feedCadence: 'tab',
  backdropCadence: 6,
  units:       'fahrenheit',
  feedMode:    'companion',
  feeds:       [],
  imageStyle:  'muted',
  imageEdge:   'dissolve',
  place:       { name: 'Denver', lat: 39.7392, lon: -104.9847 },

  backdrop:      'ambient',
  veil:          'medium',
  nasaKey:       '',
  unsplashKey:   '',
  unsplashQuery: '',
  backdropSubs:  [],
  minImageWidth: 0,
  customImages:  []
};

export const SIZE_SCALE: Record<SettingsData['size'], number> =
  { small: 0.88, medium: 1, large: 1.18 };

export const VEIL_LEVEL: Record<SettingsData['veil'], number> =
  { light: 0.62, medium: 0.85, heavy: 1 };

/* ── Reading what was stored ─────────────────────────────────── */

/* Bumped when a setting changes shape, rather than when one is merely added.
 * A blob written under a shape this version does not know is left alone and
 * the defaults stand: spread over them it would half-apply, which looks like
 * the extension being broken rather than like it being new. Gaining a key
 * needs no bump — a key that is missing already falls back to its default.
 *
 * feeds.ts keeps a CACHE_SHAPE for the same reason. */
const SETTINGS_SHAPE = 1;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/* One feed, rebuilt from whatever was on disk. Returns null for anything that
   is not recognisably a feed, so a bad entry is dropped rather than carried. */
function asFeed(v: unknown): Feed | null {
  if (!isPlainObject(v)) return null;
  const { url, name, imagesOnly } = v;
  if (typeof url !== 'string' || !url) return null;
  return {
    url,
    name: typeof name === 'string' ? name : '',
    imagesOnly: imagesOnly === true
  };
}

const readFeeds = (v: unknown): Feed[] =>
  (Array.isArray(v) ? v : []).map(asFeed).filter((f): f is Feed => f !== null);

/* On disk this is { shape, data }. Versions before the marker existed wrote
   the settings object flat, with no wrapper; that is read as the current
   shape, because nothing about the settings themselves changed when the
   wrapper was introduced. */
function readStored(): Record<string, unknown> {
  const raw = store.get<unknown>('settings', null);
  if (!isPlainObject(raw)) return {};

  if (typeof raw.shape === 'number') {
    if (raw.shape !== SETTINGS_SHAPE) return {};
    return isPlainObject(raw.data) ? raw.data : {};
  }
  return raw;                                    // flat, written before the marker
}

const stored = readStored();

/* ── The settings themselves ─────────────────────────────────── */

/* '*' means everything changed at once — a reset. Anything watching should
   redraw the lot rather than trying to work out what moved. */
export type SettingsKey = keyof SettingsData;
type Watcher = (key: SettingsKey | '*') => void;

export const Settings = {
  /* Stored values are taken at their word, with one exception. A wrong value
     in any other key degrades quietly — a bad `size` falls through the guard
     in applyLayout, a bad `periodHours` still lands on a piece — but a `feeds`
     that is not an array of feeds is mapped over before the first paint and
     takes the whole page down, settings panel included. So feeds is rebuilt
     and the rest is trusted. The cast below is that decision, written down. */
  data: { ...DEFAULTS, ...stored, feeds: readFeeds(stored.feeds) } as SettingsData,
  listeners: [] as Watcher[],

  get<K extends SettingsKey>(key: K): SettingsData[K] {
    return this.data[key];
  },

  set<K extends SettingsKey>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    this.save();
    this.listeners.forEach((fn) => fn(key));
  },

  onChange(fn: Watcher): void { this.listeners.push(fn); },

  reset(): void {
    this.data = { ...DEFAULTS };
    this.save();
    this.listeners.forEach((fn) => fn('*'));
  },

  save(): void {
    store.set('settings', { shape: SETTINGS_SHAPE, data: this.data });
  }
};
