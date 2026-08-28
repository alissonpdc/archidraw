/**
 * Parser de arquivos `.excalidrawlib` (Excalidraw Library).
 *
 * Cada library item do Excalidraw é um conjunto de elementos
 * (rect, ellipse, diamond, line, arrow, freedraw, text). Convertimos
 * cada item para um SVG autocontido (data URI), que é desenhado pelo
 * mesmo pipeline de imagens usado pelos ícones oficiais AWS.
 */

export interface ExcalidrawLibParseResult {
  /** um item por library item do arquivo */
  items: {
    name: string;
    svg: string;
    /** largura/altura do SVG (para preservar proporção na inserção) */
    aspect: number;
  }[];
}

interface ExcalidrawElementLike {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
  opacity?: number;
  roundness?: { type: number; value?: number } | null;
  strokeSharpness?: string;
  points?: { x: number; y: number }[];
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  closed?: boolean;
}

export class ExcalidrawLibParseError extends Error {}

/** extrai a lista de library items (v1: {library}; v2: {libraryItems}; raiz: array) */
function extractItems(root: unknown): ExcalidrawElementLike[][] {
  if (Array.isArray(root)) {
    return root.filter(
      (it): it is ExcalidrawElementLike[] => Array.isArray(it) && it.length > 0,
    );
  }
  if (root && typeof root === "object") {
    for (const key of ["libraryItems", "library"] as const) {
      const list = (root as Record<string, unknown>)[key];
      if (!Array.isArray(list)) continue;
      return (list as unknown[])
        .map((it) =>
          it && typeof it === "object" && Array.isArray((it as { elements?: unknown }).elements)
            ? ((it as { elements: ExcalidrawElementLike[] }).elements)
            : Array.isArray(it)
              ? (it as ExcalidrawElementLike[])
              : null,
        )
        .filter((it): it is ExcalidrawElementLike[] => !!it && it.length > 0);
    }
  }
  throw new ExcalidrawLibParseError("Invalid .excalidrawlib file: no libraryItems");
}

/**
 * normaliza points: Excalidraw usa tuplas [x, y] (versões novas) ou
 * objetos {x, y} (antigas); descarta valores inválidos
 */
function normalizePoints(points: unknown): { x: number; y: number }[] {
  if (!Array.isArray(points)) return [];
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
      out.push({ x: p[0] as number, y: p[1] as number });
    } else if (
      p &&
      typeof p === "object" &&
      Number.isFinite((p as { x?: unknown }).x) &&
      Number.isFinite((p as { y?: unknown }).y)
    ) {
      out.push({ x: (p as { x: number }).x, y: (p as { y: number }).y });
    }
  }
  return out;
}

/** copia rasa do elemento com points normalizados para {x,y}[] */
function normalizeElement(el: ExcalidrawElementLike): ExcalidrawElementLike {
  if (!("points" in el)) return el;
  return { ...el, points: normalizePoints((el as { points?: unknown }).points) };
}

/** nome do item i no formato v2 ({libraryItems:[{name,elements}]}) */
function findWrapperName(root: unknown, index: number): unknown {
  if (root && typeof root === "object") {
    for (const key of ["libraryItems", "library"] as const) {
      const list = (root as Record<string, unknown>)[key];
      if (Array.isArray(list)) return list[index] ?? null;
    }
  }
  return null;
}

const PAD = 4;

function fontFamilyOf(f: number | undefined): string {
  if (f === 1) return '"Virgil","Segoe Print",cursive';
  if (f === 3) return '"Cascadia",monospace';
  return 'system-ui,sans-serif';
}

function dashArray(style: string | undefined): string | null {
  if (style === "dashed") return "8 5";
  if (style === "dotted") return "0.5 5";
  return null;
}

/** nome de exibição do item */
function itemName(item: unknown, index: number): string {
  if (item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string") {
    const n = (item as { name: string }).name.trim();
    if (n) return n;
  }
  return `Item ${index + 1}`;
}

/** bounds globais (inclui pontos de linhas/setas, que extrapolam x/y/w/h) */
function computeBounds(elements: ExcalidrawElementLike[]) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  const push = (x: number, y: number) => {
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);
  };
  for (const el of elements) {
    if (Array.isArray(el.points) && el.points.length > 0) {
      for (const p of el.points) push(el.x + p.x, el.y + p.y);
    } else {
      const w = el.width ?? 0;
      const h = el.height ?? 0;
      push(el.x, el.y);
      push(el.x + w, el.y + h);
    }
  }
  return { x1, y1, x2, y2 };
}

