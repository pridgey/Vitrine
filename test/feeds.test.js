/* Does a new tab hold still?
 *
 * The page paints from the last fetch and then goes looking for a newer one.
 * If the fresh list would put something else in the slot it is supposed to
 * leave what is up alone and let the next tab pick the change up: a page that
 * reshuffles a second after loading reads as a fault rather than as news.
 *
 * Driven through the real bundle, from real RSS, with only the network and the
 * document stubbed. Which item a given slot lands on depends on the hour, so
 * nothing below asserts a particular one — the baseline is what the page shows
 * when no fetch is allowed to interfere, and the tests compare against that.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { boot, bundleForTest } from './harness.js';

const code = await bundleForTest();

const FEED_URL = 'https://ex.com/rss';
const FEEDS = [{ url: FEED_URL, name: 'Ex', imagesOnly: false }];

const CACHED_TITLES = ['Item 3', 'Item 2', 'Item 1'];

const item = (n, minsAgo) => ({
  title: `Item ${n}`,
  link: `https://ex.com/${n}`,
  source: 'Ex',
  at: Date.now() - minsAgo * 60000,
  blurb: `blurb ${n}`,
  image: null,
  imageOnly: false
});

/* An RSS document the real parseFeed will read, newest first — the position in
   the list sets the date, so the order asked for is the order that comes out. */
const rss = (ns) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Ex</title>
${ns.map((n, i) => `<item>
  <title>Item ${n}</title>
  <link>https://ex.com/${n}</link>
  <pubDate>${new Date(Date.now() - (i + 1) * 60000).toUTCString()}</pubDate>
  <description>blurb ${n}</description>
</item>`).join('\n')}
</channel></rss>`;

/** Settings and a feed cache of items 3, 2, 1, `ageMins` old. */
const cached = (ageMins, feedMode = 'mixed') => ({
  'vitrine.settings': JSON.stringify({ feedMode, feeds: FEEDS, periodHours: 3 }),
  'vitrine.feedCache': JSON.stringify({
    at: Date.now() - ageMins * 60000,
    key: `2|${FEED_URL}`,
    items: [item(3, 30), item(2, 90), item(1, 150)]
  }),
  'vitrine.tabSeq': '7'
});

/** What the glass ended up showing. */
const lead = (s) => s.els.object.children.at(-1)?.textContent ?? '';

const serve = (body) => async (url) =>
  (String(url).startsWith(FEED_URL)
    ? { ok: true, status: 200, url: FEED_URL, text: async () => body }
    : { ok: false, status: 500 });

const dead = async () => ({ ok: false, status: 503 });

/* What a fresh cache puts up, with no fetch able to interfere. Every test
   below is measured against this. */
const baseline = lead(await boot({ code, local: cached(5), fetchImpl: dead }));

test('a fresh cache is shown, and the feed is not refetched', async () => {
  const asked = [];
  await boot({
    code, local: cached(5),
    fetchImpl: async (url) => { asked.push(String(url)); return dead(); }
  });
  assert.ok(CACHED_TITLES.includes(baseline), `showed ${baseline}`);
  assert.equal(asked.filter((u) => u.startsWith(FEED_URL)).length, 0,
    'a cache under half an hour old should not go back to the network');
});

test('a newer item arriving does not move what is on screen', async () => {
  const s = await boot({ code, local: cached(40), fetchImpl: serve(rss([4, 3, 2, 1])) });
  assert.equal(lead(s), baseline,
    'one new entry shifts every index by one; the page must hold its place');
});

test('an item that has dropped off the feed gives way', async () => {
  const s = await boot({ code, local: cached(40), fetchImpl: serve(rss([9, 8, 7])) });
  assert.ok(['Item 9', 'Item 8', 'Item 7'].includes(lead(s)),
    `what was up is gone, so it has to be replaced — showed ${lead(s)}`);
});

test('a feed that fails falls back to the last good fetch', async () => {
  const s = await boot({ code, local: cached(40), fetchImpl: dead });
  assert.equal(lead(s), baseline);
});

test('a feed that comes back empty keeps the last good fetch', async () => {
  const s = await boot({ code, local: cached(40), fetchImpl: serve(rss([])) });
  assert.equal(lead(s), baseline,
    'an empty answer is treated as a bad one, not as the feed being emptied');
});

test('with feeds off, the collection has the slot to itself', async () => {
  const s = await boot({ code, local: cached(5, 'off'), fetchImpl: dead });
  assert.match(s.els.object.className, /is-(note|passage|plate)/);
  assert.equal(s.els.companion.hidden, true);
});

test('the second card does not repeat the main slot', async () => {
  const s = await boot({ code, local: cached(5, 'companion'), fetchImpl: dead });
  assert.equal(s.els.companion.hidden, false, 'the card should be up');
  assert.notEqual(s.els.companionTitle.textContent, lead(s));
});

/* The browser can drop a host permission without anyone revoking it. A new
   tab cannot ask for it back — a request with no click behind it is refused —
   so the page must not try, must keep showing what it had, and must say so. */
test('a lost permission keeps the old fetch and flags the gear', async () => {
  const asked = [];
  const requested = [];
  const s = await boot({
    code, local: cached(40),
    fetchImpl: async (url) => { asked.push(String(url)); return serve(rss([4, 3, 2, 1]))(url); },
    chrome: { permissions: {
      contains: async () => false,
      request: async (p) => { requested.push(p); throw new Error('needs a user gesture'); }
    } }
  });
  await new Promise((r) => setTimeout(r, 25));    // the flag lands after the fetch
  assert.equal(lead(s), baseline);
  assert.equal(asked.filter((u) => u.startsWith(FEED_URL)).length, 0,
    'without permission the fetch would fail anyway');
  assert.equal(requested.length, 0, 'a new tab must not ask for permission');
  assert.ok(s.els.settings.classList.contains('alert'), 'the gear should carry the flag');
});

test('with permission held the gear carries no flag', async () => {
  const s = await boot({
    code, local: cached(40), fetchImpl: serve(rss([4, 3, 2, 1])),
    chrome: { permissions: { contains: async () => true, request: async () => true } }
  });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(s.els.settings.classList.contains('alert'), false);
});
