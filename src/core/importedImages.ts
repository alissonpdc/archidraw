/**
 * Imagens raster importadas pelo usuário (abrir arquivo ou colar).
 *
 * Cada imagem vira um item de biblioteca no grupo "Imported", reutilizável
 * pelo painel — o mesmo modelo dos componentes da lib (`.excalidrawlib`).
 * O `src` (data URL) é registrado como asset e o item de lib marca
 * `fill: true`, para o asset preencher o bounds inteiro do elemento.
 * Persistidas em localStorage; registradas no startup.
 */

import {
  registerImportedLibraryItems,
  unregisterImportedLibraryItems,
  type LibraryItem,
} from "./library";
import {
  registerImageAsset,
  unregisterCustomAsset,
} from "./componentAssets";

export interface ImportedImageData {
  id: string;
  /** nome de exibição (nome do arquivo sem extensão) */
  name: string;
  /** data URL da imagem (data:image/png;base64,...) */
  src: string;
  /** proporção largura/altura da imagem original */
  aspect: number;
}

export interface ImportedImageInput {
  src: string;
  name: string;
  naturalWidth: number;
  naturalHeight: number;
}

const STORAGE_KEY = "archidraw:importedImages";
const GROUP_NAME = "Imported";
/** id de grupo no catálogo (library.ts) dos itens de imagem */
export const IMPORTED_IMAGES_GROUP = "imported-images";

let images: ImportedImageData[] = [];

function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function toLibraryItem(img: ImportedImageData): LibraryItem {
  return {
    id: img.id,
    name: img.name,
    category: GROUP_NAME,
    keywords: ["image", img.name.toLowerCase()],
    aspect: img.aspect,
    group: IMPORTED_IMAGES_GROUP,
    fill: true,
    src: img.src,
  };
}

function registerAll() {
  for (const img of images) registerImageAsset(img.id, img.src);
  registerImportedLibraryItems(images.map(toLibraryItem));
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
  } catch {
    // best-effort: pode estourar quota com imagens grandes
  }
}

function sanitize(raw: unknown): ImportedImageData[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (im): im is ImportedImageData =>
        !!im &&
        typeof im === "object" &&
        typeof (im as ImportedImageData).id === "string" &&
        typeof (im as ImportedImageData).name === "string" &&
        typeof (im as ImportedImageData).src === "string",
    )
    .map((im) => {
      const a = im.aspect;
      return {
        ...im,
        aspect: typeof a === "number" && isFinite(a) && a > 0 ? a : 1,
      };
    });
}

/** restaura imagens persistidas e as re-registra (chamado no startup) */
export function initImportedImages(): void {
  try {
    images = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    registerAll();
  } catch {
    images = [];
  }
}

export function getImportedImages(): ImportedImageData[] {
  return images;
}

/**
 * registra uma imagem importada/colada como item de lib (grupo "Imported").
 * deduplica por conteúdo: o data URL é idêntico para os mesmos bytes, então a
 * mesma imagem reusa o item existente em vez de duplicar no painel.
 */
export function addImportedImage(input: ImportedImageInput): ImportedImageData | null {
  if (!input.src || input.naturalWidth <= 0 || input.naturalHeight <= 0) {
    return null;
  }
  const existing = images.find((im) => im.src === input.src);
  if (existing) return existing;
  const img: ImportedImageData = {
    id: `img-${makeId()}`,
    name: input.name.trim() || "Imported image",
    src: input.src,
    aspect: input.naturalWidth / input.naturalHeight,
  };
  registerImageAsset(img.id, img.src);
  registerImportedLibraryItems([toLibraryItem(img)]);
  images = [...images, img];
  persist();
  return img;
}

/** remove um item do grupo "Imported" (elementos já colocados ficam órfãos) */
export function removeImportedImage(id: string): void {
  const img = images.find((im) => im.id === id);
  if (!img) return;
  unregisterCustomAsset(img.id);
  unregisterImportedLibraryItems([img.id]);
  images = images.filter((im) => im.id !== id);
  persist();
}