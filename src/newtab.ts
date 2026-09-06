/* Vitrine — new tab.
 *
 * One thing is on show under the glass, with an optional second card from
 * your feeds. With no feeds running that thing is always a piece from the
 * bundled collection; once feeds are running the collection steps back and
 * takes one slot in five. Both change on a timer, and both can be pushed
 * along by hand.
 *
 * This module is the entry point: the bundle Chrome loads is this file and
 * everything it imports.
 */

import { $, el, store, mod } from './base.js';
import { PIECES, TINT } from './pieces.js';
import type { CollectionPiece, PlatePiece, Tint, Label, Link } from './pieces.js';
import { PLATES, mulberry32 } from './plates.js';
import { Settings, SIZE_SCALE, VEIL_LEVEL } from './settings.js';
import type { Cadence } from './settings.js';
import { ago, cachedFeedItems, loadFeeds, loadGallery, knownGallery, normaliseFeedUrl } from './feeds.js';
import type { FeedItem, Shot } from './feeds.js';
import {
  applyBackdrop, backdropUp, cachedBackdropPool, loadBackdropPool, pickFromPool
} from './backdrop.js';
import type { BackdropImage } from './backdrop.js';
import { loadWeather } from './weather.js';
import { buildPanel, closePanel, openPanel, panelIsOpen } from './panel.js';
import type { BackdropTest, PanelHooks } from './panel.js';

/* One item out of a feed, dressed as something the glass can show. It carries
   the media fields the collection pieces have no use for. */
export interface FeedPiece {
  kind: 'feed';
  lead: string;
  label: Label;
  note: string;
  link: Link;
  tint: Tint;
  /** The headline again, used as the caption under a looking feed's pictures. */
  caption: string;
  image: string | null;
  imageAlt: string | null;
  /** Whether the sheet opens onto pictures rather than onto words. */
  viewer: boolean;
  images: string[] | null;
  gallery: string | null;
}

/** Anything the glass can show. */
type Piece = CollectionPiece | FeedPiece;

let feedItems: FeedItem[] = [];

/* ── Which piece is on show ─────────────────────────────────── */

function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

// A stride near the golden ratio, coprime with the collection size, so
// stepping through it visits every piece before repeating any.
function strideFor(n: number): number {
  let s = Math.max(1, Math.round(n * 0.6180339887));
  while (gcd(s, n) !== 1) s++;
  return s;
}

/* Counts up once per new tab, so anything set to 'tab' moves on every load.
   Set once by start(), before anything renders. */
let tabCount = 0;

const tabSeq = (): number => tabCount;
const skip   = (): number => store.get('skip', 0);

/* Each of the three things on screen keeps its own clock. A cadence is
   either a number of hours or the string 'tab'. */
function slotFor(cadence: Cadence): number {
  if (cadence === 'tab') return tabSeq();
  return Math.floor(Date.now() / (cadence * 60 * 60 * 1000));
}

const slotNow = (): number => slotFor(Settings.get('periodHours'));

/* Feed items borrow a tint from their source name, so a given subreddit
   always lights the ground the same colour. */
const TINT_LIST: readonly Tint[] = Object.values(TINT);
function tintFor(name: string): Tint {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TINT_LIST[Math.abs(h) % TINT_LIST.length] ?? TINT.verdigris;
}

function feedAsPiece(item: FeedItem): FeedPiece {
  // An item from a looking feed has no summary by design. Its sheet opens as
  // the pictures themselves, with the headline under them as their caption.
  const note = item.imageOnly
    ? ''
    : (item.blurb || 'This item came with no summary. The link below has the rest.');

  return {
    kind: 'feed',
    lead: item.title,
    label: { field: item.source, date: ago(item.at) },
    note,
    caption: item.imageOnly ? item.title : '',
    link: { text: 'Open the original', url: item.link },
    tint: tintFor(item.source),
    image: item.image || null,
    imageAlt: item.imageAlt || null,
    // The viewer is a looking feed's own thing: on a reading feed the images
    // in a body are decoration, and lining them up would make more of them
    // than the post did.
    viewer: !!item.imageOnly,
    images: item.images || null,
    gallery: item.gallery || null
  };
}

