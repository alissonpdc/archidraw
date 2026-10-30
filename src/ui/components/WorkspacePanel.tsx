import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { editor, useEditorSelector } from "../hooks/useEditor";
import type { TabInfo, WorkspaceInfo } from "../../core/editor";
import { archidrawFilename, downloadArchidraw } from "../archidrawDownload";
import { toast } from "../toasts";
import { ConfirmModal, type ConfirmRequest } from "./ConfirmModal";
import { CloseIcon, DownloadIcon, LayersIcon, PlusIcon, SaveIcon } from "./icons";
import { documents } from "../documents";
import { filePicker } from "../../core/documents/filePicker";
import {
  getDocumentSyncSnapshot,
  subscribeDocumentSync,
} from "../../core/documents/syncState";
import { WorkspaceFileAction } from "./WorkspaceFileControls";

const DRAG_THRESHOLD_PX = 4;

interface CanvasTagProps {
  open?: boolean;
}

function PanelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <line x1="6" y1="2" x2="6" y2="14" />
    </svg>
  );
}

function CaretIcon({ open }: CanvasTagProps) {
  return (
    <svg
      className={open ? "tree-caret-open" : undefined}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 2.5l3.5 3.5-3.5 3.5" />
    </svg>
  );
}

type DragScope = "workspace" | "canvas";

interface DragCtx {
  scope: DragScope;
  wsId: string;
  id: string;
  startX: number;
  startY: number;
  moved: boolean;
}

interface OrderOverride {
  scope: DragScope;
  wsId: string;
  ids: string[];
}

interface RenameCtx {
  id: string;
  initial: string;
}

export function WorkspacePanelToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      className={open ? "corner-toggle open" : "corner-toggle"}
      data-testid="panel-toggle"
      aria-label="Toggle workspaces panel"
      title="Workspaces (W)"
      data-tip="Workspaces (W)"
      onClick={onToggle}
    >
      <PanelIcon />
      <kbd className="corner-kbd" aria-hidden>
        W
      </kbd>
    </button>
  );
}

const isActionTarget = (target: EventTarget | null) =>
  target !== null &&
  (target as HTMLElement).closest?.(
    ".icon-btn, .tree-caret, .tree-empty, .tree-file-badge",
  ) !== null;

