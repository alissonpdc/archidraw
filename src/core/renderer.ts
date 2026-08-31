import type { ArrowBinding, Bounds, Camera, ComponentElement, Document, Element, Point } from "./types";
import {
  arrowPoints,
  bindingPoint,
  curvedArrowControl,
  diamondVertices,
  edgeLabelAnchor,
  elementBounds,
  measureText,
} from "./utils";
import { getLibraryItem } from "./library";
import { getComponentImage } from "./componentAssets";
import { resolveFont, resolveTextColor, lineHeight } from "./textStyle";

export interface RenderColors {
  selection: string;
  gridDot: string;
  gridLine: string;
  /** theme-appropriate stroke for elements using the default color */
  elementStroke: string;
  /** canvas background color (plates behind edge labels must match it) */
  canvasBg: string;
}

export interface RenderState {
  doc: Document;
  camera: Camera;
  selectedIds: ReadonlySet<string>;
  /** in-progress creation draft (scene coords, already normalized) */
  draft: Element | null;
  marquee: { x1: number; y1: number; x2: number; y2: number } | null;
  colors?: RenderColors;
  gridMode?: "none" | "dots" | "lines";
  guides?: { orientation: "h" | "v"; pos: number }[] | null;
  /** live anchor highlights while drawing/dragging an edge endpoint */
  bindingPreview?: { start: ArrowBinding | null; end: ArrowBinding | null } | null;
  /** element whose label is being edited (suppresses selection box/handles) */
  hiddenLabelId?: string | null;
  /** free text element being edited (suppresses resize handles) */
  hiddenTextId?: string | null;
}

/** default stroke colors that adapt to the active theme at render time */
const AUTO_STROKES = new Set(["#1e1e1e", "#e8e8e8"]);

const DEFAULT_COLORS: RenderColors = {
  selection: "#6965db",
  elementStroke: "#1e1e1e",
  gridDot: "rgba(0,0,0,0.14)",
  gridLine: "rgba(0,0,0,0.07)",
  canvasBg: "#ffffff",
};

function visibleSceneRect(cam: Camera, w: number, h: number) {
  const vx1 = -cam.scrollX / cam.zoom;
  const vy1 = -cam.scrollY / cam.zoom;
  return { vx1, vy1, vx2: vx1 + w / cam.zoom, vy2: vy1 + h / cam.zoom };
}

function gridStep(cam: Camera): number {
  let step = 20;
  while (step * cam.zoom < 14) step *= 2;
  while (step * cam.zoom > 56) step /= 2;
  return step;
}

