/* Vitrine — backdrops.
 *
 * The default ground is the drifting bloom, drawn in CSS and dependent on
 * nothing. Everything here is opt-in: a pool of images is fetched, cached,
 * and one is picked per rotation. Any failure falls back to the bloom
 * rather than leaving an empty page.
 */

import { $, store, looksLikeImage } from './base.js';
import { Settings } from './settings.js';
import type { BackdropMode } from './settings.js';

/** One candidate ground, with whatever attribution its source asks for. */
export interface BackdropImage {
  url: string;
  credit: string;
  link?: string;
  /** Unsplash's terms ask for a ping here when a photo is actually shown. */
  download?: string;
}

/** Everything a source needs to know, lifted out of Settings in one go. */
export interface PoolConfig {
  nasaKey: string;
  unsplashKey: string;
  unsplashQuery: string;
  backdropSubs: string[];
  customImages: string[];
  minImageWidth: number;
}

/** The modes that go to the network. 'ambient' needs nothing and has no pool. */
type PhotoMode = Exclude<BackdropMode, 'ambient'>;

const POOL_MAX_AGE = 6 * 60 * 60 * 1000;    // refetch the pool twice a day
const APOD_MAX_AGE = 12 * 60 * 60 * 1000;   // the picture of the day changes daily

/* Each source turns its service's answer into a pool. Any of them may throw:
   the panel's "Test this source" button shows what they say, and a failure on
   a new tab just leaves the bloom up. */
const SOURCES: Record<PhotoMode, (cfg: PoolConfig) => Promise<BackdropImage[]>> = {

  async apod(cfg) {
    const key = (cfg.nasaKey || '').trim() || 'DEMO_KEY';
    const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}&thumbs=true`);
    if (res.status === 429) throw new Error('NASA is rate-limiting the shared demo key. Add your own — it is free.');
    if (!res.ok) throw new Error('NASA returned ' + res.status);
    const d = (await res.json()) as {
      media_type?: string; hdurl?: string; url?: string; thumbnail_url?: string;
      title?: string; copyright?: string;
    };

    const url = d.media_type === 'image' ? (d.hdurl || d.url) : d.thumbnail_url;
    if (!url) throw new Error('Today\'s entry is a video with no still image.');

    return [{
      url,
      credit: [d.title, d.copyright?.trim()].filter(Boolean).join(' — '),
      link: 'https://apod.nasa.gov/apod/astropix.html'
    }];
  },

  async unsplash(cfg) {
    const key = (cfg.unsplashKey || '').trim();
    if (!key) throw new Error('Unsplash needs a free access key. See the note below the field.');
    const query = (cfg.unsplashQuery || '').trim();

    const url = 'https://api.unsplash.com/photos/random?count=24&orientation=landscape'
      + (query ? '&query=' + encodeURIComponent(query) : '');
    const res = await fetch(url, { headers: { Authorization: 'Client-ID ' + key } });
    if (res.status === 401) throw new Error('Unsplash rejected that key.');
    if (!res.ok) throw new Error('Unsplash returned ' + res.status);

    interface UnsplashPhoto {
      urls?: { raw?: string };
      user?: { name?: string };
      links?: { html?: string; download_location?: string };
    }
    const data = (await res.json()) as UnsplashPhoto | UnsplashPhoto[];
    const list = Array.isArray(data) ? data : [data];

    return list.flatMap((p): BackdropImage[] => {
      const raw = p.urls?.raw;
      if (!raw) return [];
      return [{
        // Unsplash asks that you request a sized image rather than the raw file.
        url: raw + '&w=2400&q=80&fm=jpg&fit=max',
        credit: 'Unsplash — ' + (p.user?.name ?? 'unknown'),
        ...(p.links?.html ? { link: p.links.html } : {}),
        // Unsplash's terms ask for this ping when a photo is actually shown.
        ...(p.links?.download_location ? { download: p.links.download_location } : {})
      }];
    });
  },

  async subreddit(cfg) {
    const subs = (cfg.backdropSubs || []).filter(Boolean);
    if (!subs.length) throw new Error('Add at least one subreddit.');
    const minW = cfg.minImageWidth || 0;

    interface RedditListing {
      data?: { children?: { data?: {
        over_18?: boolean;
        url?: string;
        author?: string;
        permalink?: string;
        preview?: { images?: { source?: { url?: string; width?: number } }[] };
      } }[] };
    }

    const pools = await Promise.all(subs.map(async (sub): Promise<BackdropImage[]> => {
      const name = sub.replace(/^\/?r\//i, '').replace(/\/$/, '');
      const res = await fetch(
        `https://www.reddit.com/r/${encodeURIComponent(name)}/hot.json?limit=75&raw_json=1`);
      if (!res.ok) return [];
      const data = (await res.json()) as RedditListing;
      const posts = data.data?.children ?? [];

      return posts.flatMap((c): BackdropImage[] => {
        const d = c.data;
        if (!d || d.over_18) return [];

        const source = d.preview?.images?.[0]?.source;
        const best = source?.url;
        const url = looksLikeImage(best) ? best : (looksLikeImage(d.url) ? d.url : null);
        if (!url) return [];
        // Only filtered if you ask for it. A small image is stretched to fit,
        // which is soft, but that is a look you are allowed to want.
        if (minW && source?.width && source.width < minW) return [];

        return [{
          url,
          credit: 'r/' + name + ' — u/' + (d.author || 'unknown'),
          link: 'https://www.reddit.com' + d.permalink
        }];
      });
    }));

    const all = pools.flat();
    if (!all.length) {
      throw new Error(minW
        ? `No images at least ${minW}px wide. Try lowering the minimum.`
        : 'No image posts found in those subreddits.');
    }
    return all;
  },

  async custom(cfg) {
    const urls = (cfg.customImages || []).filter(looksLikeImage);
    if (!urls.length) throw new Error('No usable image URLs on the list.');
    return urls.map((url) => ({ url, credit: '', link: url }));
  }
};

