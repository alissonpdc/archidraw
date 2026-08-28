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

const STORAGE_KEY = "archidraw:importedLibraries:v3";
/** chaves antigas (SVGs gerados por versões bugadas do parser) — descartadas no init */
const LEGACY_STORAGE_KEYS = [
  "archidraw:importedLibraries",
  "archidraw:importedLibraries:v2",
];

let libraries: ImportedLibrary[] = [];

function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

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

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(libraries));
  } catch {
    // best-effort: pode estourar quota com bibliotecas grandes
  }
}

/** restaura bibliotecas persistidas e as re-registra (chamado no startup) */
export function initImportedLibraries(): void {
  try {
    // descarta SVGs persistidos por versões antigas do parser (inválidos)
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
  } catch {
    // best-effort
  }
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
    // descarta itens com SVG inválido (não decodificável como imagem)
    for (const lib of libraries) {
      lib.items = lib.items.filter(
        (it) => typeof it.svg === "string" && !/NaN|undefined/.test(it.svg),
      );
    }
    libraries = libraries.filter((l) => l.items.length > 0);
    for (const lib of libraries) registerAll(lib);
    persist();
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
  persist();
}

/**
 * importa um arquivo `.excalidrawlib`: parseia, registra os itens como
 * componentes e retorna a nova biblioteca (grupo) criada
 */
export async function importExcalidrawLibFile(file: File): Promise<ImportedLibrary> {
  const text = await file.text();
  const { items } = parseExcalidrawLib(text);
  const lib: ImportedLibrary = {
    id: makeId(),
    name: groupNameFromFile(file.name),
    items: items.map((it, i) => ({
      id: `imp-${makeId()}-${i}`,
      name: it.name,
      svg: it.svg,
      aspect: it.aspect,
    })),
  };
  registerAll(lib);
  libraries = [...libraries, lib];
  persist();
  return lib;
}

export { ExcalidrawLibParseError };