import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { editor } from "../hooks/useEditor";
import { detailsBadgeAnchor, elementVisualBounds } from "../../core/renderer";
import type { Element } from "../../core/types";
import { Markdown } from "./Markdown";

/** badge hover is deliberate and instant; body hover is ambient and delayed */
const BODY_HOVER_DELAY_MS = 350;

interface HoverState {
  id: string;
  details: string;
  /** anchor position in screen px */
  x: number;
  y: number;
  /** badge anchors instantly, the element body waits out the delay */
  instant: boolean;
}

/** off-screen context used to measure element bounds for the hover anchor */
let measureCtx: CanvasRenderingContext2D | null = null;
function measureContext(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d")!;
  }
  return measureCtx;
}

/**
 * Anchor for the body-triggered card: the top-right corner of the element's
 * visual bounds in scene space, so the preview sits beside the shape instead
 * of chasing the cursor. Falls back to the badge slot for thin shapes.
 */
function hoverAnchor(el: Element): { x: number; y: number } {
  const b = elementVisualBounds(measureContext(), el);
  return { x: b.x2, y: b.y1 };
}

/**
 * Read-only markdown preview shown while hovering an element that carries
 * additional information. Triggered by the details badge ("i", instantly)
 * and by the element body itself (after BODY_HOVER_DELAY_MS), so sweeping
 * the mouse across a dense diagram does not make the card flicker.
 *
 * Portal + `position: fixed` so no canvas transform/overflow can clip it
 * (see KB tooltip-clipping).
 */
export function HoverInfoBox() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const contextOpenRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  // mirror of `hover`, so the pointermove listener (registered once) can read
  // the current value without re-subscribing on every state change
  const hoverRef = useRef<HoverState | null>(null);
  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingIdRef.current = null;
    };
    const hide = () => {
      clearTimer();
      setHover(null);
    };

    const onContextEvent = (e: Event) => {
      contextOpenRef.current = (e as CustomEvent<boolean>).detail === true;
      if (contextOpenRef.current) hide();
    };
    window.addEventListener(
      "archidraw:contextmenu",
      onContextEvent as EventListener,
    );

    const show = (el: Element, instant: boolean) => {
      const anchor = instant
        ? detailsBadgeAnchor(el, editor.getSnapshot().camera.zoom)
        : hoverAnchor(el);
      const screen = anchor ? editor.getScreenPoint(anchor) : null;
      setHover({
        id: el.id,
        details: el.details ?? "",
        x: screen?.x ?? 0,
        y: screen?.y ?? 0,
        instant,
      });
    };

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

      // badge wins: it is a small, deliberate target, so no delay
      const badge = editor.badgeElementAt({ x: e.clientX, y: e.clientY });
      if (badge && badge.details) {
        clearTimer();
        show(badge, true);
        return;
      }

      const el = editor.elementAt({ x: e.clientX, y: e.clientY });
      if (!el || !el.details) {
        hide();
        return;
      }

      // already showing this element, or already counting down towards it:
      // do nothing, so the card stays put while the pointer drifts
      if (pendingIdRef.current === el.id || hoverRef.current?.id === el.id) return;

      clearTimer();
      pendingIdRef.current = el.id;
      const hovered = el;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        pendingIdRef.current = null;
        show(hovered, false);
      }, BODY_HOVER_DELAY_MS);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", hide);
    window.addEventListener("wheel", hide);
    window.addEventListener("scroll", hide, true);

    return () => {
      window.removeEventListener("archidraw:contextmenu", onContextEvent as EventListener);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", hide);
      window.removeEventListener("wheel", hide);
      window.removeEventListener("scroll", hide, true);
      clearTimer();
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
      className={`hover-info-box${hover.instant ? "" : " hover-info-box--body"}`}
      role="tooltip"
      data-testid="hover-info-box"
      data-source={hover.instant ? "badge" : "body"}
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