/* Once feeds are running the bundled collection steps back: one slot in
   PIECE_EVERY is drawn from it and the rest come from the feeds, so the pieces
   read as punctuation between fresh things rather than as the main text.
   Nothing is dropped — the piece slots still stride the whole collection, they
   just come round five times more slowly, which is what keeps them from
   wearing out. */
const PIECE_EVERY = 5;

const feedsLive = (): boolean =>
  Settings.get('feedMode') !== 'off' && feedItems.length > 0;

/* What the main slot shows. Returns the thing itself, a key that changes only
   when the thing does, and which feed item was spent — the second card needs
   to know, so as not to show the same item twice. */
/** What the main slot shows, and what it cost. */
interface Selection {
  piece: Piece;
  /** Changes only when the thing on show does. */
  key: string;
  /** Which feed item was spent, or -1 for a collection piece. */
  feedIndex: number;
}

function selection(slot: number): Selection {
  const fromCollection = (ord: number): Selection => {
    const i = mod(ord * strideFor(PIECES.length), PIECES.length);
    return { piece: PIECES[i] ?? PIECES[0], key: 'p' + i, feedIndex: -1 };
  };

  if (!feedsLive()) return fromCollection(slot);

  // Counting the piece slots rather than the tabs keeps the stride walking the
  // collection one step at a time, however rarely its turn comes up.
  if (mod(slot, PIECE_EVERY) === 0) {
    return fromCollection(Math.floor(slot / PIECE_EVERY));
  }

  // Feed slots walk the list in time order rather than striding, so a run of
  // new tabs reads as newest-first rather than scattered.
  const i = mod(slot - Math.floor(slot / PIECE_EVERY) - 1, feedItems.length);
  const item = feedItems[i];
  if (!item) return fromCollection(slot);      // feedsLive() says this cannot happen

  return {
    piece: feedAsPiece(item),
    key: 'f' + item.link,
    feedIndex: i
  };
}

/* The second card walks in time order too, on its own clock. */
function companionIndex(n: number, avoid = -1): number {
  const cadence = Settings.get('feedCadence');
  const slot = (cadence === 'tab' ? tabSeq() : slotNow()) + skip();
  const i = mod(slot, n);
  return i === avoid ? mod(i + 1, n) : i;
}

/* ── Drawing the piece ──────────────────────────────────────── */

/* The second card only earns its space if there is an item left over for it.
   When the main slot has already spent one, that takes a second. */
const companionShowing = (mainFeedIndex = -1): boolean =>
  Settings.get('feedMode') === 'companion' &&
  feedItems.length > (mainFeedIndex >= 0 ? 1 : 0);

function drawPlate(piece: PlatePiece, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // The second card needs room, so the figure gives some back.
  const share = companionShowing() ? 0.40 : 0.52;
  const css = Math.min(576, window.innerWidth * 0.78, window.innerHeight * share);

  canvas.style.width = css + 'px';
  canvas.style.height = css + 'px';
  canvas.width = Math.round(css * dpr);
  canvas.height = Math.round(css * dpr);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    PLATES[piece.draw](ctx, css, css, piece.tint, mulberry32(seed));
  }
  return canvas;
}

/* ── Images ─────────────────────────────────────────────────── */

/* A picture hangs at its own proportions, which are not known until it
   arrives. The figure holds a plain 3:2 in the meantime and eases to the real
   shape as the image fades up, so the headline under it is carried rather
   than kicked. Anything past these bounds is a banner or a scrolling
   infographic rather than a photograph, and gets held to the nearest shape a
   plate can reasonably take. */
const AR_MIN = 0.5;                // taller than 1:2 is not a photograph
const AR_MAX = 2.6;

/** How a picture should behave once its real proportions are known. */
interface MountOpts {
  /** Ease the frame from a holding 3:2 to the picture's own shape. */
  band?: boolean;
  /** Show it at up to this multiple of its own pixels, rather than filling. */
  upto?: number;
  /** A crop to try if the full-size ask comes back empty. */
  fallback?: string | null;
  onFail?: () => void;
}

