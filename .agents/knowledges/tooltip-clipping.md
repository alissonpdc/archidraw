# KB — Tooltips clipped by overflow containers

**Symptom:** tooltip (hover/help bubble) appears clipped or invisible near the
edges of the panel/menu containing it — top, bottom, sides or all of them.

**Root cause:** tooltips implemented as a CSS pseudo-element
(`[data-tip]::after` with `position: absolute`) are **clipped by any ancestor
with `overflow: hidden/auto/scroll`**. Panels with `max-height` +
`overflow-y: auto` (like `.properties-panel`) always clip the tooltip in some
direction. Known aggravator: `transform`/`filter`/`will-change` on ancestors
create an additional *containing block* and clip the pseudo-element even more.

**Rule (always follow):**

1. CSS tooltips via `::after` are only allowed in containers **without
   overflow** and without `transform` in the ancestor (toolbar, loose
   widgets).
2. Inside any component with its own `overflow-*` or `transform`, use a
   **portal + `position: fixed`** tooltip (rendered outside the clipping
   tree, e.g. `createPortal(..., document.body)`), measuring the anchor
   element's rect and clamping to the viewport edges.
3. When creating a new scrollable panel/popover, decide the tooltip strategy
   **at creation time**, not after the first bug.
4. Never fix it by "pushing the tooltip up/down" (`tip-up` etc.) — it only
   flips the side of the clipping.

## Standard snippet (use as reference)

Actual implementation: `src/ui/components/PropertiesPanel.tsx`
(`PanelTooltip` + event delegation on the root). Essential structure:

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function PanelTooltip({ tip }: { tip: { text: string; x: number; y: number } | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // horizontal clamp so it never leaves the viewport
    const left = Math.min(
      Math.max(8, tip.x - r.width / 2),
      window.innerWidth - r.width - 8,
    );
    setPos({ left, top: tip.y });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={ref}
      className="panel-tooltip" // position: fixed; high z-index; pointer-events: none
      style={{ left: pos?.left ?? tip.x, top: pos?.top ?? tip.y, visibility: pos ? "visible" : "hidden" }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
```

Activation by delegation on the panel root (one handler for all
`[data-tip]`):

```tsx
<div
  onMouseOver={(e) => {
    const el = (e.target as HTMLElement).closest("[data-tip]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTip({ text: el.getAttribute("data-tip") || "", x: r.left + r.width / 2, y: r.top });
  }}
  onMouseLeave={() => setTip(null)}
  onScroll={() => setTip(null)} // the anchor moves with scroll: hide it
>
```

Mandatory CSS when using the portal (suppresses the double tooltip inside the
container):

```css
.properties-panel [data-tip]::after,
.library-panel [data-tip]::after { display: none; }
.panel-tooltip {
  position: fixed;
  transform: translateY(calc(-100% - 8px));
  pointer-events: none;
  /* colors/border/font identical to the system [data-tip] */
}
```

## Checklist before approving new UI

- [ ] Does the container have `overflow`, `max-height` or `transform`?
- [ ] If so, do the tooltips use portal/fixed (not `::after`)?
- [ ] Is the tooltip clamped to the viewport edges?
- [ ] Tested hover on items at the container's top/bottom/side edges?

## KB — Clamp with position-dependent `width` (the box "grows" by itself)

**Symptom:** a floating tooltip anchored at the right/bottom of the viewport
**overflows the edge** even with the clamp applied — `right` equals
`innerWidth` (or vanishes off-screen), while `left + width` looks correct in
the calculation.

**Root cause:** a `position: fixed` box with **only `left` set** and
`width: auto` uses *shrink-to-fit*: the used width is
`min(max-content, available space up to the viewport edge)`. Since the clamp
depends on the measured width **and** the width depends on the `left` the
clamp chooses, the calculation feeds back: `getBoundingClientRect()` measures
a narrow box (because it's still at the edge), the clamp decides it fits,
positions it by the right side, and the box then **re-narrows** — or worse,
overflows.

**Rule:** any clamped tooltip **needs** a width that doesn't depend on
position. Use `width: max-content` (plus `max-width` as the ceiling):

```css
.tooltip-float {
  position: fixed;
  width: max-content;              /* <- essential: independent of `left` */
  max-width: min(420px, calc(100vw - 32px));
}
```

With `width: max-content`, `max-width` remains the ceiling and the actual
width is stable between "before clamping" and "after clamping", so the
`useLayoutEffect` that measures and positions measures the right value.

**Equivalent sibling symptom:** `max-height` + `overflow: auto` on a
top-anchored box makes the `useLayoutEffect` read the **already-limited**
height and position too early. Measure `scrollHeight` when the height ceiling
matters.

Actual implementation: `src/ui/components/HoverInfoBox.tsx` (clamp in
`useLayoutEffect`) + `.hover-info-box` in `src/ui/styles/app.css`.
Spec that catches the regression: `tests/specs/hover-markdown.spec.ts`
("a long preview stays clamped inside the viewport").
