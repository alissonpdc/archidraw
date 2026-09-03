import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { editor } from "../hooks/useEditor";
import { AdditionalInfoModal } from "./AdditionalInfoModal";
import { buildSvgString, exportSVG } from "../../core/exporter";
import {
  addCustomItem,
  nextCustomNumber,
} from "../../core/customLibrary";
import { unionBounds } from "../../core/utils";
import type { Element } from "../../core/types";
import { toast } from "../toasts";

const MODIFIER_KEYS = new Set(["Control", "Meta", "Shift", "Alt"]);

interface MenuState {
  x: number;
  y: number;
  /** element under the cursor when the menu opened (null = empty canvas) */
  targetId: string | null;
  /** ids to snapshot for "Save": the current selection with every group
   *  completed — a partially-selected group saves the whole group */
  saveIds: string[] | null;
}

/**
 * Full set of elements the "Save" actions should serialize: the selection
 * with each group completed. A group member pulled in by a partial marquee
 * (or any other partial selection) must not leave its siblings behind.
 */
function saveTarget(ids: ReadonlySet<string>): string[] {
  const { doc } = editor.getSnapshot();
  const wanted = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const el of doc.elements) {
      if (!el.groupId || !wanted.has(el.id)) continue;
      for (const sib of doc.elements) {
        if (sib.groupId === el.groupId && !wanted.has(sib.id)) {
          wanted.add(sib.id);
          changed = true;
        }
      }
    }
  }
  return doc.elements.filter((el) => wanted.has(el.id)).map((el) => el.id);
}

/** elements targeted by the open menu's "Save" actions (stable snapshot) */
function saveElements(saveIds: string[] | null): Element[] {
  const snap = editor.getSnapshot();
  const ids = saveIds ?? [...snap.selectedIds];
  const key = new Set(ids);
  return snap.doc.elements.filter((el) => key.has(el.id));
}

/**
 * Replaces the browser context menu over the canvas (`.canvas-host`) with
 * ArchiDraw's own menu. Rendered via portal + fixed positioning so no
 * ancestor overflow/transform can clip it (see KB tooltip-clipping).
 */
export function ContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".canvas-host")) return;
      // text editing keeps the native menu so paste/copy works in the overlay
      if (document.activeElement?.tagName === "TEXTAREA") return;
      e.preventDefault();
      setEditingId(null);
      const p = { x: e.clientX, y: e.clientY };
      const hit = editor.elementAt(p) ?? editor.badgeElementAt(p);
      // The "Save" target is ALWAYS the full current selection (with every
      // group completed). A non-empty selection must never collapse on
      // right-click — even if the cursor lands on an unselected overlapping
      // element — otherwise a multiselection saves only the hit element.
      let selection = editor.getSnapshot().selectedIds;
      if (hit && selection.size === 0) {
        editor.selectElementAt(p);
        selection = editor.getSnapshot().selectedIds;
      }
      setMenu({
        x: e.clientX,
        y: e.clientY,
        targetId: hit?.id ?? null,
        saveIds: hit ? saveTarget(selection) : null,
      });
      window.dispatchEvent(new CustomEvent("archidraw:contextmenu", { detail: true }));
    };
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || !MODIFIER_KEYS.has(e.key)) close();
    };
    const onHide = () => close();
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onHide, { passive: true });
    window.addEventListener("resize", onHide);
    window.addEventListener("blur", onHide);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onHide);
      window.removeEventListener("resize", onHide);
      window.removeEventListener("blur", onHide);
    };
  }, [close]);

  // clamp the menu into the viewport once it is measured
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const r = menuRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8));
    const top = Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8));
    setPos({ left, top });
  }, [menu]);

  useEffect(() => {
    if (menu) return;
    window.dispatchEvent(
      new CustomEvent("archidraw:contextmenu", { detail: false }),
    );
  }, [menu]);

  /** serializa a seleção como SVG standalone (documento só com os ítens) */
  const addToLibrary = () => {
    const selected = saveElements(menu?.saveIds ?? null);
    if (selected.length === 0) return;
    const svg = buildSvgString({ schemaVersion: 1, elements: selected });
    if (!svg) return;
    const b = unionBounds(selected);
    const rawW = b ? b.x2 - b.x1 : 0;
    const rawH = b ? b.y2 - b.y1 : 0;
    const aspect = rawW > 0 && rawH > 0 ? rawW / rawH : 1;
    // guarda os ELEMENTOS Nativos (re-inseridos como grupo editável); o SVG
    // é usado apenas como thumbnail no painel da library
    const item = addCustomItem(selected, svg, aspect);
    toast(`Added "${item.name}" to library`);
    close();
  };

  const downloadSvgImage = () => {
    const selected = saveElements(menu?.saveIds ?? null);
    if (selected.length === 0) return;
    const name = `custom-${nextCustomNumber()}`;
    const ok = exportSVG({ schemaVersion: 1, elements: selected }, name);
    if (ok) toast(`SVG "${name}.svg" downloaded`);
    close();
  };

  if (!menu && !editingId) return null;

  return createPortal(
    <>
      {menu && (
        <div
          ref={menuRef}
          className="context-menu"
          role="menu"
          data-testid="context-menu"
          style={{
            left: pos?.left ?? menu.x,
            top: pos?.top ?? menu.y,
            visibility: pos ? "visible" : "hidden",
          }}
        >
          {menu.targetId ? (
            <>
              <div
                className="context-menu-header"
                data-testid="context-menu-save-header"
              >
                SAVE
              </div>
              <button
                className="context-menu-item"
                role="menuitem"
                data-testid="context-menu-add-library"
                onClick={addToLibrary}
              >
                Add to Library
              </button>
              <button
                className="context-menu-item"
                role="menuitem"
                data-testid="context-menu-download-svg"
                onClick={downloadSvgImage}
              >
                Download SVG Image
              </button>
              <div className="context-menu-divider" />
              <button
                className="context-menu-item"
                role="menuitem"
                data-testid="context-menu-info"
                onClick={() => {
                  setEditingId(menu.targetId);
                  close();
                }}
              >
                Additional Information
              </button>
            </>
          ) : (
            <div className="context-menu-empty" data-testid="context-menu-empty">
              No actions available
            </div>
          )}
        </div>
      )}
      {editingId && (
        <AdditionalInfoModal
          elementId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
    </>,
    document.body,
  );
}