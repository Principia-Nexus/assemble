/* eslint-disable */
import GLYPHS from "./dotsGlyphs.json";

const FILTERS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" id="assemble-dot-filters">
  <filter id="soft-cap" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
    <feComponentTransfer>
      <feFuncR type="table" tableValues="0 0.1 0.2 0.3 0.4 0.5 0.6 0.68 0.74 0.78 0.8"/>
      <feFuncG type="table" tableValues="0 0.1 0.2 0.3 0.4 0.5 0.6 0.68 0.74 0.78 0.8"/>
      <feFuncB type="table" tableValues="0 0.1 0.2 0.3 0.4 0.5 0.6 0.68 0.74 0.78 0.8"/>
    </feComponentTransfer>
  </filter>
  <filter id="ink-from-mask" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
    <feColorMatrix type="matrix" values="0 0 0 0 0.10196  0 0 0 0 0.16078  0 0 0 0 0.21569  1 0 0 0 0"/>
  </filter>
</svg>`;

// Dots swirl across the page and condense into the wordmark at getTarget() {x, cy, w} (CSS px).
export function createDots(canvas, getTarget) {
if (!document.getElementById("assemble-dot-filters")) document.body.insertAdjacentHTML("beforeend", FILTERS);


// ---------------------------------------------------------------- constants
const REF_W = 960, REF_H = 620;            // design space (matches the original video)
const INK = '#1a2937';     // sampled from the original's final frame
const FONT_PX = 149.08;                    // fitted logo size in design space
const ORIGIN_X = 173.68, BASELINE = 363.56;

const SEED = 20261025;
// Dots are the ink. Every dot's target is a point inside the wordmark and its
// final radius is the inscribed radius there (distance to the outline), capped
// at R_MAX: stems take several overlapping dots, hairlines and serifs one bead
// across. The union of all landed dots is the letterform itself.
const R_MAX = 2.4;                         // design px; caps the dot size inside stems
const R_MIN = 0.55;                        // smallest dot (serif tips, corners)
const GRID = 1.3 * R_MAX;                  // hex pitch for full-size interior dots
const FINISH = 0.06;                       // s: a dot's local vector finish, from the moment it first reaches its target
const FINISH_GROW = 2.0;                   // design px: how far that finish reaches (inside the outline only)
const LAND_GROW = 0.6;                     // design px of it applied at once
const FINISH_BAND = 2.5;                   // design px: the growth only acts this close to the outline
const EDGE_LEAD = 0.025;                   // s: outline dots leave (and land) this much before interior dots

// The swirl. Three density arms (spiral filaments) and a few "lead" dots with
// long shutter streaks make the rotation readable while the ring is still whole.
const ARMS = 3, ARM_K = 0.55, ARM_TWIST = 2.4;
const LEAD_FRAC = 0, LEAD_SHUTTER = 1 / 30;
const VIS0 = 0;                         // the first frame already shows the ring at ~a third of its strength
// The ending. A share of the last three letters' dots stay on a wide outer orbit
// (full ink, so it reads) until late, then come in on long, strongly bent paths,
// so b, l and e are fed by a sweeping arc rather than a crawl.
const OUTER_FRAC = {};   // per letter (b, l, last e): the finale gets the most
const OUTER_EXTRA = 0, FINALE_EXTRA = 0.3;
// The last letters (b, l, e) are fed along the vortex's own rotation: their dots
// peel off the upper-right arc of the orbit (from above the word round to its
// right end, LATE_ARC rad) and arc down into their letters from above, never up
// from below the baseline.
const LATE_FROM = 99, LATE_ARC = [-1.2, 0.35];
// After leaving, a late dot's ring carry decays (time constant 1/CARRY_K s), so
// the fast late swirl cannot drag it round the far side of the orbit and in from below.
const CARRY_K = 4;   // s: the last e's fan leaves earlier on longer flights (lands on schedule)
// The closing beat: the word swells 0.6% as the last e's final dots land (peak
// exactly at the last landing) and eases back, one smooth hump, no undershoot;
// exact 0.2 s after the last landing.
const BEAT_AMP = 0.006, BEAT_LEN = 0.4, BEAT_LEAD = 0.2;
const INK_EARLY = 2 / 60;                  // s: a dot's ink (and its 60 ms growth) starts this long before it arrives
// Stroke interiors land with almost no jitter, so a filling stem advances as a
// straight edge; outline dots keep the full jitter. Every landed dot also swells
// a little (INNER_GROW) so the advancing edge closes up as it moves.
const JITTER_INNER = 0.012, INNER_GROW = 0.5;
// In flight: streaks shorten as a dot nears its target, opacity of a streak
// never drops below STREAK_MIN_A, so the tone is the same across the sweep.
const NEAR_PX = 30, NEAR_SHUTTER = 0.4, STREAK_MIN_A = 0.5;
// Depth cue: a dot crossing the already-written part of the word, or any finished
// letter's box (counters included), passes "behind" it at PASS_BEHIND opacity, so
// streams bound for later letters do not haze the finished letters.
const PASS_BEHIND = 0.05, PASS_SOFT = 10;

// Timeline (seconds). See NOTES.md for the table.
const T = {
  emergeEnd: 0.12,       // last dot starts fading in
  emergeDur: 0.35,
  convStart: 0.55,      // first dot leaves the ring (end of wind-up)
  sweep: 0.3,           // left-to-right release stagger across the word
  jitter: 0.04,
  flight: 1.25,          // + up to 0.1 random
  duration: 0,          // set below: exact logo + HOLD
};
const LOOP_FADE = 0.45, LOOP_BLANK = 0.35;  // live playback only: fade the logo out, then fade the opening ring back in

// ---------------------------------------------------------------- easing
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, u) => a + (b - a) * u;
const smoothstep = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);

// Flight progress p(u), u = 0..1 over a dot's flight.
//  - 0 .. U_ARRIVE: Hermite ease. Starts at rest relative to the swirl (the dot
//    leaves with the ring's own velocity), peaks late, and reaches the target
//    still moving at V_ARRIVE, so it does not hover in front of its letter.
//  - U_ARRIVE .. 1: that leftover speed carries it a hair past the target and a
//    damped spring brings it back (the "snap to the magnet" settle).
//  The dot always arrives at V_ARRIVE (so it never hovers outside its letter);
//  only the settle's amplitude v is set per dot, so the overshoot never exceeds
//  SETTLE_MAX design px whatever the path length.
const U_ARRIVE = 0.9, V_ARRIVE = 1.2, SETTLE_W = 34, SETTLE_Z = 0.55, SETTLE_MAX = 0.6;
const OVERSHOOT_PER_V = (() => {                         // peak (p - 1) per unit arrival speed
  let m = 0;
  for (let i = 1; i <= 400; i++) m = Math.max(m, flight(U_ARRIVE + (1 - U_ARRIVE) * i / 400, 1) - 1);
  return m;
})();
function flight(u, v = V_ARRIVE) {
  if (u <= 0) return 0;
  if (u < U_ARRIVE) {
    const x = u / U_ARRIVE, m1 = V_ARRIVE * U_ARRIVE;   // end slope in x units
    const peak = x * x * (3 - 2 * x);                  // smoothstep
    return peak + (m1 - 0) * (x * x * x - x * x);      // Hermite with p'(1) = m1
  }
  if (u >= 1) return 1;
  const tau = u - U_ARRIVE, wd = SETTLE_W * Math.sqrt(1 - SETTLE_Z * SETTLE_Z);
  const env = Math.exp(-SETTLE_Z * SETTLE_W * tau);
  const tail = 1 - smoothstep(0.6, 1, tau / (1 - U_ARRIVE));   // lands exactly at u = 1
  return 1 + (v / wd) * env * Math.sin(wd * tau) * tail;
}

// Seeded PRNG (mulberry32) so every render is identical.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- wordmark geometry
const DATA = GLYPHS;
const S = FONT_PX / DATA.upm;

const letters = DATA.glyphs.map((g) => {
  const path = new Path2D();
  path.addPath(new Path2D(g.d), new DOMMatrix([S, 0, 0, -S, ORIGIN_X + g.x * S, BASELINE]));
  return {
    path,
    x0: ORIGIN_X + (g.x + g.bounds[0]) * S, x1: ORIGIN_X + (g.x + g.bounds[2]) * S,
    y0: BASELINE - g.bounds[3] * S, y1: BASELINE - g.bounds[1] * S,
    dots: [],
  };
});
const WORD_X0 = Math.min(...letters.map((l) => l.x0)), WORD_X1 = Math.max(...letters.map((l) => l.x1));
const WORD_Y0 = Math.min(...letters.map((l) => l.y0)), WORD_Y1 = Math.max(...letters.map((l) => l.y1));
const LOGO_CX = (WORD_X0 + WORD_X1) / 2, LOGO_CY = (WORD_Y0 + WORD_Y1) / 2;   // ~ (477.5, 310)

// ---------------------------------------------------------------- dot targets
// Each letter is rasterised (RASTER px per design px) once at start-up, with an
// exact Euclidean distance transform of its interior (edge = inscribed radius).
//  1. Interior: a hex grid of full-size dots (r = R_MAX) wherever such a dot
//     fits inside the outline.
//  2. Everything else (the band along every edge, hairlines, serifs, corners):
//     candidate points sorted by inscribed radius, largest first, so ridges of
//     thin strokes are taken before their flanks. A candidate becomes a dot
//     (r = its inscribed radius) if its disk still covers enough not-yet-inked
//     pixels. Every dot is inscribed, so the union never leaves the outline.
const RASTER = 4;

function edt1d(f, n, d, v, z) {           // Felzenszwalb-Huttenlocher squared EDT, one line
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) {
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      if (s <= z[k]) { k--; continue; }
      break;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}

// Distance (in raster px) from each inked pixel centre to the nearest blank pixel centre.
function insideDistance(inside, w, h) {
  const BIG = 1e20, n = Math.max(w, h);
  const g = new Float64Array(w * h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let i = 0; i < w * h; i++) g[i] = inside[i] ? BIG : 0;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]);
  }
  return g;
}

const stats = { dots: 0, uncovered: 0, inked: 0, maxHalf: [] };
function sampleLetter(L, li) {
  const pad = 3, ox = L.x0 - pad, oy = L.y0 - pad;
  const w = Math.ceil((L.x1 - L.x0 + 2 * pad) * RASTER), h = Math.ceil((L.y1 - L.y0 + 2 * pad) * RASTER);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.setTransform(RASTER, 0, 0, RASTER, -ox * RASTER, -oy * RASTER);
  c.fill(L.path);
  const px = c.getImageData(0, 0, w, h).data;
  const inside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inside[i] = px[i * 4 + 3] >= 128 ? 1 : 0;
  const edge = insideDistance(inside, w, h);           // raster px; 0.5 = edge pixel
  const covered = new Uint8Array(w * h);
  const toPx = (x, y) => [(x - ox) * RASTER, (y - oy) * RASTER];
  // r in design px; the dot's disk on the raster has radius r * RASTER around (cx, cy)
  const disk = (cx, cy, rr, mark) => {
    let n = 0;
    const x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(w - 1, Math.ceil(cx + rr));
    const y0 = Math.max(0, Math.floor(cy - rr)), y1 = Math.min(h - 1, Math.ceil(cy + rr));
    const r2 = rr * rr;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy + 0.5 - cy;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - cx, i = yy * w + xx;
        if (dx * dx + dy * dy <= r2 && inside[i] && !covered[i]) { n++; if (mark) covered[i] = 1; }
      }
    }
    return n;
  };
  const add = (x, y, r, edgeDot = false) => {
    L.dots.push({ tx: x, ty: y, r, li, edgeDot });
    const [cx, cy] = toPx(x, y);
    disk(cx, cy, r * RASTER, true);
  };
  const edgeAt = (x, y) => {
    const [fx, fy] = toPx(x, y), ix = Math.floor(fx), iy = Math.floor(fy);
    return ix < 0 || iy < 0 || ix >= w || iy >= h ? 0 : edge[iy * w + ix];
  };

  // 1. hex grid of full-size dots, anchored to the word so letters share one lattice
  const rowH = GRID * Math.sqrt(3) / 2;
  const r0 = Math.floor((L.y0 - LOGO_CY) / rowH) - 1, r1 = Math.ceil((L.y1 - LOGO_CY) / rowH) + 1;
  for (let r = r0; r <= r1; r++) {
    const y = LOGO_CY + r * rowH, off = (r & 1) ? GRID / 2 : 0;
    const c0 = Math.floor((L.x0 - WORD_X0) / GRID) - 1, c1 = Math.ceil((L.x1 - WORD_X0) / GRID) + 1;
    for (let cc = c0; cc <= c1; cc++) {
      const x = WORD_X0 + cc * GRID + off;
      if (edgeAt(x, y) - 0.5 >= R_MAX * RASTER) add(x, y, R_MAX);
    }
  }
  // 2. greedy, largest inscribed radius first
  const cand = [];
  for (let i = 0; i < w * h; i++) {
    const rr = edge[i] - 0.5;                            // inscribed radius in raster px
    if (inside[i] && !covered[i] && rr >= R_MIN * RASTER) cand.push(i);
  }
  // also consider covered pixels as centres (a dot centred in ink can still reach the rim)
  for (let i = 0; i < w * h; i++) {
    const rr = edge[i] - 0.5;
    if (inside[i] && covered[i] && rr >= R_MIN * RASTER && rr < R_MAX * RASTER && (i % 2 === 0)) cand.push(i);
  }
  const key = (i) => Math.min(edge[i] - 0.5, R_MAX * RASTER);
  cand.sort((a, b) => key(b) - key(a) || a - b);
  for (const i of cand) {
    const rr = key(i), cx = (i % w) + 0.5, cy = Math.floor(i / w) + 0.5;
    const area = Math.PI * rr * rr;
    const need = Math.max(5, 0.22 * area);
    if (disk(cx, cy, rr, false) >= need) add(ox + cx / RASTER, oy + cy / RASTER, rr / RASTER, rr < R_MAX * RASTER);
  }
  let unc = 0, ink = 0, maxE = 0;
  for (let i = 0; i < w * h; i++) if (inside[i]) { ink++; if (!covered[i]) unc++; maxE = Math.max(maxE, edge[i]); }
  stats.dots += L.dots.length; stats.uncovered += unc; stats.inked += ink; stats.maxHalf.push(+(maxE / RASTER).toFixed(2));
}

// ---------------------------------------------------------------- dots
letters.forEach(sampleLetter);
const rand = mulberry32(SEED);
let FIELD_CX = 480, FIELD_CY = 310, FIELD_RX = 420, FIELD_RY = 238;
const dots = letters.flatMap((L) => L.dots);
const windup = (t) => t * (1 + 0.35 * t);                  // the swirl winds up before release

// Pairing: targets are ranked by angle around the word (in the word's own
// aspect) and by distance from its centre. The ranks become each dot's ring
// angle and ring radius at the moment it leaves, so a dot leaves from the side
// of the swirl nearest its letter and spirals in without crossing the word.
{
  const AX = (WORD_X1 - WORD_X0) / 2, AY = (WORD_Y1 - WORD_Y0) / 2;
  const n = dots.length;
  for (const d of dots) {
    const nx = (d.tx - LOGO_CX) / AX, ny = (d.ty - LOGO_CY) / AY;
    d.ang = Math.atan2(ny, nx); d.rad = Math.hypot(nx, ny);
  }
  [...dots].sort((a, b) => a.ang - b.ang).forEach((d, k) => { d.angRank = (k + 0.5) / n; });
  [...dots].sort((a, b) => a.rad - b.rad).forEach((d, k) => { d.radRank = (k + 0.5) / n; });
}
const LEAD = 0.75;                                         // rad: leave a little "upstream" of the target
const wrap = (x) => x - 2 * Math.PI * Math.floor((x + Math.PI) / (2 * Math.PI));   // to [-pi, pi)
for (const d of dots) {
  const sx = (d.tx - WORD_X0) / (WORD_X1 - WORD_X0);       // left-to-right sweep
  const sy = (d.ty - WORD_Y0) / (WORD_Y1 - WORD_Y0);
  const outer = rand() < (OUTER_FRAC[d.li] || 0);
  const finale = outer && d.li === letters.length - 1;     // the last e's arc fans wider
  const rr = outer ? (finale ? 0.95 + 0.25 * rand() : 0.98 + 0.14 * rand()) : Math.sqrt(lerp(0.30 * 0.30, 1, clamp01(0.3 * d.radRank + 0.7 * rand())));
  const spin = 0.55 + 0.30 * (1 - Math.min(rr, 1));       // one swirl, counter-clockwise; inner dots faster
  const extra = finale ? FINALE_EXTRA : outer ? OUTER_EXTRA : 0;
  const land0 = T.convStart + T.sweep * (0.94 * sx + 0.06 * (1 - sy)) + 0.25 * rand() + (d.edgeDot ? T.jitter : JITTER_INNER) * rand() - (d.edgeDot ? EDGE_LEAD : 0);
  const convDur = T.flight + 0.25 * rand() + extra;
  const conv0 = land0 - extra;                             // outer dots leave earlier, land on schedule
  const late = d.li >= LATE_FROM;
  const lateX = 0;
  const leave = late
    ? lerp(LATE_ARC[0], LATE_ARC[1], clamp01(0.55 * lateX + 0.45 * rand()))   // b from the top, e from the right end
    : -Math.PI + 2 * Math.PI * d.angRank + LEAD + 0.6 * (rand() - 0.5);
  Object.assign(d, {
    rr, spin, leave, outer, late,
    want: wrap(leave + spin * windup(conv0)),              // ring angle at t = 0 that leaves exactly at `leave`
    wobA: 3 + 4 * rand(), wobF: 0.5 + 0.6 * rand(), wobP: rand() * Math.PI * 2,
    depth: rand(),                                         // in-ring size / opacity variation
    lead: outer || rand() < LEAD_FRAC,
    appear: rand() * T.emergeEnd,
    conv0, convDur,
    bend: 0.22 * (rand() - 0.5),
  });
  d.land = d.conv0 + d.convDur;
  d.inkAt = d.conv0 + U_ARRIVE * d.convDur - INK_EARLY;    // just before it first reaches its target (then settles)
}
// The wanted start angles bunch up (late leavers have turned further), so the
// ring would start lopsided. Re-space them evenly in the same order: the ring
// starts uniform and each dot still leaves from close to its side of the word.
const ringDev = (() => {
  const order = [...dots].sort((a, b) => a.want - b.want);
  const n = order.length, slot = (i) => -Math.PI + 2 * Math.PI * (i + 0.5) / n;
  let best = 0, bestErr = Infinity;                        // rotation of the even spacing that fits best
  for (let k = 0; k < 72; k++) {
    const off = (k / 72 - 0.5) * 2 * Math.PI;
    let err = 0;
    order.forEach((d, i) => { const e = wrap(slot(i) + off - d.want); err += e * e; });
    if (err < bestErr) { bestErr = err; best = off; }
  }
  let maxDev = 0, sumDev = 0;
  order.forEach((d, i) => {
    // even spacing, then gathered into ARMS arms whose phase turns with radius (a monotone remap,
    // so order and departure side are kept; density on an arm is ~3.4x that between arms)
    const th = slot(i) + best;
    d.theta = th - (ARM_K / ARMS) * Math.sin(ARMS * (th - ARM_TWIST * d.rr));
    const dev = Math.abs(wrap(d.theta - d.want)); maxDev = Math.max(maxDev, dev); sumDev += dev;
  });
  return { mean: +(sumDev / n).toFixed(3), max: +maxDev.toFixed(3) };
})();
// Late dots keep their evenly spaced start (so the opening ring stays uniform); each
// one's spin and flight time are nudged, within small ranges, so that it still
// leaves from the upper-right arc. Its landing time does not change.
const lateFit = (() => {
  const arcGap = (a) => { a = wrap(a); return a < LATE_ARC[0] ? LATE_ARC[0] - a : a > LATE_ARC[1] ? a - LATE_ARC[1] : 0; };
  let inArc = 0, n = 0;
  for (const d of dots) {
    if (!d.late) continue;
    n++;
    const want = wrap(d.leave), s0 = d.spin, dur0 = d.convDur;
    let best = null;
    for (let sp = 0.4; sp <= 1.0001; sp += 0.025) {
      for (let du = dur0 - 0.15; du <= dur0 + 0.3501; du += 0.025) {
        const a = d.theta - sp * windup(d.land - du);
        const cost = 10 * arcGap(a) + 0.2 * Math.abs(wrap(a - want)) + Math.abs(sp - s0) + Math.abs(du - dur0);
        if (!best || cost < best.cost) best = { cost, sp, du, gap: arcGap(a) };
      }
    }
    d.spin = best.sp; d.convDur = best.du; d.conv0 = d.land - best.du;
    d.inkAt = d.conv0 + U_ARRIVE * d.convDur - INK_EARLY;
    if (best.gap < 1e-9) inArc++;
  }
  return { late: n, inArc };
})();
// per-dot arrival speed: overshoot capped at SETTLE_MAX for this dot's path length
{
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const pts = dots.map((_, i) => [halton(i + 1, 2), halton(i + 1, 3)]);
  const ang = ([x, y]) => Math.atan2(y - 0.3, (x - 0.5) * 1.6);
  pts.sort((p, q) => ang(p) - ang(q));
  const AX = (WORD_X1 - WORD_X0) / 2, AY = (WORD_Y1 - WORD_Y0) / 2;
  const tAng = (d) => Math.atan2((d.ty - LOGO_CY) / AY * 0.25, (d.tx - LOGO_CX) / AX);
  const order = [...dots].sort((a, b) => tAng(a) - tAng(b));
  order.forEach((d, i) => { [d.ux, d.uy] = pts[i]; });
  for (const d of dots) { d.wobA = 2 + 3 * rand(); d.wobF = 0.8 + 0.8 * rand(); }
}
function computeVArr() { for (const d of dots) {
  const [hx, hy] = fieldPos(d, d.inkAt);
  const len = Math.hypot(d.tx - hx, d.ty - hy);
  d.vArr = V_ARRIVE * Math.min(1, SETTLE_MAX / (OVERSHOOT_PER_V * V_ARRIVE * len + 1e-9));
} }
computeVArr();
for (const L of letters) {
  L.landLast = Math.max(...L.dots.map((d) => d.land));
  // from here the letter is the exact vector glyph: every dot has landed and finished growing
  L.done = Math.max(L.landLast, ...L.dots.map((d) => d.inkAt + FINISH));
}
const BEAT_AT = letters[letters.length - 1].landLast + BEAT_LEAD - BEAT_LEN;   // peak (mid-hump) at the last landing
const LOGO_EXACT = Math.max(BEAT_AT + BEAT_LEN, ...letters.map((L) => L.done));
const HOLD = 1.5;                                          // exact final logo on screen
T.duration = Math.ceil((LOGO_EXACT + HOLD) * 60) / 60;

// Whole-word scale for the closing beat: one smooth hump (sin^2) of BEAT_AMP,
// exactly 1 outside [BEAT_AT, BEAT_AT + BEAT_LEN].
function wordScale(t) {
  const tau = t - BEAT_AT;
  if (tau <= 0 || tau >= BEAT_LEN) return 1;
  const s = Math.sin(Math.PI * tau / BEAT_LEN);
  return 1 + BEAT_AMP * s * s;
}

// Scattered over the whole page, drifting gently.
function fieldPos(d, t) {
  const w = d.wobA * Math.sin(t * d.wobF + d.wobP);
  return [FIELD_CX + (2 * d.ux - 1) * FIELD_RX + w, FIELD_CY + (2 * d.uy - 1) * FIELD_RY + 0.7 * w * Math.cos(d.wobP)];
}

// Position, radius and opacity of a dot in the ring or in flight.
function dotState(d, t) {
  const e = easeOutCubic(clamp01((t - d.appear) / T.emergeDur));
  const u = clamp01((t - d.conv0) / d.convDur);   // (t may be slightly negative for the shutter at t = 0)
  const p = flight(u, d.vArr);
  let x = d.tx, y = d.ty;
  if (u < 1) {
    const tc = d.late && t > d.conv0 ? d.conv0 + (1 - Math.exp(-CARRY_K * (t - d.conv0))) / CARRY_K : t;
    const [hx, hy] = fieldPos(d, tc);
    const vx = d.tx - hx, vy = d.ty - hy;
    const bulge = Math.sin(Math.PI * Math.min(p, 1)) * d.bend;
    x = hx + vx * p - vy * bulge;
    y = hy + vy * p + vx * bulge;
  }
  // in the ring dots are a smaller, softer version of themselves (lead dots are
  // full ink); they reach their final size and full ink exactly as they reach the target
  const k = smoothstep(0.2, U_ARRIVE, u);
  const fieldR = Math.max(0.5, d.r * (d.lead ? 0.95 : 0.55 + 0.3 * d.depth));
  const fieldA = d.lead ? 1 : 0.55 + 0.45 * d.depth;
  const eA = VIS0 + (1 - VIS0) * e, eR = 0.7 + 0.3 * e;
  return { x, y, r: lerp(fieldR, d.r, k) * eR, a: lerp(fieldA, 1, k) * eA, u };
}

// ---------------------------------------------------------------- drawing
const ctx = canvas.getContext('2d');
const HAS_FILTER = false;
const layer = document.createElement('canvas');          // per-letter ink layer
const lctx = layer.getContext('2d');
const band = document.createElement('canvas');           // grown dots, kept to the band along the outline
const bctx = band.getContext('2d');
const mask = document.createElement('canvas');           // in-flight opacity mask (grey = opacity)
const mctx = mask.getContext('2d');
const accum = document.createElement('canvas');          // first pass: "over" accumulation
const actx = accum.getContext('2d');
const SHUTTER = 1 / 120;                                  // 180-degree shutter at 60 fps

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

let lastT = 0, showLoose = true;                          // review hook: window.__showLoose(false) hides dots in flight
function render(t) {
  lastT = t;
  resize();
  t = Math.max(0, Math.min(T.duration, t));
  const W = canvas.width, H = canvas.height;
  const dpr = W / Math.max(1, canvas.clientWidth), box = getTarget();
  const k = dpr * box.w / (WORD_X1 - WORD_X0), ws = wordScale(t);
  const cx = dpr * (box.x + box.w / 2), cy = dpr * box.cy;
  const a = k * ws, e = cx - a * LOGO_CX, f = cy - a * LOGO_CY;
  const fx = (W / 2 - cx) / k + LOGO_CX, fy = (H / 2 - cy) / k + LOGO_CY, rx = 0.5 * W / k, ry = 0.5 * H / k;
  if (Math.abs(fx - FIELD_CX) + Math.abs(fy - FIELD_CY) + Math.abs(rx - FIELD_RX) + Math.abs(ry - FIELD_RY) > 0.5) {
    FIELD_CX = fx; FIELD_CY = fy; FIELD_RX = rx; FIELD_RY = ry; computeVArr();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);

  ctx.setTransform(a, 0, 0, a, e, f);
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (const L of letters) {
    if (t >= L.done) { ctx.globalAlpha = 1; ctx.fill(L.path); }
    else drawInk(L, t, a, e, f);
  }
  if (t < LOGO_EXACT && showLoose) drawLoose(t, a, e, f, W, H);

  ctx.globalAlpha = 1;
}

// Dots still in the ring or in flight. A moving dot is drawn as a capsule
// spanning a 180-degree shutter (motion blur; lead dots use a longer one in the
// ring, every dot a shorter one near its target), its opacity spread over the
// streak (never below STREAK_MIN_A) so a fast dot does not get heavier.
// Opacity goes into a grey mask: pass 1 accumulates "over" (n dots of opacity a
// give 1-(1-a)^n, so stacks darken progressively and keep their texture), the
// soft-cap filter limits the total to ~0.8, and pass 2 "lightens" each dot back
// in so a single opaque dot is never lightened. #ink-from-mask stamps it as ink.
const ops = [];
// x reached by the written word at time t (the sweep's landing front), design px
const writtenTo = (t) => WORD_X0 + (WORD_X1 - WORD_X0) * (t - T.convStart - T.flight) / (0.94 * T.sweep);
function drawLoose(t, a, e, f, W, H) {
  ops.length = 0;
  const front = writtenTo(t) - 8;
  const written = letters.filter((L) => t >= L.done);
  for (const d of dots) {
    if (t >= d.land) continue;
    const s = dotState(d, t);
    if (s.a <= 0.002 || s.r <= 0.01) continue;
    let shutter = d.lead ? lerp(LEAD_SHUTTER, SHUTTER, smoothstep(0, 0.3, s.u)) : SHUTTER;
    shutter *= lerp(NEAR_SHUTTER, 1, smoothstep(NEAR_PX / 3, NEAR_PX, Math.hypot(s.x - d.tx, s.y - d.ty)));
    const q = dotState(d, t - shutter);
    const len = Math.hypot(s.x - q.x, s.y - q.y);
    let alpha = s.a;
    if (len > 0.25) alpha *= Math.max(d.lead && s.u <= 0 ? 0.6 : STREAK_MIN_A, (2 * s.r) / (2 * s.r + len));
    if (s.u > 0) {
      let out = Infinity;                                   // signed distance to written ink regions, > 0 outside
      if (d.tx > front + 4) out = Math.max(s.x - front, WORD_X0 - s.x, WORD_Y0 - 4 - s.y, s.y - WORD_Y1 - 4);
      for (const L of written) out = Math.min(out, Math.max(L.x0 - 4 - s.x, s.x - L.x1 - 4, L.y0 - 4 - s.y, s.y - L.y1 - 4));
      if (out < 0) alpha *= lerp(PASS_BEHIND, 1, smoothstep(-2 * PASS_SOFT, 0, out));   // full strength from the edge out
    }
    if (alpha < 1 / 255) continue;
    ops.push(s.x, s.y, q.x, q.y, s.r, alpha, len > 0.25 ? 1 : 0);
  }
  const shapes = (c, styled) => {
    for (let i = 0; i < ops.length; i += 7) {
      const [x, y, qx, qy, r, alpha, streak] = ops.slice(i, i + 7);
      styled(alpha);
      c.beginPath();
      if (streak) { c.lineWidth = 2 * r; c.moveTo(qx, qy); c.lineTo(x, y); c.stroke(); }
      else { c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    }
  };
  if (!ops.length) return;
  if (!HAS_FILTER) {
    ctx.save(); ctx.lineCap = 'round';
    shapes(ctx, (alpha) => { ctx.globalAlpha = alpha * 0.85; });
    ctx.restore();
    return;
  }
  for (const cv of [mask, accum]) if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }

  // pass 1: white "over" black at each dot's opacity
  actx.setTransform(1, 0, 0, 1, 0, 0); actx.globalAlpha = 1; actx.globalCompositeOperation = 'source-over';
  actx.fillStyle = '#000'; actx.fillRect(0, 0, W, H);
  actx.setTransform(a, 0, 0, a, e, f); actx.lineCap = 'round';
  actx.fillStyle = '#fff'; actx.strokeStyle = '#fff';
  shapes(actx, (alpha) => { actx.globalAlpha = alpha; });
  actx.globalAlpha = 1;
  // soft cap into the mask, then pass 2: each dot "lightened" back in at its own opacity
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.globalCompositeOperation = 'source-over';
  mctx.filter = 'url(#soft-cap)'; mctx.drawImage(accum, 0, 0); mctx.filter = 'none';
  mctx.globalCompositeOperation = 'lighten';
  mctx.setTransform(a, 0, 0, a, e, f); mctx.lineCap = 'round';
  shapes(mctx, (alpha) => { const g = Math.round(255 * alpha); mctx.fillStyle = mctx.strokeStyle = `rgb(${g},${g},${g})`; });
  mctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'url(#ink-from-mask)';
  ctx.drawImage(mask, 0, 0);
  ctx.restore();
}

// Landed ink of one letter: the union of its arrived dots (from the moment each
// first reaches its target, while it is still settling), each grown by up to
// FINISH_GROW over the FINISH seconds after that (within FINISH_BAND of the
// outline only), intersected with the
// letter's outline. Every dot is inscribed, so at landing the union is just the
// dots; the growth only closes the hairline gaps between neighbours and fills
// the corners, and because it is cut by the outline it can only ever reveal the
// exact vector letter, locally, right where dots have already arrived.
// Composed on an offscreen layer aligned to whole device pixels, then stamped.
function drawInk(L, t, a, e, f) {
  const plain = new Path2D(), grown = new Path2D();
  let n = 0, ng = 0;
  for (const d of L.dots) {
    if (t < d.inkAt) continue;
    const k = smoothstep(d.inkAt, d.inkAt + FINISH, t);
    const rp = d.r + LAND_GROW + INNER_GROW * k;
    const rg = d.r + LAND_GROW + (FINISH_GROW - LAND_GROW) * k;
    plain.moveTo(d.tx + rp, d.ty); plain.arc(d.tx, d.ty, rp, 0, Math.PI * 2); n++;
    if (rg > rp + 0.01) { grown.moveTo(d.tx + rg, d.ty); grown.arc(d.tx, d.ty, rg, 0, Math.PI * 2); ng++; }
  }
  if (!n) return;
  const m = 2;
  const bx = Math.floor(a * (L.x0 - m) + e), by = Math.floor(a * (L.y0 - m) + f);
  const bw = Math.ceil(a * (L.x1 + m) + e) - bx, bh = Math.ceil(a * (L.y1 + m) + f) - by;
  for (const cv of [layer, band]) if (cv.width < bw || cv.height < bh) { cv.width = Math.max(cv.width, bw); cv.height = Math.max(cv.height, bh); }
  const prep = (c) => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, bw, bh);
    c.setTransform(a, 0, 0, a, e - bx, f - by);
    c.fillStyle = INK; c.strokeStyle = INK;
  };
  prep(lctx);
  lctx.fill(plain);
  if (ng) {
    // the growth closes gaps and corners along the outline only; inside, the
    // frontier of a filling stroke stays the plain dots
    prep(bctx);
    bctx.fill(grown);
    bctx.globalCompositeOperation = 'destination-in';
    bctx.lineWidth = 2 * FINISH_BAND; bctx.lineJoin = 'round';
    bctx.stroke(L.path);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.drawImage(band, 0, 0, bw, bh, 0, 0, bw, bh);
    lctx.setTransform(a, 0, 0, a, e - bx, f - by);
  }
  lctx.globalCompositeOperation = 'destination-in';
  lctx.fill(L.path);
  lctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(layer, 0, 0, bw, bh, bx, by, bw, bh);
  ctx.restore();
}

// ---------------------------------------------------------------- playback
let t0 = null, raf = 0;
function frame(now) {
  if (t0 === null) t0 = now;
  const tt = (now - t0) / 1000;
  render(tt);
  raf = tt < T.duration ? requestAnimationFrame(frame) : 0;
}
const playing = () => raf !== 0;
function play() { if (raf) return; t0 = null; raf = requestAnimationFrame(frame); }
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce) render(T.duration); else play();
const onResize = () => { if (!raf) render(lastT); };
window.addEventListener('resize', onResize);
return {
  replay: () => { if (!reduce && !playing()) play(); },
  redraw: onResize,
  destroy: () => { cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', onResize); },
};
}
