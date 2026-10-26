/* Vitrine — the settings panel.
 *
 * Built fresh each time it opens, and rebuilt in place when a choice changes
 * which other choices apply. Nothing here holds state of its own: every
 * control reads Settings and writes straight back to it.
 *
 * The page hands in its own refresh functions rather than being imported
 * from, which is what keeps the panel from having to know what a new tab is.
 */

import { $, el } from './base.js';
import { Settings } from './settings.js';
import type { Cadence } from './settings.js';
import {
  normaliseFeedUrl, ensureFeedPermission, parseFeed,
  missingFeedAccess, grantFeedAccess, feedCacheTime
} from './feeds.js';
import { lookupPlace } from './weather.js';

/** What the panel can ask the page to redo after a change. */
export interface PanelHooks {
  refreshFeeds(opts?: { force?: boolean }): Promise<void>;
  testBackdrop(): Promise<BackdropTest>;
}

/** The answer from "Test this source". */
export interface BackdropTest {
  ok: boolean;
  /** How many images the source offered. */
  n: number;
  /** Why it failed, in words the reader can act on. Empty when ok. */
  error: string;
}

function row(
  labelText: string,
  control: HTMLElement,
  hintText?: string
): HTMLDivElement {
  const r = el('div', 'row');
  const left = el('div', 'row-left');
  left.append(el('span', 'row-label', labelText));
  if (hintText) left.append(el('span', 'row-hint', hintText));
  r.append(left, control);
  return r;
}

function textArea(
  value: string,
  placeholder: string,
  onCommit: (v: string) => void
): HTMLTextAreaElement {
  const t = el('textarea', 'feed-area');
  t.value = value;
  t.placeholder = placeholder;
  t.spellcheck = false;
  t.addEventListener('change', () => onCommit(t.value));
  t.addEventListener('blur', () => onCommit(t.value));
  return t;
}

function textField(
  value: string,
  placeholder: string,
  onCommit: (v: string) => void
): HTMLInputElement {
  const i = el('input', 'feed-input');
  i.type = 'text';
  i.value = value;
  i.placeholder = placeholder;
  i.spellcheck = false;
  i.addEventListener('change', () => onCommit(i.value.trim()));
  i.addEventListener('blur', () => onCommit(i.value.trim()));
  return i;
}

const lines = (v: string): string[] =>
  v.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

/* A row of buttons where exactly one is on. The value type is carried through
   from the options, so the callback hands Settings.set something it accepts
   and a wrong pairing will not compile. */
function seg<T extends string | number>(
  options: readonly (readonly [T, string])[],
  current: T,
  onPick: (value: T) => void
): HTMLDivElement {
  const wrap = el('div', 'seg');
  options.forEach(([value, label]) => {
    const b = el('button', 'seg-btn', label);
    b.type = 'button';
    if (value === current) b.classList.add('on');
    b.addEventListener('click', () => {
      [...wrap.children].forEach((c) => c.classList.remove('on'));
      b.classList.add('on');
      onPick(value);
    });
    wrap.append(b);
  });
  return wrap;
}

/* ── The panel ──────────────────────────────────────────────── */

