import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { editor, useEditor } from "../hooks/useEditor";
import type { TabInfo } from "../../core/editor";
import { CloseIcon, PlusIcon } from "./icons";

const DRAG_THRESHOLD_PX = 4;

interface DragState {
  id: string;
  startX: number;
  startY: number;
  moved: boolean;
}

export function TabBar() {
  const snap = useEditor();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmTab, setConfirmTab] = useState<{ id: string; name: string } | null>(null);
  // ordem local enquanto uma aba está sendo arrastada (preview)
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  const segRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (!confirmTab) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setConfirmTab(null);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [confirmTab]);

  const tabs: readonly TabInfo[] = orderOverride
    ? orderOverride
        .map((id) => snap.tabs.find((t) => t.id === id))
        .filter((t): t is TabInfo => !!t)
    : snap.tabs;

  const startRename = (id: string, name: string) => {
    setDraftName(name);
    setEditingId(id);
  };

  const commitRename = () => {
    if (editingId) editor.renameTab(editingId, draftName);
    setEditingId(null);
  };

  const requestClose = (tab: { id: string; name: string }) => {
    setConfirmTab({ id: tab.id, name: tab.name });
  };

  const currentOrder = () => orderOverride ?? snap.tabs.map((t) => t.id);

  const onSegPointerDown = (e: React.PointerEvent, tab: TabInfo) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".tab-close")) return;
    dragRef.current = { id: tab.id, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onSegPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      movedRef.current = true;
      setDragId(d.id);
      setOrderOverride(currentOrder());
    }
    // índice de inserção entre as outras abas pelos midpoints
    let target = 0;
    for (const t of tabs) {
      if (t.id === d.id) continue;
      const el = segRefs.current.get(t.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX > r.left + r.width / 2) target++;
    }
    const order = currentOrder();
    const cur = order.indexOf(d.id);
    if (target !== cur) {
      const next = [...order];
      next.splice(cur, 1);
      next.splice(target, 0, d.id);
      setOrderOverride(next);
    }
  };

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      editor.reorderTab(d.id, currentOrder().indexOf(d.id));
      // libera o supressor de click depois que o click sintético passar
      setTimeout(() => {
        movedRef.current = false;
      }, 0);
    }
    setDragId(null);
    setOrderOverride(null);
  };

  return (
    <div className="tabbar">
      {tabs.map((tab, i) => (
        <div key={tab.id} className="tabbar-seg-wrap">
          {i > 0 &&
            tabs[i - 1].id !== snap.activeTabId &&
            tab.id !== snap.activeTabId && (
              <span className="tabbar-dot" aria-hidden>
                ·
              </span>
            )}
          {editingId === tab.id ? (
            <input
              ref={inputRef}
              className="tab-rename"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
                e.stopPropagation();
              }}
            />
          ) : (
            <div
              ref={(el) => {
                if (el) segRefs.current.set(tab.id, el);
                else segRefs.current.delete(tab.id);
              }}
              className={`tabbar-seg ${tab.id === snap.activeTabId ? "active" : ""} ${dragId === tab.id ? "dragging" : ""}`}
              data-testid={`tab-seg-${tab.name}`}
              onPointerDown={(e) => onSegPointerDown(e, tab)}
              onPointerMove={onSegPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              // handlers no div: com pointer capture ativo, o click é
              // retargetado para o elemento de captura, não ao botão interno
              onClick={() => {
                if (!movedRef.current) editor.switchTab(tab.id);
              }}
              onDoubleClick={() => startRename(tab.id, tab.name)}
            >
              <button className="tabbar-seg-name" title={tab.name}>
                {tab.name}
              </button>
              {tab.id === snap.activeTabId && (
                <button
                  className="tab-close"
                  data-tip={`Fechar ${tab.name}`}
                  aria-label={`Fechar ${tab.name}`}
                  data-testid={`tab-close-${tab.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    requestClose(tab);
                  }}
                >
                  <CloseIcon size={11} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      <button
        className="tool-btn tabbar-add tip-up"
        data-tip="Nova aba"
        aria-label="Nova aba"
        data-testid="tab-add"
        onClick={() => editor.addTab()}
      >
        <PlusIcon size={14} />
      </button>

      {confirmTab &&
        createPortal(
          <div
            className="modal-backdrop tab-confirm-backdrop"
            data-testid="tab-close-confirm"
            onClick={() => setConfirmTab(null)}
          >
            <div
              className="tab-confirm"
              role="alertdialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="tab-confirm-text">
                Fechar <b>{confirmTab.name}</b>? Os elementos desta aba serão
                perdidos.
              </p>
              <div className="tab-confirm-actions">
                <button
                  className="menu-item tab-confirm-btn"
                  data-testid="tab-close-cancel"
                  onClick={() => setConfirmTab(null)}
                >
                  Cancelar
                </button>
                <button
                  className="menu-item tab-confirm-btn danger"
                  data-testid="tab-close-confirm-btn"
                  onClick={() => {
                    editor.closeTab(confirmTab.id);
                    setConfirmTab(null);
                  }}
                >
                  Fechar aba
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
