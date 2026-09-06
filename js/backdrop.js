/* Vitrine — backdrops.
 *
 * The default ground is the drifting bloom, drawn in CSS and dependent on
 * nothing. Everything here is opt-in: a pool of images is fetched, cached,
 * and one is picked per rotation. Any failure falls back to the bloom
 * rather than leaving an empty page.
 */

const POOL_MAX_AGE = 6 * 60 * 60 * 1000;    // refetch the pool twice a day
const APOD_MAX_AGE = 12 * 60 * 60 * 1000;   // the picture of the day changes daily

const IMG_RE = /\.(jpe?g|png|webp|avif)(\?|#|$)/i;
const IMG_HOST = /(^|\.)(i\.redd\.it|preview\.redd\.it|images-assets\.nasa\.gov|apod\.nasa\.gov|images\.unsplash\.com)$/i;

function looksLikeImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    return IMG_RE.test(u.pathname) || IMG_HOST.test(u.hostname);
  } catch { return false; }
}

/* Each source returns a pool of { url, credit, link }. */
const SOURCES = {

  async apod(cfg) {
    const key = (cfg.nasaKey || '').trim() || 'DEMO_KEY';
    const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}&thumbs=true`);
    if (res.status === 429) throw new Error('NASA is rate-limiting the shared demo key. Add your own — it is free.');
    if (!res.ok) throw new Error('NASA returned ' + res.status);
    const d = await res.json();

    const url = d.media_type === 'image' ? (d.hdurl || d.url) : d.thumbnail_url;
    if (!url) throw new Error('Today\'s entry is a video with no still image.');

    return [{
      url,
      credit: [d.title, d.copyright && d.copyright.trim()].filter(Boolean).join(' — '),
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

    const data = await res.json();
    const list = Array.isArray(data) ? data : [data];

    return list.map((p) => ({
      // Unsplash asks that you request a sized image rather than the raw file.
      url: p.urls.raw + '&w=2400&q=80&fm=jpg&fit=max',
      credit: 'Unsplash — ' + (p.user && p.user.name ? p.user.name : 'unknown'),
      link: p.links && p.links.html,
      // Unsplash's terms ask for this ping when a photo is actually shown.
      download: p.links && p.links.download_location
    })).filter((p) => p.url);
  },

  async subreddit(cfg) {
    const subs = (cfg.backdropSubs || []).filter(Boolean);
    if (!subs.length) throw new Error('Add at least one subreddit.');
    const minW = cfg.minImageWidth || 0;

    const pools = await Promise.all(subs.map(async (sub) => {
      const name = sub.replace(/^\/?r\//i, '').replace(/\/$/, '');
      const res = await fetch(
        `https://www.reddit.com/r/${encodeURIComponent(name)}/hot.json?limit=75&raw_json=1`);
      if (!res.ok) return [];
      const data = await res.json();
      const posts = (data.data && data.data.children) || [];

      return posts.map((c) => c.data).filter((d) => d && !d.over_18).map((d) => {
        const preview = d.preview && d.preview.images && d.preview.images[0];
        const best = preview && preview.source && preview.source.url;
        const url = looksLikeImage(best) ? best : (looksLikeImage(d.url) ? d.url : null);
        if (!url) return null;
        // Only filtered if you ask for it. A small image is stretched to fit,
        // which is soft, but that is a look you are allowed to want.
        const w = preview && preview.source && preview.source.width;
        if (minW && w && w < minW) return null;
        return {
          url,
          credit: 'r/' + name + ' — u/' + (d.author || 'unknown'),
          link: 'https://www.reddit.com' + d.permalink
        };
      }).filter(Boolean);
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

function poolConfig() {
  return {
    nasaKey: Settings.get('nasaKey'),
    unsplashKey: Settings.get('unsplashKey'),
    unsplashQuery: Settings.get('unsplashQuery'),
    backdropSubs: Settings.get('backdropSubs'),
    customImages: Settings.get('customImages'),
    minImageWidth: Settings.get('minImageWidth')
  };
}

const poolKey = (mode) => mode + '|' + JSON.stringify(poolConfig());

/* The pool as it was last fetched, read straight out of storage. The new tab
 * primes itself with this so the first paint already carries its photograph,
 * instead of putting up the bare bloom and fading a picture over it — and the
 * text over the veil with it — a moment later. Age is deliberately not
 * checked: a slightly old picture is the right one to hold while
 * loadBackdropPool goes looking for a fresher pool. */
function cachedBackdropPool() {
  const mode = Settings.get('backdrop');
  if (mode === 'ambient') return [];
  const cached = store.get('bgPool', null);
  return cached && cached.key === poolKey(mode) ? cached.pool : [];
}

async function loadBackdropPool({ force = false } = {}) {
  const mode = Settings.get('backdrop');
  if (mode === 'ambient') return [];

  const cfg = poolConfig();
  const key = poolKey(mode);
  const maxAge = mode === 'apod' ? APOD_MAX_AGE : POOL_MAX_AGE;
  const cached = store.get('bgPool', null);

  if (!force && cached && cached.key === key && Date.now() - cached.at < maxAge) {
    return cached.pool;
  }

  // 'custom' needs no network, so it never has to fail.
  if (mode === 'custom') {
    const pool = await SOURCES.custom(cfg);
    store.set('bgPool', { at: Date.now(), key, pool });
    return pool;
  }

  const origins = {
    apod: 'https://api.nasa.gov/*',
    unsplash: 'https://api.unsplash.com/*',
    subreddit: 'https://www.reddit.com/*'
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

function pickFromPool(pool, index) {
  if (!pool.length) return null;
  return pool[((index % pool.length) + pool.length) % pool.length];
}

/* Which photograph is already up. A backdrop is asked for on every render, and
 * most renders want the one that is there — re-applying it restarts a 1400ms
 * fade for no reason and pings Unsplash a second time for the same picture. */
let backdropOnScreen = null;

const backdropUp = () => backdropOnScreen !== null;

function applyBackdrop(image) {
  const layer = $('backdrop');
  const credit = $('credit');

  const url = image ? image.url : null;
  if (url === backdropOnScreen) return;
  backdropOnScreen = url;

  if (!image) {
    layer.style.opacity = 0;
    document.body.classList.remove('has-image');
    credit.hidden = true;
    return;
  }

  const pre = new Image();
  pre.onload = () => {
    layer.style.backgroundImage = `url("${CSS.escape ? image.url : image.url}")`;
    layer.style.opacity = 1;
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
  pre.onerror = () => {
    layer.style.opacity = 0;
    document.body.classList.remove('has-image');
    credit.hidden = true;
  };
  pre.src = image.url;
}
