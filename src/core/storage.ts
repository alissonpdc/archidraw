import type { Editor } from "./editor";
import type { ArrowBinding, ArrowElement, Camera, Document, Element, LineElement } from "./types";
import { addImportedImage } from "./importedImages";

const STORAGE_KEY = "archidraw:workspace";
export const SCHEMA_VERSION = 2;

interface TabData {
  id: string;
  name: string;
  doc: Document;
  camera: Camera;
}

export interface WorkspaceData {
  schemaVersion: number;
  activeTabId: string;
  tabs: TabData[];
}

/** serializes workspace (all tabs) to a portable JSON string */
export function serialize(tabs: TabData[], activeTabId: string): string {
  const data: WorkspaceData = {
    schemaVersion: SCHEMA_VERSION,
    activeTabId,
    tabs,
  };
  return JSON.stringify(data);
}

function isValidCamera(c: unknown): c is Camera {
  return (
    typeof c === "object" &&
    c !== null &&
    typeof (c as Camera).zoom === "number" &&
    typeof (c as Camera).scrollX === "number" &&
    typeof (c as Camera).scrollY === "number"
  );
}

function isValidDoc(d: unknown): d is Document {
  return (
    typeof d === "object" &&
    d !== null &&
    Array.isArray((d as Document).elements)
  );
}

/** anchor-side → normalized position within the element bounds */
const LEGACY_ANCHOR_POS: Record<string, [number, number]> = {
  top: [0.5, 0],
  right: [1, 0.5],
  bottom: [0.5, 1],
  left: [0, 0.5],
  center: [0.5, 0.5],
};

/** migrates legacy anchor-based edge bindings to normalized outline positions */
function migrateBinding(b: unknown): unknown {
  if (typeof b !== "object" || b === null) return b;
  const rec = b as Record<string, unknown>;
  if (typeof rec.anchor !== "string") return b;
  const [nx, ny] = LEGACY_ANCHOR_POS[rec.anchor] ?? [0.5, 0.5];
  return { elementId: rec.elementId, nx, ny };
}

/** legacy anchor-based bindings carry an `anchor` field */
const needsBindingMigration = (b: unknown): boolean =>
  typeof b === "object" && b !== null && "anchor" in b;

/** view of an element's optional edge bindings (only lines/arrows have them) */
type WithBindings = Partial<Pick<LineElement | ArrowElement, "startBinding" | "endBinding">>;

/**
 * migra elementos "image" legados (pré-unificação) para componentes de lib:
 * o `src` vinha embutido no elemento; agora vira um item do grupo "Imported"
 * (asset registrado) e o elemento passa a referenciar o componentId. Retorna
 * null para imagens inválidas (sem src/dimensões), que são descartadas.
 */
function migrateLegacyImage(raw: Element): Element | null {
  const legacy = raw as unknown as Record<string, unknown>;
  if (legacy.type !== "image") return raw;
  const item = addImportedImage({
    src: typeof legacy.src === "string" ? legacy.src : "",
    name: "Imported image",
    naturalWidth:
      typeof legacy.naturalWidth === "number" && legacy.naturalWidth > 0
        ? legacy.naturalWidth
        : typeof legacy.width === "number"
          ? Math.abs(legacy.width)
          : 1,
    naturalHeight:
      typeof legacy.naturalHeight === "number" && legacy.naturalHeight > 0
        ? legacy.naturalHeight
        : typeof legacy.height === "number"
          ? Math.abs(legacy.height)
          : 1,
  });
  if (!item) return null;
  const { src: _src, naturalWidth: _w, naturalHeight: _h, ...rest } = legacy;
  return {
    ...(rest as Record<string, unknown>),
    type: "component" as const,
    componentId: item.id,
  } as unknown as Element;
}

/** fills style defaults on elements saved before strokeStyle/roughness/borderRadius existed */
function normalizeDoc(doc: Document): Document {
  let changed = false;
  const elements = doc.elements
    .map(migrateLegacyImage)
    .filter((el): el is Element => el !== null)
    .map((el) => {
      let next: Document["elements"][number] = el;
      if (
        el.strokeStyle === undefined ||
        el.roughness === undefined ||
        el.borderRadius === undefined
      ) {
        next = {
          ...el,
          strokeStyle: el.strokeStyle ?? ("solid" as const),
          roughness: el.roughness ?? (0 as const),
          borderRadius: el.borderRadius ?? 0,
        };
      }
      const bindings = next as Element & WithBindings;
      if (
        needsBindingMigration(bindings.startBinding) ||
        needsBindingMigration(bindings.endBinding)
      ) {
        next = {
          ...next,
          startBinding: needsBindingMigration(bindings.startBinding)
            ? (migrateBinding(bindings.startBinding) as ArrowBinding)
            : bindings.startBinding,
          endBinding: needsBindingMigration(bindings.endBinding)
            ? (migrateBinding(bindings.endBinding) as ArrowBinding)
            : bindings.endBinding,
        } as Element;
      }
      if (next !== el) {
        changed = true;
      }
      return next;
    })
    .filter((el): el is Element => el !== null);
  return changed ? { ...doc, elements } : doc;
}

/** migrates legacy v1 single-doc workspace to v2 tabs envelope */
function migrateV1(data: { doc?: unknown; camera?: unknown }): WorkspaceData | null {
  if (!isValidDoc(data.doc) || !isValidCamera(data.camera)) return null;
  const id = "tab_1";
  return {
    schemaVersion: SCHEMA_VERSION,
    activeTabId: id,
    tabs: [{ id, name: "Diagram 1", doc: normalizeDoc(data.doc), camera: data.camera }],
  };
}

/**
 * parses and validates a serialized workspace.
 * returns null for invalid JSON, unsupported schema, or malformed structure.
 */
export function parse(json: string): WorkspaceData | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;

  // legacy single-diagram format
  if (d.schemaVersion === 1) return migrateV1(d);

  if (d.schemaVersion !== SCHEMA_VERSION) return null;
  if (typeof d.activeTabId !== "string") return null;
  if (!Array.isArray(d.tabs) || d.tabs.length === 0) return null;

  const tabs: TabData[] = [];
  for (const t of d.tabs) {
    if (
      typeof t !== "object" ||
      t === null ||
      typeof (t as TabData).id !== "string" ||
      typeof (t as TabData).name !== "string" ||
      !isValidDoc((t as TabData).doc) ||
      !isValidCamera((t as TabData).camera)
    ) {
      return null;
    }
    tabs.push({
      ...t,
      doc: normalizeDoc((t as TabData).doc),
    } as TabData);
  }
  return { schemaVersion: SCHEMA_VERSION, activeTabId: d.activeTabId, tabs };
}

// ---- localStorage -----------------------------------------------------

export function saveToStorage(json: string) {
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // quota exceeded or storage unavailable — persistence is best-effort
  }
}

export function loadFromStorage(): WorkspaceData | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? parse(json) : null;
  } catch {
    return null;
  }
}

export function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---- autosave ---------------------------------------------------------

export function attachAutosave(
  editor: Editor,
  delayMs = 400,
  onSaved?: () => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = editor.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      saveToStorage(editor.serializeState());
      onSaved?.();
      timer = null;
    }, delayMs);
  });
  // flush immediately when leaving the page
  const flush = () => saveToStorage(editor.serializeState());
  window.addEventListener("beforeunload", flush);
  return () => {
    unsubscribe();
    window.removeEventListener("beforeunload", flush);
    if (timer) clearTimeout(timer);
  };
}