function drawGridDots(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  color: string,
) {
  const { vx1, vy1, vx2, vy2 } = visibleSceneRect(cam, w, h);
  const step = gridStep(cam);
  const r = Math.max(1, 1.3 / cam.zoom);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let x = Math.floor(vx1 / step) * step; x <= vx2; x += step) {
    for (let y = Math.floor(vy1 / step) * step; y <= vy2; y += step) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  color: string,
) {
  const { vx1, vy1, vx2, vy2 } = visibleSceneRect(cam, w, h);
  const step = gridStep(cam);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1 / cam.zoom, 0.5);
  ctx.beginPath();
  for (let x = Math.floor(vx1 / step) * step; x <= vx2; x += step) {
    ctx.moveTo(x, vy1);
    ctx.lineTo(x, vy2);
  }
  for (let y = Math.floor(vy1 / step) * step; y <= vy2; y += step) {
    ctx.moveTo(vx1, y);
    ctx.lineTo(vx2, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  tail: Point,
  size: number,
) {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(
    tip.x - size * Math.cos(angle - Math.PI / 6),
    tip.y - size * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(
    tip.x - size * Math.cos(angle + Math.PI / 6),
    tip.y - size * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

/** resolves the element stroke, adapting default colors to the theme */
function resolveStroke(el: Element, colors: RenderColors): string {
  return AUTO_STROKES.has(el.strokeColor) ? colors.elementStroke : el.strokeColor;
}

/** deterministic pseudo-random in [-1, 1] from integer seed */
function jitter(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/** dot product below this marks a sharp corner where the pen "lifts" */
const BREAK_COS = Math.cos((35 * Math.PI) / 180);

/** dot product above this marks two segments as the same straight run */
const COLIN_COS = Math.cos((1.5 * Math.PI) / 180);

/**
 * one hand-drawn pass over a polyline. the exact geometry is traced (arcs
 * stay perfect curves — no wave, so no sawtooth or overshoot artifacts);
 * looseness comes from:
 *  - a per-pass rigid misregistration (offset + slight rotation), like a
 *    second pencil pass over the same shape;
 *  - a gentle one-shot bow on straight runs that end at sharp corners or
 *    loose tips;
 *  - pen-lifts (gaps / overshoots) at sharp corners, open tips, and a few
 *    soft spots along continuous outlines (arcs split into loose strokes
 *    with salient crossing tips).
 * `roughness` scales the sloppiness (0 = perfectly straight).
 */
function roughPolyline(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  roughness: number,
  seed: number,
  waveScale = 1,
) {
  if (points.length < 2) return;
  let s = seed;
  const jit = (max: number) => jitter(++s) * max;
  const o = roughness * 1.5;
  const slip = Math.max(o * 1.4, 1);
  const last = points.length - 1;

  // cumulative arc length along the polyline
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++)
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = cum[last];

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
  // the pen mid-outline. placed only at bend points (never inside straight
  // runs) and spaced along the arclength.
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
  ctx.save();
  ctx.translate(cx + jit(roughness * 0.9), cy + jit(roughness * 0.9));
  ctx.rotate((jit(roughness * 0.5) * Math.PI) / 180);
  ctx.scale(1 + jit(roughness * 0.005), 1 + jit(roughness * 0.005));
  ctx.translate(-cx, -cy);

  // loose tip: slip along the direction + a little perpendicular scatter
  const tipPt = (px: number, py: number, ux: number, uy: number): Point => {
    const g = jit(slip);
    const sc = jit(o * 0.5);
    return { x: px + ux * g - uy * sc, y: py + uy * g + ux * sc };
  };

  // ---- body wave -------------------------------------------------------
  // a smooth sinusoid of arclength, applied along the (smoothly rotating)
  // bisector normal and tapered to zero at pen-lifts and open tips. being an
  // analytic C1 function of s, it CANNOT produce sawtooth or kinks — but it
  // gives arcs and continuous outlines organic hand-drawn wander.
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
  // integer wave count: periodic on closed loops (seam matches exactly);
  // low frequency: several samples per period so chords can't alias
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
  // stretches trace the wave-displaced geometry, subdivided so the wave
  // shows on long straight runs too.
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
      const p = tipPt(points[i - 1].x, points[i - 1].y, dir[i - 1].x, dir[i - 1].y);
      sx = p.x;
      sy = p.y;
    } else if (liftStart) {
      // salient tip: slip past the break (signed jitter → crossing strokes)
      const g = jit(slip);
      sx = D[i - 1].x + dir[i - 1].x * g;
      sy = D[i - 1].y + dir[i - 1].y * g;
    } else {
      sx = D[i - 1].x;
      sy = D[i - 1].y;
    }
    if (i === 1 || liftStart) ctx.moveTo(sx, sy);

    let ex: number;
    let ey: number;
    if (liftEnd) {
      const g = jit(slip);
      ex = D[e].x - dir[e - 1].x * g;
      ey = D[e].y - dir[e - 1].y * g;
    } else if (tipEnd) {
      const p = tipPt(points[e].x, points[e].y, dir[e - 1].x, dir[e - 1].y);
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
      // one-shot gentle bow on the straight run
      const len = cum[e] - cum[i - 1] || 1;
      const ux = (points[e].x - points[i - 1].x) / len;
      const uy = (points[e].y - points[i - 1].y) / len;
      const bow = jit(roughness * 1.6) * Math.min(1, len / 60);
      ctx.quadraticCurveTo(
        (points[i - 1].x + points[e].x) / 2 - uy * bow,
        (points[i - 1].y + points[e].y) / 2 + ux * bow,
        ex,
        ey,
      );
    } else {
      // continuous stretch (straight run or arc chord): subdivide finely so
      // the wave renders smoothly — drawing it only at sample vertices would
      // alias into zig-zag on wide-spaced arc chords
      const sA = cum[i - 1];
      const sB = cum[e];
      const steps = Math.max(1, Math.ceil((sB - sA) / 8));
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const s = sA + (sB - sA) * t;
        const bx = points[i - 1].x + (points[e].x - points[i - 1].x) * t;
        const by = points[i - 1].y + (points[e].y - points[i - 1].y) * t;
        let nx = N[i - 1].x + (N[e].x - N[i - 1].x) * t;
        let ny = N[i - 1].y + (N[e].y - N[i - 1].y) * t;
        const nl = Math.hypot(nx, ny);
        if (nl > 0) {
          nx /= nl;
          ny /= nl;
        }
        const w = waveAt(s);
        ctx.lineTo(bx + nx * w, by + ny * w);
      }
    }
    i = e + 1;
  }
  ctx.restore();
}

/**
 * strokes hand-drawn polylines: a single straight pass when clean,
 * independent offset passes otherwise (sloppy sketch look).
 * endpoints don't meet exactly at corners — that's the point.
 */
function sketchStroke(
  ctx: CanvasRenderingContext2D,
  polylines: Point[][],
  roughness: number,
  seedBase: number,
  waveScale = 1,
) {
  const passes = roughness === 0 ? 1 : roughness === 3 ? 3 : 2;
  for (let p = 0; p < passes; p++) {
    for (const pts of polylines) {
      if (roughness === 0) {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++)
          ctx.lineTo(pts[i].x, pts[i].y);
      } else {
        roughPolyline(
          ctx,
          pts,
          roughness,
          seedBase + p * 131 + pts.length,
          waveScale,
        );
      }
    }
  }
}

