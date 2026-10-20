# KB — Canvas 2D render/interaction scalability and performance

**Symptom:** FPS drops or *judder* when dragging multiple elements, panning
within the `50%–150%` zoom range, dropping elements onto `Context`
(`pointerUp`), hovering, or triggering `undo`/`redo` on large diagrams
($N \ge 1{,}000$ elements), plus sustained CPU/GPU usage while the canvas is idle.

**Root cause:** combination of (1) invalidation of `WeakMap<Element, Path2D>`
by creating new references `{ ...el, x, y }` on every drag frame, (2) bilinear
*resampling* in Skia when filling a `CanvasPattern` under
`ctx.scale(zoom, zoom)`, or using `ctx.setLineDash` on hundreds of grid lines
in the `50%–150%` zoom band, (3) `ctx.clip()` per shape on every frame for
`hachure` fills, (4) linear scans `.find()` / `[...elements].reverse()` inside
loops, and (5) synchronous `JSON.stringify` in `History`.

**Rule (always follow):**

1. **Preserve origin identity on pure translations (`translatedOrigin`)**:
   Whenever creating an element that is only translated (`translateElement`,
   `snapEdgeEndpoints` when both endpoints move by the same `(dx, dy)`),
   propagate the root via
   `translatedOrigin.set(next, translatedOrigin.get(el) ?? el)` and shift
   `rotatedBoundsCache`. In the renderer (`drawElement`, `drawLabel`,
   `getCachedBounds`, `elementVisualBounds`), delegate to the root applying
   `ctx.translate(el.x - root.x, el.y - root.y)` — keeping a 100% cache hit
   rate for `Path2D` (*sketch/hachure*) and text layouts during drags. In the
   `PropertiesPanel` selector, compare `(translatedOrigin.get(el) ?? el)` so
   the panel DOM doesn't re-render at 60 Hz during drags.
2. **Grid (`dots` and `lines`) always via 1:1 `CanvasPattern` in physical pixels**:
   NEVER fill a `CanvasPattern` under `ctx.scale(cam.zoom, cam.zoom)` (forces
   per-pixel bilinear resampling in Skia on HiDPI displays) and NEVER draw the
   dashed micro-grid with `ctx.setLineDash` directly on the main canvas every
   frame. Pre-render a periodic tile (`GRID_CELLS = 10`) at the current
   physical resolution (`scale = ctx.getTransform().a`) and blit it with
   `ctx.setTransform(1, 0, 0, 1, ox - tilePx, oy - tilePx)`.
3. **Zero per-element `ctx.clip()` in the `render()` loop**:
   For `hachure` / `cross-hachure` fills, clip the segments algebraically
   against the shape's geometry (`clipHachureLine` for rectangle, ellipse and
   diamond) once when building the cached `Path2D` (`buildHachurePath`), using
   `clampStart = true, clampEnd = true` in sketch mode and
   `ctx.lineCap = "butt"`.
4. **On-demand rendering via `editor.getRenderToken()`**:
   The `CanvasHost`'s `requestAnimationFrame` loop should only call
   `editor.renderTo` when `editor.getRenderToken()` changes (`renderVersion`
   increment on `doc`/`camera`/`emit` mutations, `assetLoadVersion` increment
   in the `onload` of images/SVGs in `componentAssets.ts`, or presence of an
   arrow with `animated === true` in `getDocIndex(doc).hasAnimated`), or when
   the canvas physical dimensions change.
5. **$O(1)$ per-document indexing (`getDocIndex`) and AABB fast rejection**:
   - Use `getDocIndex(this.doc)` (`byId: Map<string, Element>`,
     `withDetails: Element[]`, `hasAnimated: boolean`) instead of
     `this.doc.elements.find(...)` or repeated linear filters.
   - In `hitTest` and `findNearestBinding`, reject candidates immediately by
     AABB (cached `elementBounds` / `rotatedBounds`) before trigonometry or
     polyline distance.
   - Never use `[...this.doc.elements].reverse()` in pointer handlers;
     iterate with a reverse indexed loop
     (`for (let i = list.length - 1; i >= 0; i--)`).
   - Process context containment (`captureInContexts`,
     `refreshContextContainment`) in batch for ID sets, and keep the linear
     $O(N)$ fast-path in `ensureContextZOrder`.
6. **History by immutable `Document` reference ($O(1)$)**:
   Since `this.doc` is immutable, `History` must store `Document` directly by
   reference — never serialize with `JSON.stringify` / `JSON.parse` in
   `commitHistory()`, `undo()` or `redo()`.
