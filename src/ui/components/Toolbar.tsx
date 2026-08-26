import type { Tool } from "../../core/types";
import { editor, useEditor } from "../hooks/useEditor";
import {
  ArrowIcon,
  FitIcon,
  HandIcon,
  LibraryIcon,
  RectIcon,
  SelectionIcon,
  TextIcon,
} from "./icons";

const TOOLS: { id: Tool; label: string; key: string; Icon: typeof SelectionIcon }[] = [
  { id: "selection", label: "Seleção", key: "V", Icon: SelectionIcon },
  { id: "hand", label: "Mão", key: "H", Icon: HandIcon },
  { id: "rectangle", label: "Retângulo", key: "R", Icon: RectIcon },
  { id: "arrow", label: "Seta", key: "A", Icon: ArrowIcon },
  { id: "text", label: "Texto", key: "T", Icon: TextIcon },
];

export function Toolbar({
  libraryOpen = false,
  onToggleLibrary,
}: {
  libraryOpen?: boolean;
  onToggleLibrary?: () => void;
}) {
  const snap = useEditor();

  return (
    <div className="toolbar">
      {TOOLS.map(({ id, label, key, Icon }) => (
        <button
          key={id}
          className={`tool-btn ${snap.tool === id ? "active" : ""}`}
          data-tip={`${label} (${key})`}
          aria-label={label}
          onClick={() => editor.setTool(id)}
        >
          <Icon size={18} />
        </button>
      ))}
      <div className="toolbar-sep" />
      <button
        className={`tool-btn ${libraryOpen ? "active" : ""}`}
        data-tip="Biblioteca de componentes (B)"
        aria-label="Biblioteca de componentes"
        onClick={() => onToggleLibrary?.()}
      >
        <LibraryIcon size={18} />
      </button>
      <button
        className="tool-btn"
        data-tip="Resetar zoom"
        aria-label="Resetar zoom"
        onClick={() => editor.resetZoom()}
      >
        <FitIcon size={16} />
      </button>
    </div>
  );
}