const seedCache = new Map<string, number>();

/** stable seed from element id: sketch outlines must NOT shift while dragging */
function seedOf(id: string): number {
  let s = seedCache.get(id);
  if (s === undefined) {
    s = 0;
    for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) % 100000;
    seedCache.set(id, s);
  }
  return s;
}

/** corner radius in scene px for a rectangle/component (0–100% of the smaller side) */
function cornerRadius(el: Element): number {
  if ((el.type !== "rectangle" && el.type !== "component") || el.borderRadius <= 0)
    return 0;
  const max = Math.min(Math.abs(el.width), Math.abs(el.height)) / 2;
  return (Math.min(100, el.borderRadius) / 100) * max;
}

// ---- library icon rendering (Path2D cache) ------------------------------

const iconPathCache = new Map<string, Path2D[]>();

function iconPaths(componentId: string): Path2D[] {
  let paths = iconPathCache.get(componentId);
  if (!paths) {
    const item = getLibraryItem(componentId);
    paths = (item?.icon ?? []).map((d) => new Path2D(d));
    iconPathCache.set(componentId, paths);
  }
  return paths;
}

// ---- image cache (HTMLImageElement from data URLs) ----------------------
const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(src: string): HTMLImageElement | null {
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    if (!img.complete) return null;
    imageCache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/**
 * closed perimeter of a rounded rectangle as a sampled polyline loop
 * (first point == last point), so hand-drawn strokes follow the corners.
 */
function roundedRectLoop(
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
  // fixed arc sampling (7.5° facets): exact-traced curves stay visually
  // perfect while keeping the polyline representation simple
  const seg = 12;
  // [centerX, centerY, startAngle] per corner, clockwise from top-left arc
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

/** closed perimeter of a diamond as a polyline loop (first point == last) */
function diamondLoop(el: Element): Point[] {
  const v = diamondVertices(el);
  return [...v, v[0]];
}

/**
 * ellipse perimeter sampled as a closed polyline loop (first point == last),
 * with fixed ~7.5° facets — same sampling style as the rounded-rect corners.
 */
function ellipseLoop(
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

function applyDash(
  ctx: CanvasRenderingContext2D,
  el: Element,
  strokeWidth: number,
) {
  if (el.strokeStyle === "dashed") {
    ctx.setLineDash([strokeWidth * 5, strokeWidth * 4]);
  } else if (el.strokeStyle === "dotted") {
    ctx.setLineDash([strokeWidth * 0.01 + 0.01, strokeWidth * 2.6]);
    ctx.lineCap = "round";
  } else if (el.strokeStyle === "dashdot") {
    ctx.setLineDash([
      strokeWidth * 5,
      strokeWidth * 3,
      strokeWidth * 0.01 + 0.01,
      strokeWidth * 3,
    ]);
    ctx.lineCap = "round";
  }
}

/** fixed icon→label distance and font size (do NOT scale with resize) */
const ICON_LABEL_GAP = 2;
const COMPONENT_LABEL_FONT = 12;

/** label inset inside a shape: global text offset + the per-side offset of
 *  the side the text is aligned to (same model as caption gap/offset) */
export function textOffsets(el: Element): { padX: number; padY: number } {
  const g = el.textOffsetGlobal ?? 8;
  const align = el.textAlign ?? "center";
  const vAlign = el.textVAlign ?? "middle";
  return {
    padX:
      g +
      (align === "left"
        ? el.textOffsetLeft ?? 0
        : align === "right"
          ? el.textOffsetRight ?? 0
          : 0),
    padY:
      g +
      (vAlign === "top"
        ? el.textOffsetTop ?? 0
        : vAlign === "bottom"
          ? el.textOffsetBottom ?? 0
          : 0),
  };
}

/** icon geometry shared between canvas rendering and label placement */
export function componentIconLayout(el: ComponentElement) {
  const s = Math.min(Math.abs(el.width), Math.abs(el.height));
  const hasLabel = !!el.label && el.label.trim() !== "";
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const baseGap = el.captionGap ?? ICON_LABEL_GAP;
  const captionPos = el.captionPosition ?? "bottom";
  const offset =
    captionPos === "top" ? (el.captionOffsetTop ?? 0) :
    captionPos === "bottom" ? (el.captionOffsetBottom ?? 0) :
    captionPos === "left" ? (el.captionOffsetLeft ?? 0) :
    (el.captionOffsetRight ?? 0);
  const gap = baseGap + offset;
  const labelFont = el.fontSize ?? COMPONENT_LABEL_FONT;
  const labelH = labelFont * 1.25;

  // icon size is ALWAYS fixed proportion of element, never affected by fontSize
  const iconSizeFixed = hasLabel ? Math.max(s * 0.65, 8) : s;

  if (!hasLabel) {
    return {
      hasLabel,
      iconX: cx - iconSizeFixed / 2,
      iconY: cy - iconSizeFixed / 2,
      iconSize: iconSizeFixed,
      labelCx: cx,
      labelCy: cy,
      labelFont,
      captionPosition: captionPos,
    };
  }

  if (captionPos === "left" || captionPos === "right") {
    // horizontal layout: icon and label side by side, edge-to-edge
    const { width: tw } = measureText(el.label!, labelFont);
    const iconY = cy - iconSizeFixed / 2;
    const totalW = iconSizeFixed + gap + tw;
    let iconX: number;
    let labelCx: number;
    if (captionPos === "left") {
      // label on left, icon on right
      iconX = cx + totalW / 2 - iconSizeFixed;
      labelCx = cx - totalW / 2 + tw / 2;
    } else {
      // label on right, icon on left
      iconX = cx - totalW / 2;
      labelCx = cx + totalW / 2 - tw / 2;
    }
    return {
      hasLabel,
      iconX,
      iconY,
      iconSize: iconSizeFixed,
      labelCx,
      labelCy: cy,
      labelFont,
      captionPosition: captionPos,
    };
  }

  // vertical layout (top or bottom): icon takes fixed space, label gets remaining
  const totalContentH = iconSizeFixed + gap + labelH;
  const topOffset = cy - totalContentH / 2;
  if (captionPos === "top") {
    return {
      hasLabel,
      iconX: cx - iconSizeFixed / 2,
      iconY: topOffset + labelH + gap,
      iconSize: iconSizeFixed,
      labelCx: cx,
      labelCy: topOffset + labelH / 2,
      labelFont,
      captionPosition: captionPos,
    };
  }
  // bottom (default)
  return {
    hasLabel,
    iconX: cx - iconSizeFixed / 2,
    iconY: topOffset,
    iconSize: iconSizeFixed,
    labelCx: cx,
    labelCy: topOffset + iconSizeFixed + gap + labelH / 2,
    labelFont,
    captionPosition: captionPos,
  };
}

function drawComponentIcon(ctx: CanvasRenderingContext2D, el: ComponentElement) {
  const { iconX, iconY, iconSize } = componentIconLayout(el);

  // official bundled icon (AWS Architecture Icons) when available
  const img = getComponentImage(el.componentId);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
    return;
  }

  const paths = iconPaths(el.componentId);
  if (paths.length === 0) return;
  const scale = iconSize / 24;
  ctx.save();
  ctx.translate(iconX, iconY);
  ctx.scale(scale, scale);
  ctx.lineWidth = ctx.lineWidth / scale;
  for (const p of paths) {
    ctx.beginPath();
    ctx.stroke(p);
  }
  ctx.restore();
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: Element,
  colors: RenderColors,
) {
  ctx.save();
  ctx.globalAlpha = el.opacity;
  ctx.strokeStyle = resolveStroke(el, colors);
  ctx.fillStyle = el.backgroundColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (el.type === "rectangle" || el.type === "component") {
    // fill always uses a clean closed shape so it never breaks
    if (el.backgroundColor !== "transparent") {
      ctx.beginPath();
      ctx.roundRect(el.x, el.y, el.width, el.height, cornerRadius(el));
      ctx.fill();
    }
    // strokeWidth 0 = borderless (library components)
    if (el.strokeWidth > 0) {
      ctx.beginPath();
      if (el.roughness === 0) {
        ctx.roundRect(el.x, el.y, el.width, el.height, cornerRadius(el));
      } else {
        sketchStroke(
          ctx,
          [
            roundedRectLoop(
              el.x,
              el.y,
              el.width,
              el.height,
              cornerRadius(el),
            ),
          ],
          el.roughness,
          seedOf(el.id),
          cornerRadius(el) > 0 ? 0.30 : 1,
        );
      }
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke();
    }

    if (el.type === "component") drawComponentIcon(ctx, el);
  } else if (el.type === "diamond") {
    const v = diamondVertices(el);
    if (el.backgroundColor !== "transparent") {
      ctx.beginPath();
      ctx.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    if (el.roughness === 0) {
      ctx.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
      ctx.closePath();
    } else {
      sketchStroke(ctx, [diamondLoop(el)], el.roughness, seedOf(el.id));
    }
    applyDash(ctx, el, el.strokeWidth);
    ctx.stroke();
  } else if (el.type === "ellipse") {
    const rx = Math.abs(el.width) / 2;
    const ry = Math.abs(el.height) / 2;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    if (el.backgroundColor !== "transparent") {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    if (el.roughness === 0) {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      sketchStroke(
        ctx,
        [ellipseLoop(el.x, el.y, el.width, el.height)],
        el.roughness,
        seedOf(el.id),
      );
    }
    applyDash(ctx, el, el.strokeWidth);
    ctx.stroke();
  } else if (el.type === "line") {
    const [a, b] = arrowPoints(el);
    ctx.beginPath();
    sketchStroke(ctx, [[a, b]], el.roughness, seedOf(el.id));
    applyDash(ctx, el, el.strokeWidth);
    ctx.stroke();
  } else if (el.type === "arrow") {
    const [a, b] = arrowPoints(el);
    const lineType = el.lineType ?? "straight";
    const endY = b.y === a.y ? b.y + 1 : b.y;
    const tip = { x: b.x, y: endY };

    ctx.beginPath();
    if (lineType === "straight") {
      sketchStroke(ctx, [[a, tip]], el.roughness, seedOf(el.id));
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke();
      drawArrowHead(ctx, tip, a, Math.max(12, el.strokeWidth * 4));
    } else if (lineType === "curved") {
      const cp = curvedArrowControl(el, a, tip);
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cp.x, cp.y, tip.x, tip.y);
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke();
      drawArrowHead(ctx, tip, cp, Math.max(12, el.strokeWidth * 4));
    } else {
      // auto: L-shaped routing (horizontal then vertical)
      const mid = { x: tip.x, y: a.y };
      sketchStroke(ctx, [[a, mid, tip]], el.roughness, seedOf(el.id));
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke();
      drawArrowHead(ctx, tip, mid, Math.max(12, el.strokeWidth * 4));
    }
  } else if (el.type === "text") {
    ctx.fillStyle = resolveTextColor(el, colors);
    ctx.font = resolveFont(el);
    ctx.textBaseline = "top";
    const lh = lineHeight(el);
    const lines = el.text.split("\n");
    const align = el.textAlign ?? "left";
    ctx.textAlign = align;
    const n = lines.length;
    const textBlockH = n === 1 ? el.fontSize : (n - 1) * el.fontSize * lh + el.fontSize;
    const vOffset = Math.max(0, (el.height - textBlockH) / 2);
    const underlineOn = !!el.underline;
    lines.forEach((line, i) => {
      let lx = el.x;
      if (align === "center") lx = el.x + el.width / 2;
      else if (align === "right") lx = el.x + el.width;
      const lineY = el.y + vOffset + i * el.fontSize * lh;
      ctx.fillText(line, lx, lineY);
      if (underlineOn && line.length > 0) {
        const lw = ctx.measureText(line).width;
        if (lw > 0) {
          let ux = el.x;
          if (align === "center") ux = el.x + (el.width - lw) / 2;
          else if (align === "right") ux = el.x + el.width - lw;
          ctx.strokeStyle = resolveTextColor(el, colors);
          ctx.lineWidth = Math.max(2, el.fontSize * 0.07);
          ctx.beginPath();
          ctx.moveTo(ux, lineY + el.fontSize);
          ctx.lineTo(ux + lw, lineY + el.fontSize);
          ctx.stroke();
        }
      }
    });
  } else if (el.type === "image") {
    const img = getCachedImage(el.src);
    if (img) {
      ctx.drawImage(img, el.x, el.y, el.width, el.height);
    } else {
      // placeholder while image loads
      ctx.fillStyle = "#e0e0e0";
      ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.strokeStyle = resolveStroke(el, colors);
      ctx.lineWidth = 1;
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    }
  }
  ctx.restore();
}

export function elementVisualBounds(ctx: CanvasRenderingContext2D, el: Element): Bounds {
  const eb = elementBounds(el);
  let x1 = eb.x1;
  let y1 = eb.y1;
  let x2 = eb.x2;
  let y2 = eb.y2;

  if ("label" in el && el.label) {
    const fontSize = el.fontSize ?? (el.type === "component" ? 12 : 14);
    ctx.font = resolveFont(el, fontSize);
    const lines = el.label.split("\n");
    const tw =
      el.type === "component"
        ? ctx.measureText(el.label).width
        : Math.max(...lines.map((l) => ctx.measureText(l).width));
    const lh = lineHeight(el);
    const th =
      el.type === "component"
        ? fontSize * 1.25
        : lines.length === 1
          ? fontSize * 1.25
          : (lines.length - 1) * fontSize * lh + fontSize;
    if (el.type === "component") {
      const layout = componentIconLayout(el);
      x1 = Math.min(x1, layout.iconX);
      y1 = Math.min(y1, layout.iconY);
      x2 = Math.max(x2, layout.iconX + layout.iconSize);
      y2 = Math.max(y2, layout.iconY + layout.iconSize);
      const lx = layout.labelCx - tw / 2;
      const ly = layout.labelCy - th / 2;
      x1 = Math.min(x1, lx);
      y1 = Math.min(y1, ly);
      x2 = Math.max(x2, lx + tw);
      y2 = Math.max(y2, ly + th);
    } else {
      const textAlign = el.textAlign ?? "center";
      const textVAlign = el.textVAlign ?? "middle";
      const { padX: pad, padY } = textOffsets(el);
      let lx: number;
      let ly: number;
      if (textAlign === "left") lx = el.x + pad;
      else if (textAlign === "right") lx = el.x + el.width - pad - tw;
      else lx = el.x + (el.width - tw) / 2;
      if (textVAlign === "top") ly = el.y + padY;
      else if (textVAlign === "bottom") ly = el.y + el.height - padY - th;
      else ly = el.y + (el.height - th) / 2;
      // clip the text rect to the element bounds: text fully contained must NOT expand them
      const tx1 = Math.min(Math.max(lx, x1), x2);
      const ty1 = Math.min(Math.max(ly, y1), y2);
      const tx2 = Math.max(tx1, Math.min(lx + tw, x2));
      const ty2 = Math.max(ty1, Math.min(ly + th, y2));
      x1 = Math.min(x1, tx1);
      y1 = Math.min(y1, ty1);
      x2 = Math.max(x2, tx2);
      y2 = Math.max(y2, ty2);
    }
  }

  return { x1, y1, x2, y2 };
}

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  color: string,
) {
  // arrows/lines: highlight the line itself instead of a misleading bbox rectangle
  if (el.type === "arrow" || el.type === "line") {
    const [a, b] = arrowPoints(el);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = el.strokeWidth + 4 / zoom;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const b = elementVisualBounds(ctx, el);
  const pad = 3 / zoom;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.75, 1 / zoom);
  ctx.setLineDash([3 / zoom, 4 / zoom]);
  ctx.strokeRect(
    b.x1 - pad,
    b.y1 - pad,
    b.x2 - b.x1 + pad * 2,
    b.y2 - b.y1 + pad * 2,
  );
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, el: Element, colors: RenderColors) {
  if (el.type === "text" || !el.label) return;
  ctx.save();
  ctx.globalAlpha = el.opacity;
  ctx.fillStyle = resolveTextColor(el, colors);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const underlineOn = !!el.underline;
  if (el.type === "component") {
    const layout = componentIconLayout(el);
    ctx.font = resolveFont(el, layout.labelFont);
    const fs = layout.labelFont;
    const lh = lineHeight(el);
    const lines = el.label.split("\n");
    const step = fs * lh;
    const vShift = ((lines.length - 1) * step) / 2;
    ctx.fillText(lines[0], layout.labelCx, layout.labelCy - vShift);
    for (let i = 1; i < lines.length; i++) {
      ctx.fillText(lines[i], layout.labelCx, layout.labelCy + i * step - vShift);
    }
    if (underlineOn) {
      let maxLw = 0;
      let bestY = layout.labelCy;
      lines.forEach((line, i) => {
        const lw = ctx.measureText(line).width;
        if (lw > maxLw) {
          maxLw = lw;
          bestY = layout.labelCy + i * step - vShift;
        }
      });
      if (maxLw > 0) {
        ctx.strokeStyle = resolveTextColor(el, colors);
        ctx.lineWidth = Math.max(1.5, fs * 0.07);
        ctx.beginPath();
        const uy = bestY + fs * 0.55;
        ctx.moveTo(layout.labelCx - maxLw / 2, uy);
        ctx.lineTo(layout.labelCx + maxLw / 2, uy);
        ctx.stroke();
      }
    }
  } else {
    const textAlign = el.textAlign ?? "center";
    const textVAlign = el.textVAlign ?? "middle";
    ctx.textAlign = textAlign;
    let cx: number;
    let cy: number;
    if (el.type === "line" || el.type === "arrow") {
      // edges: label slides along the stroke (labelT, default center)
      const anchor = edgeLabelAnchor(el)!;
      cx = anchor.x;
      cy = anchor.y;
    } else {
      const { padX: pad, padY } = textOffsets(el);
      if (textAlign === "left") cx = el.x + pad;
      else if (textAlign === "right") cx = el.x + el.width - pad;
      else cx = el.x + el.width / 2;
      if (textVAlign === "top") cy = el.y + padY;
      else if (textVAlign === "bottom") cy = el.y + el.height - padY;
      else cy = el.y + el.height / 2;
    }
    const fontSize = el.fontSize ?? 14;
    ctx.font = resolveFont(el, fontSize);
    const lh = lineHeight(el);
    const lines = el.label.split("\n");
    const step = fontSize * lh;
    // edges: opaque plate in the canvas background color sits between the
    // stroke and the text so the line does not cut through the label
    // (never hardcoded — matches the live canvas background via the theme)
    if (el.type === "line" || el.type === "arrow") {
      const pad = Math.max(2, fontSize * 0.3);
      const tw = Math.max(...lines.map((l: string) => ctx.measureText(l).width), 1);
      const bh = (lines.length - 1) * step + fontSize;
      const blockCy =
        textVAlign === "top"
          ? cy + ((lines.length - 1) * step) / 2
          : textVAlign === "bottom"
            ? cy - ((lines.length - 1) * step) / 2
            : cy;
      const bx =
        textAlign === "left" ? cx : textAlign === "right" ? cx - tw : cx - tw / 2;
      ctx.save();
      ctx.globalAlpha = 1;
      // fallback defends against callers with a stale colors object (e.g.
      // React state created before canvasBg existed): assigning an undefined
      // fillStyle is silently ignored and would reuse the TEXT color,
      // painting an opaque block instead of a plate
      ctx.fillStyle = colors.canvasBg || DEFAULT_COLORS.canvasBg;
      ctx.fillRect(bx - pad, blockCy - bh / 2 - pad, tw + pad * 2, bh + pad * 2);
      ctx.restore();
    }
    const drawLine = (line: string, i: number) => {
      let ly: number;
      if (textVAlign === "top") ly = cy + i * step;
      else if (textVAlign === "bottom") ly = cy + (i - (lines.length - 1)) * step;
      else ly = cy + i * step - ((lines.length - 1) * step) / 2;
      ctx.fillText(line, cx, ly);
      if (underlineOn) {
        const lw = ctx.measureText(line).width;
        if (lw > 0) {
          ctx.strokeStyle = resolveTextColor(el, colors);
          ctx.lineWidth = Math.max(1.5, fontSize * 0.07);
          ctx.beginPath();
          const uy = ly + fontSize * 0.55;
          let ux = cx;
          if (textAlign === "left") ux = cx;
          else if (textAlign === "right") ux = cx - lw;
          else ux = cx - lw / 2;
          ctx.moveTo(ux, uy);
          ctx.lineTo(ux + lw, uy);
          ctx.stroke();
        }
      }
    };
    lines.forEach(drawLine);
  }
  ctx.restore();
}

const HANDLE_SIZE = 7; // screen px

function drawHandles(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  color: string,
) {
  const b = elementVisualBounds(ctx, el);
  const cx = (b.x1 + b.x2) / 2;
  const cy = (b.y1 + b.y2) / 2;
  // arrows/lines expose only their two endpoints; width/height are signed,
  // so the endpoints are (x,y) and (x+width,y+height), not fixed bbox corners
  const points =
    el.type === "arrow" || el.type === "line"
      ? arrowPoints(el)
      : [
          { x: b.x1, y: b.y1 },
          { x: cx, y: b.y1 },
          { x: b.x2, y: b.y1 },
          { x: b.x2, y: cy },
          { x: b.x2, y: b.y2 },
          { x: cx, y: b.y2 },
          { x: b.x1, y: b.y2 },
          { x: b.x1, y: cy },
        ];
  const s = HANDLE_SIZE / zoom;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 / zoom;
  for (const p of points) {
    ctx.beginPath();
    ctx.rect(p.x - s / 2, p.y - s / 2, s, s);
    ctx.fill();
    ctx.stroke();
  }
  // circular handle for dragging the label along a line/arrow stroke
  if (el.type === "line" || el.type === "arrow") {
    const anchor = edgeLabelAnchor(el);
    if (anchor && el.label) {
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGuides(
  ctx: CanvasRenderingContext2D,
  guides: { orientation: "h" | "v"; pos: number }[],
  cam: Camera,
  w: number,
  h: number,
) {
  if (guides.length === 0) return;
  const vx1 = -cam.scrollX / cam.zoom;
  const vy1 = -cam.scrollY / cam.zoom;
  const vx2 = vx1 + w / cam.zoom;
  const vy2 = vy1 + h / cam.zoom;

  ctx.save();
  ctx.strokeStyle = "#e03131";
  ctx.lineWidth = 1 / cam.zoom;
  ctx.beginPath();
  for (const g of guides) {
    if (g.orientation === "v") {
      ctx.moveTo(g.pos, vy1);
      ctx.lineTo(g.pos, vy2);
    } else {
      ctx.moveTo(vx1, g.pos);
      ctx.lineTo(vx2, g.pos);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** halo around a shape offered/accepted as a binding target */
function drawBindingHighlight(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  color: string,
) {
  const b = elementBounds(el);
  const pad = 4 / zoom;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color + "1a";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 / zoom;
  ctx.beginPath();
  ctx.rect(
    b.x1 - pad,
    b.y1 - pad,
    b.x2 - b.x1 + pad * 2,
    b.y2 - b.y1 + pad * 2,
  );
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** draws the highlight of each binding target plus a dot on the outline */
function drawBindingPreview(
  ctx: CanvasRenderingContext2D,
  preview: { start: ArrowBinding | null; end: ArrowBinding | null },
  doc: Document,
  zoom: number,
  color: string,
) {
  const byId = new Map(doc.elements.map((el) => [el.id, el] as const));
  for (const binding of [preview.start, preview.end]) {
    if (!binding) continue;
    const target = byId.get(binding.elementId);
    if (!target) continue;
    drawBindingHighlight(ctx, target, zoom, color);
    const ap = bindingPoint(target, binding);
    const r = 5 / zoom;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  canvasWidth: number,
  canvasHeight: number,
) {
  const { camera: cam } = state;
  const colors = state.colors ?? DEFAULT_COLORS;
  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (state.gridMode === "dots") {
    drawGridDots(ctx, cam, canvasWidth, canvasHeight, colors.gridDot);
  } else if (state.gridMode === "lines") {
    drawGridLines(ctx, cam, canvasWidth, canvasHeight, colors.gridLine);
  }

  // scene transform
  ctx.translate(cam.scrollX, cam.scrollY);
  ctx.scale(cam.zoom, cam.zoom);

  for (const el of state.doc.elements) {
    const isEditingThisLabel =
      !!state.hiddenLabelId && el.id === state.hiddenLabelId;
    drawElement(ctx, el, colors);
    // label is ALWAYS painted (even while its text is being edited) so the
    // invisible overlay textarea stays WYSIWYG with the final style
    drawLabel(ctx, el, colors);
    if (state.selectedIds.has(el.id) && !isEditingThisLabel)
      drawSelectionBox(ctx, el, cam.zoom, colors.selection);
  }

  // resize handles for single selection of a shape/arrow/text
  if (!state.draft && state.selectedIds.size === 1) {
    const sel = state.doc.elements.find((el) => state.selectedIds.has(el.id));
    if (
      sel &&
      (sel.type === "rectangle" ||
        sel.type === "diamond" ||
        sel.type === "ellipse" ||
        sel.type === "line" ||
        sel.type === "arrow" ||
        sel.type === "component" ||
        sel.type === "text" ||
        sel.type === "image") &&
      !(state.hiddenLabelId && sel.id === state.hiddenLabelId) &&
      !(state.hiddenTextId && sel.id === state.hiddenTextId)
    ) {
      drawHandles(ctx, sel, cam.zoom, colors.selection);
    }
  }

  if (state.guides && state.camera) {
    drawGuides(ctx, state.guides, cam, canvasWidth, canvasHeight);
  }

  if (state.draft) {
    drawElement(ctx, state.draft, colors);
    drawLabel(ctx, state.draft, colors);
    drawSelectionBox(ctx, state.draft, cam.zoom, colors.selection);
  }

  if (state.bindingPreview) {
    drawBindingPreview(
      ctx,
      state.bindingPreview,
      state.doc,
      cam.zoom,
      colors.selection,
    );
  }

  if (state.marquee) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.selection + "14";
    ctx.strokeStyle = colors.selection;
    ctx.lineWidth = 1 / cam.zoom;
    const { x1, y1, x2, y2 } = state.marquee;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    ctx.fillRect(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.strokeRect(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.restore();
  }

  ctx.restore();
}
