import { registerCustomAsset } from "./componentAssets";
import { parseExcalidrawLib } from "./excalidrawImport";
import type { LibraryItem } from "./library";
import {
  NATIVE_LIBRARY_ENTRIES,
  NATIVE_LIBRARIES_MAP,
  NATIVE_LIBRARIES,
} from "./nativeLibrariesMap";

export { NATIVE_LIBRARIES_MAP, NATIVE_LIBRARIES };

export interface NativeLibrary {
  id: string;
  name: string;
  fileName: string;
  items: LibraryItem[];
}

export const NATIVE_LIBRARY_NAMES: Record<string, string> = {
  "clients-devices.archidrawlib": "Clients & Devices",
  "infra-network.archidrawlib": "Infrastructure & Network",
  "compute-services.archidrawlib": "Compute & Services",
  "data-storage.archidrawlib": "Data & Storage",
  "messaging-events.archidrawlib": "Messaging & Events",
  "security-identity.archidrawlib": "Security & Identity",
  "observability-ops.archidrawlib": "Observability & Operations",
  "platform-integrations.archidrawlib": "Platform & Integrations",
};

export const NATIVE_LIBRARY_ORDER = [
  "clients-devices.archidrawlib",
  "infra-network.archidrawlib",
  "compute-services.archidrawlib",
  "data-storage.archidrawlib",
  "messaging-events.archidrawlib",
  "security-identity.archidrawlib",
  "observability-ops.archidrawlib",
  "platform-integrations.archidrawlib",
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

function findModuleRaw(fileName: string): string {
  for (const [path, content] of Object.entries(rawModules)) {
    if (path.endsWith(`/${fileName}`) || path.endsWith(fileName)) {
      return content;
    }
  }
  return "";
}

function buildNativeLibrary(displayName: string, fileName: string): NativeLibrary {
  const content = findModuleRaw(fileName);
  const libSlug = slugify(fileName.replace(/\.archidrawlib$/i, ""));
  const parsed = parseExcalidrawLib(content);

  const items: LibraryItem[] = parsed.items.map((it) => {
    const itemId = `sd-${libSlug}-${slugify(it.name)}`;
    registerCustomAsset(itemId, it.svg);
    return {
      id: itemId,
      name: it.name,
      category: displayName,
      keywords: [displayName.toLowerCase(), it.name.toLowerCase(), "system design", "native"],
      aspect: it.aspect,
      group: libSlug,
      elements: it.nativeElements,
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
  for (const [displayName, fileName] of NATIVE_LIBRARY_ENTRIES) {
    const lib = buildNativeLibrary(displayName, fileName);
    loaded.push(lib);
    for (const item of lib.items) {
      nativeItemMap.set(item.id, item);
    }
  }
  nativeLibraries = loaded;
}

initNativeLibraries();

export function getNativeLibraries(): NativeLibrary[] {
  return nativeLibraries;
}

export function getAllNativeLibraryItems(): LibraryItem[] {
  return Array.from(nativeItemMap.values());
}

export function getNativeLibraryItem(id: string): LibraryItem | undefined {
  return nativeItemMap.get(id);
}

export function isNativeLibraryItem(id: string): boolean {
  return nativeItemMap.has(id);
}
