# KB — Custom context menu on the canvas (right click)

**Symptom:** right-clicking an element starts a drag/marquee instead of
opening the custom menu; or the browser's native menu appears on top of the
application menu.

**Root cause:** the canvas editor treats `pointerdown` as the start of an
interaction (draw/move/marquee). The `contextmenu` event (where the custom
menu opens) **fires after** `pointerdown`, so without a guard the right-click
already started an interaction before the menu exists. Also, elements need
`preventDefault` on `contextmenu` to suppress the native menu.

**Rule (always follow):**

1. In the `Editor`'s `pointerDown`, return early when `button === 2` — the
   right button belongs exclusively to the context menu, never to drag/draw:
   ```ts
   if (button === 2) return;
   ```
2. Menus and tooltips floating over the canvas **always** via `createPortal`
   + `position: fixed` with viewport clamping (same rule as
   `tooltip-clipping.md`) — the canvas has a `transform` (zoom/pan) that
   becomes a containing block and clips `position: absolute`.
3. Suppress the native menu with `preventDefault` only when the event target
   is inside the canvas host (`.canvas-host`), **never** when a text-editing
   `textarea` has focus — there the native menu is required for copy/paste.
4. Menus that need to survive the closing of their own trigger (e.g. a modal
   opened from a menu item) must be rendered **outside** the menu's
   conditional block.
5. Close the menu on: outside click, Escape, wheel/scroll, resize, and window
   blur.
6. **Edge distance:** main menu and submenus keep `EDGE_MARGIN = 8px` from
   EVERY viewport edge. Whatever would overflow the right edge opens to the
   left of the parent item; whatever would overflow the bottom edge moves up
   until it fits.

## Measurement: layout box only (never `getBoundingClientRect` during animation)

**Symptom:** the menu touches (or crosses) the bottom edge of the screen even
with the clamp in place; a submenu opens clipped at the right edge.

**Root cause:** `menu-in` animates `transform: scale(0.97) translateY(-3px)`
for the first 140ms. The positioning `useLayoutEffect` runs on that first
frame, and `getBoundingClientRect()` returns the box **already shrunk** by the
transform. The clamp shifts less than needed and the final box (scale 1)
overflows the edge — you measured a smaller box than the one that will be
rendered.

**Rule (always follow):**

1. Box size always via `offsetWidth`/`offsetHeight` (layout box, immune to
   `transform`), never via `getBoundingClientRect()`.
2. Absolute position in layout space:
   `menuOrigin + offsetParent.client* + offset*`. `offsetTop`/`offsetLeft` are
   measured from the `offsetParent`'s *padding edge*, so add
   `clientTop`/`clientLeft` (the border).
3. The menu origin (`left`/`top` applied) comes from the clamp state itself —
   memoized, otherwise a fresh object per render re-fires the submenu effect
   in a loop (same trap as `getSnapshot()`).
4. Position in `useLayoutEffect` (before paint): the box never flashes in its
   default position.

## Actual implementation

- `src/core/editor.ts` — `button === 2` guard in `pointerDown`; helpers
  `elementAt`, `badgeElementAt`, `selectElementAt`, `updateElementDetails`.
- `src/ui/components/ContextMenu.tsx` — document-level `contextmenu` listener
  + portal/fixed + clamp + closing logic; `EDGE_MARGIN`, `clampEdge`, single
  submenu state `{ id, anchor }` and the `ContextSubmenu` component
  (submenu clamp).
- `tests/specs/context-menu-viewport.spec.ts` — menu and submenu gaps on all
  four edges (the submenu test must keep existing: it's the only one that
  catches the transform-induced clamp error).
- Reference component: `src/ui/components/ContextMenu.tsx`.
