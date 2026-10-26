/* A stub DOM, just enough of one for the bundle to boot and draw into.
 *
 * Not a browser and not trying to be: the point is to catch what a type
 * checker cannot — a module cycle, a missing element id, something thrown at
 * the top level — by loading the real bundle and running the real start().
 */
import * as esbuild from 'esbuild';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

/* parseFeed reads real RSS and real HTML bodies, so the parser has to be a
   real one. Everything else the page touches is stubbed below. */
const { DOMParser } = new JSDOM().window;

/** Bundles src/newtab.ts the way the build does, but as a script vm can run. */
export async function bundleForTest() {
  const out = await esbuild.build({
    entryPoints: ['src/newtab.ts'],
    bundle: true, write: false, format: 'iife',
    target: 'chrome116', logLevel: 'silent'
  });
  return out.outputFiles[0].text;
}

const noop = () => {};

function mkEl(tag = 'div') {
  const e = {
    tagName: tag.toUpperCase(), localName: tag, children: [], attrs: {},
    classes: new Set(), textContent: '', hidden: false, disabled: false,
    style: new Proxy({}, {
      get: (t, k) => (k === 'setProperty' || k === 'removeProperty' ? noop : t[k]),
      set: (t, k, v) => ((t[k] = v), true)
    }),
    dataset: {},
    classList: {
      add: (...c) => c.forEach((x) => e.classes.add(x)),
      remove: (...c) => c.forEach((x) => e.classes.delete(x)),
      toggle: (c, on) => (on ? e.classes.add(c) : e.classes.delete(c)),
      contains: (c) => e.classes.has(c)
    },
    append: (...n) => e.children.push(...n),
    replaceChildren: (...n) => { e.children = n; },
    remove: noop, focus: noop, scrollTo: noop,
    addEventListener: (ev, fn) => { (e.on ??= {})[ev] = fn; },
    removeEventListener: noop,
    setAttribute: (k, v) => { e.attrs[k] = v; },
    getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null),
    removeAttribute: (k) => { delete e.attrs[k]; },
    querySelector: () => null, querySelectorAll: () => [],
    getElementsByTagName: () => [],
    getContext: () => new Proxy({}, { get: () => noop }),
    offsetWidth: 0, scrollLeft: 0, scrollTop: 0, clientWidth: 800,
    get className() { return [...e.classes].join(' '); },
    set className(v) { e.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  };
  return e;
}

/* The ids newtab.html actually carries. base.ts throws on anything else, so
   this list is what keeps the harness honest about the real document. */
export const IDS = [
  'advance', 'backdrop', 'case', 'companion', 'companionLabel', 'companionThumb',
  'companionTitle', 'credit', 'cue', 'date', 'gallery', 'galleryBar',
  'galleryCount', 'galleryNews', 'galleryNext', 'galleryPrev', 'galleryStrip',
  'labelDate', 'labelField', 'note', 'noteBody', 'noteClose', 'noteHead',
  'noteLink', 'object', 'panel', 'panelBody', 'panelClose', 'panelHead',
  'panelReset', 'piece', 'scrim', 'settings', 'time', 'weather'
];

export function makeSandbox({ local = {}, fetchImpl, preloadSucceeds = false, chrome } = {}) {
  const els = Object.fromEntries(IDS.map((id) => [id, mkEl()]));
  const raw = { ...local };
  const doc = {
    documentElement: mkEl('html'),
    body: mkEl('body'),
    getElementById: (id) => els[id] ?? null,
    createElement: mkEl,
    addEventListener: (ev, fn) => { (doc.on ??= {})[ev] = fn; },
    querySelector: () => null, querySelectorAll: () => []
  };

  const sandbox = {
    console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    document: doc, els,
    localStorage: {
      getItem: (k) => (k in raw ? raw[k] : null),
      setItem: (k, v) => { raw[k] = String(v); },
      removeItem: (k) => { delete raw[k]; }
    },
    Image: class {
      set src(v) {
        sandbox.preloaded.push(v);
        // The real one fires this once the bytes are in. Tests that care about
        // what lands in the CSS need it to.
        if (sandbox.preloadSucceeds) queueMicrotask(() => this.onload?.());
      }
    },
    fetch: fetchImpl ?? (async () => ({ ok: false, status: 500 })),
    matchMedia: () => ({ matches: false }),
    DOMParser,
    /* A bare vm context holds the ECMAScript built-ins and nothing else, so
       the web ones the page uses have to be handed in. Leaving URL out is
       worth being careful about: loadFeeds catches everything, so a missing
       global shows up as a feed that quietly never loads rather than as an
       error. */
    URL, URLSearchParams, TextEncoder, TextDecoder,
    devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900,
    addEventListener: noop, removeEventListener: noop,
    HTMLElement: class {},
    preloaded: [], preloadSucceeds, raw,
    // Left out unless a test hands one in, which the page reads as a preview.
    ...(chrome ? { chrome } : {})
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

/** Boots the bundle in a fresh sandbox and returns it. */
export async function boot(opts = {}) {
  const code = opts.code ?? (await bundleForTest());
  const sandbox = makeSandbox(opts);
  vm.runInNewContext(code, sandbox, { filename: 'newtab.js' });
  sandbox.document.on?.DOMContentLoaded?.();
  await new Promise((r) => setTimeout(r, 25));   // let the refreshes land
  return sandbox;
}
