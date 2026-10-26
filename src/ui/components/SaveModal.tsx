import { useEffect, useState } from "react";
import { editor } from "../hooks/useEditor";
import { archidrawFilename, downloadArchidraw } from "../archidrawDownload";
import { toast } from "../toasts";
import { SaveIcon, ExportIcon } from "./icons";

type SaveTarget = "canvas" | "workspace";

export function SaveModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<SaveTarget>("canvas");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const snap = editor.getSnapshot();
  const activeTab = snap.tabs.find((t) => t.id === snap.activeTabId);
  const canvasName = activeTab?.name ?? "canvas";
  const canvasFilename = archidrawFilename(canvasName);

  const activeWorkspace = snap.workspaces.find((w) => w.id === snap.activeWorkspaceId);
  const workspaceName = activeWorkspace?.name ?? "workspace";
  const workspaceFilename = archidrawFilename(workspaceName);

  const handleSave = () => {
    if (target === "canvas") {
      downloadArchidraw(editor.serializeActiveTab(), canvasName);
      toast(`"${canvasName}" saved`);
    } else {
      downloadArchidraw(editor.serializeState(), workspaceName);
      toast(`"${workspaceName}" saved`);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="save-modal"
        role="dialog"
        aria-label="Save"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="save-modal-header">
          <span>Save</span>
          <button className="tool-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="save-modal-body">
          <div className="save-modal-label">What to save</div>
          <div className="save-modal-options">
            <button
              className={`save-modal-option ${target === "canvas" ? "active" : ""}`}
              onClick={() => setTarget("canvas")}
            >
              <SaveIcon size={18} />
              <span className="save-modal-option-title">Save Canvas</span>
              <span className="save-modal-option-desc">
                Save "{canvasName}" as {canvasFilename}
              </span>
            </button>
            <button
              className={`save-modal-option ${target === "workspace" ? "active" : ""}`}
              onClick={() => setTarget("workspace")}
            >
              <ExportIcon size={18} />
              <span className="save-modal-option-title">Save Workspace</span>
              <span className="save-modal-option-desc">
                Save "{workspaceName}" as {workspaceFilename}
              </span>
            </button>
          </div>
        </div>
        <div className="save-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
