import type { Tool } from "../../core/types";
import { Fragment, useRef } from "react";
import { editor, useEditor } from "../hooks/useEditor";
import {
  ArrowIcon,
  DiamondIcon,
  EllipseIcon,
  HandIcon,
  ImageIcon,
  LibraryIcon,
  LineIcon,
  RectIcon,
  SelectionIcon,
  TextIcon,
} from "./icons";

const TOOLS: { id: Tool; label: string; key: string; Icon: typeof SelectionIcon }[] = [
  { id: "selection", label: "Selection", key: "V", Icon: SelectionIcon },
  { id: "hand", label: "Hand", key: "H", Icon: HandIcon },
  { id: "rectangle", label: "Rectangle", key: "R", Icon: RectIcon },
  { id: "diamond", label: "Diamond", key: "D", Icon: DiamondIcon },
  { id: "ellipse", label: "Ellipse", key: "E", Icon: EllipseIcon },
  { id: "line", label: "Line", key: "L", Icon: LineIcon },
  { id: "arrow", label: "Arrow", key: "A", Icon: ArrowIcon },
  { id: "text", label: "Text", key: "T", Icon: TextIcon },
];

export function Toolbar({
  libraryOpen = false,
  onToggleLibrary,
}: {
  libraryOpen?: boolean;
  onToggleLibrary?: () => void;
}) {
  const snap = useEditor();
  const imageInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar">
      {TOOLS.map(({ id, label, key, Icon }) => (
        <Fragment key={id}>
          {id === "rectangle" && <div className="toolbar-sep" />}
          <button
            className={`tool-btn ${snap.tool === id ? "active" : ""}`}
            data-tip={`${label} (${key})`}
            aria-label={label}
            onClick={() => editor.setTool(id)}
          >
            <Icon size={18} />
          </button>
        </Fragment>
      ))}
      <div className="toolbar-sep" />
      <button
        className="tool-btn"
        data-tip="Open Image"
        aria-label="Open Image"
        onClick={() => imageInputRef.current?.click()}
      >
        <ImageIcon size={18} />
      </button>
      <button
        className={`tool-btn ${libraryOpen ? "active" : ""}`}
        data-tip="Component Library (B)"
        aria-label="Component Library"
        onClick={() => onToggleLibrary?.()}
      >
        <LibraryIcon size={18} />
      </button>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        data-testid="image-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) editor.insertImage(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
