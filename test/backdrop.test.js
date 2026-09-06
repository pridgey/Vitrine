/* The ground has the same job as the piece: be there on the first paint, and
   then stay put. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { boot, bundleForTest } from './harness.js';

const code = await bundleForTest();

const CFG = {
  nasaKey: '', unsplashKey: '', unsplashQuery: '',
  backdropSubs: ['EarthPorn'], customImages: [], minImageWidth: 0
};

const pool = (tag) => Array.from({ length: 12 }, (_, i) =>
  ({ url: `https://i.redd.it/${tag}${i}.jpg`, credit: `${tag}${i}`, link: 'x' }));

const local = (ageHours) => ({
  'vitrine.settings': JSON.stringify({
    feedMode: 'off', feeds: [], backdrop: 'subreddit',
    backdropSubs: ['EarthPorn'], backdropCadence: 6
  }),
  'vitrine.bgPool': JSON.stringify({
    at: Date.now() - ageHours * 3600 * 1000,
    key: 'subreddit|' + JSON.stringify(CFG),
    pool: pool('old')
  })
});

/* Reddit's listing shape, so the real source parser has something to chew. */
const listing = (tag) => ({
  ok: true, status: 200,
  json: async () => ({ data: { children: pool(tag).map((p, i) => ({ data: {
    over_18: false, url: p.url, author: 'someone', permalink: `/r/x/${i}`,
    preview: { images: [{ source: { url: p.url, width: 2400 } }] }
  } })) } })
});

test('a cached pool is on screen from the first paint', async () => {
  const s = await boot({ code, local: local(1), fetchImpl: async () => listing('old') });
  assert.equal(s.preloaded.length, 1, 'exactly one picture should be asked for');
  assert.match(s.preloaded[0], /old\d+\.jpg$/);
});

test('a refetched pool does not crossfade over what is already up', async () => {
  const s = await boot({ code, local: local(7), fetchImpl: async () => listing('new') });
  assert.equal(s.preloaded.length, 1,
    'the reshuffled pool must wait for the next rotation');
  assert.match(s.preloaded[0], /old\d+\.jpg$/);
});

test('the ambient ground fetches nothing and shows nothing', async () => {
  const s = await boot({
    code,
    local: { 'vitrine.settings': JSON.stringify({ feedMode: 'off', feeds: [], backdrop: 'ambient' }) },
    fetchImpl: async () => ({ ok: false, status: 500 })
  });
  assert.equal(s.preloaded.length, 0);
  assert.equal(s.document.body.classList.contains('has-image'), false);
});
