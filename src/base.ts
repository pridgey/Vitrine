/* Vitrine — the things everything else needs. */

/* Every element the page reaches for, with the type it actually is in
   newtab.html. Writing it down once buys two things: a mistyped id is a
   compile error rather than a null at run time, and `$('galleryPrev').disabled`
   type-checks without a cast at every call site. */
interface Elements {
  advance: HTMLButtonElement;
  backdrop: HTMLDivElement;
  case: HTMLElement;
  companion: HTMLAnchorElement;
  companionLabel: HTMLSpanElement;
  companionThumb: HTMLImageElement;
  companionTitle: HTMLSpanElement;
  credit: HTMLAnchorElement;
  cue: HTMLSpanElement;
  date: HTMLSpanElement;
  gallery: HTMLDivElement;
  galleryBar: HTMLDivElement;
  galleryCount: HTMLSpanElement;
  galleryNews: HTMLParagraphElement;
  galleryNext: HTMLButtonElement;
  galleryPrev: HTMLButtonElement;
  galleryStrip: HTMLDivElement;
  labelDate: HTMLSpanElement;
  labelField: HTMLSpanElement;
  note: HTMLElement;
  noteBody: HTMLDivElement;
  noteClose: HTMLButtonElement;
  noteHead: HTMLParagraphElement;
  noteLink: HTMLAnchorElement;
  object: HTMLDivElement;
  panel: HTMLElement;
  panelBody: HTMLDivElement;
  panelClose: HTMLButtonElement;
  panelHead: HTMLParagraphElement;
  panelReset: HTMLButtonElement;
  piece: HTMLElement;
  scrim: HTMLDivElement;
  settings: HTMLButtonElement;
  time: HTMLSpanElement;
  weather: HTMLButtonElement;
}

/* None of these elements is ever replaced — only their children are — so the
   lookup is worth holding on to. Some of them are asked for several times in
   a single frame. */
const found = new Map<string, HTMLElement>();

export function $<K extends keyof Elements>(id: K): Elements[K] {
  const hit = found.get(id);
  if (hit) return hit as Elements[K];

  const node = document.getElementById(id);
  if (!node) throw new Error(`newtab.html has no #${id}`);

  found.set(id, node);
  return node as Elements[K];
}

/* Make an element, name it, and give it its words. The tag is carried through
   to the return type, so el('input', …) is an HTMLInputElement and setting
   .value on it needs no cast. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string | null,
  textContent?: string | null
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (textContent != null) n.textContent = textContent;
  return n;
}

/* Everything Vitrine keeps is under one prefix in localStorage, and every read
   is allowed to fail: a private window, a full disk, or a cache written by a
   version that stored something else all end the same way — you get the
   fallback and the page carries on. Reads of anything but a primitive should
   name their type, since what comes back out of JSON.parse is unknown. */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem('vitrine.' + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch { return fallback; }
  },

  set(key: string, value: unknown): void {
    try { localStorage.setItem('vitrine.' + key, JSON.stringify(value)); }
    catch { /* private window, or storage full — carry on */ }
  }
};

/* Positive remainder, so a slot counter that has been walked backwards past
   zero still lands inside the collection. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

/* Does this URL point at a picture? Asked by both the feeds and the backdrops,
   which is why it lives down here rather than with either of them. */
const IMG_RE = /\.(jpe?g|png|webp|avif)(\?|#|$)/i;
const IMG_HOST = /(^|\.)(i\.redd\.it|preview\.redd\.it|images-assets\.nasa\.gov|apod\.nasa\.gov|images\.unsplash\.com)$/i;

export function looksLikeImage(url: string | null | undefined): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    return IMG_RE.test(u.pathname) || IMG_HOST.test(u.hostname);
  } catch { return false; }
}
