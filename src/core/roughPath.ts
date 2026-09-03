import { diamondVertices } from "./utils";
import type { Element, Point } from "./types";

/**
 * Hand-drawn ("sketch") stroke geometry shared by the canvas renderer and the
 * SVG exporter. The renderer replays the emitted segments onto a 2D context;
 * the exporter serializes the same segments to an SVG path `d`. Keeping the
 * pure geometry here guarantees the downloaded/saved SVG matches the canvas
 * sketch style (Bug: saved SVG came back with clean, non-sketch lines).
 */

/** deterministic pseudo-random in [-1, 1] from integer seed */
export function jitter(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const seedCache = new Map<string, number>();

/** stable seed from element id: sketch outlines must NOT shift while dragging */
export function seedOf(id: string): number {
  let s = seedCache.get(id);
  if (s === undefined) {
    s = 0;
    for (let i = 0; i < id.length; i++)
      s = (s * 31 + id.charCodeAt(i)) % 100000;
    seedCache.set(id, s);
  }
  return s;
}

/** dot product below this marks a sharp corner where the pen "lifts" */
const BREAK_COS = Math.cos((35 * Math.PI) / 180);

/** dot product above this marks two segments as the same straight run */
const COLIN_COS = Math.cos((1.5 * Math.PI) / 180);

/** a `moveTo` + sequence of `lineTo`/`quadraticCurveTo` (canvas-agnostic) */
export interface RoughSegment {
  moveTo: Point;
  curves: { kind: "line" | "quad"; ctrl?: Point; to: Point }[];
}

function pushLine(seg: RoughSegment, to: Point) {
  seg.curves.push({ kind: "line", to });
}

function pushQuad(seg: RoughSegment, ctrl: Point, to: Point) {
  seg.curves.push({ kind: "quad", ctrl, to });
}

/** 2D affine transform for a per-pass rigid misregistration */
interface Misregister {
  dx: number;
  dy: number;
  cos: number;
  sin: number;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
}

function applyMis(px: number, py: number, t: Misregister): Point {
  const x = px - t.cx;
  const y = py - t.cy;
  const rx = x * t.sx;
  const ry = y * t.sy;
  return {
    x: t.cx + rx * t.cos - ry * t.sin + t.dx,
    y: t.cy + rx * t.sin + ry * t.cos + t.dy,
  };
}

/**
 * inverse misregistration: a point that must land EXACTLY at its geometry
 * position after the per-pass transform. clamped endpoints (arrow shaft tip,
 * arrowhead tip) draw through this so the sketch never runs past the shape
 * even when the pass offsets/rotates the whole stroke.
 */
function unApply(px: number, py: number, t: Misregister): Point {
  const x = px - t.cx - t.dx;
  const y = py - t.cy - t.dy;
  const rx = (x * t.cos + y * t.sin) / t.sx;
  const ry = (-x * t.sin + y * t.cos) / t.sy;
  return { x: t.cx + rx, y: t.cy + ry };
}

/**
 * one hand-drawn pass over a polyline. exact port of the renderer's
 * `roughPolyline`, but emitting segments instead of painting the canvas.
 * the exact geometry is traced (arcs stay perfect curves); looseness comes
 * from a per-pass rigid misregistration, a gentle one-shot bow on straight
 * runs ending at sharp corners or loose tips, and pen-lifts at corners.
 * `roughness` scales the sloppiness (0 = perfectly straight).
 */
function roughSegments(
  points: Point[],
  roughness: number,
  seed: number,
  waveScale = 1,
  clampStart = false,
  clampEnd = false,
): RoughSegment[] {
  if (points.length < 2) return [];
  let s = seed;
  const jit = (max: number) => jitter(++s) * max;
  const o = roughness * 1.5;
  const slip = Math.max(o * 1.4, 1);
  const last = points.length - 1;

  // cumulative arc length along the polyline
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++)
    cum.push(
      cum[i - 1] +
        Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y),
    );
  const total = cum[last];
  if (total <= 0) return [];

  // unit direction of each segment (zero-length falls back to previous)
  const dir: Point[] = [];
  for (let i = 0; i < last; i++) {
    const l = cum[i + 1] - cum[i];
    dir.push(
      l > 0
        ? { x: (points[i + 1].x - points[i].x) / l, y: (points[i + 1].y - points[i].y) / l }
        : dir.length
          ? dir[dir.length - 1]
          : { x: 1, y: 0 },
    );
  }

  // sharp interior corners get pen-lifts; gentle bends (arc samplings) never
  const sharp = new Array<boolean>(points.length).fill(false);
  for (let v = 1; v < last; v++) {
    if (
      dir[v - 1].x * dir[v].x + dir[v - 1].y * dir[v].y < BREAK_COS &&
      cum[v] - cum[v - 1] >= 6 &&
      cum[v + 1] - cum[v] >= 6
    )
      sharp[v] = true;
  }
  // two joined segments colinear enough to be one straight run
  const colin = (v: number) =>
    dir[v - 1].x * dir[v].x + dir[v - 1].y * dir[v].y > COLIN_COS;

  const closedLoop =
    points.length > 3 &&
    points[0].x === points[last].x &&
    points[0].y === points[last].y;

  // soft pen-lifts: continuous outlines (arcs / rounded corners) also split
  // into a few disconnected strokes with salient tips, like a hand lifting
  // the pen mid-outline
  const lift = sharp.slice();
  {
    let acc = 0;
    let next = 90 + jit(70);
    for (let v = 2; v < last - 1; v++) {
      acc += cum[v] - cum[v - 1];
      if (acc < next) continue;
      if (
        sharp[v] ||
        colin(v) ||
        cum[v] - cum[v - 1] < 6 ||
        cum[v + 1] - cum[v] < 6
      )
        continue;
      if (closedLoop && (v <= 2 || v >= last - 2)) continue;
      lift[v] = true;
      acc = 0;
      next = 90 + jit(70);
    }
  }

  // per-pass rigid misregistration: offset + rotation + slight non-uniform
  // scale, so each pass reads as a separate hand trace of the same shape
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = minX;
  let maxY = minY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const dx = jit(roughness * 0.9);
  const dy = jit(roughness * 0.9);
  const rot = (jit(roughness * 0.5) * Math.PI) / 180;
  const t: Misregister = {
    dx,
    dy,
    cos: Math.cos(rot),
    sin: Math.sin(rot),
    sx: 1 + jit(roughness * 0.005),
    sy: 1 + jit(roughness * 0.005),
    cx,
    cy,
  };

  // loose tip: slip along the direction + a little perpendicular scatter
  const tipPt = (px: number, py: number, ux: number, uy: number): Point => {
    const g = jit(slip);
    const sc = jit(o * 0.5);
    return { x: px + ux * g - uy * sc, y: py + uy * g + ux * sc };
  };

  // ---- body wave -------------------------------------------------------
  const perp = (u: Point): Point => ({ x: -u.y, y: u.x });
  const N: Point[] = [];
  for (let j = 0; j <= last; j++) {
    if (j === 0) N.push(perp(dir[0]));
    else if (j === last) N.push(perp(dir[last - 1]));
    else {
      const bx = -dir[j - 1].y - dir[j].y;
      const by = dir[j - 1].x + dir[j].x;
      const bl = Math.hypot(bx, by);
      N.push(bl > 0.05 ? { x: bx / bl, y: by / bl } : perp(dir[j]));
    }
  }
  // wave must vanish at pen-lifts and open tips (break positions)
  const breaks: number[] = [];
  if (!closedLoop) breaks.push(0, total);
  for (let v = 1; v < last; v++) if (sharp[v]) breaks.push(cum[v]);
  const envAt = (s: number): number => {
    let d = Infinity;
    for (const b of breaks) {
      const dd = Math.abs(s - b);
      if (dd < d) d = dd;
    }
    if (d === Infinity) return 1;
    const t = Math.min(1, d / 22);
    return t * t * (3 - 2 * t);
  };
  const lam = 90 + jit(40);
  const cycles = Math.max(1, Math.round(total / lam));
  const wamp = waveScale * roughness * (0.9 + 0.5 * jit(1));
  const phase = jit(6.283);
  const waveAt = (s: number): number =>
    wamp * envAt(s) * Math.sin((2 * Math.PI * cycles * s) / total + phase);
  // wave-displaced vertices (used by continuous stretches)
  const D: Point[] = [];
  for (let j = 0; j <= last; j++) {
    const w = waveAt(cum[j]);
    D.push({ x: points[j].x + N[j].x * w, y: points[j].y + N[j].y * w });
  }

  // walk maximal runs: colinear stretch (bounded by sharp corners / tips /
  // bends). straight stretches that END loose get a one-shot bow; continuous
  // stretches trace the wave-displaced geometry, subdivided so the wave shows
  // on long straight runs too
  const segs: RoughSegment[] = [];
  let seg: RoughSegment | null = null;
  let i = 1;
  while (i <= last) {
    let e = i;
    while (e < last && !lift[e] && colin(e)) e++;

    const tipStart = i === 1 && !closedLoop;
    const tipEnd = e === last && !closedLoop;
    const liftStart = i > 1 && lift[i - 1];
    const liftEnd = e < last && lift[e];

    let sx: number;
    let sy: number;
    if (tipStart) {
      const p = clampStart
        ? { x: points[i - 1].x, y: points[i - 1].y }
        : tipPt(points[i - 1].x, points[i - 1].y, dir[i - 1].x, dir[i - 1].y);
      sx = p.x;
      sy = p.y;
    } else if (liftStart) {
      const g = jit(slip);
      sx = D[i - 1].x + dir[i - 1].x * g;
      sy = D[i - 1].y + dir[i - 1].y * g;
    } else {
      sx = D[i - 1].x;
      sy = D[i - 1].y;
    }
    // the pen lifts (new subpath) at the first run and at pen-lifts; every
    // other run simply continues the current subpath with lineTo/quad
    if (i === 1 || liftStart) {
      const start = tipStart && clampStart
        ? unApply(points[i - 1].x, points[i - 1].y, t)
        : applyMis(sx, sy, t);
      seg = { moveTo: start, curves: [] };
      segs.push(seg);
    }
    // first run always starts a new segment, so `seg` is non-null here
    const cur = seg!;

    let ex: number;
    let ey: number;
    if (liftEnd) {
      const g = jit(slip);
      ex = D[e].x - dir[e - 1].x * g;
      ey = D[e].y - dir[e - 1].y * g;
    } else if (tipEnd) {
      const p = clampEnd
        ? { x: points[e].x, y: points[e].y }
        : tipPt(points[e].x, points[e].y, dir[e - 1].x, dir[e - 1].y);
      ex = p.x;
      ey = p.y;
    } else {
      ex = D[e].x;
      ey = D[e].y;
    }

    // one-shot bow only on straight runs bounded by sharp corners / tips
    // (soft lifts keep the wave trace, so arcs stay arcs)
    if (
      tipStart ||
      tipEnd ||
      (liftStart && sharp[i - 1]) ||
      (liftEnd && sharp[e])
    ) {
      const len = cum[e] - cum[i - 1] || 1;
      const ux = (points[e].x - points[i - 1].x) / len;
      const uy = (points[e].y - points[i - 1].y) / len;
      const bow = jit(roughness * 1.6) * Math.min(1, len / 60);
      const end = tipEnd && clampEnd
        ? unApply(points[e].x, points[e].y, t)
        : applyMis(ex, ey, t);
      pushQuad(
        cur,
        applyMis(
          (points[i - 1].x + points[e].x) / 2 - uy * bow,
          (points[i - 1].y + points[e].y) / 2 + ux * bow,
          t,
        ),
        end,
      );
    } else {
      // continuous stretch (straight run or arc chord): subdivide finely so
      // the wave renders smoothly
      const sA = cum[i - 1];
      const sB = cum[e];
      const steps = Math.max(1, Math.ceil((sB - sA) / 8));
      for (let k = 1; k <= steps; k++) {
        const tt = k / steps;
        const s = sA + (sB - sA) * tt;
        const bx = points[i - 1].x + (points[e].x - points[i - 1].x) * tt;
        const by = points[i - 1].y + (points[e].y - points[i - 1].y) * tt;
        let nx = N[i - 1].x + (N[e].x - N[i - 1].x) * tt;
        let ny = N[i - 1].y + (N[e].y - N[i - 1].y) * tt;
        const nl = Math.hypot(nx, ny);
        if (nl > 0) {
          nx /= nl;
          ny /= nl;
        }
        const w = waveAt(s);
        pushLine(cur, applyMis(bx + nx * w, by + ny * w, t));
      }
    }
    i = e + 1;
  }
  return segs;
}

