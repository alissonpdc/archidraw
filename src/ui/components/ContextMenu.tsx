import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { editor } from "../hooks/useEditor";
import { AdditionalInfoModal } from "./AdditionalInfoModal";

const MODIFIER_KEYS = new Set(["Control", "Meta", "Shift", "Alt"]);

interface MenuState {
  x: number;
  y: number;
  /** element under the cursor when the menu opened (null = empty canvas) */
  targetId: string | null;
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
      if (hit) editor.selectElementAt(p);
      setMenu({ x: e.clientX, y: e.clientY, targetId: hit?.id ?? null });
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