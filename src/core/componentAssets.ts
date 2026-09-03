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

const kubernetesModules = import.meta.glob("./assets/kubernetes/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const dataUris = new Map<string, string>();
for (const [path, svg] of Object.entries(modules)) {
  const m = path.match(/\/([^/]+)\.svg$/);
  if (m) dataUris.set(m[1], `data:image/svg+xml;base64,${btoa(svg)}`);
}
for (const [path, svg] of Object.entries(kubernetesModules)) {
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

// ---- custom assets (bibliotecas importadas .excalidrawlib) ---------------

/** registra um asset dinâmico (SVG string) — ex. itens importados do Excalidraw */
export function registerCustomAsset(componentId: string, svg: string): void {
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  dataUris.set(componentId, uri);
  images.delete(componentId);
}

/** registra um asset de imagem raster via data URI pronto (ex. PNG colado) */
export function registerImageAsset(componentId: string, dataUri: string): void {
  dataUris.set(componentId, dataUri);
  images.delete(componentId);
}

export function unregisterCustomAsset(componentId: string): void {
  dataUris.delete(componentId);
  images.delete(componentId);
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

// ---- self-contained raster images (data URI embedded in the element) -----

const bySrc = new Map<string, HTMLImageElement>();

/** cached <img> for a self-contained data-URI src; returns non-null only
 *  after it has decoded (naturalWidth > 0). The element stays cached so a
 *  not-yet-loaded src is never restarted on the next frame. */
export function getCachedImage(src: string): HTMLImageElement | null {
  let img = bySrc.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    bySrc.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** resolves once the data URI has decoded (or errored) */
export function waitForImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}