/**
 * segments for hand-drawn polylines: a single straight pass when clean,
 * independent offset passes otherwise (sloppy sketch look).
 */
export function sketchStrokeSegments(
  polylines: Point[][],
  roughness: number,
  seedBase: number,
  waveScale = 1,
  clampStart = false,
  clampEnd = false,
): RoughSegment[] {
  if (roughness === 0) {
    const segs: RoughSegment[] = [];
    for (const pts of polylines) {
      if (pts.length === 0) continue;
      const seg: RoughSegment = { moveTo: { ...pts[0] }, curves: [] };
      for (let i = 1; i < pts.length; i++) pushLine(seg, pts[i]);
      segs.push(seg);
    }
    return segs;
  }
  const passes = roughness === 3 ? 3 : 2;
  const segs: RoughSegment[] = [];
  for (let p = 0; p < passes; p++) {
    for (const pts of polylines) {
      segs.push(
        ...roughSegments(
          pts,
          roughness,
          seedBase + p * 131 + pts.length,
          waveScale,
          clampStart,
          clampEnd,
        ),
      );
    }
  }
  return segs;
}

function fmt(n: number): string {
  const v = n.toFixed(2);
  return v === "-0.00" || v === "-0" ? "0" : v;
}

/** SVG path `d` string for the sketch strokes (multi-pass, multi-subpath) */
export function sketchPathD(
  polylines: Point[][],
  roughness: number,
  seedBase: number,
  waveScale = 1,
  clampStart = false,
  clampEnd = false,
): string {
  const segs = sketchStrokeSegments(
    polylines,
    roughness,
    seedBase,
    waveScale,
    clampStart,
    clampEnd,
  );
  let d = "";
  for (const seg of segs) {
    d += `M ${fmt(seg.moveTo.x)} ${fmt(seg.moveTo.y)}`;
    for (const c of seg.curves) {
      if (c.kind === "quad" && c.ctrl) {
        d += ` Q ${fmt(c.ctrl.x)} ${fmt(c.ctrl.y)} ${fmt(c.to.x)} ${fmt(c.to.y)}`;
      } else {
        d += ` L ${fmt(c.to.x)} ${fmt(c.to.y)}`;
      }
    }
  }
  return d;
}

