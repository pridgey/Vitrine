/* What is on disk is JSON somebody could have hand-edited, and an older
   version of Vitrine wrote it in a different wrapper. Neither may cost the
   reader a new tab that will not draw. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { boot, bundleForTest } from './harness.js';

const code = await bundleForTest();

const run = (settings) => boot({
  code,
  local: { 'vitrine.settings': JSON.stringify(settings) },
  fetchImpl: async () => ({ ok: false, status: 500 })
});

/** Did the page draw something? */
const drew = (s) =>
  s.document.body.classList.contains('lit') &&
  (s.els.object.children.at(-1)?.textContent ?? '') !== '';

/** The settings as they were written back out. */
const saved = (s) => JSON.parse(s.raw['vitrine.settings'] ?? 'null');

test('a flat blob from before the shape marker is still honoured', async () => {
  // What every existing install has on disk right now.
  const s = await run({ align: 'center', size: 'large', feedMode: 'off', feeds: [] });
  assert.ok(drew(s));
  assert.equal(s.els.case.dataset.align, 'center', 'the stored alignment should survive');
  assert.equal(s.document.body.classList.contains('centered'), true);
});

test('a wrapped blob of the current shape is read back', async () => {
  const s = await run({ shape: 1, data: { align: 'center', feedMode: 'off', feeds: [] } });
  assert.equal(s.els.case.dataset.align, 'center');
});

test('a blob of an unknown shape falls back to the defaults', async () => {
  const s = await run({ shape: 99, data: { align: 'center', feedMode: 'off', feeds: [] } });
  assert.ok(drew(s));
  assert.equal(s.els.case.dataset.align, 'left', 'defaults, not a half-applied blob');
});

test('a save writes the wrapper, and it reads back', async () => {
  const first = await run({ align: 'center', feedMode: 'off', feeds: [] });
  first.els.panelReset.on.click();               // Settings.reset() saves

  const out = saved(first);
  assert.equal(out.shape, 1, 'the shape marker should be on it');
  assert.ok(out.data, 'and the settings should live under .data');
  assert.equal(out.data.align, 'left', 'reset means back to the defaults');

  // What was just written has to be readable by the next tab.
  const second = await run(out);
  assert.ok(drew(second));
  assert.equal(second.els.case.dataset.align, 'left');
});

test('an upgraded install rewrites its flat blob as a wrapped one', async () => {
  const s = await run({ align: 'center', size: 'large', feedMode: 'off', feeds: [] });
  assert.equal(saved(s).shape, undefined,
    'reading a flat blob should not rewrite it');
  assert.equal(s.els.case.dataset.align, 'center', 'and should not lose it');

  s.els.panelReset.on.click();
  assert.equal(saved(s).shape, 1, 'the next write is the one that adds the marker');
});

for (const [label, feeds] of [
  ['a string',            'oops'],
  ['a number',            7],
  ['an array of nulls',   [null, null]],
  ['entries with no url', [{ name: 'x' }, {}]],
  ['a url that is not a string', [{ url: 123, name: 'x' }]]
]) {
  test(`feeds as ${label} does not cost the page`, async () => {
    const s = await run({ feedMode: 'mixed', feeds });
    assert.ok(drew(s), 'the collection should be on show instead');
    assert.match(s.els.object.className, /is-(note|passage|plate)/);
    assert.equal(s.els.companion.hidden, true);
  });
}

test('the good feeds in a part-corrupt list are kept', async () => {
  const s = await run({
    feedMode: 'companion',
    feeds: [null, { url: 'https://ex.com/rss', name: 'Ex' }, { name: 'no url' }]
  });
  assert.ok(drew(s));
  // The one survivor should be the one the panel offers to remove.
  s.els.settings.on.click();
  const names = JSON.stringify(s.els.panelBody);
  assert.ok(names.includes('Ex'), 'the valid feed should still be on the list');
  assert.ok(!names.includes('no url'), 'the invalid ones should not');
});
