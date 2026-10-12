import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { editor } from "../hooks/useEditor";
import { detailsBadgeAnchor } from "../../core/renderer";
import { Markdown } from "./Markdown";

interface HoverState {
  id: string;
  details: string;
  /** badge position in screen px (tooltip anchor) */
  x: number;
  y: number;
}

/**
 * Read-only markdown preview shown while the mouse hovers the details badge
 * ("i") of an element that carries additional information. Hovering the
 * element itself shows nothing — the badge is the only trigger, so sweeping
 * the pointer across a dense diagram never makes the card flicker.
 *
 * Portal + `position: fixed` so no canvas transform/overflow can clip it
 * (see KB tooltip-clipping).
 */
export function HoverInfoBox() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const contextOpenRef = useRef(false);

  useEffect(() => {
    const hide = () => setHover(null);

    const onContextEvent = (e: Event) => {
      contextOpenRef.current = (e as CustomEvent<boolean>).detail === true;
      if (contextOpenRef.current) hide();
    };
    window.addEventListener(
      "archidraw:contextmenu",
      onContextEvent as EventListener,
    );

    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".canvas-host") ||
        contextOpenRef.current ||
        e.buttons > 0
      ) {
        hide();
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
        setHover({ id: el.id, details: el.details, x: screen.x, y: screen.y });
      } else {
        hide();
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", hide);
    window.addEventListener("wheel", hide);
    window.addEventListener("scroll", hide, true);

    return () => {
      window.removeEventListener(
        "archidraw:contextmenu",
        onContextEvent as EventListener,
      );
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", hide);
      window.removeEventListener("wheel", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  // the card is driven by pointer events, not by editor state, so a document
  // change while the pointer rests (undo, delete, edit details) would leave it
  // showing stale content. Drop it as soon as its element stops matching.
  useEffect(() => {
    if (!hover) return;
    const unsubscribe = editor.subscribe(() => {
      const current = editor.getElement(hover.id);
      if (!current || current.details !== hover.details) setHover(null);
    });
    return () => {
      unsubscribe();
    };
  }, [hover]);

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
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - r.height - 8));
    setPos({ left, top });
  }, [hover]);

  const details = hover?.details;
  const body = useMemo(
    () => (details ? <Markdown source={details} /> : null),
    [details],
  );

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
      <div className="hover-info-body">{body}</div>
    </div>,
    document.body,
  );
}
