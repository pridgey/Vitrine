/* newtab.html and base.ts have to agree about what is in the page. base.ts
   throws on an id the document does not carry, and an id the document carries
   that base.ts has not been told about cannot be reached with a type. Neither
   half can drift without this failing. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { IDS } from './harness.js';

const html = await readFile('static/newtab.html', 'utf8');
const base = await readFile('src/base.ts', 'utf8');

const inHtml = [...html.matchAll(/\sid="([A-Za-z]+)"/g)].map((m) => m[1]).sort();

const iface = base.slice(base.indexOf('interface Elements {'));
const inTypes = [...iface.slice(0, iface.indexOf('\n}')).matchAll(/^\s{2}(\w+):/gm)]
  .map((m) => m[1]).sort();

test('every id in the document has a type in base.ts', () => {
  assert.deepEqual(inTypes, inHtml);
});

test('the test harness stubs exactly the document it claims to', () => {
  assert.deepEqual([...IDS].sort(), inHtml);
});