export function buildPanel(hooks: PanelHooks): void {
  const body = $('panelBody');
  const keepScroll = $('panel').scrollTop;
  const rebuild = () => { buildPanel(hooks); $('panel').scrollTop = keepScroll; };
  body.replaceChildren();

  /* Lost access never fixes itself, and a new tab cannot ask for it back, so
     the panel asks — first thing, above everything else, since until it is
     answered every feed below is showing an old copy. Filled in once the
     browser answers, and empty when nothing is missing. */
  const access = el('div', 'access-alert');
  access.setAttribute('role', 'alert');
  const drawAccess = async (): Promise<void> => {
    const feeds = Settings.get('feeds');
    const missing = await missingFeedAccess(feeds);
    access.replaceChildren();
    if (!missing.length) return;

    const hosts = [...new Set(missing.map((o) =>
      o.replace(/^https?:\/\//, '').replace(/\/\*$/, '').replace(/^www\./, '')))];
    const at = feedCacheTime(feeds);
    const since = at
      ? ', so feeds are stuck on what it fetched on '
        + new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short' })
      : '';
    access.append(
      el('p', 'access-head', 'Feeds are not updating'),
      el('p', 'access-body',
        `Vitrine no longer has permission to read ${hosts.join(', ')}${since}.`));

    const allow = el('button', 'feed-btn', 'Allow access');
    allow.type = 'button';
    allow.addEventListener('click', async () => {
      if (!(await grantFeedAccess(Settings.get('feeds')))) return;
      allow.textContent = 'Refreshing…';
      await hooks.refreshFeeds({ force: true });
      void drawAccess();
    });
    access.append(allow);
  };
  void drawAccess();
  body.append(access);

  /* Layout */
  body.append(el('p', 'panel-section', 'Layout'));

  body.append(row('Alignment',
    seg([['left', 'Left'], ['center', 'Centre']], Settings.get('align'),
        (v) => Settings.set('align', v))));

  body.append(row('Text size',
    seg([['small', 'S'], ['medium', 'M'], ['large', 'L']], Settings.get('size'),
        (v) => Settings.set('size', v))));

  /* Rotation */
  body.append(el('p', 'panel-section', 'Rotation'));

  const HOURS: readonly (readonly [Cadence, string])[] =
    [['tab', 'Tab'], [1, '1h'], [3, '3h'], [6, '6h'], [24, 'Day']];

  body.append(row('Main piece',
    seg(HOURS, Settings.get('periodHours'), (v) => Settings.set('periodHours', v)),
    'Tab means a different one on every new tab'));

  body.append(row('Second card',
    seg([['tab', 'Every tab'], ['piece', 'With the piece']], Settings.get('feedCadence'),
        (v) => Settings.set('feedCadence', v))));

  const BG_HOURS: readonly (readonly [Cadence, string])[] =
    [['tab', 'Tab'], [1, '1h'], [6, '6h'], [24, 'Day']];

  body.append(row('Backdrop',
    seg(BG_HOURS, Settings.get('backdropCadence'),
        (v) => Settings.set('backdropCadence', v))));

  /* Feeds */
  body.append(el('p', 'panel-section', 'Feeds'));

  body.append(row('Where feed items go',
    seg([['companion', 'Second card'], ['mixed', 'In rotation'], ['off', 'Off']],
        Settings.get('feedMode'), (v) => Settings.set('feedMode', v)),
    'Feeds take the main slot either way once you have some. '
    + 'Second card puts one more below it'));

  body.append(row('Image treatment',
    seg([['plain', 'Plain'], ['muted', 'Muted'], ['duotone', 'Duotone']],
        Settings.get('imageStyle'), (v) => Settings.set('imageStyle', v)),
    'Photos fade into the ground either way. Hover one to see it in full colour'));

  body.append(row('Image edges',
    seg([['dissolve', 'Dissolve'], ['framed', 'Framed']], Settings.get('imageEdge'),
        (v) => Settings.set('imageEdge', v)),
    'Dissolve fades the bottom edge under the headline'));

  const list = el('div', 'feed-list');
  const drawList = () => {
    list.replaceChildren();
    const feeds = Settings.get('feeds');
    if (!feeds.length) {
      list.append(el('p', 'feed-empty', 'No feeds yet. Paste a subreddit or a feed URL below.'));
      return;
    }
    feeds.forEach((f, i) => {
      const r = el('div', 'feed-row');
      const label = el('span', 'feed-name', f.name || f.url);
      label.title = f.url;

      const controls = el('span', 'feed-controls');

      // Some subreddits are for looking rather than reading. Marked this way,
      // only their posts that carry a picture come through.
      const only = el('button', 'feed-flag', 'Images only');
      only.type = 'button';
      only.setAttribute('aria-pressed', f.imagesOnly ? 'true' : 'false');
      if (f.imagesOnly) only.classList.add('on');
      only.title = f.imagesOnly
        ? 'Showing only posts with a picture'
        : 'Show only posts with a picture';
      only.addEventListener('click', () => {
        const next = Settings.get('feeds').slice();
        const cur = next[i];
        if (!cur) return;                     // the list moved under us
        next[i] = { ...cur, imagesOnly: !cur.imagesOnly };
        Settings.set('feeds', next);
        drawList();
      });

      const x = el('button', 'feed-remove', 'Remove');
      x.type = 'button';
      x.addEventListener('click', () => {
        const next = Settings.get('feeds').slice();
        next.splice(i, 1);
        Settings.set('feeds', next);
        drawList();
      });

      controls.append(only, x);
      r.append(label, controls);
      list.append(r);
    });
    list.append(el('p', 'feed-empty',
      'Images only drops a feed\u2019s text posts, for the subreddits you keep '
      + 'for the pictures. Their items open onto the picture itself, and onto '
      + 'the whole set if the post is a gallery.'));
  };
  drawList();

  body.append(list);

  const adder = el('div', 'feed-add');
  const input = el('input', 'feed-input');
  input.type = 'text';
  input.placeholder = 'reddit.com/r/AskHistorians  ·  or any feed URL';
  input.spellcheck = false;
  const add = el('button', 'feed-btn', 'Add');
  add.type = 'button';
  const status = el('p', 'feed-status', '');

  async function addFeed(): Promise<void> {
    const url = normaliseFeedUrl(input.value);
    if (!url) { status.textContent = 'That does not look like a URL.'; return; }
    if (Settings.get('feeds').some((f) => f.url === url)) {
      status.textContent = 'Already on the list.';
      return;
    }

    status.textContent = 'Checking…';
    const ok = await ensureFeedPermission(url);
    if (!ok) {
      status.textContent = 'Vitrine needs permission to read that site.';
      return;
    }

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const parsed = parseFeed(await res.text(), url);
      if (!parsed || !parsed.items.length) throw new Error('empty');

      // If we were redirected, remember where we ended up rather than where
      // we started, so the next fetch does not cross an origin again.
      const settled = res.url && res.url !== url ? res.url : url;
      Settings.set('feeds', [...Settings.get('feeds'),
        { url: settled, name: parsed.source, imagesOnly: false }]);
      input.value = '';
      status.textContent = `Added ${parsed.source} — ${parsed.items.length} items.`;
      drawList();
      hooks.refreshFeeds();
    } catch {
      status.textContent = 'Could not read a feed there. Check the address.';
    }
  }

  add.addEventListener('click', addFeed);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addFeed(); }
  });

  adder.append(input, add);
  body.append(adder, status);

  const refresh = el('button', 'link-btn', 'Refresh feeds now');
  refresh.type = 'button';
  refresh.addEventListener('click', async () => {
    // A click is the only time a lost permission can be asked for again.
    await grantFeedAccess(Settings.get('feeds'));
    refresh.textContent = 'Refreshing…';
    await hooks.refreshFeeds({ force: true });
    refresh.textContent = 'Refresh feeds now';
    void drawAccess();
  });
  body.append(row('', refresh));

  /* Backdrop */
  body.append(el('p', 'panel-section', 'Backdrop'));

  const mode = Settings.get('backdrop');

  body.append(row('Source',
    seg([['ambient', 'Ambient'], ['apod', 'NASA'], ['unsplash', 'Unsplash'],
         ['subreddit', 'Reddit'], ['custom', 'Your own']], mode,
        (v) => { Settings.set('backdrop', v); rebuild(); }),
    'Ambient is the drifting glow, and needs no network'));

  if (mode !== 'ambient') {
    body.append(row('Dim the photo',
      seg([['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']],
          Settings.get('veil'), (v) => Settings.set('veil', v)),
      'Heavier is easier to read against a busy image'));
  }

  if (mode === 'apod') {
    body.append(row('NASA key',
      textField(Settings.get('nasaKey'), 'DEMO_KEY', (v) => Settings.set('nasaKey', v)),
      'Optional. The shared demo key is rate-limited; a free one from api.nasa.gov is not'));
  }

  if (mode === 'unsplash') {
    body.append(row('Unsplash key',
      textField(Settings.get('unsplashKey'), 'Access key',
                (v) => Settings.set('unsplashKey', v)),
      'Free from unsplash.com/developers — make an app, copy the Access Key'));
    body.append(row('Search for',
      textField(Settings.get('unsplashQuery'), 'e.g. fog, minimal, texture',
                (v) => Settings.set('unsplashQuery', v)),
      'Leave empty for anything'));
  }

  if (mode === 'subreddit') {
    body.append(row('Minimum width',
      seg([[0, 'Any'], [800, '800px'], [1200, '1200px']], Settings.get('minImageWidth'),
          (v) => Settings.set('minImageWidth', v)),
      'Any takes everything and stretches it to fill the screen'));
    body.append(el('p', 'feed-empty',
      'One subreddit per line. Posts marked NSFW are skipped.'));
    body.append(textArea((Settings.get('backdropSubs') || []).join('\n'),
      'EarthPorn\nExposurePorn\nSpacePorn',
      (v) => Settings.set('backdropSubs', lines(v))));
  }

  if (mode === 'custom') {
    body.append(el('p', 'feed-empty', 'One image URL per line. Nothing is fetched but the images themselves.'));
    body.append(textArea((Settings.get('customImages') || []).join('\n'),
      'https://example.com/a-photograph.jpg',
      (v) => Settings.set('customImages', lines(v))));
  }

  if (mode !== 'ambient') {
    const test = el('button', 'feed-btn', 'Test this source');
    test.type = 'button';
    const testStatus = el('p', 'feed-status', '');
    test.addEventListener('click', async () => {
      testStatus.textContent = 'Trying…';
      const r = await hooks.testBackdrop();
      testStatus.textContent = r.ok
        ? `Working — ${r.n} image${r.n === 1 ? '' : 's'} available.`
        : r.error;
    });
    const wrap = el('div', 'feed-add');
    wrap.append(test);
    body.append(wrap, testStatus);
  }

  /* Weather */
  body.append(el('p', 'panel-section', 'Weather'));

  body.append(row('Units',
    seg([['fahrenheit', '°F'], ['celsius', '°C']], Settings.get('units'),
        (v) => Settings.set('units', v))));

  const placeWrap = el('div', 'place-set');
  const placeInput = el('input', 'feed-input');
  placeInput.type = 'text';
  placeInput.placeholder = 'City or postcode';
  placeInput.value = Settings.get('place').name;
  const placeBtn = el('button', 'feed-btn', 'Set');
  placeBtn.type = 'button';
  const placeStatus = el('p', 'feed-status', '');

  async function setPlace(): Promise<void> {
    placeStatus.textContent = 'Looking…';
    const found = await lookupPlace(placeInput.value);
    if (!found) {
      placeStatus.textContent = 'No match. Try a city name, or a 5-digit ZIP.';
      return;
    }
    Settings.set('place', found);
    placeInput.value = found.name;
    placeStatus.textContent = 'Set to ' + found.name + '.';
  }

  placeBtn.addEventListener('click', setPlace);
  placeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); setPlace(); }
  });

  placeWrap.append(placeInput, placeBtn);
  body.append(row('Location', el('span', 'row-spacer')), placeWrap, placeStatus);
}

export function openPanel(hooks: PanelHooks): void {
  buildPanel(hooks);
  $('scrim').hidden = false;
  $('panel').hidden = false;
  $('panel').scrollTop = 0;
  $('panelClose').focus({ preventScroll: true });
}

export function closePanel(): void {
  $('panel').hidden = true;
  if ($('note').hidden) $('scrim').hidden = true;
  $('settings').focus();
}

export const panelIsOpen = (): boolean => !$('panel').hidden;
