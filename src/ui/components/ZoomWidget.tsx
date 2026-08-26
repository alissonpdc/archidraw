import { editor, useEditor } from "../hooks/useEditor";
import { FitIcon, MinusIcon, PlusIcon, TargetIcon } from "./icons";

export function ZoomWidget() {
  const snap = useEditor();
  const pct = Math.round(snap.camera.zoom * 100);

  return (
    <div className="zoom-widget">
      <button
        className="zoom-btn tip-up"
        data-tip="Resetar zoom (100%)"
        aria-label="Resetar zoom"
        onClick={() => editor.resetZoom()}
      >
        <FitIcon size={14} />
      </button>
      <div className="toolbar-sep" />
      <button
        className="zoom-btn tip-up"
        data-tip="Reduzir zoom"
        aria-label="Reduzir zoom"
        onClick={() => editor.zoomOut()}
      >
        <MinusIcon size={14} />
      </button>
      <span className="zoom-level tip-up" data-tip={`${pct}%`}>
        {pct}%
      </span>
      <button
        className="zoom-btn tip-up"
        data-tip="Aumentar zoom"
        aria-label="Aumentar zoom"
        onClick={() => editor.zoomIn()}
      >
        <PlusIcon size={14} />
      </button>
      <div className="toolbar-sep" />
      <button
        className="zoom-btn tip-up"
        data-tip="Enquadrar conteúdo (Shift+1)"
        aria-label="Enquadrar conteúdo"
        onClick={() => editor.zoomToFit()}
      >
        <TargetIcon size={14} />
      </button>
    </div>
  );
}
