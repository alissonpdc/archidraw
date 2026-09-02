import { useEffect, useState } from "react";
import { editor } from "../hooks/useEditor";
import { slugify } from "../../core/exporter";
import { toast } from "../toasts";
import { SaveIcon, ExportIcon } from "./icons";

type SaveTarget = "diagram" | "all";

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SaveModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<SaveTarget>("diagram");

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
  const diagramName = activeTab?.name ?? "diagram";
  const diagramFilename = `${slugify(diagramName)}.archidraw`;

  const handleSave = () => {
    if (target === "diagram") {
      downloadBlob(editor.serializeActiveTab(), diagramFilename);
      toast(`"${diagramName}" saved`);
    } else {
      downloadBlob(editor.serializeState(), "workspace.archidraw");
      toast("Workspace saved");
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
              className={`save-modal-option ${target === "diagram" ? "active" : ""}`}
              onClick={() => setTarget("diagram")}
            >
              <SaveIcon size={18} />
              <span className="save-modal-option-title">Save Diagram</span>
              <span className="save-modal-option-desc">
                Save "{diagramName}" as {diagramFilename}
              </span>
            </button>
            <button
              className={`save-modal-option ${target === "all" ? "active" : ""}`}
              onClick={() => setTarget("all")}
            >
              <ExportIcon size={18} />
              <span className="save-modal-option-title">Save All</span>
              <span className="save-modal-option-desc">
                Save entire workspace as workspace.archidraw
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
