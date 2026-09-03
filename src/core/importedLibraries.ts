/**
 * Bibliotecas importadas de arquivos `.excalidrawlib`.
 * Cada arquivo vira um grupo na library (nome = nome do arquivo),
 * com os itens registrados como assets de imagem (SVG → data URI).
 * Persistidas em localStorage; registradas no startup.
 */

import {
  parseExcalidrawLib,
  ExcalidrawLibParseError,
} from "./excalidrawImport";
import {
  registerCustomAsset,
  unregisterCustomAsset,
} from "./componentAssets";
import {
  registerImportedLibraryItems,
  unregisterImportedLibraryItems,
  type LibraryItem,
} from "./library";
import { makeReuseId, persistJson } from "./localStore";

export interface ImportedLibraryItemData {
  id: string;
  name: string;
  svg: string;
  aspect: number;
}

export interface ImportedLibrary {
  id: string;
  /** nome do grupo = nome do arquivo sem extensão */
  name: string;
  items: ImportedLibraryItemData[];
}

const STORAGE_KEY = "archidraw:importedLibraries";

let libraries: ImportedLibrary[] = [];

/** nome do grupo a partir do nome do arquivo */
export function groupNameFromFile(filename: string): string {
  const base = filename.replace(/\.(excalidrawlib|json)$/i, "").trim();
  const cleaned = base.replace(/[-_]+/g, " ").trim();
  return cleaned || "Imported library";
}

function toLibraryItem(lib: ImportedLibrary, it: ImportedLibraryItemData): LibraryItem {
  return {
    id: it.id,
    name: it.name,
    category: "",
    keywords: [lib.name.toLowerCase()],
    aspect: it.aspect,
    group: lib.id,
  };
}

function registerAll(lib: ImportedLibrary) {
  for (const it of lib.items) {
    registerCustomAsset(it.id, it.svg);
  }
  registerImportedLibraryItems(lib.items.map((it) => toLibraryItem(lib, it)));
}

function unregisterAll(lib: ImportedLibrary) {
  for (const it of lib.items) {
    unregisterCustomAsset(it.id);
  }
  unregisterImportedLibraryItems(lib.items.map((it) => it.id));
}

/** restaura bibliotecas persistidas e as re-registra (chamado no startup) */
export function initImportedLibraries(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    libraries = parsed.filter(
      (l): l is ImportedLibrary =>
        !!l &&
        typeof l === "object" &&
        typeof (l as ImportedLibrary).id === "string" &&
        typeof (l as ImportedLibrary).name === "string" &&
        Array.isArray((l as ImportedLibrary).items),
    );
    for (const lib of libraries) registerAll(lib);
  } catch {
    libraries = [];
  }
}

export function getImportedLibraries(): ImportedLibrary[] {
  return libraries;
}

export function removeImportedLibrary(id: string): void {
  const lib = libraries.find((l) => l.id === id);
  if (!lib) return;
  unregisterAll(lib);
  libraries = libraries.filter((l) => l.id !== id);
  persistJson(STORAGE_KEY, libraries);
}

/**
 * importa um arquivo `.excalidrawlib`: parseia, registra os itens como
 * componentes e retorna a nova biblioteca (grupo) criada
 */
export async function importExcalidrawLibFile(file: File): Promise<ImportedLibrary> {
  const text = await file.text();
  const { items } = parseExcalidrawLib(text);
  const lib: ImportedLibrary = {
    id: makeReuseId(),
    name: groupNameFromFile(file.name),
    items: items.map((it, i) => ({
      id: `imp-${makeReuseId()}-${i}`,
      name: it.name,
      svg: it.svg,
      aspect: it.aspect,
    })),
  };
  registerAll(lib);
  libraries = [...libraries, lib];
  persistJson(STORAGE_KEY, libraries);
  return lib;
}

export { ExcalidrawLibParseError };