// ---- closed perimeter loops sampled as polylines (for sketch tracing) ----

/** closed perimeter of a rounded rectangle (first point == last point) */
export function roundedRectLoop(
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
): Point[] {
  const x1 = Math.min(x, x + width);
  const y1 = Math.min(y, y + height);
  const x2 = x1 + Math.abs(width);
  const y2 = y1 + Math.abs(height);
  if (r <= 0) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
      { x: x1, y: y1 },
    ];
  }
  const pts: Point[] = [];
  const seg = 12;
  const arcs: [number, number, number][] = [
    [x2 - r, y1 + r, -Math.PI / 2],
    [x2 - r, y2 - r, 0],
    [x1 + r, y2 - r, Math.PI / 2],
    [x1 + r, y1 + r, Math.PI],
  ];
  for (const [cx, cy, start] of arcs) {
    for (let i = 0; i <= seg; i++) {
      const a = start + (i / seg) * (Math.PI / 2);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  pts.push(pts[0]);
  return pts;
}

/** closed perimeter of a diamond (first point == last point) */
export function diamondLoop(el: Element): Point[] {
  const v = diamondVertices(el);
  return [...v, v[0]];
}

/** ellipse perimeter sampled as a closed polyline loop (first == last) */
export function ellipseLoop(
  x: number,
  y: number,
  width: number,
  height: number,
): Point[] {
  const rx = Math.abs(width) / 2;
  const ry = Math.abs(height) / 2;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const seg = 48;
  const pts: Point[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  pts.push(pts[0]);
  return pts;
}

/** `d` of the exact closed loop (clean fill / hachure clip under the sketch) */
export function closedLoopD(
  loop: Point[],
  closed = false,
): string {
  let d = "";
  loop.forEach((p, i) => {
    d += `${i === 0 ? "M" : "L"} ${fmt(p.x)} ${fmt(p.y)}`;
  });
  return closed && loop.length > 0 ? `${d} Z` : d;
}