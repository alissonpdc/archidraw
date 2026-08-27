import { History } from "./history";
import { hitTest, elementsInBounds } from "./hitTest";
import { parse, serialize } from "./storage";
import { render, type RenderColors } from "./renderer";
import type {
  AnchorSide,
  ArrowBinding,
  ArrowElement,
  Bounds,
  Camera,
  ComponentElement,
  Document,
  Element,
  LineType,
  Point,
  RectangleElement,
  Roughness,
  StrokeStyle,
  TextElement,
  Tool,
} from "./types";
import {
  screenToScene,
  newId,
  normalizeBounds,
  sceneToScreen,
  translateElement,
  unionBounds,
  elementBounds,
  measureText,
} from "./utils";
import { DEFAULT_BG, DEFAULT_STROKE } from "./types";
import { getLibraryItem } from "./library";
import { elementVisualBounds } from "./renderer";

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_CURSOR: Record<HandleId, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

/** handle hit tolerance in SCREEN pixels */
const HANDLE_TOLERANCE_PX = 6;
/** snap activation threshold in scene units */
const SNAP_TOLERANCE = 4;

export interface SnapGuide {
  orientation: "h" | "v";
  pos: number;
}

function handlePosition(handle: HandleId, b: Bounds): Point {
  const cx = (b.x1 + b.x2) / 2;
  const cy = (b.y1 + b.y2) / 2;
  switch (handle) {
    case "nw":
      return { x: b.x1, y: b.y1 };
    case "n":
      return { x: cx, y: b.y1 };
    case "ne":
      return { x: b.x2, y: b.y1 };
    case "e":
      return { x: b.x2, y: cy };
    case "se":
      return { x: b.x2, y: b.y2 };
    case "s":
      return { x: cx, y: b.y2 };
    case "sw":
      return { x: b.x1, y: b.y2 };
    case "w":
      return { x: b.x1, y: cy };
  }
}

function resizeHandleAt(
  scenePoint: Point,
  b: Bounds,
  zoom: number,
  allowed: HandleId[] = HANDLES,
): HandleId | null {
  for (const h of allowed) {
    const p = handlePosition(h, b);
    if (Math.hypot(scenePoint.x - p.x, scenePoint.y - p.y) * zoom <= HANDLE_TOLERANCE_PX) {
      return h;
    }
  }
  return null;
}

const ARROW_HANDLES: HandleId[] = ["nw", "se"];

const BIND_TOLERANCE = 20; // scene units

let _offCanvas: HTMLCanvasElement | null = null;
let _offCtx: CanvasRenderingContext2D | null = null;
function visualBounds(el: Element): Bounds {
  if (!_offCanvas) {
    _offCanvas = document.createElement("canvas");
    _offCtx = _offCanvas.getContext("2d")!;
  }
  return elementVisualBounds(_offCtx!, el);
}

