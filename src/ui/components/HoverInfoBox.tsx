import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { editor } from "../hooks/useEditor";
import { detailsBadgeAnchor } from "../../core/renderer";
import { Markdown } from "./Markdown";

/** preferred size floor; see resizeBy for how it interacts with narrow content */
const MIN_W = 260;
const MIN_H = 160;
/** absolute floor, so a frame can never be shrunk out of usefulness */
const HARD_MIN = 80;
/** viewport margin kept clear when clamping the frame */
const MARGIN = 8;
const KEY_STEP = 16;
const KEY_STEP_LARGE = 48;
/** padding around the badge that keeps the card alive on the way to the frame */
const BRIDGE_PAD = 18;

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface HoverState {
  id: string;
  details: string;
  /** badge position in screen px (tooltip anchor) */
  x: number;
  y: number;
}

interface Size {
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/**
 * Applies a resize delta.
 *
 * The preferred floor only applies once the frame has reached it. A short
 * note is naturally narrower than MIN_W, and clamping unconditionally would
 * snap the frame *up* to the floor the first time the user nudged it — or,
 * worse, ratchet it there so it could never be shrunk again. Below the floor
 * the frame stays free to shrink, down to HARD_MIN.
 */
function resizeBy(current: number, delta: number, floor: number, max: number): number {
  const lo = current >= floor ? floor : HARD_MIN;
  return Math.round(clamp(current + delta, lo, max));
}

/**
 * Read-only markdown preview shown while the mouse hovers the details badge
 * ("i") of an element that carries additional information. The badge is the
 * only trigger — hovering the shape itself shows nothing.
 *
 * The frame is interactive: it can be scrolled, its links clicked and its
 * bottom-right corner dragged to resize, so it must stay open while the
 * pointer is over it (`pointer-events: auto`). Dismissal therefore has to
 * ignore events originating inside the frame.
 *
 * Portal + `position: fixed` so no canvas transform/overflow can clip it
 * (see KB tooltip-clipping).
 */
export function HoverInfoBox() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const contextOpenRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  /**
   * Union of the frame and the badge that opened it. The frame is anchored
   * `offset` px away from the badge, so travelling between them crosses plain
   * canvas — which would read as "not over the badge" and dismiss the card
   * before the pointer ever reaches it. Treating the whole span as still-valid
   * makes the gap unnoticeable.
   */
  const bridgeRef = useRef<Rect | null>(null);

  /** true when an event happened inside the frame, not on the canvas */
  const insideFrame = useCallback((target: EventTarget | null) => {
    return !!ref.current && target instanceof Node && ref.current.contains(target);
  }, []);

  /** true when the point sits in the badge-to-frame span */
  const insideBridge = useCallback((x: number, y: number) => {
    const b = bridgeRef.current;
    return !!b && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  }, []);

  useEffect(() => {
    const hide = () => {
      bridgeRef.current = null;
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

    const onMove = (e: PointerEvent) => {
      // the frame itself must never dismiss on move: that is how you get to
      // its scrollbar, its links and its resize grip
      if (insideFrame(e.target)) return;
      // ...nor may the gap between the badge and the frame it opened
      if (insideBridge(e.clientX, e.clientY)) return;

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

    const onDown = (e: Event) => {
      // a press inside the frame selects text or follows a link
      if (insideFrame(e.target)) return;
      hide();
    };

    const onWheel = (e: Event) => {
      // scrolling the frame scrolls the frame; anywhere else it pans the
      // canvas, which moves the anchor out from under the card
      if (insideFrame(e.target)) return;
      hide();
    };

    const onScroll = (e: Event) => {
      if (insideFrame(e.target)) return;
      hide();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("archidraw:contextmenu", onContextEvent as EventListener);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [insideFrame, insideBridge]);

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

  // clamp the frame into the viewport after it is measured, and again on
  // every resize so a grown frame cannot be pushed off screen
  useLayoutEffect(() => {
    if (!hover || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const offset = 14;
    let left = hover.x + offset;
    let top = hover.y + offset;
    if (left + r.width > window.innerWidth - MARGIN) {
      left = hover.x - r.width - offset;
    }
    if (top + r.height > window.innerHeight - MARGIN) {
      top = hover.y - r.height - offset;
    }
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - r.width - MARGIN));
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - r.height - MARGIN));
    setPos({ left, top });

    // span from the badge (padded) to the placed frame, so travelling between
    // them never crosses a dismissible pixel. Uses the final `left`/`top`,
    // not the measured rect: on the first pass the box is still sitting at
    // the un-clamped anchor position.
    const bx = hover.x - BRIDGE_PAD;
    const by = hover.y - BRIDGE_PAD;
    bridgeRef.current = {
      left: Math.min(left, bx),
      top: Math.min(top, by),
      right: Math.max(left + r.width, bx + BRIDGE_PAD * 2),
      bottom: Math.max(top + r.height, by + BRIDGE_PAD * 2),
    };
  }, [hover, size]);

  const currentSize = (): Size => {
    const r = ref.current?.getBoundingClientRect();
    return { w: r?.width ?? MIN_W, h: r?.height ?? MIN_H };
  };

  const grow = (targetW: number, targetH: number) => {
    setSize({
      w: resizeBy(targetW, 0, MIN_W, window.innerWidth - MARGIN * 2),
      h: resizeBy(targetH, 0, MIN_H, window.innerHeight - MARGIN * 2),
    });
  };

  const onGripDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // never let the drag reach the canvas: it would start a marquee or a move
    e.preventDefault();
    e.stopPropagation();
    const c = currentSize();
    dragRef.current = { x: e.clientX, y: e.clientY, w: c.w, h: c.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onGripMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    grow(d.w + (e.clientX - d.x), d.h + (e.clientY - d.y));
  };

  const onGripUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onGripKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const c = currentSize();
    switch (e.key) {
      case "ArrowRight":
        grow(c.w + step, c.h);
        break;
      case "ArrowLeft":
        grow(c.w - step, c.h);
        break;
      case "ArrowDown":
        grow(c.w, c.h + step);
        break;
      case "ArrowUp":
        grow(c.w, c.h - step);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const details = hover?.details;
  const body = useMemo(
    () => (details ? <Markdown source={details} /> : null),
    [details],
  );

  if (!hover) return null;

  return createPortal(
    <div
      ref={ref}
      className={`hover-info-box${size ? " hover-info-box--resized" : ""}`}
      role="dialog"
      aria-label="Additional Information"
      data-testid="hover-info-box"
      style={{
        left: pos?.left ?? hover.x,
        top: pos?.top ?? hover.y,
        visibility: pos ? "visible" : "hidden",
        ...(size ? { width: size.w, height: size.h } : null),
      }}
    >
      <div className="hover-info-title">Additional Information</div>
      <div className="hover-info-sep" data-testid="hover-info-sep" />
      <div className="hover-info-body" data-testid="hover-info-body">
        {body}
      </div>
      <div
        className="hover-info-resize"
        data-testid="hover-info-resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize preview"
        tabIndex={0}
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
        onKeyDown={onGripKey}
      />
    </div>,
    document.body,
  );
}
