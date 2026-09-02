import type { Tool } from "../../core/types";
import type { RefObject } from "react";
import { Fragment } from "react";
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
  { id: "selection", label: "Selection", key: "1", Icon: SelectionIcon },
  { id: "hand", label: "Hand", key: "H", Icon: HandIcon },
  { id: "rectangle", label: "Rectangle", key: "2", Icon: RectIcon },
  { id: "diamond", label: "Diamond", key: "3", Icon: DiamondIcon },
  { id: "ellipse", label: "Ellipse", key: "4", Icon: EllipseIcon },
  { id: "line", label: "Line", key: "5", Icon: LineIcon },
  { id: "arrow", label: "Arrow", key: "6", Icon: ArrowIcon },
  { id: "text", label: "Text", key: "7", Icon: TextIcon },
];

export function Toolbar({
  libraryOpen = false,
  onToggleLibrary,
  imageInputRef,
}: {
  libraryOpen?: boolean;
  onToggleLibrary?: () => void;
  imageInputRef: RefObject<HTMLInputElement | null>;
}) {
  const snap = useEditor();

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
            <span className="tool-key">{key}</span>
          </button>
        </Fragment>
      ))}
      <div className="toolbar-sep" />
      <button
        className="tool-btn"
        data-tip="Import Image (I)"
        aria-label="Import Image"
        onClick={() => imageInputRef.current?.click()}
      >
        <ImageIcon size={18} />
        <span className="tool-key">I</span>
      </button>
      <button
        className={`tool-btn ${libraryOpen ? "active" : ""}`}
        data-tip="Component Library (L)"
        aria-label="Component Library"
        onClick={() => onToggleLibrary?.()}
      >
        <LibraryIcon size={18} />
        <span className="tool-key">L</span>
      </button>
    </div>
  );
}
