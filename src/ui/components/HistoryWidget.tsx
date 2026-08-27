import { editor, useEditor } from "../hooks/useEditor";
import { RedoIcon, UndoIcon } from "./icons";
import { MOD } from "../platform";

export function HistoryWidget() {
  useEditor(); // re-render on every emit so canUndo/canRedo stay fresh

  return (
    <div className="zoom-widget">
      <button
        className="zoom-btn tip-up"
        data-tip={`Undo (${MOD}+Z)`}
        aria-label="Undo"
        disabled={!editor.canUndo()}
        onClick={() => editor.undo()}
      >
        <UndoIcon size={14} />
      </button>
      <button
        className="zoom-btn tip-up"
        data-tip={`Redo (${MOD}+Y)`}
        aria-label="Redo"
        disabled={!editor.canRedo()}
        onClick={() => editor.redo()}
      >
        <RedoIcon size={14} />
      </button>
    </div>
  );
}