function anchorPoint(el: Element, anchor: AnchorSide): Point {
  const b = elementBounds(el);
  switch (anchor) {
    case "top": return { x: (b.x1 + b.x2) / 2, y: b.y1 };
    case "bottom": return { x: (b.x1 + b.x2) / 2, y: b.y2 };
    case "left": return { x: b.x1, y: (b.y1 + b.y2) / 2 };
    case "right": return { x: b.x2, y: (b.y1 + b.y2) / 2 };
    case "center": return { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
  }
}

function findNearestBinding(
  point: Point,
  elements: Element[],
  excludeId: string,
): ArrowBinding | null {
  let best: { dist: number; binding: ArrowBinding } | null = null;
  for (const el of elements) {
    if (el.id === excludeId || el.type === "arrow") continue;
    const anchors: AnchorSide[] = ["top", "right", "bottom", "left"];
    for (const anchor of anchors) {
      const ap = anchorPoint(el, anchor);
      const dist = Math.hypot(point.x - ap.x, point.y - ap.y);
      if (dist <= BIND_TOLERANCE && (!best || dist < best.dist)) {
        best = { dist, binding: { elementId: el.id, anchor } };
      }
    }
  }
  return best?.binding ?? null;
}

type Interaction =
  | { kind: "none" }
  | { kind: "pan"; lastScreen: Point }
  | { kind: "draw"; startScene: Point; id: string }
  | { kind: "move"; startScene: Point; originals: Element[]; moved?: boolean }
  | { kind: "resize"; handle: HandleId; original: Element }
  | { kind: "marquee"; startScene: Point };

export interface TabInfo {
  id: string;
  name: string;
}

interface TabData extends TabInfo {
  doc: Document;
  camera: Camera;
}

export interface EditorSnapshot {
  doc: Document;
  camera: Camera;
  tool: Tool;
  selectedIds: ReadonlySet<string>;
  editingTextId: string | null;
  editingKind: "text" | "label";
  tabs: readonly TabInfo[];
  activeTabId: string;
  hasDraft: boolean;
}

let tabSeq = 0;

export class Editor {
  private tabs: TabData[] = [
    { id: `tab_${++tabSeq}`, name: "Diagrama 1", doc: { schemaVersion: 1, elements: [] }, camera: { scrollX: 0, scrollY: 0, zoom: 1 } },
  ];
  private activeTabId = this.tabs[0].id;
  private tool: Tool = "selection";
  private selectedIds = new Set<string>();
  private editingTextId: string | null = null;
  private editingKind: "text" | "label" = "text";
  private editingInitial: string | null = null;

  private draft: Element | null = null;
  private marquee: { x1: number; y1: number; x2: number; y2: number } | null =
    null;
  private guides: SnapGuide[] | null = null;
  private interaction: Interaction = { kind: "none" };
  private spacePressed = false;
  private pasteCount = 0;
  private lastDefaultStroke: string = DEFAULT_STROKE;
  private lastStrokeStyle: StrokeStyle = "solid";
  private lastRoughness: Roughness = 0;
  private lastBorderRadius = 0;

  private listeners = new Set<() => void>();
  private snapshotCache: EditorSnapshot | null = null;

  // ---- active-tab accessors --------------------------------------------
  private get tab(): TabData {
    return this.tabs.find((t) => t.id === this.activeTabId)!;
  }

  /** document of the ACTIVE tab */
  private get doc(): Document {
    return this.tab.doc;
  }

  private set doc(d: Document) {
    this.tab.doc = d;
  }

  /** camera of the ACTIVE tab */
  private get camera(): Camera {
    return this.tab.camera;
  }

  private set camera(c: Camera) {
    this.tab.camera = c;
  }

  private get history(): History {
    let h = this.histories.get(this.activeTabId);
    if (!h) {
      h = new History();
      this.histories.set(this.activeTabId, h);
    }
    return h;
  }

  private histories = new Map<string, History>();

  // ---- subscriptions -------------------------------------------------
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  /** stable snapshot reference — rebuilt only when state changes (emit) */
  getSnapshot = (): EditorSnapshot => {
    if (!this.snapshotCache) {
      this.snapshotCache = {
        doc: this.doc,
        camera: this.camera,
        tool: this.tool,
        selectedIds: this.selectedIds,
        editingTextId: this.editingTextId,
        editingKind: this.editingKind,
        tabs: this.tabs.map(({ id, name }) => ({ id, name })),
        activeTabId: this.activeTabId,
        hasDraft: this.draft !== null,
      };
    }
    return this.snapshotCache;
  };

  private emit() {
    this.snapshotCache = null;
    for (const cb of this.listeners) cb();
  }

  // ---- commands ------------------------------------------------------
  setTool(tool: Tool) {
    this.tool = tool;
    if (tool !== "selection") this.selectedIds.clear();
    this.emit();
  }

  deleteSelected() {
    if (this.selectedIds.size === 0) return;
    this.commitHistory();
    const deletedIds = this.selectedIds;
    this.doc = {
      ...this.doc,
      elements: this.doc.elements
        .filter((el) => !deletedIds.has(el.id))
        .map((el) => {
          if (el.type !== "arrow") return el;
          const arrow = el;
          const startBinding = arrow.startBinding && deletedIds.has(arrow.startBinding.elementId)
            ? undefined : arrow.startBinding;
          const endBinding = arrow.endBinding && deletedIds.has(arrow.endBinding.elementId)
            ? undefined : arrow.endBinding;
          if (startBinding !== arrow.startBinding || endBinding !== arrow.endBinding) {
            return { ...arrow, startBinding, endBinding };
          }
          return el;
        }),
    };
    this.selectedIds.clear();
    this.emit();
  }

  duplicateSelected() {
    if (this.selectedIds.size === 0) return;
    this.commitHistory();
    const clones: Element[] = [];
    for (const el of this.doc.elements) {
      if (!this.selectedIds.has(el.id)) continue;
      clones.push({ ...el, id: newId(), x: el.x + 10, y: el.y + 10 });
    }
    this.doc = { ...this.doc, elements: [...this.doc.elements, ...clones] };
    this.selectedIds = new Set(clones.map((c) => c.id));
    this.emit();
  }

  // ---- layer reorder ---------------------------------------------------
  private reorderElements(ids: string[], direction: "front" | "back" | "forward" | "backward") {
    if (ids.length === 0) return;
    this.commitHistory();
    const elems = [...this.doc.elements];
    const idSet = new Set(ids);

    if (direction === "front") {
      const toMove = elems.filter((el) => idSet.has(el.id));
      const rest = elems.filter((el) => !idSet.has(el.id));
      this.doc = { ...this.doc, elements: [...rest, ...toMove] };
    } else if (direction === "back") {
      const toMove = elems.filter((el) => idSet.has(el.id));
      const rest = elems.filter((el) => !idSet.has(el.id));
      this.doc = { ...this.doc, elements: [...toMove, ...rest] };
    } else if (direction === "forward") {
      for (let i = elems.length - 2; i >= 0; i--) {
        if (idSet.has(elems[i].id) && !idSet.has(elems[i + 1].id)) {
          [elems[i], elems[i + 1]] = [elems[i + 1], elems[i]];
        }
      }
      this.doc = { ...this.doc, elements: elems };
    } else if (direction === "backward") {
      for (let i = 1; i < elems.length; i++) {
        if (idSet.has(elems[i].id) && !idSet.has(elems[i - 1].id)) {
          [elems[i], elems[i - 1]] = [elems[i - 1], elems[i]];
        }
      }
      this.doc = { ...this.doc, elements: elems };
    }
    this.emit();
  }

  bringToFront() { this.reorderElements([...this.selectedIds], "front"); }
  sendToBack() { this.reorderElements([...this.selectedIds], "back"); }
  bringForward() { this.reorderElements([...this.selectedIds], "forward"); }
  sendBackward() { this.reorderElements([...this.selectedIds], "backward"); }

  // ---- multi-select alignment -----------------------------------------
  alignSelected(direction: "left" | "center" | "right" | "top" | "middle" | "bottom") {
    if (this.selectedIds.size < 2) return;
    this.commitHistory();
    const selected = this.doc.elements.filter((el) => this.selectedIds.has(el.id));
    const bounds = selected.map((el) => elementBounds(el));

    let anchor: number;
    if (direction === "left") anchor = Math.min(...bounds.map((b) => b.x1));
    else if (direction === "right") anchor = Math.max(...bounds.map((b) => b.x2));
    else if (direction === "center") {
      const minX = Math.min(...bounds.map((b) => b.x1));
      const maxX = Math.max(...bounds.map((b) => b.x2));
      anchor = (minX + maxX) / 2;
    } else if (direction === "top") anchor = Math.min(...bounds.map((b) => b.y1));
    else if (direction === "bottom") anchor = Math.max(...bounds.map((b) => b.y2));
    else {
      const minY = Math.min(...bounds.map((b) => b.y1));
      const maxY = Math.max(...bounds.map((b) => b.y2));
      anchor = (minY + maxY) / 2;
    }

    this.doc = {
      ...this.doc,
      elements: this.doc.elements.map((el) => {
        if (!this.selectedIds.has(el.id)) return el;
        const b = elementBounds(el);
        const w = b.x2 - b.x1;
        const h = b.y2 - b.y1;
        if (direction === "left" || direction === "right" || direction === "center") {
          const newX = direction === "left" ? anchor : direction === "right" ? anchor - w : anchor - w / 2;
          return { ...el, x: newX, width: el.width } as Element;
        } else {
          const newY = direction === "top" ? anchor : direction === "bottom" ? anchor - h : anchor - h / 2;
          return { ...el, y: newY, height: el.height } as Element;
        }
      }),
    };
    this.emit();
  }

  selectAll() {
    this.tool = "selection";
    this.selectedIds = new Set(this.doc.elements.map((el) => el.id));
    this.emit();
  }

  /**
   * insere um componente da biblioteca no centro do viewport (ou num
   * ponto de tela dado, ex. drop do painel) e o seleciona
   */
  insertComponent(componentId: string, screenPoint?: Point) {
    const item = getLibraryItem(componentId);
    if (!item) return;
    const screen = screenPoint ?? this.screenCenter();
    const scene = screenToScene(screen, this.camera);
    // ícone preenche o bounds do elemento, então o tamanho de inserção
    // é o tamanho visual do ícone
    const size = 64;
    this.commitHistory();
    const el: ComponentElement = {
      id: newId(),
      type: "component",
      componentId: componentId,
      x: scene.x - size / 2,
      y: scene.y - size / 2,
      width: size,
      height: size,
      label: item.name,
      strokeColor: this.lastDefaultStroke,
      backgroundColor: DEFAULT_BG,
      // sem contorno por padrão: apenas ícone + nome
      strokeWidth: 0,
      opacity: 1,
      strokeStyle: "solid",
      roughness: 0,
      borderRadius: 20,
    };
    this.doc = { ...this.doc, elements: [...this.doc.elements, el] };
    this.tool = "selection";
    this.selectedIds = new Set([el.id]);
    this.emit();
  }

  clearSelection() {
    this.selectedIds.clear();
    this.editingTextId = null;
    this.editingKind = "text";
    this.editingInitial = null;
    this.emit();
  }

  // ---- tabs ------------------------------------------------------------
  private nextTabName(): string {
    let max = 0;
    for (const t of this.tabs) {
      const m = t.name.match(/^Diagrama (\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `Diagrama ${max + 1}`;
  }

  addTab() {
    const tab: TabData = {
      id: `tab_${Date.now().toString(36)}_${++tabSeq}`,
      name: this.nextTabName(),
      doc: { schemaVersion: 1, elements: [] },
      camera: { scrollX: 0, scrollY: 0, zoom: 1 },
    };
    this.tabs = [...this.tabs, tab];
    this.activateTab(tab.id);
  }

  switchTab(id: string) {
    if (id === this.activeTabId) return;
    if (!this.tabs.some((t) => t.id === id)) return;
    this.activateTab(id);
  }

  renameTab(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.tabs = this.tabs.map((t) => (t.id === id ? { ...t, name: trimmed } : t));
    this.emit();
  }

  /** move uma aba para a posição toIndex (ordem persiste no workspace) */
  reorderTab(id: string, toIndex: number) {
    const from = this.tabs.findIndex((t) => t.id === id);
    if (from === -1) return;
    const to = Math.max(0, Math.min(toIndex, this.tabs.length - 1));
    if (to === from) return;
    const next = [...this.tabs];
    const [tab] = next.splice(from, 1);
    next.splice(to, 0, tab);
    this.tabs = next;
    this.emit();
  }

  /** number of elements in a tab (used by UI before confirming close) */
  tabElementCount(id: string): number {
    return this.tabs.find((t) => t.id === id)?.doc.elements.length ?? 0;
  }

  closeTab(id: string) {
    const index = this.tabs.findIndex((t) => t.id === id);
    if (index === -1) return;

    if (this.tabs.length === 1) {
      // last tab: replace with a fresh one instead of closing
      this.histories.delete(id);
      const fresh: TabData = {
        id: `tab_${Date.now().toString(36)}_${++tabSeq}`,
        name: this.nextTabName(),
        doc: { schemaVersion: 1, elements: [] },
        camera: { scrollX: 0, scrollY: 0, zoom: 1 },
      };
      this.tabs = [fresh];
      this.activateTab(fresh.id);
      return;
    }

    this.histories.delete(id);
    this.tabs = this.tabs.filter((t) => t.id !== id);
    if (id === this.activeTabId) {
      const neighbor = this.tabs[Math.min(index, this.tabs.length - 1)];
      this.activateTab(neighbor.id);
    } else {
      this.emit();
    }
  }

  /** switches active tab and resets transient interaction state */
  private activateTab(id: string) {
    this.finishTextEdit();
    this.activeTabId = id;
    this.selectedIds.clear();
    this.editingTextId = null;
    this.draft = null;
    this.marquee = null;
    this.interaction = { kind: "none" };
    this.emit();
  }

  undo() {
    const snap = JSON.stringify(this.doc);
    const prev = this.history.undo(snap);
    if (prev) {
      this.doc = JSON.parse(prev);
      this.clearSelection();
    }
  }

  redo() {
    const snap = JSON.stringify(this.doc);
    const next = this.history.redo(snap);
    if (next) {
      this.doc = JSON.parse(next);
      this.clearSelection();
    }
  }

  canUndo() {
    return this.history.canUndo();
  }

  canRedo() {
    return this.history.canRedo();
  }

  /** call before mutating doc so undo returns to current state */
  commitHistory() {
    this.history.push(JSON.stringify(this.doc));
  }

  zoomAt(screenPoint: Point, deltaZoom: number) {
    const zoom = Math.min(8, Math.max(0.1, this.camera.zoom * deltaZoom));
    const scene = screenToScene(screenPoint, this.camera);
    this.camera = {
      zoom,
      scrollX: screenPoint.x - scene.x * zoom,
      scrollY: screenPoint.y - scene.y * zoom,
    };
    this.emit();
  }

  resetZoom() {
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const factor = 1 / this.camera.zoom;
    this.zoomAt(center, factor);
  }

  private screenCenter(): Point {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  zoomIn() {
    this.zoomAt(this.screenCenter(), 1.2);
  }

  zoomOut() {
    this.zoomAt(this.screenCenter(), 1 / 1.2);
  }

  /** fits all content into the viewport (Shift+1) */
  zoomToFit(padPx = 40) {
    const bounds = unionBounds(this.doc.elements);
    if (!bounds) return;
    const W = window.innerWidth - padPx * 2;
    const H = window.innerHeight - padPx * 2;
    const bw = Math.max(bounds.x2 - bounds.x1, 1);
    const bh = Math.max(bounds.y2 - bounds.y1, 1);
    const zoom = Math.min(8, Math.max(0.1, Math.min(W / bw, H / bh)));
    this.camera = {
      zoom,
      scrollX:
        (window.innerWidth - bw * zoom) / 2 - bounds.x1 * zoom,
      scrollY:
        (window.innerHeight - bh * zoom) / 2 - bounds.y1 * zoom,
    };
    this.emit();
  }

  // ---- double click ----------------------------------------------------
  pointerDoubleClick(screenPoint: Point) {
    if (this.tool !== "selection") return;
    const scene = screenToScene(screenPoint, this.camera);
    const hitEl = [...this.doc.elements]
      .reverse()
      .find((el) => hitTest(el, scene));

    if (hitEl?.type === "text") {
      this.beginTextEdit(hitEl.id, "text");
      this.emit();
      return;
    }
    if (
      hitEl &&
      (hitEl.type === "rectangle" ||
        hitEl.type === "arrow" ||
        hitEl.type === "component")
    ) {
      if (!this.selectedIds.has(hitEl.id)) {
        this.selectedIds = new Set([hitEl.id]);
      }
      this.commitHistory();
      this.beginTextEdit(hitEl.id, "label");
      this.emit();
      return;
    }
    // empty area: create a free text
    this.commitHistory();
    const el: TextElement = {
      id: newId(),
      type: "text",
      x: scene.x,
      y: scene.y,
      width: 0,
      height: 0,
      text: "",
      fontSize: 20,
      strokeColor: this.lastDefaultStroke,
      backgroundColor: DEFAULT_BG,
      strokeWidth: 1,
      opacity: 1,
      strokeStyle: "solid",
      roughness: 0,
      borderRadius: 0,
    };
    this.doc = { ...this.doc, elements: [...this.doc.elements, el] };
    this.beginTextEdit(el.id, "text");
    this.emit();
  }

  // ---- text / label editing -------------------------------------------
  beginTextEdit(id: string, kind: "text" | "label" = "text") {
    const el = this.doc.elements.find((e) => e.id === id);
    if (!el) return;
    this.editingTextId = id;
    this.editingKind = kind;
    this.editingInitial =
      kind === "label" && el.type !== "text"
        ? (el.label ?? "")
        : el.type === "text"
          ? el.text
          : "";
    this.emit();
  }

  updateElements(
    ids: string[],
    patch: {
      strokeColor?: string;
      backgroundColor?: string;
      strokeWidth?: number;
      opacity?: number;
      fontSize?: number;
      strokeStyle?: StrokeStyle;
      roughness?: Roughness;
      borderRadius?: number;
      fontFamily?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      textColor?: string;
      lineSpacing?: number;
      textAlign?: import("./types").TextAlign;
      textVAlign?: import("./types").TextVAlign;
      textPadding?: number;
      captionPosition?: import("./types").CaptionPosition;
      captionGap?: number;
      lineType?: LineType;
      controlPoint?: Point;
    },
  ) {
    this.doc = {
      ...this.doc,
      elements: this.doc.elements.map((el) => {
        if (!ids.includes(el.id)) return el;
        const next = { ...el, ...patch } as Element;
        // recalculate text dimensions when fontSize changes
        if (next.type === "text" && patch.fontSize !== undefined) {
          const te = next as TextElement;
          const { width, height } = measureText(te.text || " ", te.fontSize);
          te.width = Math.max(width, 8);
          te.height = height;
        }
        return next;
      }),
    };
    // remember style choices for the next created element
    if (patch.strokeStyle !== undefined) this.lastStrokeStyle = patch.strokeStyle;
    if (patch.roughness !== undefined) this.lastRoughness = patch.roughness;
    if (patch.borderRadius !== undefined && ids.length > 0)
      this.lastBorderRadius = patch.borderRadius;
    this.emit();
  }

  updateText(id: string, text: string) {
    if (this.editingKind === "label") {
      this.updateLabel(id, text);
      return;
    }
    this.doc = {
      ...this.doc,
      elements: this.doc.elements.map((el) => {
        if (!(el.id === id && el.type === "text")) return el;
        const { width, height } = measureText(text || " ", el.fontSize);
        return { ...el, text, width: Math.max(width, 8), height };
      }),
    };
    this.emit();
  }

  updateLabel(id: string, label: string) {
    this.doc = {
      ...this.doc,
      elements: this.doc.elements.map((el) =>
        el.id === id && el.type !== "text"
          ? { ...el, label: label.trim() === "" ? undefined : label }
          : el,
      ),
    };
    this.emit();
  }

  finishTextEdit() {
    const id = this.editingTextId;
    const kind = this.editingKind;
    const initial = this.editingInitial;
    this.editingTextId = null;
    this.editingKind = "text";
    this.editingInitial = null;
    if (!id) return;

    const el = this.doc.elements.find((e) => e.id === id);
    if (!el) return;

    if (kind === "label") {
      // unchanged edit: drop the history snapshot taken when editing started
      const current = el.type !== "text" ? (el.label ?? "") : "";
      if (initial !== null && current === initial) {
        this.history.pop();
      }
      this.emit();
      return;
    }

    // empty free texts are discarded regardless of how editing ended
    if (el.type === "text" && el.text.trim() === "") {
      this.doc = {
        ...this.doc,
        elements: this.doc.elements.filter((e) => e.id !== id),
      };
      this.history.pop(); // discard the creation snapshot too
    }
    this.emit();
  }

  // ---- clipboard -------------------------------------------------------
  private static CLIPBOARD_KEY = "archidraw:clipboard";

  copySelected() {
    if (this.selectedIds.size === 0) return;
    const selected = this.doc.elements.filter((el) =>
      this.selectedIds.has(el.id),
    );
    try {
      localStorage.setItem(Editor.CLIPBOARD_KEY, JSON.stringify(selected));
    } catch {
      // keep in-memory only
    }
  }

  cutSelected() {
    if (this.selectedIds.size === 0) return;
    this.copySelected();
    this.deleteSelected();
  }

  /** returns number of pasted elements */
  paste(): number {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(Editor.CLIPBOARD_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return 0;
    let items: Element[];
    try {
      items = JSON.parse(raw);
    } catch {
      return 0;
    }
    if (!Array.isArray(items) || items.length === 0) return 0;

    this.pasteCount += 1;
    const offset = 16 * this.pasteCount;
    const clones = items.map((el) => ({
      ...el,
      id: newId(),
      x: el.x + offset,
      y: el.y + offset,
    }));
    this.commitHistory();
    this.doc = { ...this.doc, elements: [...this.doc.elements, ...clones] };
    this.selectedIds = new Set(clones.map((c) => c.id));
    this.emit();
    return clones.length;
  }

  // ---- keyboard -------------------------------------------------------
  isSpacePressed() {
    return this.spacePressed;
  }

  onSpaceDown() {
    this.spacePressed = true;
    this.emit();
  }

  onSpaceUp() {
    this.spacePressed = false;
    this.emit();
  }

  // ---- pointer events (screen coords) ----------------------------------
  pointerDown(
    screenPoint: Point,
    button: number,
    modifiers: { shift: boolean; defaultStroke?: string } = { shift: false },
  ) {
    const scene = screenToScene(screenPoint, this.camera);
    const stroke = modifiers.defaultStroke ?? DEFAULT_STROKE;
    this.lastDefaultStroke = stroke;

    if (button === 1 || this.tool === "hand" || this.spacePressed) {
      this.interaction = { kind: "pan", lastScreen: screenPoint };
      return;
    }

    switch (this.tool) {
      case "rectangle":
      case "arrow": {
        this.commitHistory();
        const base = {
          id: newId(),
          strokeColor: stroke,
          backgroundColor: DEFAULT_BG,
          strokeWidth: 2,
          opacity: 1,
          strokeStyle: this.lastStrokeStyle,
          roughness: this.lastRoughness,
          borderRadius: this.lastBorderRadius,
        };
        const el: Element =
          this.tool === "rectangle"
            ? ({ ...base, type: "rectangle", x: scene.x, y: scene.y, width: 0, height: 0 } satisfies RectangleElement)
            : ({ ...base, type: "arrow", x: scene.x, y: scene.y, width: 0, height: 0 } satisfies ArrowElement);
        this.draft = el;
        this.interaction = { kind: "draw", startScene: scene, id: el.id };
        break;
      }
      case "text": {
        this.commitHistory();
        const el: TextElement = {
          id: newId(),
          type: "text",
          x: scene.x,
          y: scene.y,
          width: 0,
          height: 0,
          text: "",
          fontSize: 20,
          strokeColor: stroke,
          backgroundColor: DEFAULT_BG,
          strokeWidth: 1,
          opacity: 1,
          strokeStyle: this.lastStrokeStyle,
          roughness: this.lastRoughness,
          borderRadius: 0,
        };
        this.doc = { ...this.doc, elements: [...this.doc.elements, el] };
        this.tool = "selection";
        this.beginTextEdit(el.id);
        break;
      }
      case "selection": {
        // resize handle of the single selected element takes precedence
        if (this.selectedIds.size === 1) {
          const selected = this.doc.elements.find((el) =>
            this.selectedIds.has(el.id),
          );
          if (
            selected &&
            (selected.type === "rectangle" ||
              selected.type === "arrow" ||
              selected.type === "component")
          ) {
            const handle = resizeHandleAt(
              scene,
              visualBounds(selected),
              this.camera.zoom,
              selected.type === "arrow" ? ARROW_HANDLES : HANDLES,
            );
            if (handle) {
              this.commitHistory();
              this.interaction = {
                kind: "resize",
                handle,
                original: selected,
              };
              break;
            }
          }
        }

        const hitEl = [...this.doc.elements]
          .reverse()
          .find((el) => hitTest(el, scene));
        if (hitEl) {
          if (modifiers.shift) {
            // additive selection
            const next = new Set(this.selectedIds);
            if (next.has(hitEl.id)) {
              next.delete(hitEl.id);
            } else {
              next.add(hitEl.id);
            }
            this.selectedIds = next;
          } else if (!this.selectedIds.has(hitEl.id)) {
            this.selectedIds = new Set([hitEl.id]);
          }
          if (this.selectedIds.size > 0) {
            this.commitHistory();
            this.interaction = {
              kind: "move",
              startScene: scene,
              originals: this.doc.elements.filter((el) =>
                this.selectedIds.has(el.id),
              ),
            };
          }
        } else {
          this.selectedIds.clear();
          this.interaction = { kind: "marquee", startScene: scene };
        }
        break;
      }
    }
    this.emit();
  }

  pointerMove(screenPoint: Point) {
    const scene = screenToScene(screenPoint, this.camera);

    switch (this.interaction.kind) {
      case "pan": {
        const dx = screenPoint.x - this.interaction.lastScreen.x;
        const dy = screenPoint.y - this.interaction.lastScreen.y;
        this.interaction.lastScreen = screenPoint;
        this.camera = {
          ...this.camera,
          scrollX: this.camera.scrollX + dx,
          scrollY: this.camera.scrollY + dy,
        };
        break;
      }
      case "draw": {
        if (!this.draft) break;
        const b = normalizeBounds({
          x1: this.interaction.startScene.x,
          y1: this.interaction.startScene.y,
          x2: scene.x,
          y2: scene.y,
        });
        this.draft = {
          ...this.draft,
          x: b.x1,
          y: b.y1,
          width: b.x2 - b.x1,
          height: b.y2 - b.y1,
        };
        break;
      }
      case "move": {
        let dx = scene.x - this.interaction.startScene.x;
        let dy = scene.y - this.interaction.startScene.y;

        // smart snap guides against other elements
        const movingIds = new Set(this.interaction.originals.map((el) => el.id));
        const others = this.doc.elements.filter((el) => !movingIds.has(el.id));
        const movingBoxRaw = unionBounds(this.interaction.originals);
        if (movingBoxRaw && others.length > 0) {
          const mb = {
            x1: movingBoxRaw.x1 + dx,
            y1: movingBoxRaw.y1 + dy,
            x2: movingBoxRaw.x2 + dx,
            y2: movingBoxRaw.y2 + dy,
          };
          const vTargets: number[] = [];
          const hTargets: number[] = [];
          for (const el of others) {
            const b = elementBounds(el);
            vTargets.push(b.x1, (b.x1 + b.x2) / 2, b.x2);
            hTargets.push(b.y1, (b.y1 + b.y2) / 2, b.y2);
          }
          const tol = SNAP_TOLERANCE / this.camera.zoom;

          let bestV: { diff: number; target: number } | null = null;
          for (const t of vTargets) {
            for (const edge of [mb.x1, (mb.x1 + mb.x2) / 2, mb.x2]) {
              const diff = t - edge;
              if (
                Math.abs(diff) <= tol &&
                (!bestV || Math.abs(diff) < Math.abs(bestV.diff))
              ) {
                bestV = { diff, target: t };
              }
            }
          }
          let bestH: { diff: number; target: number } | null = null;
          for (const t of hTargets) {
            for (const edge of [mb.y1, (mb.y1 + mb.y2) / 2, mb.y2]) {
              const diff = t - edge;
              if (
                Math.abs(diff) <= tol &&
                (!bestH || Math.abs(diff) < Math.abs(bestH.diff))
              ) {
                bestH = { diff, target: t };
              }
            }
          }

          const guides: SnapGuide[] = [];
          if (bestV) {
            dx += bestV.diff;
            guides.push({ orientation: "v", pos: bestV.target });
          }
          if (bestH) {
            dy += bestH.diff;
            guides.push({ orientation: "h", pos: bestH.target });
          }
          this.guides = guides.length > 0 ? guides : null;
        } else {
          this.guides = null;
        }

        const moved = new Map(
          this.interaction.originals.map((el) => [
            el.id,
            translateElement(el, dx, dy),
          ]),
        );
        this.interaction.moved =
          Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6;
        // update arrow bindings when bound elements move
        const movedIds = new Set(moved.keys());
        const updatedElements = this.doc.elements.map((el) => {
          if (el.type !== "arrow") return el;
          const arrow = el;
          let changed = false;
          let newX = arrow.x, newY = arrow.y, newW = arrow.width, newH = arrow.height;
          if (arrow.startBinding && movedIds.has(arrow.startBinding.elementId)) {
            const bound = moved.get(arrow.startBinding.elementId);
            if (bound) {
              const ap = anchorPoint(bound, arrow.startBinding.anchor);
              newX = ap.x;
              newY = ap.y;
              changed = true;
            }
          }
          if (arrow.endBinding && movedIds.has(arrow.endBinding.elementId)) {
            const bound = moved.get(arrow.endBinding.elementId);
            if (bound) {
              const ap = anchorPoint(bound, arrow.endBinding.anchor);
              newW = ap.x - newX;
              newH = ap.y - newY;
              changed = true;
            }
          }
          return changed ? { ...arrow, x: newX, y: newY, width: newW, height: newH } : el;
        });
        this.doc = {
          ...this.doc,
          elements: updatedElements.map((el) => moved.get(el.id) ?? el),
        };
        break;
      }
      case "resize": {
        const o = elementBounds(this.interaction.original);
        let { x1, y1, x2, y2 } = o;
        if (this.interaction.handle.includes("e")) x2 = scene.x;
        if (this.interaction.handle.includes("w")) x1 = scene.x;
        if (this.interaction.handle.includes("n")) y1 = scene.y;
        if (this.interaction.handle.includes("s")) y2 = scene.y;
        const nb = normalizeBounds({ x1, y1, x2, y2 });
        const id = this.interaction.original.id;
        this.doc = {
          ...this.doc,
          elements: this.doc.elements.map((el) =>
            el.id === id
              ? {
                  ...el,
                  x: nb.x1,
                  y: nb.y1,
                  width: nb.x2 - nb.x1,
                  height: nb.y2 - nb.y1,
                }
              : el,
          ),
        };
        break;
      }
      case "marquee": {
        this.marquee = {
          x1: this.interaction.startScene.x,
          y1: this.interaction.startScene.y,
          x2: scene.x,
          y2: scene.y,
        };
        this.selectedIds = new Set(elementsInBounds(this.doc.elements, normalizeBounds(this.marquee)));
        break;
      }
      default:
        return;
    }
    this.emit();
  }

  pointerUp() {
    if (this.interaction.kind === "draw" && this.draft) {
      const tiny =
        Math.abs(this.draft.width) < 3 && Math.abs(this.draft.height) < 3;
      if (tiny) {
        this.doc = {
          ...this.doc,
          elements: this.doc.elements.filter((el) => el.id !== this.draft!.id),
        };
        this.history.pop(); // no-op creation: drop snapshot
        // click on empty space with a shape tool: back to selection
        this.tool = "selection";
        this.selectedIds.clear();
      } else {
        // detect bindings for arrows
        if (this.draft.type === "arrow") {
          const [startPt, endPt] = [
            { x: this.draft.x, y: this.draft.y },
            { x: this.draft.x + this.draft.width, y: this.draft.y + this.draft.height },
          ];
          const startBinding = findNearestBinding(startPt, this.doc.elements, this.draft.id);
          const endBinding = findNearestBinding(endPt, this.doc.elements, this.draft.id);
          if (startBinding || endBinding) {
            this.draft = {
              ...this.draft,
              startBinding: startBinding ?? undefined,
              endBinding: endBinding ?? undefined,
            } as Element;
          }
        }
        this.doc = { ...this.doc, elements: [...this.doc.elements, this.draft] };
        this.selectedIds = new Set([this.draft.id]);
      }
      this.draft = null;
    }
    if (this.interaction.kind === "move" && !this.interaction.moved) {
      this.history.pop(); // click without drag: drop the useless snapshot
    }
    this.marquee = null;
    this.guides = null;
    this.interaction = { kind: "none" };
    this.emit();
  }

  /** imperative cursor hint for handle hover (null = use CSS default) */
  cursorOverrideAt(screenPoint: Point): string | null {
    if (this.interaction.kind !== "none") return null;
    if (this.tool !== "selection" || this.selectedIds.size !== 1) return null;
    const selected = this.doc.elements.find((el) => this.selectedIds.has(el.id));
    if (
      !selected ||
      (selected.type !== "rectangle" &&
        selected.type !== "arrow" &&
        selected.type !== "component")
    )
      return null;
    const scene = screenToScene(screenPoint, this.camera);
    const handle = resizeHandleAt(
      scene,
      visualBounds(selected),
      this.camera.zoom,
      selected.type === "arrow" ? ARROW_HANDLES : HANDLES,
    );
    return handle ? HANDLE_CURSOR[handle] : null;
  }

  wheel(screenPoint: Point, delta: { x: number; y: number }, ctrlOrMeta: boolean) {
    if (ctrlOrMeta) {
      this.zoomAt(screenPoint, Math.exp(-delta.y * 0.01));
    } else {
      this.camera = {
        ...this.camera,
        scrollX: this.camera.scrollX - delta.x,
        scrollY: this.camera.scrollY - delta.y,
      };
      this.emit();
    }
  }

  // ---- serialization ---------------------------------------------------
  serializeState(): string {
    return serialize(this.tabs, this.activeTabId);
  }

  /** restores workspace (all tabs) from serialized data; returns false if invalid */
  restoreState(json: string): boolean {
    const data = parse(json);
    if (!data) return false;
    this.tabs = data.tabs;
    this.activeTabId = this.tabs.some((t) => t.id === data.activeTabId)
      ? data.activeTabId
      : data.tabs[0].id;
    this.histories.clear();
    this.selectedIds.clear();
    this.editingTextId = null;
    this.draft = null;
    this.marquee = null;
    this.interaction = { kind: "none" };
    this.emit();
    return true;
  }

  // ---- rendering -------------------------------------------------------
  renderTo(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    opts: { colors?: RenderColors; gridMode?: "none" | "dots" | "lines" } = {},
  ) {
    render(
      ctx,
      {
        doc: this.doc,
        camera: this.camera,
        selectedIds: this.selectedIds,
        draft: this.draft,
        marquee: this.marquee,
        colors: opts.colors,
        gridMode: opts.gridMode ?? "none",
        guides: this.guides,
        hiddenLabelId:
          this.editingKind === "label" ? this.editingTextId : null,
        hiddenTextId: this.editingKind === "text" ? this.editingTextId : null,
      },
      w,
      h,
    );
  }

  getScreenPoint(scenePoint: Point): Point {
    return sceneToScreen(scenePoint, this.camera);
  }

  /** inverse of getScreenPoint (screen -> scene), used by drag-and-drop */
  getScenePoint(screenPoint: Point): Point {
    return screenToScene(screenPoint, this.camera);
  }

  getElement(id: string): Element | undefined {
    return this.doc.elements.find((el) => el.id === id);
  }
}
