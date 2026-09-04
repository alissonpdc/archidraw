/**
 * Componentes salvos pelo usuário (context menu → Save → Add to Library).
 * Cada item guarda os ELEMENTOS NATIVOS da seleção (re-inseridos como grupo
 * editável) mais um SVG snapshot para o thumbnail no painel. Persistido no
 * grupo fixo "Custom" em localStorage.
 */

import {
  componentAssetDataUri,
  registerCustomAsset,
  unregisterCustomAsset,
} from "./componentAssets";
import {
  registerImportedLibraryItems,
  unregisterImportedLibraryItems,
  type LibraryItem,
} from "./library";
import { persistJson } from "./localStore";
import type { Element } from "./types";

export interface CustomLibraryItemData {
  id: string;
  name: string;
  /** elementos nativos salvos — re-adicionados como grupo, não como imagem */
  elements: Element[];
  /** snapshot SVG apenas para o preview do tile no painel */
  svg: string;
  aspect: number;
}

const STORAGE_KEY = "archidraw:customLibrary";
const NAME_PATTERN = /^custom-(\d+)$/;

let items: CustomLibraryItemData[] = [];

/** nome do grupo fixo exibido na library */
export const CUSTOM_GROUP_NAME = "Custom";

export function getCustomLibrary(): CustomLibraryItemData[] {
  return items;
}

/** próximo nome da sequência, ex. custom-3 quando o maior é custom-2 */
export function nextCustomNumber(): number {
  let max = 0;
  for (const it of items) {
    const m = it.name.match(NAME_PATTERN);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function toLibraryItem(it: CustomLibraryItemData): LibraryItem {
  return {
    id: it.id,
    name: it.name,
    category: "",
    keywords: ["custom", it.name.toLowerCase()],
    aspect: it.aspect,
    elements: it.elements,
  };
}

function registerAll(it: CustomLibraryItemData) {
  registerCustomAsset(it.id, it.svg);
  registerImportedLibraryItems([toLibraryItem(it)]);
}

function unregisterAll(it: CustomLibraryItemData) {
  unregisterCustomAsset(it.id);
  unregisterImportedLibraryItems([it.id]);
}

/** notifica a UI (LibraryPanel etc.) que o catálogo custom mudou */
export const CUSTOM_LIBRARY_CHANGE = "archidraw:customLibrary";

function notifyChange() {
  window.dispatchEvent(new CustomEvent(CUSTOM_LIBRARY_CHANGE));
}

/** re-registra itens persistidos (chamado no startup, antes do restore) */
export function initCustomLibrary(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    items = parsed.filter(
      (it): it is CustomLibraryItemData =>
        !!it &&
        typeof it === "object" &&
        typeof (it as CustomLibraryItemData).id === "string" &&
        typeof (it as CustomLibraryItemData).name === "string" &&
        Array.isArray((it as CustomLibraryItemData).elements) &&
        typeof (it as CustomLibraryItemData).svg === "string" &&
        typeof (it as CustomLibraryItemData).aspect === "number",
    );
    for (const it of items) registerAll(it);
  } catch {
    items = [];
  }
}

/**
 * Componente custom armazenado: embeddings de assets que podem ser removidos.
 * Elementos `component` guardam o asset embutido (src) para que re-inserir o
 * item continue renderizando mesmo se a biblioteca de origem for excluída —
 * excluir um item Custom da biblioteca nunca apaga elementos do canvas.
 */
function selfContained(el: Element): Element {
  if (el.type !== "component" || el.src) return el;
  const src = componentAssetDataUri(el.componentId);
  return src ? { ...el, src } : el;
}

/** adiciona a seleção como componente custom (nome custom-N) e persiste */
export function addCustomItem(
  elements: Element[],
  svg: string,
  aspect: number,
): CustomLibraryItemData {
  const name = `custom-${nextCustomNumber()}`;
  const it: CustomLibraryItemData = {
    id: name,
    name,
    elements: elements.map(selfContained),
    svg,
    aspect,
  };
  registerAll(it);
  items = [...items, it];
  persistJson(STORAGE_KEY, items);
  notifyChange();
  return it;
}

export function removeCustomItem(id: string): void {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  unregisterAll(it);
  items = items.filter((i) => i.id !== id);
  persistJson(STORAGE_KEY, items);
  notifyChange();
}