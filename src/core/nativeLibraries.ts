/**
 * Native System Design libraries bundled with Archidraw.
 * Loaded from .archidrawlib files in ./assets/libraries/.
 */

import { registerCustomAsset } from "./componentAssets";
import { parseExcalidrawLib } from "./excalidrawImport";
import type { LibraryItem } from "./library";

export interface NativeLibrary {
  id: string;
  name: string;
  fileName: string;
  items: LibraryItem[];
}

export const NATIVE_LIBRARY_NAMES: Record<string, string> = {
  "clients-personas.archidrawlib": "Clients & Personas",
  "infrastructure-network.archidrawlib": "Infrastructure & Network",
  "compute-services.archidrawlib": "Compute & Services",
  "messaging-integration.archidrawlib": "Messaging & Integration",
  "data-storage.archidrawlib": "Data & Storage",
};

export const NATIVE_LIBRARY_ORDER = [
  "clients-personas.archidrawlib",
  "infrastructure-network.archidrawlib",
  "compute-services.archidrawlib",
  "messaging-integration.archidrawlib",
  "data-storage.archidrawlib",
] as const;

const rawModules = import.meta.glob("./assets/libraries/*.archidrawlib", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

let nativeLibraries: NativeLibrary[] = [];
const nativeItemMap = new Map<string, LibraryItem>();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resolveLibraryName(fileName: string): string {
  if (NATIVE_LIBRARY_NAMES[fileName]) return NATIVE_LIBRARY_NAMES[fileName];
  const base = fileName.replace(/\.archidrawlib$/i, "");
  return base
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" & ");
}

function findModuleRaw(fileName: string): string | undefined {
  for (const [path, content] of Object.entries(rawModules)) {
    if (path.endsWith(`/${fileName}`) || path.endsWith(fileName)) {
      return content;
    }
  }
  return undefined;
}

function buildNativeLibrary(fileName: string): NativeLibrary | null {
  const content = findModuleRaw(fileName);
  if (!content) return null;

  const displayName = resolveLibraryName(fileName);
  const libSlug = slugify(fileName.replace(/\.archidrawlib$/i, ""));
  const parsed = parseExcalidrawLib(content);

  const items: LibraryItem[] = parsed.items.map((it) => {
    const itemId = `sd-${slugify(it.name)}`;
    registerCustomAsset(itemId, it.svg);
    return {
      id: itemId,
      name: it.name,
      category: displayName,
      keywords: [displayName.toLowerCase(), it.name.toLowerCase(), "system design", "native"],
      aspect: it.aspect,
      group: libSlug,
      ...(it.nativeElements && it.nativeElements.length > 0 ? { elements: it.nativeElements } : {}),
    };
  });

  return {
    id: libSlug,
    name: displayName,
    fileName,
    items,
  };
}

export function initNativeLibraries(): void {
  if (nativeLibraries.length > 0) return;

  const loaded: NativeLibrary[] = [];
  for (const fileName of NATIVE_LIBRARY_ORDER) {
    const lib = buildNativeLibrary(fileName);
    if (!lib) continue;
    loaded.push(lib);
    for (const item of lib.items) {
      nativeItemMap.set(item.id, item);
    }
  }
  nativeLibraries = loaded;
}

// Initialise immediately so native libraries are ready at module import time
initNativeLibraries();

export function getNativeLibraries(): NativeLibrary[] {
  if (nativeLibraries.length === 0) initNativeLibraries();
  return nativeLibraries;
}

export function getAllNativeLibraryItems(): LibraryItem[] {
  if (nativeLibraries.length === 0) initNativeLibraries();
  return Array.from(nativeItemMap.values());
}

export function getNativeLibraryItem(id: string): LibraryItem | undefined {
  if (nativeLibraries.length === 0) initNativeLibraries();
  return nativeItemMap.get(id);
}

export function isNativeLibraryItem(id: string): boolean {
  if (nativeLibraries.length === 0) initNativeLibraries();
  return nativeItemMap.has(id);
}
