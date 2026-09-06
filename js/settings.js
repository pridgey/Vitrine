/* Vitrine — settings.
 *
 * Everything configurable lives here, along with the panel that edits it.
 * Changes apply immediately; nothing needs a reload.
 */

const DEFAULTS = {
  align:       'left',        // 'left' | 'center'
  size:        'medium',      // 'small' | 'medium' | 'large'
  periodHours: 3,             // 'tab', or hours the main piece stays up
  feedCadence: 'tab',         // 'tab' | 'piece' — how often the second card moves
  backdropCadence: 6,         // 'tab', or hours between backdrops
  units:       'fahrenheit',  // 'fahrenheit' | 'celsius'
  feedMode:    'companion',   // 'companion' | 'mixed' | 'off'
  feeds:       [],            // [{ url, name, imagesOnly }]
  imageStyle:  'muted',       // 'plain' | 'muted' | 'duotone'
  imageEdge:   'dissolve',    // 'dissolve' | 'framed'
  place:       { name: 'Denver', lat: 39.7392, lon: -104.9847 },

  backdrop:      'ambient',   // 'ambient' | 'apod' | 'unsplash' | 'subreddit' | 'custom'
  veil:          'medium',    // how hard a photo is dimmed behind the text
  nasaKey:       '',
  unsplashKey:   '',
  unsplashQuery: '',
  backdropSubs:  [],          // ['EarthPorn', 'ExposurePorn']
  minImageWidth: 0,           // 0 = take them all and stretch to fit
  customImages:  []           // full image URLs
};

const SIZE_SCALE = { small: 0.88, medium: 1, large: 1.18 };
const VEIL_LEVEL = { light: 0.62, medium: 0.85, heavy: 1 };

const Settings = {
  data: { ...DEFAULTS, ...(typeof store !== 'undefined' ? store.get('settings', {}) : {}) },
  listeners: [],

  get(key) { return this.data[key]; },

  set(key, value) {
    this.data[key] = value;
    store.set('settings', this.data);
    this.listeners.forEach((fn) => fn(key, value));
  },

  onChange(fn) { this.listeners.push(fn); },

  reset() {
    this.data = { ...DEFAULTS };
    store.set('settings', this.data);
    this.listeners.forEach((fn) => fn('*', null));
  }
};

/* ── Small pieces of panel furniture ────────────────────────── */

function el(tag, cls, textContent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (textContent != null) n.textContent = textContent;
  return n;
}

function row(labelText, control, hintText) {
  const r = el('div', 'row');
  const left = el('div', 'row-left');
  left.append(el('span', 'row-label', labelText));
  if (hintText) left.append(el('span', 'row-hint', hintText));
  r.append(left, control);
  return r;
}

function textArea(value, placeholder, onCommit) {
  const t = el('textarea', 'feed-area');
  t.value = value;
  t.placeholder = placeholder;
  t.spellcheck = false;
  t.addEventListener('change', () => onCommit(t.value));
  t.addEventListener('blur', () => onCommit(t.value));
  return t;
}

function textField(value, placeholder, onCommit) {
  const i = el('input', 'feed-input');
  i.type = 'text';
  i.value = value;
  i.placeholder = placeholder;
  i.spellcheck = false;
  i.addEventListener('change', () => onCommit(i.value.trim()));
  i.addEventListener('blur', () => onCommit(i.value.trim()));
  return i;
}

const lines = (v) => v.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

function seg(options, current, onPick) {
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

function buildPanel(hooks) {
  const body = $('panelBody');
  const keepScroll = $('panel').scrollTop;
  const rebuild = () => { buildPanel(hooks); $('panel').scrollTop = keepScroll; };
  body.replaceChildren();

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

  body.append(row('Main piece',
    seg([['tab', 'Tab'], [1, '1h'], [3, '3h'], [6, '6h'], [24, 'Day']],
        Settings.get('periodHours'), (v) => Settings.set('periodHours', v)),
    'Tab means a different one on every new tab'));

  body.append(row('Second card',
    seg([['tab', 'Every tab'], ['piece', 'With the piece']], Settings.get('feedCadence'),
        (v) => Settings.set('feedCadence', v))));

  body.append(row('Backdrop',
    seg([['tab', 'Tab'], [1, '1h'], [6, '6h'], [24, 'Day']],
        Settings.get('backdropCadence'), (v) => Settings.set('backdropCadence', v))));

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
        next[i] = { ...next[i], imagesOnly: !next[i].imagesOnly };
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

  async function addFeed() {
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
      if (!res.ok) throw new Error(res.status);
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
    refresh.textContent = 'Refreshing…';
    await hooks.refreshFeeds({ force: true });
    refresh.textContent = 'Refresh feeds now';
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

  async function setPlace() {
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

function openPanel(hooks) {
  buildPanel(hooks);
  $('scrim').hidden = false;
  $('panel').hidden = false;
  $('panel').scrollTop = 0;
  $('panelClose').focus({ preventScroll: true });
}

function closePanel() {
  $('panel').hidden = true;
  if ($('note').hidden) $('scrim').hidden = true;
  $('settings').focus();
}

const panelIsOpen = () => !$('panel').hidden;
