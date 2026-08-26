import { useEffect } from "react";
import { MOD } from "../platform";

type ShortcutGroup = { title: string; items: { keys: string; desc: string }[] };

const GROUPS: ShortcutGroup[] = [
  {
    title: "Ferramentas",
    items: [
      { keys: "V", desc: "Seleção" },
      { keys: "H", desc: "Mão" },
      { keys: "R", desc: "Retângulo" },
      { keys: "A", desc: "Seta" },
      { keys: "T", desc: "Texto" },
      { keys: "B", desc: "Biblioteca" },
    ],
  },
  {
    title: "Canvas",
    items: [
      { keys: "Espaço+arrastar", desc: "Pan" },
      { keys: `${MOD}+Scroll`, desc: "Zoom" },
      { keys: "Shift+1", desc: "Enquadrar" },
      { keys: "Duplo clique", desc: "Editar label" },
    ],
  },
  {
    title: "Edição",
    items: [
      { keys: `${MOD}+Z`, desc: "Desfazer" },
      { keys: `${MOD}+Shift+Z`, desc: "Refazer" },
      { keys: `${MOD}+C / X / V`, desc: "Copiar/Recortar/Colar" },
      { keys: `${MOD}+D`, desc: "Duplicar" },
      { keys: `${MOD}+A`, desc: "Selecionar tudo" },
      { keys: "Delete", desc: "Apagar" },
      { keys: "Esc", desc: "Desselecionar" },
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
        aria-label="Atalhos de teclado"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-header">
          <span>Atalhos de teclado</span>
          <button className="tool-btn" aria-label="Fechar" onClick={onClose}>
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
