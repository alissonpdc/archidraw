import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { editor, useEditor } from "../hooks/useEditor";
import { CloseIcon, PlusIcon } from "./icons";

export function TabBar() {
  const snap = useEditor();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmTab, setConfirmTab] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="tabbar">
      {snap.tabs.map((tab, i) => (
        <div key={tab.id} className="tabbar-seg-wrap">
          {i > 0 && <span className="tabbar-dot" aria-hidden />}
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
              className={`tabbar-seg ${tab.id === snap.activeTabId ? "active" : ""}`}
              data-testid={`tab-seg-${tab.name}`}
            >
              <button
                className="tabbar-seg-name"
                title={tab.name}
                onClick={() => editor.switchTab(tab.id)}
                onDoubleClick={() => startRename(tab.id, tab.name)}
              >
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
