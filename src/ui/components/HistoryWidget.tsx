import { editor, useEditorSelector } from "../hooks/useEditor";
import { RedoIcon, UndoIcon } from "./icons";
import { MOD } from "../platform";

export function HistoryWidget() {
  const { canUndo, canRedo } = useEditorSelector(
    () => ({ canUndo: editor.canUndo(), canRedo: editor.canRedo() }),
    (a, b) => a.canUndo === b.canUndo && a.canRedo === b.canRedo,
  );

  return (
    <div className="zoom-widget">
      <button
        className="zoom-btn tip-up"
        data-tip={`Undo (${MOD}+Z)`}
        aria-label="Undo"
        disabled={!canUndo}
        onClick={() => editor.undo()}
      >
        <UndoIcon size={14} />
      </button>
      <button
        className="zoom-btn tip-up"
        data-tip={`Redo (${MOD}+Y)`}
        aria-label="Redo"
        disabled={!canRedo}
        onClick={() => editor.redo()}
      >
        <RedoIcon size={14} />
      </button>
    </div>
  );
}
