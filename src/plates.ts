/* Vitrine — the plates.
 *
 * Each function draws one figure into a canvas context, in hairlines,
 * on a transparent ground. Nothing here touches the network.
 */

/** A seeded source of 0..1. The same seed always draws the same figure. */
export type Rng = () => number;

/* What every plate is: hairlines in one ink, into a square of w by h.
 *
 * Three of the six take no seed, and that is on purpose rather than an
 * oversight: phyllotaxis, rosette and vault each draw one specific thing —
 * the golden angle, the real Earth–Venus resonance, a dome on pendentives —
 * and jittering them would draw something that is not that thing. The other
 * three depict a process rather than a figure, so they vary. Anything named
 * _rng below is declining the seed, not forgetting it. */
export type PlateFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ink: string,
  rng: Rng
) => void;

export function mulberry32(a: number): Rng {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** '#4E7C6E' at some opacity, as a colour the canvas will take. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/* A point, and a segment between two of them. Tuples rather than arrays, so
   p[0] is a number and not a number-or-nothing. */
type Pt = [number, number];
type Seg = [Pt, Pt];

/* One of a list, chosen by the seed. The list is a non-empty tuple, so there
   is always something to fall back on and no assertion is needed. */
const choose = <T,>(list: readonly [T, ...T[]], rng: Rng): T =>
  list[Math.floor(rng() * list.length)] ?? list[0];

export const PLATES = {

  /* Seeds placed one golden angle apart. */
  phyllotaxis(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string, _rng: Rng): void {
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.44;
    const n = 1100;
    const c = R / Math.sqrt(n);
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 1; i <= n; i++) {
      const r = c * Math.sqrt(i);
      const a = i * golden;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      const t = i / n;
      const dot = 0.6 + t * 2.6;

      ctx.beginPath();
      ctx.arc(x, y, dot, 0, Math.PI * 2);
      ctx.fillStyle = alpha(ink, 0.22 + t * 0.6);
      ctx.fill();
    }

    // The two dominant spiral families, traced faintly.
    ctx.lineWidth = 0.6;
    for (const step of [21, 34]) {
      for (let s = 0; s < step; s++) {
        ctx.beginPath();
        let first = true;
        for (let i = s + step; i <= n; i += step) {
          const r = c * Math.sqrt(i), a = i * golden;
          const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
          if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = alpha(ink, step === 21 ? 0.18 : 0.12);
        ctx.stroke();
      }
    }
  },

  /* Sand settling on the still lines of a vibrating plate. */
  chladni(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string, rng: Rng): void {
    const size = Math.min(w, h) * 0.82;
    const x0 = (w - size) / 2, y0 = (h - size) / 2;
    const pairs: readonly [Pt, ...Pt[]] =
      [[3, 7], [4, 9], [2, 5], [5, 8], [3, 10], [6, 7]];
    const [m, n] = choose(pairs, rng);

    const f = (x: number, y: number): number =>
      Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) -
      Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);

    // Scatter grains, keeping those that land near a nodal line.
    let placed = 0, tries = 0;
    while (placed < 9000 && tries < 260000) {
      tries++;
      const u = rng(), v = rng();
      const val = Math.abs(f(u, v));
      if (val > 0.035) continue;
      const jx = (rng() - 0.5) * 2.2, jy = (rng() - 0.5) * 2.2;
      ctx.fillStyle = alpha(ink, 0.30 + rng() * 0.45);
      ctx.fillRect(x0 + u * size + jx, y0 + v * size + jy, 1.1, 1.1);
      placed++;
    }

    ctx.strokeStyle = alpha(ink, 0.22);
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x0, y0, size, size);
  },

  /* The Earth–Venus line, drawn with the Earth held still. */
  rosette(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string, _rng: Rng): void {
    const cx = w / 2, cy = h / 2;
    const S = Math.min(w, h) * 0.255;
    const Re = 1.000, Rv = 0.7233;
    const we = 2 * Math.PI / 1.0, wv = 2 * Math.PI / 0.6152;
    const years = 8, steps = 5000;
    const near = Re - Rv, far = Re + Rv;

    // Venus's position relative to Earth. Segments are drawn brighter the
    // closer the two planets are, which brings the five retrograde loops
    // forward and lets the far sweeps fall back.
    const BANDS = 7;
    const bands: Seg[][] = Array.from({ length: BANDS }, () => []);
    let prev: Pt | null = null;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * years;
      const x = Rv * Math.cos(wv * t) - Re * Math.cos(we * t);
      const y = Rv * Math.sin(wv * t) - Re * Math.sin(we * t);
      const p: Pt = [cx + x * S, cy + y * S];

      if (prev) {
        const r = Math.hypot(x, y);
        const closeness = 1 - (r - near) / (far - near);
        const b = Math.min(BANDS - 1, Math.floor(closeness * closeness * BANDS));
        bands[b]?.push([prev, p]);
      }
      prev = p;
    }

    ctx.lineWidth = 0.85;
    bands.forEach((segs, b) => {
      if (!segs.length) return;
      ctx.beginPath();
      for (const [a, z] of segs) { ctx.moveTo(a[0], a[1]); ctx.lineTo(z[0], z[1]); }
      ctx.strokeStyle = alpha(ink, 0.09 + (b / (BANDS - 1)) * 0.58);
      ctx.stroke();
    });

    // Earth, at the centre of its own account of things.
    ctx.beginPath();
    ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = alpha(ink, 0.8);
    ctx.fill();

    ctx.setLineDash([1.5, 6]);
    ctx.strokeStyle = alpha(ink, 0.13);
    ctx.lineWidth = 0.6;
    for (const r of [Re - Rv, 1.0, Re + Rv]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * S, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  },

  /* Beds laid flat, tilted, planed off, and buried again. */
  strata(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string, rng: Rng): void {
    const x0 = w * 0.08, x1 = w * 0.92;
    const top = h * 0.10, bottom = h * 0.90;
    const surface = h * 0.52;
    const lean = 0.19 + rng() * 0.06;   // beds stood almost on end

    // Lower set: steeply dipping, planed off flat by the sea.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, surface, x1 - x0, bottom - surface);
    ctx.clip();
    const gap = (x1 - x0) / 17;
    for (let i = -4; i < 24; i++) {
      const xTop = x0 + i * gap + (rng() - 0.5) * gap * 0.28;
      ctx.beginPath();
      ctx.moveTo(xTop, surface - 6);
      ctx.lineTo(xTop - lean * (bottom - surface + 6), bottom + 6);
      ctx.lineWidth = i % 4 === 0 ? 1.15 : 0.7;
      ctx.strokeStyle = alpha(ink, i % 4 === 0 ? 0.46 : 0.20);
      ctx.stroke();
    }
    ctx.restore();

    // Upper set: flat-lying, laid down long afterwards.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, top, x1 - x0, surface - top);
    ctx.clip();
    for (let i = 0; i < 8; i++) {
      const y = surface - (surface - top) * ((i + 0.55) / 8);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      for (let x = x0; x <= x1; x += 6) {
        ctx.lineTo(x, y + Math.sin(x * 0.011 + i * 1.7) * 2.1);
      }
      ctx.lineWidth = i % 2 === 0 ? 1.0 : 0.7;
      ctx.strokeStyle = alpha(ink, i % 2 === 0 ? 0.40 : 0.21);
      ctx.stroke();
    }
    ctx.restore();

    // The hiatus itself.
    ctx.beginPath();
    ctx.moveTo(x0, surface);
    for (let x = x0; x <= x1; x += 4) {
      ctx.lineTo(x, surface + Math.sin(x * 0.021) * 2.4 + Math.sin(x * 0.007) * 3);
    }
    ctx.strokeStyle = alpha(ink, 0.9);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.strokeStyle = alpha(ink, 0.22);
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x0, top, x1 - x0, bottom - top);
  },

  /* Getting a round dome onto a square room.
   * One sphere, sliced by the four walls. What is left over in the
   * corners is the pendentive; what is left over on top is the dome. */
  vault(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string, _rng: Rng): void {
    const cx = w / 2;
    const half = Math.min(w, h) * 0.235;    // half the side of the room
    const base = h * 0.88;
    const spring = base - half * 1.05;      // where the arches turn
    const R = half * Math.SQRT2;            // the sphere: radius = half-diagonal
    const cornice = spring - half;          // exactly the crown of the arches
    const corniceHalf = half;              // the square's inscribed circle

    const line = (a: number, lw: number): void => {
      ctx.strokeStyle = alpha(ink, a); ctx.lineWidth = lw;
    };

    // Ground and piers.
    line(0.5, 1.3);
    ctx.beginPath();
    ctx.moveTo(cx - half - 16, base); ctx.lineTo(cx + half + 16, base);
    ctx.stroke();
    line(0.45, 1.1);
    for (const x of [cx - half, cx + half]) {
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, spring); ctx.stroke();
    }

    // The sphere, shown whole and faint — the idea before it is cut.
    ctx.setLineDash([2, 6]);
    line(0.15, 0.6);
    ctx.beginPath(); ctx.arc(cx, spring, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - R - 12, spring); ctx.lineTo(cx + R + 12, spring); ctx.stroke();
    ctx.setLineDash([]);

    // The dome, standing on that circle.
    line(0.70, 1.3);
    ctx.beginPath();
    ctx.arc(cx, cornice, corniceHalf, Math.PI, 0);
    ctx.stroke();

    // Meridians, to say it is a solid of revolution.
    line(0.14, 0.55);
    for (let i = 1; i < 9; i++) {
      const k = Math.abs(-1 + (2 * i) / 9);
      ctx.beginPath();
      ctx.ellipse(cx, cornice, k * corniceHalf, corniceHalf, 0, Math.PI, 0);
      ctx.stroke();
    }

    // The cornice, where dome stops and pendentive begins.
    line(0.5, 1.0);
    ctx.beginPath();
    ctx.moveTo(cx - corniceHalf, cornice); ctx.lineTo(cx + corniceHalf, cornice);
    ctx.stroke();

    // Pendentives: sphere below the cornice, outside the great arch.
    line(0.55, 1.15);
    ctx.beginPath(); ctx.arc(cx, spring, half, Math.PI, 0); ctx.stroke();

    // Axis.
    ctx.setLineDash([1, 7]);
    line(0.16, 0.6);
    ctx.beginPath();
    ctx.moveTo(cx, base + 10); ctx.lineTo(cx, cornice - corniceHalf - 16); ctx.stroke();
    ctx.setLineDash([]);
  },

  /* The cheapest way to connect a point to a volume. */
  ramify(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string, rng: Rng): void {
    const trunk = Math.min(w, h) * 0.20;

    function branch(
      x: number, y: number, ang: number,
      len: number, width: number, depth: number
    ): void {
      if (depth > 9 || len < 2.4) return;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = Math.max(0.4, width);
      ctx.strokeStyle = alpha(ink, 0.26 + (9 - depth) * 0.05);
      ctx.lineCap = 'round';
      ctx.stroke();

      const n = rng() < 0.14 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const spread = 0.42 + rng() * 0.34;
        const dir = n === 2 ? (i === 0 ? -1 : 1) : i - 1;
        branch(x2, y2,
               ang + dir * spread + (rng() - 0.5) * 0.18,
               len * (0.68 + rng() * 0.16),
               width * 0.70,
               depth + 1);
      }
    }

    branch(w / 2, h * 0.94, -Math.PI / 2, trunk, 3.4, 0);
  }
} satisfies Record<string, PlateFn>;

/** Which figures exist. A piece naming one that does not is a build error. */
export type PlateName = keyof typeof PLATES;
