/* Vitrine — feeds.
 *
 * Fetches RSS and Atom, keeps the last good result, and hands back a flat
 * list of items. Deliberately forgiving: a feed that breaks is dropped
 * quietly rather than taking the page down with it.
 *
 * Everything here parses something somebody else wrote, so the shapes below
 * describe what we hope for rather than what we are promised. The casts at
 * each fetch are the one place that hope is admitted; past them, a missing
 * field is a type error rather than a surprise.
 */

import { store, looksLikeImage } from './base.js';
import type { Feed } from './settings.js';

/** One entry out of a feed, flattened to what the page actually shows. */
export interface FeedItem {
  title: string;
  link: string;
  /** The feed's own title, or the name the reader gave it. */
  source: string;
  /** Epoch ms, or 0 where the feed sent no date. */
  at: number;
  /** A trimmed summary. Empty on a looking feed, where the picture says it. */
  blurb: string;
  image: string | null;
  imageOnly: boolean;
  /** The crop the feed definitely sent, where `image` is an upgrade on it. */
  imageAlt?: string;
  /** Every picture in the post, where it holds more than one. */
  images?: string[];
  /** A Reddit gallery id, if the rest of the post has to be asked for. */
  gallery?: string;
}

/** A picture, and the crop to fall back on if it will not load. */
export interface Shot {
  u: string;
  alt?: string;
}

const FEED_MAX_AGE = 30 * 60 * 1000;   // refetch after half an hour
const PER_FEED     = 12;               // items kept from each feed
const SCAN_MAX     = 60;               // items read through to find that many

