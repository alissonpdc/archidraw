import { editor, useEditor } from "../hooks/useEditor";
import { FitIcon, FocusIcon, MinusIcon, PlusIcon, TargetIcon } from "./icons";

export function ZoomWidget() {
  const snap = useEditor();
  const pct = Math.round(snap.camera.zoom * 100);

  return (
    <div className="zoom-widget">
      <button
        className="zoom-btn tip-up"
        data-tip="Reset zoom (100%)"
        aria-label="Reset zoom"
        onClick={() => editor.resetZoom()}
      >
        <FitIcon size={14} />
      </button>
      <div className="toolbar-sep" />
      <button
        className="zoom-btn tip-up"
        data-tip="Zoom out"
        aria-label="Zoom out"
        onClick={() => editor.zoomOut()}
      >
        <MinusIcon size={14} />
      </button>
      <span className="zoom-level tip-up" data-tip={`${pct}%`}>
        {pct}%
      </span>
      <button
        className="zoom-btn tip-up"
        data-tip="Zoom in"
        aria-label="Zoom in"
        onClick={() => editor.zoomIn()}
      >
        <PlusIcon size={14} />
      </button>
      <div className="toolbar-sep" />
      <button
        className="zoom-btn tip-up"
        data-tip="Fit content (Shift+1)"
        aria-label="Fit content"
        onClick={() => editor.zoomToFit()}
      >
        <TargetIcon size={14} />
      </button>
    </div>
  );
}

export function FocusWidget() {
  return (
    <div className="focus-widget">
      <button
        className="zoom-btn tip-up"
        data-tip="Focus (hide UI)"
        aria-label="Focus"
        onClick={() => editor.toggleFocusMode()}
      >
        <FocusIcon size={14} />
      </button>
    </div>
  );
}
