import { useEffect, useState } from "react";
import { editor } from "../hooks/useEditor";
import { exportPNG, exportSVG, slugify } from "../../core/exporter";
import { toast } from "../toasts";
import { ImageIcon, GridIcon } from "./icons";

type ExportFormat = "png" | "svg";

export function ExportImageModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("png");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleExport = () => {
    const snap = editor.getSnapshot();
    const activeTab = snap.tabs.find((t) => t.id === snap.activeTabId);
    const name = activeTab?.name ?? "diagram";
    const filename = slugify(name);

    if (format === "png") {
      exportPNG(snap.doc, filename).then((ok) =>
        toast(ok ? "PNG exported" : "Empty canvas — nothing to export"),
      );
    } else {
      const ok = exportSVG(snap.doc, filename);
      toast(ok ? "SVG exported" : "Empty canvas — nothing to export");
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="export-image-modal"
        role="dialog"
        aria-label="Export image"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="export-image-header">
          <span>Export image</span>
          <button className="tool-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="export-image-body">
          <div className="export-image-label">Format</div>
          <div className="export-image-options">
            <button
              className={`export-image-option ${format === "png" ? "active" : ""}`}
              onClick={() => setFormat("png")}
            >
              <ImageIcon size={18} />
              <span className="export-image-option-title">PNG</span>
              <span className="export-image-option-desc">Raster image</span>
            </button>
            <button
              className={`export-image-option ${format === "svg" ? "active" : ""}`}
              onClick={() => setFormat("svg")}
            >
              <GridIcon size={18} />
              <span className="export-image-option-title">SVG</span>
              <span className="export-image-option-desc">Vector graphic</span>
            </button>
          </div>
        </div>
        <div className="export-image-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleExport}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