function mountImage(img: HTMLImageElement, src: string, opts?: MountOpts): void {
  const { band = false, upto = 0, fallback = null, onFail = () => {} } = opts ?? {};

  img.alt = '';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';

  img.onload = () => {
    const { naturalWidth: w, naturalHeight: h } = img;
    const figure = img.parentElement;
    if (band && w && h && figure) {
      const ratio = Math.min(AR_MAX, Math.max(AR_MIN, w / h));
      figure.style.setProperty('--ar', ratio.toFixed(4));
      // A feed will happily hand over a 140px thumbnail. Enlarged to the
      // measure it reads as a mistake, so let the plate be the smaller thing.
      figure.style.setProperty('--lim', w + 'px');
    }
    // Somewhere to stop between showing a small picture at its own size, which
    // in a frame this big reads as a stamp, and blowing it up until it is mush.
    // Sized rather than capped, since a cap can only ever shrink a picture, and
    // contained, so a box that is not the picture's shape letterboxes it rather
    // than stretching it.
    if (upto && w && h) {
      img.style.width = `min(100%, ${Math.round(w * upto)}px)`;
      img.style.height = `min(100%, ${Math.round(h * upto)}px)`;
    }
    img.classList.add('is-loaded');
  };

  // A picture asked for at full size and not there falls back to the crop the
  // feed definitely sent, rather than to nothing.
  img.onerror = () => {
    if (fallback && img.getAttribute('src') !== fallback) {
      img.src = fallback;
      return;
    }
    onFail();
  };

  img.src = src;
}

/* What the sheet will open onto. The piece on screen is the piece the note is
   about, so the two need not be worked out twice. */
let showing: Piece | null = null;

function show(piece: Piece, seed: number): void {
  showing = piece;
  document.documentElement.style.setProperty('--tint', piece.tint);
  document.body.classList.add('lit');

  const object = $('object');
  object.className = 'object is-' + piece.kind;
  object.replaceChildren();

  if (piece.kind === 'plate') {
    object.append(drawPlate(piece, seed));
    object.append(el('div', 'plate-title', piece.lead));
  } else {
    // Only a feed item carries a picture; a note or a passage is words.
    if (piece.kind === 'feed' && piece.image) {
      const figure = el('span', 'figure');
      const img = document.createElement('img');
      img.className = 'feed-image';
      figure.append(img, el('span', 'figure-edge'));
      object.append(figure);
      mountImage(img, piece.image, {
        band: true,
        fallback: piece.imageAlt,
        // Fold the plate away rather than yanking it out from under the words.
        onFail: () => {
          figure.classList.add('is-gone');
          setTimeout(() => figure.remove(), 600);
        }
      });
    }
    object.append(el('div', null, piece.lead));
  }

  $('labelField').textContent = piece.label.field;
  $('labelDate').textContent = piece.label.date || '';
  $('cue').textContent = cueFor(piece);

  $('noteHead').textContent = piece.label.field;
  const paras = piece.note ? piece.note.split('\n\n') : [];
  $('noteBody').replaceChildren(...paras.map((para) => el('p', null, para)));
  // A looking feed's item has no note. Its headline goes under the pictures
  // instead, as their caption.
  if (piece.kind === 'feed' && piece.caption) {
    $('noteBody').append(el('p', 'note-caption', piece.caption));
  }

  const link = $('noteLink');
  if (piece.link) {
    link.textContent = piece.link.text;
    link.href = piece.link.url;
    link.hidden = false;
  } else {
    link.hidden = true;
  }
}

/* ── The second card ────────────────────────────────────────── */

function showCompanion(mainFeedIndex = -1): void {
  const card = $('companion');
  const on = companionShowing(mainFeedIndex);

  card.hidden = !on;
  if (!on) return;

  const item = feedItems[companionIndex(feedItems.length, mainFeedIndex)];
  if (!item) { card.hidden = true; return; }

  card.href = item.link;
  $('companionLabel').textContent = [item.source, ago(item.at)].filter(Boolean).join(' · ');
  $('companionTitle').textContent = item.title;

  const thumb = $('companionThumb');
  if (item.image) {
    // The card can be re-rendered onto the same image by the ↻ button. Fading
    // it out and back in for a picture already on screen is just a flicker.
    if (thumb.getAttribute('src') !== item.image) {
      thumb.classList.remove('is-loaded', 'is-gone');
      thumb.hidden = false;
      mountImage(thumb, item.image, {
        onFail: () => thumb.classList.add('is-gone')
      });
    }
  } else {
    thumb.removeAttribute('src');
    thumb.classList.remove('is-loaded', 'is-gone');
    thumb.hidden = true;
  }
}