function fillOf(el: ExcalidrawElementLike): string {
  const bg = el.backgroundColor;
  if (!bg || bg === "transparent") return "none";
  return bg;
}

/** fill + aproximação de fillStyle (hachure/cross-hatch → sólido translúcido) */
function fillAttrs(el: ExcalidrawElementLike): string {
  const fill = fillOf(el);
  if (fill === "none") return 'fill="none"';
  const style = el.fillStyle;
  if (style === "hachure") return `fill="${fill}" fill-opacity="0.4"`;
  if (style === "cross-hatch") return `fill="${fill}" fill-opacity="0.6"`;
  return `fill="${fill}"`;
}

function strokeAttrs(el: ExcalidrawElementLike): string {
  const sw = typeof el.strokeWidth === "number" && el.strokeWidth > 0 ? el.strokeWidth : 1;
  const dash = dashArray(el.strokeStyle);
  return (
    `stroke="${el.strokeColor ?? "#000000"}" stroke-width="${sw}"` +
    (dash ? ` stroke-dasharray="${dash}"` : "")
  );
}

function angleTransform(el: ExcalidrawElementLike, ox: number, oy: number): string {
  if (!el.angle) return "";
  const cx = el.x + (el.width ?? 0) / 2 - ox;
  const cy = el.y + (el.height ?? 0) / 2 - oy;
  return ` transform="rotate(${((el.angle * 180) / Math.PI).toFixed(3)} ${cx.toFixed(2)} ${cy.toFixed(2)})"`;
}

/** path d para polilinhas; smooth ≈ strokeSharpness "round" do Excalidraw */
function pathDFor(
  pts: { x: number; y: number }[],
  ox: number,
  oy: number,
  smooth: boolean,
): string {
  const P = (p: { x: number; y: number }) =>
    `${(p.x - ox).toFixed(2)} ${(p.y - oy).toFixed(2)}`;
  if (!smooth || pts.length < 3) {
    return `M${pts.map((p) => P(p)).join("L")}`;
  }
  // quadráticas pelos pontos-médios (aproximação das curvas do Excalidraw)
  let d = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mx = (a.x + b.x) / 2 - ox;
    const my = (a.y + b.y) / 2 - oy;
    d += `Q${P(a)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  d += `L${P(pts[pts.length - 1])}`;
  return d;
}

function arrowHeads(
  el: ExcalidrawElementLike,
  ox: number,
  oy: number,
): string {
  const pts = el.points!;
  if (pts.length < 2) return "";
  let out = "";
  const head = (tip: { x: number; y: number }, prev: { x: number; y: number }, len: number) => {
    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const bx = tip.x - ux * len;
    const by = tip.y - uy * len;
    const px = -uy;
    const py = ux;
    const w = len * 0.4;
    const lines = [
      [tip.x, tip.y, bx + px * w, by + py * w],
      [tip.x, tip.y, bx - px * w, by - py * w],
    ];
    return linesToPath(lines, ox, oy);
  };
  if (el.endArrowhead !== "none" && el.endArrowhead !== null) {
    out += head(pts[pts.length - 1], pts[pts.length - 2], 10);
  }
  if (el.startArrowhead && el.startArrowhead !== "none") {
    out += head(pts[0], pts[1], 10);
  }
  return out;
}

function linesToPath(lines: number[][], ox: number, oy: number): string {
  return lines
    .map(
      ([x1, y1, x2, y2]) =>
        `M${(x1 - ox).toFixed(2)} ${(y1 - oy).toFixed(2)}L${(x2 - ox).toFixed(2)} ${(y2 - oy).toFixed(2)}`,
    )
    .join("");
}

function elementToSvg(el: ExcalidrawElementLike, ox: number, oy: number): string | null {
  const w = el.width ?? 0;
  const h = el.height ?? 0;
  const angle = angleTransform(el, ox, oy);
  const opacity = typeof el.opacity === "number" && el.opacity < 100 ? ` opacity="${el.opacity / 100}"` : "";
  const open = `<g${opacity}>`;
  const round = !!el.roundness || el.strokeSharpness === "round";

  switch (el.type) {
    case "rectangle": {
      const rx = round ? Math.min(w, h) * 0.25 : 0;
      return `${open}<rect x="${(el.x - ox).toFixed(2)}" y="${(el.y - oy).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}"${rx > 0 ? ` rx="${rx.toFixed(2)}"` : ""} ${fillAttrs(el)} ${strokeAttrs(el)}${angle}/></g>`;
    }
    case "ellipse":
      return `${open}<ellipse cx="${(el.x + w / 2 - ox).toFixed(2)}" cy="${(el.y + h / 2 - oy).toFixed(2)}" rx="${(w / 2).toFixed(2)}" ry="${(h / 2).toFixed(2)}" ${fillAttrs(el)} ${strokeAttrs(el)}${angle}/></g>`;
    case "diamond": {
      const cx = el.x + w / 2;
      const cy = el.y + h / 2;
      const pts = [
        [cx, el.y],
        [el.x + w, cy],
        [cx, el.y + h],
        [el.x, cy],
      ]
        .map(([x, y]) => `${(x - ox).toFixed(2)},${(y - oy).toFixed(2)}`)
        .join(" ");
      return `${open}<polygon points="${pts}" ${fillAttrs(el)} ${strokeAttrs(el)}${angle}/></g>`;
    }
    case "line":
    case "draw": {
      const pts = el.points ?? [];
      if (pts.length < 2) return null;
      const closed =
        !!el.closed ||
        (pts.length > 2 &&
          pts[0].x === pts[pts.length - 1].x &&
          pts[0].y === pts[pts.length - 1].y);
      const smooth = round || el.type === "draw";
      let d = pathDFor(pts, ox, oy, smooth);
      if (closed) d += "Z";
      const shapeFill = el.type === "draw" || !closed ? "none" : fillAttrs(el);
      return `${open}<path d="${d}" ${shapeFill === "none" ? 'fill="none"' : shapeFill} ${strokeAttrs(el)}${angle}/></g>`;
    }
    case "arrow": {
      const pts = el.points ?? [];
      if (pts.length < 2) return null;
      const body = `<path d="${pathDFor(pts, ox, oy, round)}" fill="none" ${strokeAttrs(el)}${angle}/>`;
      const heads = arrowHeads(el, ox, oy);
      return `${open}${body}${heads}</g>`;
    }
    case "text": {
      const size = el.fontSize ?? 20;
      const lines = (el.text ?? "").split("\n");
      const x = (el.x - ox).toFixed(2);
      const spans = lines
        .map(
          (line, i) =>
            `<tspan x="${x}" dy="${i === 0 ? 0 : (size * 1.25).toFixed(2)}">${escapeXml(line)}</tspan>`,
        )
        .join("");
      return `${open}<text x="${x}" y="${firstBaselineY(el, oy)}" font-family="${fontFamilyOf(el.fontFamily)}" font-size="${size}" fill="${el.strokeColor ?? "#000000"}"${angle}>${spans}</text></g>`;
    }
    default:
      return null;
  }
}

