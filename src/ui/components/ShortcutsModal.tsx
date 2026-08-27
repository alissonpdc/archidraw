import { useEffect } from "react";
import { MOD } from "../platform";

type ShortcutGroup = { title: string; items: { keys: string; desc: string }[] };

const GROUPS: ShortcutGroup[] = [
  {
    title: "Tools",
    items: [
      { keys: "V", desc: "Selection" },
      { keys: "H", desc: "Hand" },
      { keys: "R", desc: "Rectangle" },
      { keys: "A", desc: "Arrow" },
      { keys: "T", desc: "Text" },
      { keys: "B", desc: "Library" },
    ],
  },
  {
    title: "Canvas",
    items: [
      { keys: "Space+drag", desc: "Pan" },
      { keys: `${MOD}+Scroll`, desc: "Zoom" },
      { keys: "Shift+1", desc: "Fit" },
      { keys: "Double click", desc: "Edit label" },
    ],
  },
  {
    title: "Editing",
    items: [
      { keys: `${MOD}+Z`, desc: "Undo" },
      { keys: `${MOD}+Shift+Z`, desc: "Redo" },
      { keys: `${MOD}+C / X / V`, desc: "Copy/Cut/Paste" },
      { keys: `${MOD}+D`, desc: "Duplicate" },
      { keys: `${MOD}+A`, desc: "Select all" },
      { keys: "Delete", desc: "Delete" },
      { keys: "Esc", desc: "Deselect" },
    ],
  },
];

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
        className="shortcuts-modal shortcuts-modal-wide"
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
        <div className="shortcuts-grid shortcuts-grid-2col">
          {GROUPS.map((group) => (
            <div key={group.title} className="shortcuts-section">
              <div className="menu-section-title">{group.title}</div>
              {group.items.map((s) => (
                <div key={s.keys} className="shortcut-row">
                  <span>{s.desc}</span>
                  <kbd>{s.keys}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
