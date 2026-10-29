## 6. Layout guidelines and visual safety

### 6.1 Alignment, spacing and visual collision avoidance

Archidraw provides a continuous 2D canvas with arbitrary positioning, hierarchical boundary contexts, 62 catalog component icons, free-form and orthogonal arrows with port bindings, and configurable camera framing. Because elements do not auto-flow or auto-wrap, AI agents must compute coordinates that prevent visual defects such as clipped text, overlapping labels, and obstructed arrows.

#### 1. Coordinate Grid & Spacing Math

Keep element coordinates on a regular grid so shapes, cards, and columns align cleanly:

```
originX = 80, originY = 80
boxW = 220, boxH = 90, gutterX = 80, gutterY = 60

column(i) x = originX + i * (boxW + gutterX)
row(j)    y = originY + j * (boxH + gutterY)
```

Maintain consistent gutters (`gutterX >= 80`, `gutterY >= 60`) between neighboring elements to leave clear corridors for arrows and labels.

#### 2. Z-Order & Context Containment

- **Z-Order:** Elements are rendered in array order (`elements[0]` is drawn first, at the bottom). When using `context` boundary boxes, declare them **first** in the `elements` array (after any diagram title text), before child shapes, icons, and arrows. This ensures the context background never occludes child elements.
- **Child Containment (`childIds`):** Include in a context's `childIds` only the nodes and internal arrows whose bounding boxes fall 100% inside `[ctx.x, ctx.y, ctx.x + ctx.width, ctx.y + ctx.height]`. Arrows connecting elements across two different contexts belong to neither context's `childIds`.
- **Context Header Clearance:** A `context` with `labelPosition: "top-left"` and `labelSide: "internal"` displays its header text in the upper-left interior band (`ctx.y .. ctx.y + 40`). Position internal elements at `y >= ctx.y + 50` so they never collide with the context header. Leave at least `30 px` padding at the bottom and right edges (`ctx.height >= maxChildBottom - ctx.y + 30`).

#### 3. Native UI Typography & Element Sizing (Zero Overflow)

Archidraw UI uses fixed typography presets. Never invent arbitrary font sizes:

- **Font Sizes (`fontSize`):**
  - Title text: `28` (`L`) or `36` (`XL`).
  - Subtitle text: `14` (`S`).
  - Context headers: `14` (`S`).
  - Shape & card labels (`rectangle`, `diamond`, `ellipse`): `14` (`S`) or `20` (`M`).
  - Component icon captions: `12` (default) or `14` (`S`).
  - Arrow and line labels: `14` (`S`).
- **Box Sizing for Labels:** Shape boxes never auto-wrap text. At `fontSize: 14` (`S`), characters average `~9.6 px` in width.
  - Size cards comfortably: `width >= Math.max(180, Math.ceil(maxLineChars * 10) + 48)` and `height >= 80` (or `height >= 90` for multiline text).
  - Use `\n` in `label` strings to split text into balanced lines rather than creating excessively wide cards.
- **Component Icon Captions:** Every catalog `component` (`width: 60, height: 60`) renders its caption *outside* the box below `y + 60` (roughly `y + 62` to `y + 80`, centered horizontally at `x + 30`, width `~130 px`). Always leave at least `80 px` vertical clearance below a component before placing another node or horizontal arrow, so the caption is never obscured.

#### 4. Arrow Binding Math & Geometry (Zero Endpoint Drift)

An arrow between node `A` and node `B` specifies its attachments via `startBinding` and `endBinding`:

```
startBinding: { elementId: A.id, nx: 1,   ny: 0.5, side: "right" }
endBinding:   { elementId: B.id, nx: 0,   ny: 0.5, side: "left"  }
```

Anchor normalization coordinates (`nx`, `ny`) range from `0` to `1` relative to the target element's top-left corner:
- Top center: `{ nx: 0.5, ny: 0, side: "top" }`
- Right center: `{ nx: 1, ny: 0.5, side: "right" }`
- Bottom center: `{ nx: 0.5, ny: 1, side: "bottom" }`
- Left center: `{ nx: 0, ny: 0.5, side: "left" }`

**Zero Drift Rule:** Always set the arrow's base coordinates to match the bound attachment points exactly:
```
startX = A.x + A.width * startBinding.nx
startY = A.y + A.height * startBinding.ny
endX   = B.x + B.width * endBinding.nx
endY   = B.y + B.height * endBinding.ny

x      = startX
y      = startY
width  = endX - startX
height = endY - startY
```