/* ── Fetching and caching the pool ──────────────────────────── */

function poolConfig(): PoolConfig {
  return {
    nasaKey: Settings.get('nasaKey'),
    unsplashKey: Settings.get('unsplashKey'),
    unsplashQuery: Settings.get('unsplashQuery'),
    backdropSubs: Settings.get('backdropSubs'),
    customImages: Settings.get('customImages'),
    minImageWidth: Settings.get('minImageWidth')
  };
}

const poolKey = (mode: BackdropMode): string =>
  mode + '|' + JSON.stringify(poolConfig());

/** What the pool cache holds between tabs. */
interface PoolCache {
  at: number;
  key: string;
  pool: BackdropImage[];
}

/* The pool as it was last fetched, read straight out of storage. The new tab
 * primes itself with this so the first paint already carries its photograph,
 * instead of putting up the bare bloom and fading a picture over it — and the
 * text over the veil with it — a moment later. Age is deliberately not
 * checked: a slightly old picture is the right one to hold while
 * loadBackdropPool goes looking for a fresher pool. */
export function cachedBackdropPool(): BackdropImage[] {
  const mode = Settings.get('backdrop');
  if (mode === 'ambient') return [];
  const cached = store.get<PoolCache | null>('bgPool', null);
  return cached && cached.key === poolKey(mode) ? cached.pool : [];
}

export async function loadBackdropPool(
  { force = false }: { force?: boolean } = {}
): Promise<BackdropImage[]> {
  const mode = Settings.get('backdrop');
  if (mode === 'ambient') return [];

  const cfg = poolConfig();
  const key = poolKey(mode);
  const maxAge = mode === 'apod' ? APOD_MAX_AGE : POOL_MAX_AGE;
  const cached = store.get<PoolCache | null>('bgPool', null);

  if (!force && cached && cached.key === key && Date.now() - cached.at < maxAge) {
    return cached.pool;
  }

  // 'custom' needs no network, so it never has to fail.
  if (mode === 'custom') {
    const pool = await SOURCES.custom(cfg);
    store.set('bgPool', { at: Date.now(), key, pool });
    return pool;
  }

  const origins: string | undefined = {
    apod: 'https://api.nasa.gov/*',
    unsplash: 'https://api.unsplash.com/*',
    subreddit: 'https://www.reddit.com/*',
    custom: undefined
  }[mode];

  if (origins && typeof chrome !== 'undefined' && chrome.permissions) {
    const has = await chrome.permissions.contains({ origins: [origins] });
    if (!has && !(await chrome.permissions.request({ origins: [origins] }))) {
      throw new Error('Vitrine needs permission to reach that service.');
    }
  }

  const pool = await SOURCES[mode](cfg);
  if (pool.length) store.set('bgPool', { at: Date.now(), key, pool });
  return pool;
}

/* ── Putting one on screen ──────────────────────────────────── */

export function pickFromPool(
  pool: readonly BackdropImage[],
  index: number
): BackdropImage | null {
  if (!pool.length) return null;
  return pool[((index % pool.length) + pool.length) % pool.length] ?? null;
}

/* Which photograph is already up. A backdrop is asked for on every render, and
 * most renders want the one that is there — re-applying it restarts a 1400ms
 * fade for no reason and pings Unsplash a second time for the same picture. */
let backdropOnScreen: string | null = null;

export const backdropUp = (): boolean => backdropOnScreen !== null;

/* The one place a URL from somebody else's server is written into CSS. A
 * quote in it would close the url() and let everything after be read as more
 * declarations, so it goes through the URL parser and comes back out as href:
 * that percent-encodes a quote and drops a newline, and leaves a well-formed
 * URL exactly as it was. Anything that will not parse is not worth showing. */
function cssUrl(url: string): string | null {
  try { return `url("${new URL(url).href}")`; }
  catch { return null; }
}

export function applyBackdrop(image: BackdropImage | null): void {
  const layer = $('backdrop');
  const credit = $('credit');

  const url = image ? image.url : null;
  if (url === backdropOnScreen) return;
  backdropOnScreen = url;

  const clear = (): void => {
    layer.style.opacity = '0';
    document.body.classList.remove('has-image');
    credit.hidden = true;
  };

  if (!image) { clear(); return; }

  const pre = new Image();
  pre.onload = () => {
    const css = cssUrl(image.url);
    if (!css) { clear(); return; }

    layer.style.backgroundImage = css;
    layer.style.opacity = '1';
    document.body.classList.add('has-image');

    if (image.credit) {
      credit.textContent = image.credit;
      credit.href = image.link || '#';
      credit.hidden = false;
    } else {
      credit.hidden = true;
    }

    // Unsplash asks to be told when a photo is actually displayed.
    if (image.download && Settings.get('unsplashKey')) {
      fetch(image.download, {
        headers: { Authorization: 'Client-ID ' + Settings.get('unsplashKey') }
      }).catch(() => {});
    }
  };
  pre.onerror = clear;
  pre.src = image.url;
}
