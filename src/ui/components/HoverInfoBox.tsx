import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { editor } from "../hooks/useEditor";
import { detailsBadgeAnchor } from "../../core/renderer";

interface HoverState {
  details: string;
  /** badge position in screen px (tooltip anchor) */
  x: number;
  y: number;
}

/**
 * Read-only rich tooltip shown while the mouse hovers the details badge
 * ("i") of an element that carries additional information. Portal + fixed
 * so no canvas transform/overflow can clip it (see KB tooltip-clipping).
 */
export function HoverInfoBox() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const contextOpenRef = useRef(false);

  useEffect(() => {
    const onContextEvent = (e: Event) => {
      contextOpenRef.current = (e as CustomEvent<boolean>).detail === true;
      if (contextOpenRef.current) setHover(null);
    };
    window.addEventListener(
      "archidraw:contextmenu",
      onContextEvent as EventListener,
    );
    return () =>
      window.removeEventListener(
        "archidraw:contextmenu",
        onContextEvent as EventListener,
      );
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".canvas-host") ||
        contextOpenRef.current ||
        e.buttons > 0
      ) {
        setHover(null);
        return;
      }
      const el = editor.badgeElementAt({ x: e.clientX, y: e.clientY });
      if (el && el.details) {
        const anchor = detailsBadgeAnchor(
          el,
          editor.getSnapshot().camera.zoom,
        );
        const screen = anchor
          ? editor.getScreenPoint(anchor)
          : { x: e.clientX, y: e.clientY };
        setHover({ details: el.details, x: screen.x, y: screen.y });
      } else {
        setHover(null);
      }
    };
    const onDown = () => setHover(null);
    const onHide = () => setHover(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("wheel", onHide);
    window.addEventListener("scroll", onHide, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("wheel", onHide);
      window.removeEventListener("scroll", onHide, true);
    };
  }, []);

  // clamp the box into the viewport after it is measured
  useLayoutEffect(() => {
    if (!hover || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const offset = 14;
    let left = hover.x + offset;
    let top = hover.y + offset;
    if (left + r.width > window.innerWidth - 8) {
      left = hover.x - r.width - offset;
    }
    if (top + r.height > window.innerHeight - 8) {
      top = hover.y - r.height - offset;
    }
    left = Math.max(8, left);
    top = Math.max(8, top);
    setPos({ left, top });
  }, [hover]);

  if (!hover) return null;

  return createPortal(
    <div
      ref={ref}
      className="hover-info-box"
      role="tooltip"
      data-testid="hover-info-box"
      style={{
        left: pos?.left ?? hover.x,
        top: pos?.top ?? hover.y,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div className="hover-info-title">Additional Information</div>
      <div className="hover-info-body">{hover.details}</div>
    </div>,
    document.body,
  );
}