#### 5. Orthogonal Routing & Corridor Protection

- **Do Not Slice Through Unrelated Elements:** An arrow must not intersect or pass over an unrelated node. If two connected nodes do not have a direct line of sight, route through open gutters between elements using `lineType: "auto"` and explicit `bendPoints`:
  ```json
  "bendPoints": [
    { "x": 500, "y": 200 },
    { "x": 500, "y": 380 }
  ]
  ```
- **Inter-Element Gutters:** Keep corridors of at least `40–60 px` between adjacent shapes and contexts so multi-segment arrows have clean paths without clipping node borders.

#### 6. Arrow Labels & Details Placement

- **Arrow Label Plates:** At `fontSize: 14`, an arrow label renders on an opaque background plate of width `plateW = label.length * 10 + 16 px`.
  - Keep arrow labels concise (`<= 16` characters, e.g., `"HTTPS"`, `"gRPC"`, `"Async Events"`, `"Replication"`).
  - Use `labelT` (`0.0` to `1.0`, where `0.5` is midpoint) to position the label on a sufficiently long, clear segment of the arrow. Avoid setting `labelT` near endpoints or on short bend legs (< 100 px) where the opaque label plate would overlap the connected node.
- **Details Placement:** Store rich documentation, schemas, and metrics in `details` (Markdown) on **node elements** (`rectangle`, `component`), not on arrows or lines. On edges, `details` renders a floating badge that can obstruct narrow routing corridors.

#### 7. Native UI Presets & Color Tokens

Use native UI values to ensure the diagram integrates seamlessly with light/dark themes:

- **`strokeWidth`:** `0`, `1`, `2`, `4`, or `8` (typically `2` for shapes, `1` or `2` for arrows/lines, `1` for contexts, `0` for catalog components).
- **`strokeStyle` & `animated`:** `"solid"`, `"dashed"`, `"dotted"`, or `"dashdot"`. Note: set `"animated": true` only on non-solid strokes (`"dashed"`, `"dotted"`, `"dashdot"`); solid strokes must have `"animated": false`.
- **Colors:** Use hex values from the 15×5 UI palette in `/ai/catalog.md`, or the neutral sentinels (`#3d4248`, `#dfe0e2`, `#c4c7ca`, `transparent`).
- **`textColor`:** Set `"textColor": ""` (`Auto`) on shapes, components, and arrows so the text color automatically tracks stroke color and adapts to light/dark themes. Set `"textColor": "#26292c"` on `context` boundaries when `strokeColor` is `"#c4c7ca"`.

#### 8. Camera Viewport Framing

Compute scene bounds across all elements (`minX, minY, maxX, maxY`, where `spanX = maxX - minX` and `spanY = maxY - minY`):

- **Safe Screen Band:** On a standard 1280 × 800 window, the top toolbar occupies `y: 0..75` and the bottom tab bar occupies `y: 710..800`.
- **Optimal Camera Calculation:**
  ```
  zoom    = Number(Math.min(1, 1180 / spanX, 560 / spanY).toFixed(2))
  scrollX = Math.round(640 - ((minX + maxX) / 2) * zoom)
  scrollY = Math.round(400 - ((minY + maxY) / 2) * zoom)
  ```
  Writing this `camera` in the active tab ensures the entire diagram opens neatly centered and framed without requiring the user to manually zoom or pan.

### 6.2 Operating the three channels

- Import channel: write the workspace JSON to a file named `<name>.archidraw` and open it through the app menu. Success adds one tab per file tab; failure adds nothing and shows an error toast.
- Paste channel: put the clipboard envelope, a bare array or a single element on the clipboard as plain text and trigger paste on the canvas. Success adds one element per array entry; failure is a silent no-op unless the internal store has content.
- Library channel: write the envelope of section 5.1 to a file named `<name>.archidrawlib` and import it through the Library panel. Success adds one group with one tile per item and inserts nothing on the canvas; failure adds nothing and shows `Invalid library file`. Give every item an `archidrawElements` array (section 5.1): that is what makes the tile insert an editable group. An item with only `elements` imports fine but lands as a static image, and the line-style toggle has no effect on it.
- The import and paste channels end with the new elements selected, so a follow-up move or style edit applies to them immediately.

## 8. Agent checklist

