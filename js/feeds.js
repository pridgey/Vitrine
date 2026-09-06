/* Vitrine — feeds.
 *
 * Fetches RSS and Atom, keeps the last good result, and hands back a flat
 * list of items. Deliberately forgiving: a feed that breaks is dropped
 * quietly rather than taking the page down with it.
 */

const FEED_MAX_AGE = 30 * 60 * 1000;   // refetch after half an hour
const PER_FEED     = 12;               // items kept from each feed
const SCAN_MAX     = 60;               // items read through to find that many

/* Paste a subreddit and get the feed. Same for a few other common shapes. */
function normaliseFeedUrl(input) {
  let url = input.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let u;
  try { u = new URL(url); } catch { return null; }
  // Reddit redirects the bare domain to www, and a redirect across origins
  // loses the host permission that made the request privileged. Go straight
  // to the host it would have sent us to.
  if (/^reddit\.com$/i.test(u.hostname)) u.hostname = 'www.reddit.com';
  // A hostname with no dot, or with spaces in it, is a typo rather than a feed.
  if (!/^[^\s]+\.[^\s]+$/.test(u.hostname)) return null;

  const isFeed = /\.(rss|xml|atom)$/i.test(u.pathname) ||
                 /(^|\/)(rss|feed|atom)\/?$/i.test(u.pathname) ||
                 u.searchParams.has('feed');

  if (!isFeed) {
    if (/(^|\.)reddit\.com$/i.test(u.hostname)) {
      u.pathname = u.pathname.replace(/\/$/, '') + '/.rss';
    } else if (/(^|\.)youtube\.com$/i.test(u.hostname) && u.searchParams.get('channel_id')) {
      u.pathname = '/feeds/videos.xml';
    }
  }
  return u.toString();
}

/* A fetch may be redirected between the apex domain and www. Chrome checks
 * permission against the redirect target too, so hold both. */
function originVariants(url) {
  try {
    const u = new URL(url);
    const bare = u.hostname.replace(/^www\./i, '');
    return [...new Set([
      `${u.protocol}//${u.hostname}/*`,
      `${u.protocol}//${bare}/*`,
      `${u.protocol}//www.${bare}/*`
    ])];
  } catch { return []; }
}

/* Do we already hold it? Asked where a prompt would be out of place — a
 * gallery opening is not the moment to put a dialog over the page. */
async function hasFeedPermission(url) {
  const origins = originVariants(url);
  if (!origins.length) return false;
  if (typeof chrome === 'undefined' || !chrome.permissions) return true;  // preview
  try { return await chrome.permissions.contains({ origins }); }
  catch { return false; }
}

