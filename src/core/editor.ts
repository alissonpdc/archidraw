import { History } from "./history";
import { hitTest, elementsInBounds } from "./hitTest";
import { parse, serialize } from "./storage";
import { render, type RenderColors } from "./renderer";
import type {
  ArrowBinding,
  ArrowElement,
  Bounds,
  Camera,
  ComponentElement,
  DiamondElement,
  Document,
  Element,
  EllipseElement,
  ImageElement,
  LineElement,
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
  edgeLabelAnchor,
  edgeParamAt,
  isEdge,
  bindingPoint,
  nearestOutlinePoint,
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
/** 45° in radians, used by shift-constrained line/arrow angle snapping */
const QUARTER_TURN = Math.PI / 4;

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

/** element types that expose resize handles in single selection */
function hasResizeHandles(el: Element): boolean {
  return (
    el.type === "rectangle" ||
    el.type === "diamond" ||
    el.type === "ellipse" ||
    el.type === "line" ||
    el.type === "arrow" ||
    el.type === "component" ||
    el.type === "text" ||
    el.type === "image"
  );
}

/** lines/arrows expose only their two endpoints instead of the 8 bbox handles.
 *  width/height are signed: the start endpoint sits at (x,y) and the end at
 *  (x+width, y+height), which map to different bbox corners per quadrant. */
function handlesFor(el: Element): HandleId[] {
  if (el.type === "line" || el.type === "arrow") {
    const startHandle = `${el.height < 0 ? "s" : "n"}${el.width < 0 ? "e" : "w"}` as HandleId;
    const endHandle = `${el.height < 0 ? "n" : "s"}${el.width < 0 ? "w" : "e"}` as HandleId;
    return [startHandle, endHandle];
  }
  return HANDLES;
}

const BIND_TOLERANCE = 20; // scene units

/** true when the scene point hits the label-drag handle of a selected edge */
function labelHandleAt(scene: Point, el: Element, zoom: number): boolean {
  if (!isEdge(el) || !el.label) return false;
  const anchor = edgeLabelAnchor(el)!;
  return (
    Math.hypot(scene.x - anchor.x, scene.y - anchor.y) * zoom <=
    HANDLE_TOLERANCE_PX
  );
}

let _offCanvas: HTMLCanvasElement | null = null;
let _offCtx: CanvasRenderingContext2D | null = null;
function visualBounds(el: Element): Bounds {
  if (!_offCanvas) {
    _offCanvas = document.createElement("canvas");
    _offCtx = _offCanvas.getContext("2d")!;
  }
  return elementVisualBounds(_offCtx!, el);
}

/**
 * binding candidate for a point: any non-edge element whose outline is
 * within BIND_TOLERANCE of the point (or that contains it). Binds to the
 * nearest outline point, stored normalized within the element bounds.
 */
function findNearestBinding(
  point: Point,
  elements: Element[],
  excludeId: string,
): ArrowBinding | null {
  let best: { dist: number; binding: ArrowBinding } | null = null;
  for (const el of elements) {
    if (el.id === excludeId || isEdge(el)) continue;
    const b = elementBounds(el);
    const w = b.x2 - b.x1;
    const h = b.y2 - b.y1;
    const op = nearestOutlinePoint(el, point);
    const dist = Math.hypot(point.x - op.x, point.y - op.y);
    const inside =
      point.x >= b.x1 && point.x <= b.x2 && point.y >= b.y1 && point.y <= b.y2;
    if ((inside || dist <= BIND_TOLERANCE) && (!best || dist < best.dist)) {
      best = {
        dist,
        binding: {
          elementId: el.id,
          nx: w === 0 ? 0.5 : (op.x - b.x1) / w,
          ny: h === 0 ? 0.5 : (op.y - b.y1) / h,
        },
      };
    }
  }
  return best?.binding ?? null;
}

/** live anchor highlights while drawing or dragging an edge endpoint */
export interface BindingPreview {
  start: ArrowBinding | null;
  end: ArrowBinding | null;
}

/**
 * re-snaps an edge's bound endpoints to their anchor points; unbound
 * endpoints stay fixed. Used when either the edge itself or a shape it
 * binds to moves/resizes.
 */
function snapEdgeEndpoints(
  el: LineElement | ArrowElement,
  resolve: (id: string) => Element | undefined,
): LineElement | ArrowElement {
  let x = el.x;
  let y = el.y;
  let w = el.width;
  let h = el.height;
  if (el.startBinding) {
    const target = resolve(el.startBinding.elementId);
    if (target) {
      const ap = bindingPoint(target, el.startBinding);
      // pivot on the free end: it stays where it is
      w = x + w - ap.x;
      h = y + h - ap.y;
      x = ap.x;
      y = ap.y;
    }
  }
  if (el.endBinding) {
    const target = resolve(el.endBinding.elementId);
    if (target) {
      const ap = bindingPoint(target, el.endBinding);
      w = ap.x - x;
      h = ap.y - y;
    }
  }
  return { ...el, x, y, width: w, height: h };
}

type Interaction =
  | { kind: "none" }
  | { kind: "pan"; lastScreen: Point }
  | { kind: "draw"; startScene: Point; id: string }
  | { kind: "move"; startScene: Point; originals: Element[]; moved?: boolean }
  | { kind: "resize"; handle: HandleId; original: Element }
  | { kind: "label-move"; id: string; moved?: boolean }
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
    { id: `tab_${++tabSeq}`, name: "Diagram 1", doc: { schemaVersion: 1, elements: [] }, camera: { scrollX: 0, scrollY: 0, zoom: 1 } },
  ];
  private activeTabId = this.tabs[0].id;
  private tool: Tool = "selection";
  private selectedIds = new Set<string>();
  private editingTextId: string | null = null;
  private editingKind: "text" | "label" = "text";
  private editingInitial: string | null = null;

  private draft: Element | null = null;
  private bindingPreview: BindingPreview | null = null;
  private marquee: { x1: number; y1: number; x2: number; y2: number } | null =
    null;
  private guides: SnapGuide[] | null = null;
  private interaction: Interaction = { kind: "none" };
  private spacePressed = false;
  private shiftPressed = false;
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
          if (!isEdge(el)) return el;
          const startBinding = el.startBinding && deletedIds.has(el.startBinding.elementId)
            ? undefined : el.startBinding;
          const endBinding = el.endBinding && deletedIds.has(el.endBinding.elementId)
            ? undefined : el.endBinding;
          if (startBinding !== el.startBinding || endBinding !== el.endBinding) {
            return { ...el, startBinding, endBinding };
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
    const originals = this.doc.elements.filter((el) =>
      this.selectedIds.has(el.id),
    );
    const clones = this.cloneElements(originals, 10, 10);
    this.doc = {
      ...this.doc,
      elements: [...this.doc.elements, ...this.cloneGroupIds(clones)],
    };
    this.selectedIds = new Set(clones.map((c) => c.id));
    this.emit();
  }

  /**
   * clones elements with translated positions; edge bindings pointing at
   * elements that are also cloned are remapped to the clone ids, otherwise
   * they keep referencing the original target
   */
  private cloneElements(originals: Element[], dx: number, dy: number): Element[] {
    const idMap = new Map<string, string>();
    const clones = originals.map((el) => {
      const id = newId();
      idMap.set(el.id, id);
      return { ...el, id, x: el.x + dx, y: el.y + dy };
    });
    return clones.map((el) => {
      if (!isEdge(el)) return el;
      const startBinding =
        el.startBinding && idMap.has(el.startBinding.elementId)
          ? { ...el.startBinding, elementId: idMap.get(el.startBinding.elementId)! }
          : el.startBinding;
      const endBinding =
        el.endBinding && idMap.has(el.endBinding.elementId)
          ? { ...el.endBinding, elementId: idMap.get(el.endBinding.elementId)! }
          : el.endBinding;
      return { ...el, startBinding, endBinding };
    });
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

  // ---- grouping ---------------------------------------------------------
  groupSelected() {
    if (this.selectedIds.size < 2) return;
    this.commitHistory();
    const gid = newId();
    this.doc = {
      ...this.doc,
      elements: this.doc.elements.map((el) =>
        this.selectedIds.has(el.id) ? { ...el, groupId: gid } : el,
      ),
    };
    this.emit();
  }

  ungroupSelected() {
    const gids = new Set(
      this.doc.elements
        .filter((el) => this.selectedIds.has(el.id) && el.groupId)
        .map((el) => el.groupId as string),
    );
    if (gids.size === 0) return;
    this.commitHistory();
    // dissolve the whole group even if only part of it is selected
    this.doc = {
      ...this.doc,
      elements: this.doc.elements.map((el) =>
        el.groupId && gids.has(el.groupId) ? { ...el, groupId: undefined } : el,
      ),
    };
    this.emit();
  }

  /**
   * remaps groupIds on cloned elements so clones form their own groups;
   * clones that end up alone in a group lose the groupId entirely
   */
  private cloneGroupIds(elements: Element[]): Element[] {
    const counts = new Map<string, number>();
    for (const el of elements) {
      if (el.groupId) counts.set(el.groupId, (counts.get(el.groupId) ?? 0) + 1);
    }
    const remap = new Map<string, string | undefined>();
    return elements.map((el) => {
      if (!el.groupId) return el;
      if (!remap.has(el.groupId)) {
        remap.set(el.groupId, (counts.get(el.groupId) ?? 0) > 1 ? newId() : undefined);
      }
      const gid = remap.get(el.groupId);
      return gid ? { ...el, groupId: gid } : { ...el, groupId: undefined };
    });
  }

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
    // é o tamanho visual do ícone (com proporção preservada p/ importados)
    const size = 64;
    const aspect = item.aspect && item.aspect > 0 ? item.aspect : 1;
    const w = aspect >= 1 ? size : size * aspect;
    const h = aspect >= 1 ? size / aspect : size;
    this.commitHistory();
    const el: ComponentElement = {
      id: newId(),
      type: "component",
      componentId: componentId,
      x: scene.x - w / 2,
      y: scene.y - h / 2,
      width: w,
      height: h,
      strokeColor: this.lastDefaultStroke,
      backgroundColor: DEFAULT_BG,
      // no border and no label by default: just the icon
      strokeWidth: 0,
      opacity: 1,
      strokeStyle: "solid",
      roughness: 0,
      borderRadius: 20,
      // legenda/editação usa a mesma fonte default do texto (média, sans)
      fontSize: 20,
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
    this.bindingPreview = null;
    this.emit();
  }

  /** inserts a raster image file onto the canvas at the viewport center */
  insertImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        const aspect = img.naturalWidth / img.naturalHeight;
        const w = aspect >= 1 ? maxDim : maxDim * aspect;
        const h = aspect >= 1 ? maxDim / aspect : maxDim;
        const scene = screenToScene(this.screenCenter(), this.camera);
        this.commitHistory();
        const el: ImageElement = {
          id: newId(),
          type: "image",
          src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          x: scene.x - w / 2,
          y: scene.y - h / 2,
          width: w,
          height: h,
          // legenda/editação usa a mesma fonte default do texto (média, sans)
          fontSize: 20,
          strokeColor: DEFAULT_STROKE,
          backgroundColor: DEFAULT_BG,
          strokeWidth: 0,
          opacity: 1,
          strokeStyle: "solid",
          roughness: 0,
          borderRadius: 0,
        };
        this.doc = { ...this.doc, elements: [...this.doc.elements, el] };
        this.tool = "selection";
        this.selectedIds = new Set([el.id]);
        this.emit();
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  // ---- tabs ------------------------------------------------------------
  private nextTabName(): string {
    let max = 0;
    for (const t of this.tabs) {
      const m = t.name.match(/^Diagram (\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `Diagram ${max + 1}`;
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
    this.bindingPreview = null;
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

  /** re-snaps edges bound to the given element after it changed shape/position */
  private syncEdgesBoundTo(id: string) {
    const target = this.doc.elements.find((el) => el.id === id);
    if (!target) return;
    let changed = false;
    const elements = this.doc.elements.map((el) => {
      if (!isEdge(el)) return el;
      if (el.startBinding?.elementId !== id && el.endBinding?.elementId !== id) {
        return el;
      }
      changed = true;
      return snapEdgeEndpoints(el, (bid) =>
        bid === id ? target : this.doc.elements.find((e) => e.id === bid),
      );
    });
    if (changed) this.doc = { ...this.doc, elements };
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
        hitEl.type === "diamond" ||
        hitEl.type === "ellipse" ||
        hitEl.type === "line" ||
        hitEl.type === "arrow" ||
        hitEl.type === "component" ||
        hitEl.type === "image")
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
      textOffsetGlobal?: number;
      textOffsetTop?: number;
      textOffsetBottom?: number;
      textOffsetLeft?: number;
      textOffsetRight?: number;
      captionPosition?: import("./types").CaptionPosition;
      captionGap?: number;
      captionOffsetTop?: number;
      captionOffsetBottom?: number;
      captionOffsetLeft?: number;
      captionOffsetRight?: number;
      lineType?: LineType;
      controlPoint?: Point;
    },
  ) {
    this.doc = {
      ...this.doc,
      elements: this.doc.elements.map((el) => {
        if (!ids.includes(el.id)) return el;
        const next = { ...el, ...patch } as Element;
        // recalculate text dimensions when font-related props change
        if (next.type === "text" && (patch.fontSize !== undefined || patch.fontFamily !== undefined || patch.bold !== undefined || patch.italic !== undefined || patch.lineSpacing !== undefined)) {
          const te = next as TextElement;
          const { width, height } = measureText(te.text || " ", te.fontSize, te.fontFamily, te.bold, te.italic, te.lineSpacing);
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
        const { width, height } = measureText(text || " ", el.fontSize, el.fontFamily, el.bold, el.italic, el.lineSpacing);
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
    const clones = this.cloneElements(items, offset, offset);
    this.commitHistory();
    this.doc = {
      ...this.doc,
      elements: [...this.doc.elements, ...this.cloneGroupIds(clones)],
    };
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

  onShiftDown() {
    this.shiftPressed = true;
  }

  onShiftUp() {
    this.shiftPressed = false;
  }

  /** snap an angle to the nearest multiple of 45° */
  private snapAngle(dx: number, dy: number): { x: number; y: number } {
    const angle =
      Math.round(Math.atan2(dy, dx) / QUARTER_TURN) * QUARTER_TURN;
    const len = Math.hypot(dx, dy);
    return { x: len * Math.cos(angle), y: len * Math.sin(angle) };
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
      case "diamond":
      case "ellipse":
      case "line":
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
        const bbox = { x: scene.x, y: scene.y, width: 0, height: 0 };
        let el: Element;
        if (this.tool === "rectangle") {
          el = { ...base, type: "rectangle", ...bbox } satisfies RectangleElement;
        } else if (this.tool === "diamond") {
          el = { ...base, type: "diamond", ...bbox } satisfies DiamondElement;
        } else if (this.tool === "ellipse") {
          el = { ...base, type: "ellipse", ...bbox } satisfies EllipseElement;
        } else if (this.tool === "line") {
          el = { ...base, type: "line", ...bbox } satisfies LineElement;
        } else {
          el = { ...base, type: "arrow", ...bbox } satisfies ArrowElement;
        }
        // drawing that starts over/near a shape binds and snaps the start
        // to the nearest outline point
        if (el.type === "line" || el.type === "arrow") {
          const startBinding = findNearestBinding(scene, this.doc.elements, el.id);
          if (startBinding) {
            const target = this.doc.elements.find(
              (e) => e.id === startBinding.elementId,
            )!;
            const ap = nearestOutlinePoint(target, scene);
            el = { ...el, x: ap.x, y: ap.y, startBinding };
          }
        }
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
        // label-drag handle of the single selected edge takes precedence
        if (this.selectedIds.size === 1) {
          const selected = this.doc.elements.find((el) =>
            this.selectedIds.has(el.id),
          );
          if (selected && labelHandleAt(scene, selected, this.camera.zoom)) {
            this.commitHistory();
            this.interaction = { kind: "label-move", id: selected.id };
            break;
          }
        }
        // resize handle of the single selected element takes precedence
        if (this.selectedIds.size === 1) {
          const selected = this.doc.elements.find((el) =>
            this.selectedIds.has(el.id),
          );
          if (selected && hasResizeHandles(selected)) {
            const handle = resizeHandleAt(
              scene,
              visualBounds(selected),
              this.camera.zoom,
              handlesFor(selected),
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
          // clicking a member of a group selects the whole group
          const groupIds = hitEl.groupId
            ? this.doc.elements
                .filter((el) => el.groupId === hitEl.groupId)
                .map((el) => el.id)
            : [hitEl.id];
          if (modifiers.shift) {
            // additive selection
            const next = new Set(this.selectedIds);
            if (next.has(hitEl.id)) {
              for (const id of groupIds) next.delete(id);
            } else {
              for (const id of groupIds) next.add(id);
            }
            this.selectedIds = next;
          } else if (!this.selectedIds.has(hitEl.id)) {
            this.selectedIds = new Set(groupIds);
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

  pointerMove(screenPoint: Point, modifiers: { shift?: boolean } = {}) {
    const scene = screenToScene(screenPoint, this.camera);
    const shift = modifiers.shift ?? this.shiftPressed;

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
        if (this.draft.type === "line" || this.draft.type === "arrow") {
          // edge draft: pivots on its (possibly anchor-snapped) start point;
          // width/height stay signed so the drawn direction (and the
          // arrowhead) is preserved in any quadrant
          const draft: LineElement | ArrowElement = this.draft;
          const start = { x: draft.x, y: draft.y };
          let x2 = scene.x;
          let y2 = scene.y;
          if (shift) {
            // shift locks the angle to the nearest 45° increment
            const d = this.snapAngle(x2 - start.x, y2 - start.y);
            x2 = start.x + d.x;
            y2 = start.y + d.y;
          }
          // live binding: the moving end snaps to the nearest shape anchor
          const endBinding = findNearestBinding(
            { x: x2, y: y2 },
            this.doc.elements,
            draft.id,
          );
          if (endBinding) {
            const target = this.doc.elements.find(
              (e) => e.id === endBinding.elementId,
            )!;
            const ap = nearestOutlinePoint(target, { x: x2, y: y2 });
            x2 = ap.x;
            y2 = ap.y;
          }
          this.bindingPreview = {
            start: draft.startBinding ?? null,
            end: endBinding,
          };
          this.draft = {
            ...draft,
            width: x2 - start.x,
            height: y2 - start.y,
            endBinding: endBinding ?? undefined,
          };
        } else {
          const draft = this.draft;
          const start = this.interaction.startScene;
          let x2 = scene.x;
          let y2 = scene.y;
          if (
            shift &&
            (draft.type === "rectangle" ||
              draft.type === "ellipse" ||
              draft.type === "diamond")
          ) {
            // shift keeps the aspect ratio: perfect square/circle/diamond
            const dx = x2 - start.x;
            const dy = y2 - start.y;
            const size = Math.max(Math.abs(dx), Math.abs(dy));
            x2 = start.x + (dx < 0 ? -size : size);
            y2 = start.y + (dy < 0 ? -size : size);
          }
          const b = normalizeBounds({
            x1: start.x,
            y1: start.y,
            x2,
            y2,
          });
          this.draft = {
            ...draft,
            x: b.x1,
            y: b.y1,
            width: b.x2 - b.x1,
            height: b.y2 - b.y1,
          };
        }
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
        // keep bindings coherent: edges bound to moved shapes follow their
        // anchors, and moved edges re-snap their own bound endpoints
        const movedIds = new Set(moved.keys());
        const resolveBound = (id: string) =>
          moved.get(id) ?? this.doc.elements.find((el) => el.id === id);
        const updatedElements = this.doc.elements.map((el) => {
          const next = moved.get(el.id) ?? el;
          if (!isEdge(next) || (!next.startBinding && !next.endBinding)) {
            return next;
          }
          const startAffected =
            next.startBinding !== undefined &&
            movedIds.has(next.startBinding.elementId);
          const endAffected =
            next.endBinding !== undefined &&
            movedIds.has(next.endBinding.elementId);
          if (!moved.has(next.id) && !startAffected && !endAffected) {
            return next;
          }
          return snapEdgeEndpoints(next, resolveBound);
        });
        this.doc = {
          ...this.doc,
          elements: updatedElements,
        };
        break;
      }
      case "label-move": {
        const moveId = this.interaction.id;
        const el = this.doc.elements.find((e) => e.id === moveId);
        if (el && isEdge(el)) {
          const t = edgeParamAt(el, scene);
          const prev = el.labelT ?? 0.5;
          if (Math.abs(t - prev) > 1e-6) {
            this.interaction.moved = true;
            this.doc = {
              ...this.doc,
              elements: this.doc.elements.map((e) =>
                e.id === el.id ? { ...e, labelT: t } : e,
              ),
            };
          }
        }
        break;
      }
      case "resize": {
        const o = elementBounds(this.interaction.original);
        const orig = this.interaction.original;
        const handle = this.interaction.handle;
        let nb: Bounds = o;
        let linePatch:
          | {
              x: number;
              y: number;
              width: number;
              height: number;
              startBinding?: ArrowBinding;
              endBinding?: ArrowBinding;
            }
          | null = null;
        if (handle.length === 2 && (orig.type === "line" || orig.type === "arrow")) {
          // endpoint drag: the grabbed endpoint follows the pointer (shift
          // locks the angle to 45° from the fixed one); the opposite endpoint
          // stays anchored. Signed dims preserve the line direction.
          const ax = orig.x;
          const ay = orig.y;
          const bx = orig.x + orig.width;
          const by = orig.y + orig.height;
          const draggingStart = handle === handlesFor(orig)[0];
          const fx = draggingStart ? bx : ax;
          const fy = draggingStart ? by : ay;
          const delta = shift
            ? this.snapAngle(scene.x - fx, scene.y - fy)
            : { x: scene.x - fx, y: scene.y - fy };
          const ex = fx + delta.x;
          const ey = fy + delta.y;
          // live rebinding: drop the dragged endpoint near another shape
          // anchor to bind it there; away from any anchor clears the binding
          const candidate = findNearestBinding(
            { x: ex, y: ey },
            this.doc.elements,
            orig.id,
          );
          let snapped = { x: ex, y: ey };
          if (candidate) {
            const target = this.doc.elements.find(
              (e) => e.id === candidate.elementId,
            )!;
            snapped = nearestOutlinePoint(target, { x: ex, y: ey });
          }
          if (draggingStart) {
            linePatch = {
              x: snapped.x,
              y: snapped.y,
              width: bx - snapped.x,
              height: by - snapped.y,
              startBinding: candidate ?? undefined,
            };
            this.bindingPreview = {
              start: candidate,
              end: orig.endBinding ?? null,
            };
          } else {
            linePatch = {
              x: ax,
              y: ay,
              width: snapped.x - ax,
              height: snapped.y - ay,
              endBinding: candidate ?? undefined,
            };
            this.bindingPreview = {
              start: orig.startBinding ?? null,
              end: candidate,
            };
          }
        } else if (handle.length === 2) {
          // corner handles: proportional scale anchored at the opposite corner
          const oW = o.x2 - o.x1 || 1;
          const oH = o.y2 - o.y1 || 1;
          const fx = handle.includes("e") ? o.x1 : o.x2;
          const fy = handle.includes("s") ? o.y1 : o.y2;
          const corner = handlePosition(handle, o);
          const sx = (scene.x - fx) / (corner.x - fx || 1);
          const sy = (scene.y - fy) / (corner.y - fy || 1);
          const s = Math.max(0.05, (sx + sy) / 2);
          const w = oW * s;
          const h = oH * s;
          nb = {
            x1: handle.includes("w") ? fx - w : fx,
            y1: handle.includes("n") ? fy - h : fy,
            x2: handle.includes("w") ? fx : fx + w,
            y2: handle.includes("n") ? fy : fy + h,
          };
        } else if (orig.type === "component" || orig.type === "image") {
          // edge handles on library components also scale proportionally:
          // dragged edge follows the pointer, opposite edge stays fixed and
          // the other axis follows the original ratio (centered)
          const oW = o.x2 - o.x1 || 1;
          const oH = o.y2 - o.y1 || 1;
          const cx = (o.x1 + o.x2) / 2;
          const cy = (o.y1 + o.y2) / 2;
          const ratio = oH / oW;
          let w: number;
          let h: number;
          if (handle === "e" || handle === "w") {
            w = handle === "e" ? scene.x - o.x1 : o.x2 - scene.x;
            w = Math.max(1, w);
            h = w * ratio;
          } else {
            h = handle === "s" ? scene.y - o.y1 : o.y2 - scene.y;
            h = Math.max(1, h);
            w = h / ratio;
          }
          nb = {
            x1: handle === "e" ? o.x1 : handle === "w" ? o.x2 - w : cx - w / 2,
            x2: handle === "e" ? o.x1 + w : handle === "w" ? o.x2 : cx + w / 2,
            y1: handle === "s" ? o.y1 : handle === "n" ? o.y2 - h : cy - h / 2,
            y2: handle === "s" ? o.y1 + h : handle === "n" ? o.y2 : cy + h / 2,
          };
        } else if (shift && orig.type !== "text") {
          // shift on edge handles keeps the original aspect ratio,
          // anchored at the opposite edge
          const oW = o.x2 - o.x1 || 1;
          const oH = o.y2 - o.y1 || 1;
          const ratio = oH / oW;
          let w: number;
          let h: number;
          if (handle === "e" || handle === "w") {
            w = Math.max(1, handle === "e" ? scene.x - o.x1 : o.x2 - scene.x);
            h = w * ratio;
          } else {
            h = Math.max(1, handle === "s" ? scene.y - o.y1 : o.y2 - scene.y);
            w = h / ratio;
          }
          nb = {
            x1: handle === "w" ? o.x2 - w : o.x1,
            x2: handle === "w" ? o.x2 : o.x1 + w,
            y1: handle === "n" ? o.y2 - h : o.y1,
            y2: handle === "n" ? o.y2 : o.y1 + h,
          };
        } else {
          // edge handles: resize along a single axis only (aspect ratio may distort)
          let { x1, y1, x2, y2 } = o;
          if (handle.includes("e")) x2 = scene.x;
          if (handle.includes("w")) x1 = scene.x;
          if (handle.includes("n")) y1 = scene.y;
          if (handle.includes("s")) y2 = scene.y;
          nb = normalizeBounds({ x1, y1, x2, y2 });
        }
        const id = this.interaction.original.id;
        if (orig.type === "text") {
          const oW = o.x2 - o.x1 || 1;
          const oH = o.y2 - o.y1 || 1;
          const scaleX = (nb.x2 - nb.x1) / oW;
          const scaleY = (nb.y2 - nb.y1) / oH;
          const scale = Math.max(scaleX, scaleY);
          const newFontSize = Math.max(1, Math.round(orig.fontSize * scale));
          const { width, height } = measureText(orig.text || " ", newFontSize, orig.fontFamily, orig.bold, orig.italic, orig.lineSpacing);
          this.doc = {
            ...this.doc,
            elements: this.doc.elements.map((el) =>
              el.id === id
                ? {
                    ...el,
                    x: nb.x1,
                    y: nb.y1,
                    fontSize: newFontSize,
                    width: Math.max(width, 8),
                    height,
                  }
                : el,
            ),
          };
        } else {
          const patch = linePatch ?? {
            x: nb.x1,
            y: nb.y1,
            width: nb.x2 - nb.x1,
            height: nb.y2 - nb.y1,
          };
          this.doc = {
            ...this.doc,
            elements: this.doc.elements.map((el) =>
              el.id === id
                ? {
                    ...el,
                    ...patch,
                  }
                : el,
            ),
          };
        }
        // edges bound to the resized shape follow its new anchors
        this.syncEdgesBoundTo(id);
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
        // bindings were resolved live during the draw (draft carries them)
        this.doc = { ...this.doc, elements: [...this.doc.elements, this.draft] };
        this.selectedIds = new Set([this.draft.id]);
      }
      this.draft = null;
    }
    if (this.interaction.kind === "move" && !this.interaction.moved) {
      this.history.pop(); // click without drag: drop the useless snapshot
    }
    if (this.interaction.kind === "label-move" && !this.interaction.moved) {
      this.history.pop(); // handle grabbed without dragging: drop snapshot
    }
    this.marquee = null;
    this.guides = null;
    this.bindingPreview = null;
    this.interaction = { kind: "none" };
    this.emit();
  }

  /** imperative cursor hint for handle hover (null = use CSS default) */
  cursorOverrideAt(screenPoint: Point): string | null {
    if (this.interaction.kind !== "none") return null;
    if (this.tool !== "selection" || this.selectedIds.size !== 1) return null;
    const selected = this.doc.elements.find((el) => this.selectedIds.has(el.id));
    if (!selected || !hasResizeHandles(selected)) return null;
    const scene = screenToScene(screenPoint, this.camera);
    if (labelHandleAt(scene, selected, this.camera.zoom)) return "move";
    const handle = resizeHandleAt(
      scene,
      visualBounds(selected),
      this.camera.zoom,
      handlesFor(selected),
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
    this.bindingPreview = null;
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
        bindingPreview: this.bindingPreview,
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