/* ── The viewer ─────────────────────────────────────────────── */

/* A reading item opens onto its note. A looking one opens onto its pictures:
   one to a screen, snapped, with the count under them.

   Reddit sends a gallery as a single thumbnail and a link, so how many
   pictures a post holds is not known until it is asked for. It is asked for
   here, on the way in, and the strip grows under the reader's hand rather
   than making them wait on it before anything appears. */

const smoothly = (): boolean =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* What the line under the piece offers. Once a gallery has been opened its
   count is known for good, so the cue can say how much is in there. */
function cueFor(piece: Piece): string {
  if (piece.kind !== 'feed' || !piece.viewer) return 'Read the note';
  const known = knownGallery(piece.gallery);
  const n = known ? known.length : (piece.images ? piece.images.length : 1);
  if (n > 1) return n + ' images';
  return piece.gallery ? 'See the rest' : 'See it bigger';
}

function markViewer(i: number): void {
  const n = $('galleryStrip').children.length;
  $('galleryCount').textContent = n > 1 ? `${i + 1} / ${n}` : '';
  $('galleryPrev').disabled = i <= 0;
  $('galleryNext').disabled = i >= n - 1;
}

/* Which slide is up is held here rather than read back off the scroll
   position: a second press has to count from where the strip is going, not
   from where it has got to, or a quick walk through a gallery stalls halfway
   between two pictures. The reader's own scrolling is what sets it instead. */
let viewerIndex = 0;
let steering = false;
let steerTimer: number | undefined;

const viewerAt = (): number => {
  const strip = $('galleryStrip');
  return Math.round(strip.scrollLeft / (strip.clientWidth || 1));
};

function viewerSettle(): void {
  steering = false;
  viewerIndex = viewerAt();
  markViewer(viewerIndex);
}

function viewerGo(i: number): void {
  const strip = $('galleryStrip');
  const n = strip.children.length;
  if (n < 2) return;

  const at = Math.max(0, Math.min(n - 1, i));
  if (at === viewerIndex) return;

  viewerIndex = at;
  steering = true;
  clearTimeout(steerTimer);                       // in case scrollend does not come
  steerTimer = setTimeout(viewerSettle, 800);

  strip.scrollTo({ left: at * strip.clientWidth,
                   behavior: smoothly() ? 'smooth' : 'auto' });
  markViewer(at);   // say so now rather than when the scrolling finishes
}

const viewerStep = (by: number): void => viewerGo(viewerIndex + by);

function drawSlides(shots: readonly Shot[]): void {
  const strip = $('galleryStrip');

  strip.replaceChildren(...shots.map((s) => {
    const slide = el('div', 'gallery-slide');
    const img = document.createElement('img');
    img.className = 'gallery-img';
    slide.append(img);
    // A picture that will not load leaves its frame rather than the count.
    mountImage(img, s.u, { upto: 2, fallback: s.alt ?? null,
                           onFail: () => img.remove() });
    return slide;
  }));

  strip.scrollLeft = 0;
  viewerIndex = 0;
  $('gallery').classList.toggle('is-multi', shots.length > 1);
  $('galleryBar').hidden = shots.length < 2;
  markViewer(0);
}

let viewerTurn = 0;    // a slow gallery must not land in a sheet opened since
let viewerFor = '';    // what is already hung, so reopening does not reload it

