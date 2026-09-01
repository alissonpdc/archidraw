import { useEffect } from "react";
import { MOD } from "../platform";

type ShortcutItem = { keys: string; desc: string };
type ShortcutGroup = { title: string; items: ShortcutItem[] };

const TOOLS: ShortcutGroup = {
  title: "Tools",
  items: [
    { keys: "V", desc: "Selection" },
    { keys: "H", desc: "Hand" },
    { keys: "R", desc: "Rectangle" },
    { keys: "D", desc: "Diamond" },
    { keys: "E", desc: "Ellipse" },
    { keys: "L", desc: "Line" },
    { keys: "A", desc: "Arrow" },
    { keys: "T", desc: "Text" },
    { keys: "B", desc: "Library" },
  ],
};

const CANVAS: ShortcutGroup = {
  title: "Canvas",
  items: [
    { keys: "Space+drag", desc: "Pan" },
    { keys: `${MOD}+Scroll`, desc: "Zoom" },
    { keys: "Shift+1", desc: "Fit" },
    { keys: "Double click", desc: "Edit label" },
  ],
};

const EDITING: ShortcutGroup = {
  title: "Editing",
  items: [
    { keys: `${MOD}+Z`, desc: "Undo" },
    { keys: `${MOD}+Shift+Z`, desc: "Redo" },
    { keys: `${MOD}+C / X / V`, desc: "Copy/Cut/Paste" },
    { keys: `${MOD}+D`, desc: "Duplicate" },
    { keys: `${MOD}+G`, desc: "Group" },
    { keys: `${MOD}+Shift+G`, desc: "Ungroup" },
    { keys: `${MOD}+A`, desc: "Select all" },
    { keys: "Delete", desc: "Delete" },
    { keys: "Esc", desc: "Deselect" },
  ],
};

function Section({ group }: { group: ShortcutGroup }) {
  return (
    <div className="shortcuts-section">
      <div className="shortcuts-section-title">{group.title}</div>
      {group.items.map((s) => (
        <div key={s.keys} className="shortcut-row">
          <span className="shortcut-desc">{s.desc}</span>
          <kbd>{s.keys}</kbd>
        </div>
      ))}
    </div>
  );
}

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="shortcuts-modal"
        role="dialog"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-header">
          <span>Keyboard shortcuts</span>
          <button className="tool-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="shortcuts-body">
          <div className="shortcuts-column">
            <Section group={TOOLS} />
          </div>
          <div className="shortcuts-column">
            <Section group={CANVAS} />
            <Section group={EDITING} />
          </div>
        </div>
      </div>
    </div>
  );
}
