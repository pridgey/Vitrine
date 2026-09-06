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

/* '*' means everything changed at once — a reset. Anything watching should
   redraw the lot rather than trying to work out what moved. */
export type SettingsKey = keyof SettingsData;
type Watcher = (key: SettingsKey | '*') => void;

export const Settings = {
  data: { ...DEFAULTS, ...store.get<Partial<SettingsData>>('settings', {}) },
  listeners: [] as Watcher[],

  get<K extends SettingsKey>(key: K): SettingsData[K] {
    return this.data[key];
  },

  set<K extends SettingsKey>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    store.set('settings', this.data);
    this.listeners.forEach((fn) => fn(key));
  },

  onChange(fn: Watcher): void { this.listeners.push(fn); },

  reset(): void {
    this.data = { ...DEFAULTS };
    store.set('settings', this.data);
    this.listeners.forEach((fn) => fn('*'));
  }
};