function fillViewer(piece: Piece | null): void {
  const wrap = $('gallery');
  const news = $('galleryNews');
  const turn = ++viewerTurn;

  // Only a looking feed's item opens onto pictures.
  const shown = piece && piece.kind === 'feed' && piece.viewer ? piece : null;

  const urls = !shown ? []
    : shown.images && shown.images.length ? shown.images
    : shown.image ? [shown.image]
    : [];

  // The first picture is the one the card is showing, and the only one with a
  // crop behind it to fall back on.
  const alt = shown?.imageAlt;
  const have: Shot[] = urls.map((u, i) =>
    (i === 0 && alt ? { u, alt } : { u }));

  if (!shown || !have.length) {
    wrap.hidden = true;
    news.hidden = true;
    $('galleryStrip').replaceChildren();
    viewerFor = '';
    return;
  }

  wrap.hidden = false;
  news.hidden = true;

  const same = viewerFor === shown.link.url && $('galleryStrip').children.length;
  if (!same) {
    viewerFor = shown.link.url;
    drawSlides(have);
  }
  if (!shown.gallery) return;

  // A gallery already known is in hand before the sheet has finished rising,
  // so only say what is going on when there is actually a wait.
  if (!knownGallery(shown.gallery) && $('galleryStrip').children.length < 2) {
    news.textContent = 'Looking for the rest of this post…';
    news.hidden = false;
  }

  void loadGallery(shown.gallery).then((shots) => {
    if (turn !== viewerTurn) return;              // a different sheet is up now

    // Silence here was the wrong call: a post you know holds five pictures,
    // showing one and saying nothing, reads as the viewer being broken rather
    // than as Reddit having refused. Say which it was.
    if (!shots) {
      news.textContent = 'Reddit would not send the rest of this post. '
        + 'The link below has all of it.';
      news.hidden = false;
      return;
    }

    news.hidden = true;
    if (shots.length < 2) return;                 // nothing more than we had
    if ($('galleryStrip').children.length === shots.length) return;
    drawSlides(shots);
    $('cue').textContent = cueFor(shown);         // the count is known now
  });
}

/* ── Sheets ─────────────────────────────────────────────────── */

function openNote(): void {
  fillViewer(showing);
  $('scrim').hidden = false;
  $('note').hidden = false;
  $('piece').setAttribute('aria-expanded', 'true');
  $('note').scrollTop = 0;
  $('noteClose').focus({ preventScroll: true });
}

function closeNote(): void {
  $('note').hidden = true;
  if ($('panel').hidden) $('scrim').hidden = true;
  $('piece').setAttribute('aria-expanded', 'false');
  $('piece').focus();
}

const noteIsOpen = (): boolean => !$('note').hidden;

/* ── Clock ──────────────────────────────────────────────────── */

