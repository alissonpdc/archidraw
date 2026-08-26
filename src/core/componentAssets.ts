/**
 * Ícones oficiais AWS Architecture Icons embutidos no bundle
 * (SVGs locais — 100% offline). Carregados como data URI e desenhados
 * via drawImage, o que preserva os gradientes oficiais.
 */

const modules = import.meta.glob("./assets/aws/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const dataUris = new Map<string, string>();
for (const [path, svg] of Object.entries(modules)) {
  const m = path.match(/\/([^/]+)\.svg$/);
  if (m) dataUris.set(m[1], `data:image/svg+xml;base64,${btoa(svg)}`);
}

const images = new Map<string, HTMLImageElement>();

function ensureImage(componentId: string): HTMLImageElement | null {
  const uri = dataUris.get(componentId);
  if (!uri) return null;
  let img = images.get(componentId);
  if (!img) {
    img = new Image();
    img.src = uri;
    images.set(componentId, img);
  }
  return img;
}

/** image for canvas drawing; check .complete before drawImage */
export function getComponentImage(componentId: string): HTMLImageElement | null {
  return ensureImage(componentId);
}

/** true when the catalog id has an official bundled icon */
export function hasComponentAsset(componentId: string): boolean {
  return dataUris.has(componentId);
}

/** data URI for <img> previews and SVG export embedding */
export function componentAssetDataUri(componentId: string): string | null {
  return dataUris.get(componentId) ?? null;
}

/** resolves when every requested icon finished decoding (for PNG export) */
export function waitForComponentImages(componentIds?: string[]): Promise<void> {
  const ids = componentIds ?? [...images.keys()];
  const pending = ids
    .map((id) => ensureImage(id))
    .filter((img): img is HTMLImageElement => !!img && !img.complete)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    );
  return Promise.all(pending).then(() => undefined);
}