export function WorkspacePanel({ open }: { open: boolean }) {
  const { workspaces, activeWorkspaceId, activeTabId } = useEditorSelector(
    (snap) => ({
      workspaces: snap.workspaces,
      activeWorkspaceId: snap.activeWorkspaceId,
      activeTabId: snap.activeTabId,
    }),
    (a, b) =>
      a.activeWorkspaceId === b.activeWorkspaceId &&
      a.activeTabId === b.activeTabId &&
      a.workspaces.length === b.workspaces.length &&
      a.workspaces.every((w, i) =>
        w.id === b.workspaces[i].id &&
        w.name === b.workspaces[i].name &&
        w.canvases.length === b.workspaces[i].canvases.length &&
        w.canvases.every(
          (c, j) =>
            c.id === b.workspaces[i].canvases[j].id &&
            c.name === b.workspaces[i].canvases[j].name,
        ),
      ),
  );

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([editor.getSnapshot().activeWorkspaceId]),
  );
  const sync = useSyncExternalStore(
    subscribeDocumentSync,
    getDocumentSyncSnapshot,
  );
  const fileViewFor = (workspaceId: string) =>
    sync.views.find((view) => view.workspaceId === workspaceId) ?? null;
  const [editing, setEditing] = useState<RenameCtx | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [orderOverride, setOrderOverride] = useState<OrderOverride | null>(null);

  const dragRef = useRef<DragCtx | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const movedRef = useRef(false);

  useEffect(() => {
    setExpanded((prev) =>
      prev.has(activeWorkspaceId) ? prev : new Set(prev).add(activeWorkspaceId),
    );
  }, [activeWorkspaceId]);

  const orderedWorkspaces = orderOverride
    ? (orderOverride.ids
        .map((id) => workspaces.find((w) => w.id === id))
        .filter((w): w is WorkspaceInfo => !!w))
    : workspaces;

  const baseIdsFor = (scope: DragScope, wsId: string): string[] =>
    scope === "workspace"
      ? workspaces.map((w) => w.id)
      : (workspaces.find((w) => w.id === wsId)?.canvases ?? []).map((c) => c.id);

  const canvasOrderFor = (ws: WorkspaceInfo, base: readonly TabInfo[]): TabInfo[] => {
    if (orderOverride && orderOverride.scope === "canvas" && orderOverride.wsId === ws.id) {
      return orderOverride.ids
        .map((id) => base.find((c) => c.id === id))
        .filter((c): c is TabInfo => !!c);
    }
    return [...base];
  };

  const onRowPointerDown = (
    e: React.PointerEvent,
    scope: DragScope,
    wsId: string,
    id: string,
  ) => {
    if (e.button !== 0) return;
    if (isActionTarget(e.target)) return;
    dragRef.current = { scope, wsId, id, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const toggleExpanded = (wsId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(wsId)) next.delete(wsId);
      else next.add(wsId);
      return next;
    });

  const openCanvas = (wsId: string, canvasId: string) => {
    if (wsId !== activeWorkspaceId) editor.openWorkspace(wsId);
    editor.switchTab(canvasId);
  };

  const onPanelPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      movedRef.current = true;
      setDragId(d.id);
      setOrderOverride({ scope: d.scope, wsId: d.wsId, ids: baseIdsFor(d.scope, d.wsId) });
      return;
    }
    const ids = baseIdsFor(d.scope, d.wsId);
    let target = 0;
    for (const id of ids) {
      if (id === d.id) continue;
      const rect = rowRefs.current.get(id)?.getBoundingClientRect();
      if (rect && e.clientY > rect.top + rect.height / 2) target++;
    }
    const cur = ids.indexOf(d.id);
    if (target !== cur) {
      const next = [...ids];
      next.splice(cur, 1);
      next.splice(target, 0, d.id);
      setOrderOverride({ scope: d.scope, wsId: d.wsId, ids: next });
    }
  };

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) {
      setDragId(null);
      setOrderOverride(null);
      return;
    }
    if (d.moved) {
      const override = orderOverride?.scope === d.scope && orderOverride.wsId === d.wsId
        ? orderOverride.ids
        : baseIdsFor(d.scope, d.wsId);
      const to = Math.max(0, override.indexOf(d.id));
      if (d.scope === "workspace") editor.reorderWorkspaces(d.id, to);
      else editor.reorderCanvasOf(d.wsId, d.id, to);
      setTimeout(() => {
        movedRef.current = false;
      }, 0);
    }
    setDragId(null);
    setOrderOverride(null);
  };

  const commitRename = (ctx: RenameCtx, value: string) => {
    if (workspaces.some((w) => w.id === ctx.id)) {
      setEditing(null);
      void documents.rename(ctx.id, value);
      return;
    }
    const owning = workspaces.find((w) => w.canvases.some((c) => c.id === ctx.id));
    if (owning?.id === activeWorkspaceId) {
      editor.renameTab(ctx.id, value);
    } else if (owning) {
      editor.renameCanvasOf(owning.id, ctx.id, value);
    }
    setEditing(null);
  };

  const requestDeleteWorkspace = (ws: WorkspaceInfo) => {
    const view = fileViewFor(ws.id);
    const title = `Close "${ws.name}"?`;
    let message: string | undefined;
    let details: string | undefined;
    let onSaveAndClose: (() => Promise<void>) | undefined;

    if (view) {
      if (view.status === "modified") {
        message = "You have unsaved changes that will be lost.";
        details = `The file ${view.fileName} will stay on disk.`;
        onSaveAndClose = async () => {
          const saved = await documents.save(ws.id);
          if (saved) {
            void documents.close(ws.id);
          }
        };
      } else {
        details = `The file ${view.fileName} will stay on disk.`;
      }
    } else {
      message = "It is not saved to a file and unsaved work will be lost.";
      onSaveAndClose = async () => {
        const saved = await documents.save(ws.id);
        if (saved) {
          void documents.close(ws.id);
        }
      };
    }

    setConfirm({
      label: "Close workspace",
      title,
      message,
      details,
      onConfirm: () => {
        void documents.close(ws.id);
      },
      onSaveAndClose,
    });
  };

  const requestDeleteCanvas = (wsId: string, canvas: TabInfo) =>
    setConfirm({
      label: "Close canvas",
      title: `Close "${canvas.name}"?`,
      message: "Unsaved work on this canvas will be lost.",
      onConfirm: () => editor.closeCanvasOf(wsId, canvas.id),
      onSaveAndClose: async () => {
        const saved = await saveCanvas(wsId, canvas);
        if (saved) {
          editor.closeCanvasOf(wsId, canvas.id);
        }
      },
    });

  const addCanvas = (wsId: string) => {
    setExpanded((prev) => new Set(prev).add(wsId));
    editor.addCanvasTo(wsId);
  };

  const downloadCanvas = (wsId: string, canvas: TabInfo) => {
    const json = editor.serializeCanvasOf(wsId, canvas.id);
    if (downloadArchidraw(json, canvas.name)) {
      toast(`"${canvas.name}" downloaded`);
    }
  };

  const saveCanvas = async (wsId: string, canvas: TabInfo): Promise<boolean> => {
    const json = editor.serializeCanvasOf(wsId, canvas.id);
    if (!json) return false;
    try {
      const handle = await filePicker.saveArchidraw(archidrawFilename(canvas.name));
      if (!handle) return false;
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      toast(`"${canvas.name}" saved`);
      return true;
    } catch {
      toast(`Could not save "${canvas.name}"`);
      return false;
    }
  };

  const downloadWorkspace = (ws: WorkspaceInfo) => {
    const json = editor.serializeWorkspace(ws.id);
    if (downloadArchidraw(json, ws.name)) {
      toast(`"${ws.name}" downloaded`);
    }
  };

  const renameField = (initial: string) => (
    <input
      className="tree-rename"
      data-testid="rename-input"
      defaultValue={editing?.initial}
      ref={(el) => {
        if (el) el.select();
        el?.focus();
      }}
      onBlur={(e) => commitRename({ id: editing?.id ?? "", initial }, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = initial;
          e.currentTarget.blur();
        }
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );

  return (
    <>
      {confirm && <ConfirmModal confirm={confirm} onCancel={() => setConfirm(null)} />}
      <div
        className="workspace-panel"
        data-testid="workspace-panel"
        data-open={open ? "true" : "false"}
        role="tree"
        aria-label="Workspaces"
        onPointerMove={onPanelPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="wp-head">
          <span className="wp-title">Workspaces</span>
          <button
            className="icon-btn wp-add"
            data-testid="ws-add"
            aria-label="New workspace"
            title="New workspace"
            onClick={() => editor.newWorkspace()}
          >
            <PlusIcon size={12} />
          </button>
        </div>
        <div className="wp-scroll">
          {orderedWorkspaces.map((ws) => {
            const view = fileViewFor(ws.id);
            return (
            <div key={ws.id} className="tree-group" data-testid={`ws-group-${ws.name}`}>
              <div
                ref={(el) => {
                  if (el) rowRefs.current.set(ws.id, el);
                  else rowRefs.current.delete(ws.id);
                }}
                className={
                  "tree-row ws-row" +
                  (activeWorkspaceId === ws.id ? " active" : "") +
                  (dragId === ws.id ? " dragging" : "")
                }
                data-testid={`ws-row-${ws.name}`}
                data-ws-id={ws.id}
                role="treeitem"
                aria-expanded={expanded.has(ws.id)}
                tabIndex={0}
                onPointerDown={(e) => onRowPointerDown(e, "workspace", ws.id, ws.id)}
                onDoubleClick={(e) => {
                  if (isActionTarget(e.target)) return;
                  setEditing({ id: ws.id, initial: ws.name });
                }}
                onClick={() => {
                  if (movedRef.current) return;
                  toggleExpanded(ws.id);
                }}
              >
                <button
                  className="tree-caret"
                  data-testid={`ws-caret-${ws.name}`}
                  aria-label={`Expand ${ws.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(ws.id);
                  }}
                >
                  <CaretIcon open={expanded.has(ws.id)} />
                </button>
                <span className="tree-icon work" aria-hidden>
                  <LayersIcon size={12} />
                </span>
                {editing?.id === ws.id ? (
                  renameField(editing.initial)
                ) : (
                  <span
                    className="tree-name work-name"
                    data-testid={`ws-name-${ws.id}`}
                  >
                    {ws.name}
                  </span>
                )}
                <span className="tree-count" aria-label={`${ws.canvases.length} canvases`}>
                  {ws.canvases.length}
                </span>
                <button
                  className="icon-btn visible"
                  data-testid="ws-add-canvas"
                  aria-label={`New canvas in ${ws.name}`}
                  title="New canvas"
                  onClick={(e) => {
                    e.stopPropagation();
                    addCanvas(ws.id);
                  }}
                >
                  <PlusIcon size={12} />
                </button>
                <WorkspaceFileAction
                  workspace={ws}
                  view={view}
                  supported={documents.isSupported()}
                />
                {!documents.isSupported() && (
                  <button
                    className="icon-btn visible"
                    data-testid="ws-download"
                    aria-label={`Download workspace ${ws.name}`}
                    title="Download workspace"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadWorkspace(ws);
                    }}
                  >
                    <DownloadIcon size={12} />
                  </button>
                )}
                <button
                  className="icon-btn visible"
                  data-testid="ws-delete"
                  aria-label={`Delete workspace ${ws.name}`}
                  title="Delete workspace"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestDeleteWorkspace(ws);
                  }}
                >
                  <CloseIcon size={12} />
                </button>
              </div>
              {expanded.has(ws.id) && (
                <div className="tree-children" role="group" aria-label={`${ws.name} canvases`}>
                  {ws.canvases.length === 0 ? (
                    <button
                      className="tree-empty"
                      data-testid="ws-empty-row"
                      onClick={() => addCanvas(ws.id)}
                    >
                      <PlusIcon size={12} />
                      <span>New canvas</span>
                    </button>
                  ) : (
                    canvasOrderFor(ws, ws.canvases).map((c) => (
                      <div
                        key={c.id}
                        ref={(el) => {
                          if (el) rowRefs.current.set(c.id, el);
                          else rowRefs.current.delete(c.id);
                        }}
                        className={
                          "tree-row canvas-row" +
                          (activeWorkspaceId === ws.id && activeTabId === c.id ? " active" : "") +
                          (dragId === c.id ? " dragging" : "")
                        }
                        data-testid={`ws-canvas-${c.name}`}
                        data-ws-id={ws.id}
                        data-canvas-id={c.id}
                        role="treeitem"
                        aria-selected={activeWorkspaceId === ws.id && activeTabId === c.id}
                        tabIndex={0}
                        onPointerDown={(e) => onRowPointerDown(e, "canvas", ws.id, c.id)}
                        onDoubleClick={(e) => {
                          if (isActionTarget(e.target)) return;
                          setEditing({ id: c.id, initial: c.name });
                        }}
                        onClick={() => {
                          if (movedRef.current) return;
                          openCanvas(ws.id, c.id);
                        }}
                      >
                        {editing?.id === c.id ? (
                          renameField(editing.initial)
                        ) : (
                          <>
                            <span
                              className="tree-name"
                              data-testid={`ws-canvas-name-${c.id}`}
                            >
                              {c.name}
                            </span>
                            {documents.isSupported() ? (
                              <button
                                className="icon-btn"
                                data-testid="ws-canvas-save"
                                aria-label={`Save canvas ${c.name}`}
                                title="Save canvas"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void saveCanvas(ws.id, c);
                                }}
                              >
                                <SaveIcon size={12} />
                              </button>
                            ) : (
                              <button
                                className="icon-btn"
                                data-testid="ws-canvas-download"
                                aria-label={`Download canvas ${c.name}`}
                                title="Download canvas"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadCanvas(ws.id, c);
                                }}
                              >
                                <DownloadIcon size={12} />
                              </button>
                            )}
                            <button
                              className="icon-btn"
                              data-testid="ws-canvas-close"
                              aria-label={`Close canvas ${c.name}`}
                              title="Close canvas"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteCanvas(ws.id, c);
                              }}
                            >
                              <CloseIcon size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