function tick(): void {
  const now = new Date();
  $('time').textContent = now
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .replace(/\s?([AP])M/i, '');
  $('date').textContent = now.toLocaleDateString([], {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

/* ── Putting it on screen ───────────────────────────────────── */

/* Which slot is on screen. The piece raises over about a second, so a render
   landing inside that window tears the contents out and puts them back
   mid-flight, which reads as the page correcting itself rather than as it
   loading. Nothing is redrawn while the slot stands: what is up is what this
   slot showed, and only a new slot, a nudge from the reader, or a caller that
   insists moves it. The backdrop keeps its own clock and is asked for either
   way; it is idempotent too. */
let shownSlot: number | null = null;

/* The key of what is up, so a feed refresh can ask whether it still stands. */
let shownKey = '';

function render(
  { animate = false, force = false }: { animate?: boolean; force?: boolean } = {}
): void {
  const slot = slotNow() + skip();

  if (slot === shownSlot && !animate && !force) {
    showBackdrop();
    return;
  }

  const sel = selection(slot);
  shownSlot = slot;
  shownKey = sel.key;
  show(sel.piece, slot);
  showCompanion(sel.feedIndex);
  showBackdrop();

  if (animate) {
    const p = $('piece');
    p.style.animation = 'none';
    void p.offsetWidth;
    p.style.animation = '';
  }
}

function applyLayout(): void {
  const align = Settings.get('align');
  $('case').dataset.align = align;
  document.body.classList.toggle('centered', align === 'center');
  // The || guards are not dead: settings come back out of localStorage
  // unvalidated, so a value stored by an older version can still fall
  // outside what the type says is possible.
  document.documentElement.style.setProperty(
    '--s', String(SIZE_SCALE[Settings.get('size')] || 1));
  document.documentElement.style.setProperty(
    '--veil', String(VEIL_LEVEL[Settings.get('veil')] || 0.88));
  document.body.classList.remove('img-plain', 'img-muted', 'img-duotone');
  document.body.classList.add('img-' + (Settings.get('imageStyle') || 'muted'));
  document.body.classList.remove('edge-dissolve', 'edge-framed');
  document.body.classList.add('edge-' + (Settings.get('imageEdge') || 'dissolve'));
}

let backdropPool: BackdropImage[] = [];

function showBackdrop(): void {
  if (Settings.get('backdrop') === 'ambient' || !backdropPool.length) {
    applyBackdrop(null);
    return;
  }
  applyBackdrop(pickFromPool(
    backdropPool, slotFor(Settings.get('backdropCadence')) + skip()));
}

async function refreshBackdrop(
  { settle = false, ...opts }: { settle?: boolean; force?: boolean } = {}
): Promise<void> {
  try {
    backdropPool = await loadBackdropPool(opts);
  } catch {
    backdropPool = [];          // any failure just leaves the bloom in place
  }
  /* A photograph already up was picked from the pool as it stood. A refetch
     reshuffles that pool, so the same rotation lands somewhere else in it —
     and crossfading to a different picture a moment after the page settles is
     the same jolt as swapping the piece. The new pool waits for the next
     rotation. */
  if (settle && backdropUp()) return;
  showBackdrop();
}

async function testBackdrop(): Promise<BackdropTest> {
  try {
    const pool = await loadBackdropPool({ force: true });
    backdropPool = pool;
    showBackdrop();
    return { ok: pool.length > 0, n: pool.length,
             error: pool.length ? '' : 'That source returned no usable images.' };
  } catch (e) {
    const why = e instanceof Error ? e.message : '';
    return { ok: false, n: 0, error: why || 'Could not reach that source.' };
  }
}

function advance(step = 1): void {
  store.set('skip', store.get('skip', 0) + step);
  render({ animate: true });
}

/* Feeds added before the redirect fix may be stored under an origin that
   redirects. Rewrite them once, quietly. */
function migrateFeeds(): void {
  const feeds = Settings.get('feeds') || [];
  let changed = false;
  const fixed = feeds.map((f) => {
    const better = normaliseFeedUrl(f.url);
    if (better && better !== f.url) { changed = true; return { ...f, url: better }; }
    return f;
  });
  if (changed) {
    store.set('feedCache', null);
    Settings.set('feeds', fixed);
  }
}

/* Is the thing already on show still one of the things the list could offer?
   A collection piece always is. A feed item is only while the list still
   holds it — an item that has dropped off the end has to go. */
function stillOnOffer(key: string): boolean {
  if (!key) return false;
  if (key[0] === 'p') return true;
  return feedItems.some((i) => 'f' + i.link === key);
}

async function refreshFeeds(
  { settle = false, ...opts }: { settle?: boolean; force?: boolean } = {}
): Promise<void> {
  const feeds = Settings.get('feeds');
  const wasLive = feedsLive();
  feedItems = Settings.get('feedMode') === 'off' ? [] : await loadFeeds(feeds, opts);

  /* The fetch that primes a new tab lands a moment after the first paint, and
     the fresh list may well put a different item in this slot — a feed that
     has gained one entry has shifted every index by one. Swapping the piece
     out at that point looks like a fault rather than like news, so if what is
     already up still stands, it keeps its place and the next tab picks from
     the updated list. A refresh the reader asked for is not settled: it should
     show what it fetched. */
  if (settle && feedsLive() === wasLive && stillOnOffer(shownKey)) return;
  render({ force: true });
}

/* Whether the page's controls have been connected. Kept outside start() so a
   second run reconnects nothing. */
let wired = false;

function start(): void {
  // One tick of the tab counter per page load, before anything renders.
  tabCount = store.get('tabSeq', 0) + 1;
  store.set('tabSeq', tabCount);

  applyLayout();
  migrateFeeds();
  // Start from the last good fetch, so the first paint is already the right
  // kind of thing. refreshFeeds() below brings it up to date.
  if (Settings.get('feedMode') !== 'off') {
    feedItems = cachedFeedItems(Settings.get('feeds') || []);
  }
  // Same for the ground: the picture that was up last time goes back up
  // before anything paints, rather than fading in over the bloom.
  backdropPool = cachedBackdropPool();

  const primed = feedItems.length > 0;
  render();
  tick();
  setInterval(tick, 10000);
  void loadWeather();
  // Only a first paint made from a real cached list has something worth
  // keeping. With nothing to go on it put up a collection piece, and the
  // fetch is entitled to replace it.
  void refreshFeeds({ settle: primed });
  void refreshBackdrop({ settle: true });

  const hooks: PanelHooks = { refreshFeeds, testBackdrop };

  /* Everything above can be run twice — see the boot at the foot of the file.
     Everything below cannot: a second set of click handlers would make the
     ↻ button skip two pieces at a time. */
  if (wired) return;
  wired = true;

  $('piece').addEventListener('click', openNote);
  $('piece').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNote(); }
  });

  $('galleryPrev').addEventListener('click', () => viewerStep(-1));
  $('galleryNext').addEventListener('click', () => viewerStep(1));
  // The picture itself is the biggest target there is, so let it turn the page.
  $('galleryStrip').addEventListener('click', () => viewerStep(1));

  // Swiping and the trackpad move the strip themselves; the count follows.
  let counting: number | undefined;
  $('galleryStrip').addEventListener('scroll', () => {
    if (steering) return;              // our own scroll, already accounted for
    if (counting !== undefined) cancelAnimationFrame(counting);
    counting = requestAnimationFrame(viewerSettle);
  });
  $('galleryStrip').addEventListener('scrollend', viewerSettle);

  $('noteClose').addEventListener('click', closeNote);
  $('scrim').addEventListener('click', () => {
    if (!$('note').hidden) closeNote();
    if (!$('panel').hidden) closePanel();
  });

  $('advance').addEventListener('click', () => advance(1));
  $('settings').addEventListener('click', () => openPanel(hooks));
  $('weather').addEventListener('click', () => openPanel(hooks));
  $('panelClose').addEventListener('click', closePanel);
  $('panelReset').addEventListener('click', () => {
    Settings.reset();
    store.set('skip', 0);
    buildPanel(hooks);
  });

  const BACKDROP_KEYS = ['backdrop', 'nasaKey', 'unsplashKey', 'unsplashQuery',
                         'backdropSubs', 'customImages', 'minImageWidth'];

  Settings.onChange((key) => {
    if (['align', 'size', 'veil', 'imageStyle', 'imageEdge', '*'].includes(key)) applyLayout();
    if (['units', 'place', '*'].includes(key)) void loadWeather({ force: true });
    if (key === 'minImageWidth') void refreshBackdrop({ force: true });
    else if (BACKDROP_KEYS.includes(key) || key === '*') void refreshBackdrop();
    if (['periodHours', 'feedCadence', 'backdropCadence'].includes(key)) showBackdrop();
    if (['feeds', 'feedMode', '*'].includes(key)) void refreshFeeds();
    else render({ force: true });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (panelIsOpen()) closePanel();
      else if (noteIsOpen()) closeNote();
      return;
    }
    if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT') return;
    // With a sheet up the arrows belong to what is in it, not to the deck.
    if (noteIsOpen()) {
      if (e.key === 'ArrowRight') { e.preventDefault(); viewerStep(1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); viewerStep(-1); }
      return;
    }
    if (panelIsOpen()) return;
    if (e.key === 'ArrowRight') advance(1);
    if (e.key === 'ArrowLeft') advance(-1);
    if (e.key === ',') { e.preventDefault(); openPanel(hooks); }
  });

  // Plates are drawn at a size, so redraw if the window changes shape.
  let resizeTimer: number | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (selection(slotNow() + skip()).piece.kind === 'plate') render({ force: true });
    }, 220);
  });

  // If a tab is left open across a boundary, catch up quietly. render() drops
  // this on the floor until the boundary is actually crossed.
  setInterval(() => {
    if (Settings.get('periodHours') === 'tab') return;   // that one waits for a new tab
    render();
  }, 60000);
}

/* A new tab that will not draw is one the reader cannot get out of: the
   settings panel is behind the same start() that just failed, so there is no
   way in to undo whatever caused it. Anything thrown on the way up therefore
   costs the stored settings rather than the page — once. If the defaults will
   not start either, the fault is not in what was stored, and the second throw
   is left to the console rather than turned into a loop. */
document.addEventListener('DOMContentLoaded', () => {
  try {
    start();
  } catch (e) {
    console.error('Vitrine could not start on the stored settings.', e);
    Settings.reset();
    store.set('skip', 0);
    start();
  }
});
