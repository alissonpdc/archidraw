import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TARGET =
  'button, [role="button"], [role="menuitem"], [role="tab"], [data-tip]';

interface Tip {
  el: HTMLElement;
  text: string;
  x: number;
  top: number;
  bottom: number;
}

function resolveText(el: HTMLElement): string {
  const own =
    el.getAttribute("data-tip") ||
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    (el.textContent ?? "").trim();
  return own.replace(/\s+/g, " ").trim();
}

export function GlobalTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    below: boolean;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const stripped = useRef<{ el: HTMLElement; title: string } | null>(null);

  useEffect(() => {
    const restoreTitle = () => {
      const s = stripped.current;
      if (s) {
        if (!s.el.hasAttribute("title")) s.el.setAttribute("title", s.title);
        stripped.current = null;
      }
    };
    const hide = () => {
      restoreTitle();
      setTip(null);
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const el = t.closest<HTMLElement>(TARGET);
      if (!el) {
        hide();
        return;
      }
      const text = resolveText(el);
      if (!text) {
        hide();
        return;
      }
      restoreTitle();
      const title = el.getAttribute("title");
      if (title !== null) {
        el.removeAttribute("title");
        stripped.current = { el, title };
      }
      const r = el.getBoundingClientRect();
      setTip({
        el,
        text,
        x: r.left + r.width / 2,
        top: r.top,
        bottom: r.bottom,
      });
    };
    const onOut = (e: MouseEvent) => {
      const rel = e.relatedTarget;
      const s = stripped.current;
      const from = (e.target as Element | null)?.closest?.(TARGET);
      if (from && rel instanceof Node && from.contains(rel)) return;
      if (!from && !s) return;
      hide();
    };
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("mousedown", hide, true);
    document.addEventListener("keydown", hide, true);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    document.documentElement.addEventListener("mouseleave", hide);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("mousedown", hide, true);
      document.removeEventListener("keydown", hide, true);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
      document.documentElement.removeEventListener("mouseleave", hide);
      restoreTitle();
    };
  }, []);

  useEffect(() => {
    if (!tip) return;
    let raf = 0;
    const watch = () => {
      if (!tip.el.isConnected || !tip.el.matches(":hover")) {
        const s = stripped.current;
        if (s) {
          if (!s.el.hasAttribute("title")) s.el.setAttribute("title", s.title);
          stripped.current = null;
        }
        setTip(null);
        return;
      }
      raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(raf);
  }, [tip]);

  useLayoutEffect(() => {
    if (!tip || !ref.current) {
      setPos(null);
      return;
    }
    const r = ref.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, tip.x - r.width / 2),
      window.innerWidth - r.width - 8,
    );
    const below = tip.top < r.height + 16;
    setPos({ left, top: below ? tip.bottom + 8 : tip.top, below });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={ref}
      className="panel-tooltip"
      role="tooltip"
      style={{
        left: pos?.left ?? tip.x,
        top: pos?.top ?? tip.top,
        transform: pos?.below ? "none" : undefined,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