- The payload is valid JSON, UTF-8 encoded.
- A file uses `schemaVersion` 2 with a non-empty `tabs` array; every tab has `id`, `name`, `doc` and `camera`.
- A library file uses `version` 2 with a non-empty `libraryItems` array; it never carries `schemaVersion` or `tabs`.
- Every library item carries a non-empty `archidrawElements` array (section 5.1), spelled with the section 3 model: ids, `roughness`, `borderRadius`, `label` and bindings included. An item without it still imports, but it becomes a static image and the line-style / hand-drawn toggle has nothing to act on — in-browser validation reports that as a warning on rule 5.1.
- Each channel rejects the other envelopes: a workspace file fails the Library import and a `libraryItems` file fails Open, both with a generic error (sections 2.2 and 5.4).
- A library item authored natively follows section 3, not section 5.2: write ids, `roughness`, `borderRadius` and `label`, and use signed `width`/`height` for line and arrow geometry instead of `points`. Section 5.2 is the raster dialect — `opacity` from 0 to 100, `roundness` instead of `borderRadius`, geometry in `points`, no ids, bindings or labels — and it applies only to items that have no `archidrawElements`.
- Every element uses one of the nine ElementType values, spelled exactly as in section 3.4.
- Files spell out all base fields explicitly; only clipboard payloads may rely on defaults.
- Element ids are unique inside their document, and bindings reference ids that exist in the same array or payload.
- Numbers are finite. Angles are radians, `borderRadius` is a percentage and opacities range from 0 to 1 (the section 5.2 raster dialect excepted: `opacity` there runs from 0 to 100).
- Enum values are lowercase strings from the tables above.
- Clipboard payloads are atomic: one invalid item rejects everything, so validate every element before writing the payload.
- Unknown fields are dropped silently, not errors.
- Text elements always carry `text` and `fontSize`.
- **Every element uses 100% native UI presets (section 3.2.1):** `fontSize` in `{14, 20, 28, 36}` (`S=14, M=20, L=28, XL=36`, plus `12` default on `component`), `strokeWidth` in `{0, 1, 2, 4, 8}`, palette hexes from `/ai/catalog.md` (`textColor: ""` `Auto` on shapes, components, and arrows; `"#26292c"` on `context` with `#c4c7ca`), and `animated: true` only when `strokeStyle !== "solid"`.
- **Every shape/card is sized for its native `fontSize` without text overflow:** card dimensions provide sufficient padding for text lines (e.g. `width >= Math.max(180, Math.ceil(maxLineChars * 10) + 48)` for `fontSize: 14`), with `\n` used for multiline labels.
- **Every `arrow` or `line` with a `label` explicitly sets `"fontSize": 14` (`S`) and `"textColor": ""` (`Auto`)** with concise `label` (`<= 16` chars), **omits `details` on edges** (putting `details` only on node elements `rectangle`/`component`), ensures the labeled segment has sufficient length for the label plate, and positions `"labelT"` on an open leg so arrow label plates never overlap any node or neighboring label.
- **Visual clearance and non-obstruction:** arrows do not intersect or slice through unrelated elements, context headers have clear top clearance (`y >= ctx.y + 50`), and all elements are framed within the computed `camera` viewport.
- Every field is accepted on every type, but only the types in section 3.9 read it: `borderRadius` rounds only `rectangle`/`component`/`context`, `line`/`arrow`/`text` ignore the fill fields, and a `context` always fills solid (its `fillStyle` is a no-op). Offset and alignment fields move `text` elements, shape labels and `context` captions as described there; edge labels move only with `labelT` and the alignment.
- Line and arrow geometry uses signed `width` and `height` from start to end.
- A well-known logo (cloud service, Kubernetes object) is a `component` with a `componentId` from the section 3.7 catalog, not a labelled box: the catalog draws the official icon, and a plain box draws only what you wrote. Use a labelled `rectangle`/`ellipse` for a concept the catalog does not cover.
- Complementary information goes in `details` (section 3.8): a Markdown string on any element, shown behind an "i" badge and rendered for humans on hover. Keep the label self-sufficient and put contracts, metrics, owners, policies and links in `details`; never hide something the reader must see without interacting in there.
- The drawing is inside the area the camera shows (section 2.1): with the default camera, keep every element inside roughly `x` 0..1280 and `y` 110..700 — the toolbar sits over the top of the window and the tab bar over the bottom, so a title at `y` < 110 opens hidden — or write a `camera` that centres the drawing.
- Before importing, validate the payload in-browser via `window.archidrawValidate` (section 7) or verify against the Ctrl+V / Open file syntax rules; fix every returned `error`; a `warning` usually means a defaulted or dropped field you meant to set. In a library, a 5.1 warning means an item would import as a static image instead of an editable group.
