/** shared helpers for the two Excalidraw parsers (scene .excalidraw and
 *  library .excalidrawlib). */

/** normaliza points: Excalidraw usa tuplas [x, y] (versões novas) ou
 *  objetos {x, y} (antigas); descarta valores inválidos */
export function normalizePoints(points: unknown): { x: number; y: number }[] {
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

/** Excalidraw stroke style (no dash-dot) — lossy for `dashdot` → solid */
export function toExcalidrawStrokeStyle(
  s: string | undefined,
): "solid" | "dashed" | "dotted" {
  if (s === "dashed") return "dashed";
  if (s === "dotted") return "dotted";
  return "solid";
}

/** Excalidraw fontFamily → categoria ArchiDraw. Excalidraw usa números estáveis
 *  (1 = Virgil/Excalifont manuscrito, 3 = Cascadia mono, 2 = Helvetica/sans);
 *  arquivos antigos podem trazer o nome como string, então aceitamos ambos.
 *  Demais valores caem em sans — a fonte padrão do ArchiDraw. */
export function excalidrawFontCategory(
  f: unknown,
): "sketch" | "mono" | "sans" {
  if (f === 1) return "sketch";
  if (f === 3) return "mono";
  if (typeof f === "string") {
    const name = f.replace(/[-_ ]/g, "").toLowerCase();
    if (name === "virgil" || name === "excalifont" || name === "comicshanns") {
      return "sketch";
    }
    if (name === "cascadia") return "mono";
  }
  return "sans";
}