/* Paste a subreddit and get the feed. Same for a few other common shapes. */
export function normaliseFeedUrl(input: string): string | null {
  let url = input.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let u: URL;
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
function originVariants(url: string): string[] {
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
export async function hasFeedPermission(url: string): Promise<boolean> {
  const origins = originVariants(url);
  if (!origins.length) return false;
  if (typeof chrome === 'undefined' || !chrome.permissions) return true;  // preview
  try { return await chrome.permissions.contains({ origins }); }
  catch { return false; }
}

/* Every origin these feeds need that the browser is not currently letting us
 * reach. A grant can go missing without anyone revoking it on purpose — a
 * browser update, or the unpacked extension being reloaded from a new path —
 * and nothing on a new tab can ask for it back, so this is how the page finds
 * out it is working from an old copy. */
export async function missingFeedAccess(feeds: readonly Feed[]): Promise<string[]> {
  if (typeof chrome === 'undefined' || !chrome.permissions) return [];  // preview
  const origins = [...new Set(feeds.flatMap((f) => originVariants(f.url)))];
  const held = await Promise.all(origins.map(async (o) => {
    try { return await chrome.permissions.contains({ origins: [o] }); }
    catch { return false; }
  }));
  return origins.filter((_, i) => !held[i]);
}

/* Ask for everything missing in one prompt. Only works from a click: the
 * browser refuses a request with no user gesture behind it, and it refuses a
 * second one while the first is still on screen, which is why the feeds are
 * not each allowed to ask for themselves. */
export async function grantFeedAccess(feeds: readonly Feed[]): Promise<boolean> {
  const origins = await missingFeedAccess(feeds);
  if (!origins.length) return true;
  try { return await chrome.permissions.request({ origins }); }
  catch { return false; }
}

/* Extension pages can fetch anywhere they hold permission for. Ask first.
 * For a click only — see grantFeedAccess. */
export async function ensureFeedPermission(url: string): Promise<boolean> {
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

const text = (node: ParentNode, sel: string): string => {
  const found = node.querySelector(sel);
  return found?.textContent ? found.textContent.trim() : '';
};

/* Parsed rather than assigned to a live element: setting innerHTML on even a
 * detached div starts a download for every image in it, which for a feed of
 * two dozen picture posts is two dozen requests nobody asked for. A document
 * from DOMParser is inert. */
const inert = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html');

function strip(html: string): string {
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

function fullSize(url: string): string {
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
const shot = (u: string, alt?: string): Shot => (alt && alt !== u ? { u, alt } : { u });

function pickImages(node: Element, html: string, link: string): string[] {
  const candidates: string[] = [];

  for (const node2 of node.getElementsByTagName('*')) {
    const tag = node2.localName;
    if (tag === 'thumbnail' || tag === 'content' || tag === 'enclosure') {
      const u = node2.getAttribute('url') || node2.getAttribute('href') || '';
      const type = node2.getAttribute('type') || '';
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

function galleryId(html: string, link: string): string | null {
  const m = GALLERY_RE.exec(link || '') || GALLERY_RE.exec(html || '');
  return m?.[1] ?? null;
}

/** What a feed turned out to be called, and what was in it. */
export interface ParsedFeed {
  source: string;
  items: FeedItem[];
}

/* An image-only feed is one where the pictures are the point — a subreddit
 * for looking rather than reading. Items that arrive without one are dropped
 * before the count is taken, so such a feed still contributes a full dozen
 * rather than however many of its first dozen happened to be photographs.
 * Reading deeper costs something — every body is parsed to look for a picture
 * in it — so the search stops at SCAN_MAX however few it has found. */
export function parseFeed(
  xml: string,
  sourceUrl: string,
  { imagesOnly = false }: { imagesOnly?: boolean } = {}
): ParsedFeed | null {
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
    if (linkEl) link = linkEl.getAttribute('href') || (linkEl.textContent ?? '').trim();
    if (!link) link = text(n, 'guid');

    const when = text(n, 'pubDate') || text(n, 'updated') || text(n, 'published');
    const body = text(n, 'description') || text(n, 'summary') || text(n, 'content');

    const small = pickImages(n, body, link);
    const found = imagesOnly
      ? [...new Set(small.map(fullSize))]
      : small;

    const item: FeedItem = {
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

const feedKey = (feeds: readonly Feed[]): string =>
  CACHE_SHAPE + '|' +
  feeds.map((f) => f.url + (f.imagesOnly ? '#images' : '')).join('|');

/* The last good fetch, read straight out of storage. The new tab primes itself
 * with this so the first paint already knows whether feeds are running,
 * instead of putting up a piece and swapping it a moment later. */
/** What the cache holds between tabs: one fetch, and when it happened. */
interface FeedCache {
  at: number;
  key: string;
  items: FeedItem[];
}

/* When the last good fetch happened, or 0 if there has not been one for
 * these feeds. */
export function feedCacheTime(feeds: readonly Feed[]): number {
  const cache = store.get<FeedCache | null>('feedCache', null);
  return cache && cache.key === feedKey(feeds) ? cache.at : 0;
}

export function cachedFeedItems(feeds: readonly Feed[]): FeedItem[] {
  if (!feeds.length) return [];
  const cache = store.get<FeedCache | null>('feedCache', null);
  return cache && cache.key === feedKey(feeds) ? cache.items : [];
}

export async function loadFeeds(
  feeds: readonly Feed[],
  { force = false }: { force?: boolean } = {}
): Promise<FeedItem[]> {
  if (!feeds.length) return [];

  const cache = store.get<FeedCache | null>('feedCache', null);
  const key = feedKey(feeds);

  if (!force && cache && cache.key === key &&
      Date.now() - cache.at < FEED_MAX_AGE) {
    return cache.items;
  }

  const results = await Promise.all(feeds.map(async (f) => {
    try {
      // Checked, never asked for: a new tab has no click behind it, so a
      // request here is refused every time. The panel asks instead.
      if (!(await hasFeedPermission(f.url))) return [];
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

/* As much of Reddit's comments payload as the viewer needs. */
interface RedditImage { u?: string; gif?: string }
interface RedditMedia { status?: string; s?: RedditImage; p?: RedditImage[] }
interface RedditPost {
  gallery_data?: { items?: { media_id: string }[] };
  media_metadata?: Record<string, RedditMedia | undefined>;
}
type RedditComments = [{ data?: { children?: { data?: RedditPost }[] } }?];

function galleryFrom(json: RedditComments): Shot[] | null {
  const post = json[0]?.data?.children?.[0]?.data;
  if (!post) return null;

  const order = post.gallery_data?.items ?? [];
  const meta = post.media_metadata ?? {};

  const urls = order.map((it): Shot | null => {
    const m = meta[it.media_id];
    if (!m || (m.status && m.status !== 'valid')) return null;
    // s is the image at its own size; p is a ladder of previews, largest last.
    const best = m.s?.u || m.s?.gif || m.p?.at(-1)?.u;
    return best ? shot(fullSize(best), best) : null;
  }).filter((s): s is Shot => s !== null);

  return urls.length ? urls : null;
}

export async function loadGallery(id: string | null): Promise<Shot[] | null> {
  if (!id) return null;

  const seen = store.get<Record<string, Shot[]>>('galleries', {});
  if (seen[id]) return seen[id];

  const url = `https://www.reddit.com/comments/${id}.json?raw_json=1`;
  if (!(await hasFeedPermission(url))) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const urls = galleryFrom((await res.json()) as RedditComments);
    if (!urls) return null;

    const next: Record<string, Shot[]> = { ...seen, [id]: urls };
    for (const old of Object.keys(next).slice(0, -GALLERY_KEEP)) delete next[old];
    store.set('galleries', next);
    return urls;
  } catch {
    return null;
  }
}

/* What we already know about a post, without asking anyone. The cue under the
 * piece uses this to say how many pictures are in there. */
export const knownGallery = (id: string | null | undefined): Shot[] | null =>
  (id ? store.get<Record<string, Shot[]>>('galleries', {})[id] ?? null : null);

/* "4h ago", "yesterday", "12 Mar" */
export function ago(ts: number): string {
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