/* Extension pages can fetch anywhere they hold permission for. Ask first. */
async function ensureFeedPermission(url) {
  const origins = originVariants(url);
  if (!origins.length) return false;
  if (typeof chrome === 'undefined' || !chrome.permissions) return true;  // preview
  try {
    if (await hasFeedPermission(url)) return true;
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

const text = (node, sel) => {
  const el = node.querySelector(sel);
  return el ? el.textContent.trim() : '';
};

/* Parsed rather than assigned to a live element: setting innerHTML on even a
 * detached div starts a download for every image in it, which for a feed of
 * two dozen picture posts is two dozen requests nobody asked for. A document
 * from DOMParser is inert. */
const inert = (html) => new DOMParser().parseFromString(html, 'text/html');

function strip(html) {
  const d = inert(html);
  return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/* Reddit sends a small thumbnail in media:thumbnail and a much larger one
 * inside the HTML body. Prefer the big one; ignore Reddit's placeholders. */
const PLACEHOLDER = /^(self|default|nsfw|spoiler|image)$/i;

/* What the feed sends is a signed crop — for a gallery post, 140px across,
 * which is a stamp rather than a picture. The same file unsigned at i.redd.it
 * is the original the poster uploaded. A looking feed asks for that instead;
 * a reading feed keeps the small one, where it is a thumbnail beside a
 * headline and the bytes would be wasted.
 *
 * Only for a bare filename. preview.redd.it also serves external-pre/ crops of
 * other people's pages, and there is no original of ours behind those. */
const REDD_FILE = /^\/[A-Za-z0-9_-]+\.(png|jpe?g|webp|gif)$/i;

function fullSize(url) {
  try {
    const u = new URL(url);
    if (!/^preview\.redd\.it$/i.test(u.hostname)) return url;
    if (!REDD_FILE.test(u.pathname)) return url;
    return 'https://i.redd.it' + u.pathname;
  } catch { return url; }
}

/* A picture and, where it came from an upgrade like that, the one it replaced.
 * Reddit will not have an original behind every preview — the poster frame of a
 * video, for one — so the crop that was definitely there stays as a fallback. */
const shot = (u, alt) => (alt && alt !== u ? { u, alt } : { u });

function pickImages(node, html, link) {
  const candidates = [];

  for (const el of node.getElementsByTagName('*')) {
    const tag = el.localName;
    if (tag === 'thumbnail' || tag === 'content' || tag === 'enclosure') {
      const u = el.getAttribute('url') || el.getAttribute('href') || '';
      const type = el.getAttribute('type') || '';
      if (u && (looksLikeImage(u) || type.startsWith('image/'))) candidates.push(u);
    }
  }

  if (html) {
    const doc = inert(html);
    // Body images first, in the order they were written: bigger than the
    // thumbnail, and on a feed that sends several, that order is the reading
    // order.
    const body = [...doc.querySelectorAll('img')]
      .map((img) => img.getAttribute('src') || '')
      .filter(looksLikeImage);
    candidates.unshift(...body);
  }

  // A post that links straight at a photograph carries no markup to find it
  // in. Take the link itself, last, once nothing better has turned up.
  if (link && looksLikeImage(link)) candidates.push(link);

  const good = candidates.filter((u) => {
    try { return !PLACEHOLDER.test(new URL(u).pathname.replace(/^\//, '')); }
    catch { return false; }
  });

  return [...new Set(good.map((u) => u.replace(/&amp;/g, '&')))];
}

/* Reddit sends a gallery as one thumbnail and a link to the rest, so the feed
 * alone cannot say what else is in the post. The link carries the post id,
 * which is all that is needed to ask for the whole set later — see
 * loadGallery, which does not run until a sheet is actually opened. */
const GALLERY_RE = /reddit\.com\/gallery\/([A-Za-z0-9]+)/;

function galleryId(html, link) {
  const m = GALLERY_RE.exec(link || '') || GALLERY_RE.exec(html || '');
  return m ? m[1] : null;
}

/* An image-only feed is one where the pictures are the point — a subreddit
 * for looking rather than reading. Items that arrive without one are dropped
 * before the count is taken, so such a feed still contributes a full dozen
 * rather than however many of its first dozen happened to be photographs.
 * Reading deeper costs something — every body is parsed to look for a picture
 * in it — so the search stops at SCAN_MAX however few it has found. */
function parseFeed(xml, sourceUrl, { imagesOnly = false } = {}) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return null;

  const isAtom = !!doc.querySelector('feed > entry, feed > title');
  const source =
    text(doc, isAtom ? 'feed > title' : 'channel > title') ||
    new URL(sourceUrl).hostname.replace(/^www\./, '');

  const nodes = [...doc.querySelectorAll('item, entry')]
    .slice(0, imagesOnly ? SCAN_MAX : PER_FEED);

  let items = nodes.map((n) => {
    let link = '';
    const linkEl = n.querySelector('link');
    if (linkEl) link = linkEl.getAttribute('href') || linkEl.textContent.trim();
    if (!link) link = text(n, 'guid');

    const when = text(n, 'pubDate') || text(n, 'updated') || text(n, 'published');
    const body = text(n, 'description') || text(n, 'summary') || text(n, 'content');

    const small = pickImages(n, body, link);
    const found = imagesOnly
      ? [...new Set(small.map(fullSize))]
      : small;

    const item = {
      title: strip(text(n, 'title')) || '(untitled)',
      link,
      source,
      at: when ? Date.parse(when) || 0 : 0,
      // On a looking feed the summary is Reddit's own scaffolding — who
      // submitted it, where to comment — and the picture says the rest.
      blurb: imagesOnly ? '' : strip(body).slice(0, 320),
      image: found[0] || null,
      imageOnly: imagesOnly
    };

    // The rest of the pictures are only ever wanted by the viewer, which only
    // image-only feeds open. Everything else would be carrying them around the
    // cache for nothing.
    if (imagesOnly) {
      if (small[0] && small[0] !== item.image) item.imageAlt = small[0];
      if (found.length > 1) item.images = found;
      const gid = galleryId(body, link);
      if (gid) item.gallery = gid;
    }

    return item;
  }).filter((i) => i.title && i.link);

  if (imagesOnly) items = items.filter((i) => i.image);
  items = items.slice(0, PER_FEED);

  return { source, items };
}

/* Bumped whenever an item gains a field. Without it a cache written by the
 * previous version keeps being served until it ages out, and the new field is
 * simply missing from everything on screen — which looks exactly like the
 * feature being broken. */
const CACHE_SHAPE = 2;

const feedKey = (feeds) =>
  CACHE_SHAPE + '|' +
  feeds.map((f) => f.url + (f.imagesOnly ? '#images' : '')).join('|');

/* The last good fetch, read straight out of storage. The new tab primes itself
 * with this so the first paint already knows whether feeds are running,
 * instead of putting up a piece and swapping it a moment later. */
function cachedFeedItems(feeds) {
  if (!feeds.length) return [];
  const cache = store.get('feedCache', null);
  return cache && cache.key === feedKey(feeds) ? cache.items : [];
}

async function loadFeeds(feeds, { force = false } = {}) {
  if (!feeds.length) return [];

  const cache = store.get('feedCache', null);
  const key = feedKey(feeds);

  if (!force && cache && cache.key === key &&
      Date.now() - cache.at < FEED_MAX_AGE) {
    return cache.items;
  }

  const results = await Promise.all(feeds.map(async (f) => {
    try {
      if (!(await ensureFeedPermission(f.url))) return [];
      const res = await fetch(f.url, { cache: 'no-store' });
      if (!res.ok) return [];
      const parsed = parseFeed(await res.text(), f.url, { imagesOnly: !!f.imagesOnly });
      if (!parsed) return [];
      return parsed.items.map((i) => ({ ...i, source: f.name || parsed.source }));
    } catch {
      return [];
    }
  }));

  const items = results.flat().sort((a, b) => b.at - a.at);

  if (items.length) store.set('feedCache', { at: Date.now(), key, items });
  else if (cache && cache.key === key) return cache.items;   // keep the last good one

  return items;
}

/* ── Galleries ───────────────────────────────────────────────── */

/* The whole set of pictures in a Reddit gallery, in the order they were posted.
 * Nothing here runs on a new tab: it is asked for when a viewer opens, and the
 * answer is kept so opening the same post again costs nothing.
 *
 * Reddit will sometimes refuse this endpoint. That is not worth reporting —
 * the picture the feed did send is already on screen, and the link out still
 * goes to the whole post. */
const GALLERY_KEEP = 80;        // remembered posts before the oldest are let go

function galleryFrom(json) {
  const post = json && json[0] && json[0].data && json[0].data.children &&
               json[0].data.children[0] && json[0].data.children[0].data;
  if (!post) return null;

  const order = (post.gallery_data && post.gallery_data.items) || [];
  const meta = post.media_metadata || {};

  const urls = order.map((it) => {
    const m = meta[it.media_id];
    if (!m || (m.status && m.status !== 'valid')) return null;
    // s is the image at its own size; p is a ladder of previews, largest last.
    const s = m.s || {};
    const previews = m.p || [];
    const best = s.u || s.gif || (previews.length ? previews[previews.length - 1].u : null);
    return best ? shot(fullSize(best), best) : null;
  }).filter(Boolean);

  return urls.length ? urls : null;
}

async function loadGallery(id) {
  if (!id) return null;

  const seen = store.get('galleries', {});
  if (seen[id]) return seen[id];

  const url = `https://www.reddit.com/comments/${id}.json?raw_json=1`;
  if (!(await hasFeedPermission(url))) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const urls = galleryFrom(await res.json());
    if (!urls) return null;

    const next = { ...seen, [id]: urls };
    for (const old of Object.keys(next).slice(0, -GALLERY_KEEP)) delete next[old];
    store.set('galleries', next);
    return urls;
  } catch {
    return null;
  }
}

/* What we already know about a post, without asking anyone. The cue under the
 * piece uses this to say how many pictures are in there. */
const knownGallery = (id) => (id ? store.get('galleries', {})[id] || null : null);

/* "4h ago", "yesterday", "12 Mar" */
function ago(ts) {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.round(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 8) return days + 'd ago';
  return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