function firstBaselineY(el: ExcalidrawElementLike, oy: number): string {
  return (el.y - oy + (el.fontSize ?? 20) * 0.8).toFixed(2);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** converte um library item (lista de elementos) para um SVG completo */
function itemToSvg(elements: ExcalidrawElementLike[]): { svg: string; aspect: number } {
  const b = computeBounds(elements);
  const ox = b.x1 - PAD;
  const oy = b.y1 - PAD;
  const W = Math.max(b.x2 - b.x1 + PAD * 2, 1);
  const H = Math.max(b.y2 - b.y1 + PAD * 2, 1);

  const parts = elements
    .map((el) => elementToSvg(el, ox, oy))
    .filter((s): s is string => !!s);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}" height="${H.toFixed(2)}" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">` +
    parts.join("") +
    `</svg>`;
  return { svg, aspect: W / H };
}

export function parseExcalidrawLib(jsonText: string): ExcalidrawLibParseResult {
  let root: unknown;
  try {
    root = JSON.parse(jsonText);
  } catch {
    throw new ExcalidrawLibParseError("Invalid JSON in .excalidrawlib file");
  }
  const lists = extractItems(root);
  const items = lists.map((elements, i) => {
    const name = itemName(
      // name vem do objeto wrapper; extractItems devolve só elements,
      // então procuramos no root original quando for v2
      findWrapperName(root, i),
      i,
    );
    const { svg, aspect } = itemToSvg(elements.map(normalizeElement));
    return { name, svg, aspect };
  });
  if (items.length === 0) {
    throw new ExcalidrawLibParseError("No items found in .excalidrawlib file");
  }
  return { items };
}