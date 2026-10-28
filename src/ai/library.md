## 5. Library file (`.archidrawlib`)

A library file is a palette of reusable elements imported through the Library panel; it never becomes a tab. It is parsed by the library parser, so the envelope and the item schema are the ones in this section — the `schemaVersion`/`tabs` envelope of section 2 does not apply.

**Every item you generate for this app carries `archidrawElements`.** That array is the native element model of section 3, and it is what makes an item editable after insertion: clicking the tile inserts those elements into the canvas as one group, so every property survives — `roughness` (the line-style / hand-drawn toggle), `borderRadius`, `strokeStyle`, `label`, bindings and `component` items. An item that carries only the Excalidraw-shaped `elements` array of section 5.2 is rasterized into a static image: it renders, but there is nothing to restyle, so the line-style toggle does nothing to it. That raster path exists for foreign `.excalidrawlib` files, not for libraries generated for this app.

### 5.1 Envelope (library version 2)

```json
{
  "type": "archidrawlib",
  "version": 2,
  "libraryItems": [
    {
      "name": "Box",
      "archidrawElements": [
        {
          "id": "lib_box",
          "type": "rectangle",
          "x": 0,
          "y": 0,
          "width": 96,
          "height": 48,
          "strokeColor": "#545c63",
          "backgroundColor": "#b3b8bc",
          "strokeWidth": 1,
          "opacity": 1,
          "strokeOpacity": 1,
          "fillOpacity": 1,
          "strokeStyle": "solid",
          "fillStyle": "solid",
          "roughness": 1,
          "borderRadius": 0,
          "angle": 0,
          "label": "Box"
        }
      ]
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| type | string | no | `"archidrawlib"` in files exported by this app, `"excalidrawlib"` in Excalidraw files; never checked |
| version | number | no | `2` in current files; never checked |
| libraryItems | array of LibraryItem | yes | the only key the parser looks for, besides the legacy `library` |

| LibraryItem field | Type | Required | Notes |
|---|---|---|---|
| name | string | no | label of the tile in the panel; blank or missing → `Item <n>` by position |
| archidrawElements | array of Element | **yes for an editable item** | the native ArchiDraw model (section 3). When present and valid the item is re-inserted as a native editable group and every field is kept, so `roughness` and the other style toggles apply. An item without it is inserted as a static image, whatever else it carries. Element ids only need to be unique inside their own item: insertion clones every element under a fresh id and one shared `groupId` |
| elements | array of ExcalidrawElement | no | Excalidraw-compatible projection (section 5.2): the interchange shape other tools read, and the fallback tile thumbnail. Only required for an item that has no `archidrawElements`; when both are present the natives win, for insertion and for the thumbnail |
| svg | string | no | cached thumbnail SVG of the item, written by this app's export to keep the hand-drawn (rough) stroke; used as the tile image when it contains `<svg`. When absent the thumbnail is rendered from `archidrawElements`, or from `elements` when there are none |

Accepted roots, in order of lookup:

1. The v2 object above: `{libraryItems: [{name, archidrawElements}, ...]}`.
2. A legacy object: `{library: [[element, ...], ...]}` (v1), where every entry is already a bare element array.
3. A root array of element arrays.

Any other root — including a workspace envelope with `tabs` — is rejected (section 5.4).

### 5.6 Example

Two native items: the first is a labelled box (one `rectangle` with a `label`, no separate text element), the second pairs a dashed `arrow` with an `ellipse`. Both are editable on insertion and keep their `roughness` — a value above 0 is what the line-style toggle shows as draft/sketch/chaos. Every colour comes from the palette table of section 3.2, so the tile in the panel and the elements on the canvas draw the same hex.

```json
{
  "type": "archidrawlib",
  "version": 2,
  "libraryItems": [
    {
      "name": "API",
      "archidrawElements": [
        {
          "id": "lib_api",
          "type": "rectangle",
          "x": 0,
          "y": 0,
          "width": 120,
          "height": 64,
          "strokeColor": "#114c83",
          "backgroundColor": "#d3e1ed",
          "strokeWidth": 1,
          "opacity": 1,
          "strokeOpacity": 1,
          "fillOpacity": 1,
          "strokeStyle": "solid",
          "fillStyle": "solid",
          "roughness": 1,
          "borderRadius": 12,
          "angle": 0,
          "label": "API"
        }
      ]
    },
    {
      "name": "Invoke",
      "archidrawElements": [
        {
          "id": "lib_invoke_edge",
          "type": "arrow",
          "x": 0,
          "y": 32,
          "width": 144,
          "height": 0,
          "strokeColor": "#114c83",
          "backgroundColor": "transparent",
          "strokeWidth": 2,
          "opacity": 1,
          "strokeOpacity": 1,
          "fillOpacity": 1,
          "strokeStyle": "dashed",
          "fillStyle": "solid",
          "roughness": 1,
          "borderRadius": 0,
          "angle": 0,
          "startArrowhead": "none",
          "endArrowhead": "arrow"
        },
        {
          "id": "lib_invoke_target",
          "type": "ellipse",
          "x": 144,
          "y": 8,
          "width": 48,
          "height": 48,
          "strokeColor": "#216e2f",
          "backgroundColor": "#d7eadb",
          "strokeWidth": 1,
          "opacity": 1,
          "strokeOpacity": 1,
          "fillOpacity": 1,
          "strokeStyle": "solid",
          "fillStyle": "hachure",
          "roughness": 1,
          "borderRadius": 0,
          "angle": 0,
          "label": "Target"
        }
      ]
    }
  ]
}
```

### 5.4 Validation and rejection rules

Library import is all-or-nothing. The file is rejected when any of these holds:

- The content is not valid JSON.
- The root is not an array and has neither a `libraryItems` nor a `library` array — which is always the case for a section 2 workspace envelope.
- After dropping empty entries, no item is left.

The Library panel reports every rejection with the single message `Invalid library file`.

Everything else is tolerated and never rejects: unknown fields are ignored, an entry that is neither an array nor an object carrying `archidrawElements`, `elements` or both is skipped, and element-level problems only cost that element. An unsupported `type` or a `line`/`arrow` without a usable `points` array disappears; mistyped style fields fall back to their defaults (`strokeWidth` 1, `strokeColor` `#000000`, `fillStyle` `solid`). Geometry, by contrast, is never checked at all: `x`, `y`, `width`, `height` and `points` must already be finite numbers, because a non-numeric value lands as `NaN` in the SVG.

### 5.5 Import semantics

- Channel: Library panel → import button, which accepts `.excalidrawlib` and `.archidrawlib` files. This is not the app menu Open of section 2.4; the two parsers are disjoint, so a workspace envelope fails here and a `libraryItems` file fails there.
- The group takes the file name without extension (`_` becomes a space, an empty base becomes `Imported library`) and opens expanded.
- Every item becomes one tile, registered as an image asset; the group persists in localStorage under `archidraw:importedLibraries` and survives reloads until removed. The thumbnail is the item's stored `svg` when it has one (sketch strokes included), otherwise it is rendered from `archidrawElements`, and only for a raster item from `elements`.
- Clicking a tile inserts a `component` element whose `componentId` starts with `imp-` and carries no label — unless the item has native `archidrawElements`. Those come back as an editable native group (one shared `groupId`, fresh ids, bindings remapped inside the group), so `roughness`, `borderRadius`, `label` and `component` items survive a full export → import round-trip. This is the only path on which the line-style / hand-drawn toggle reaches a library item: a raster item has no elements to restyle.
- The app's own Export .archidrawlib button writes the envelope of section 5.1: per item the exact native array under `archidrawElements`, plus the stored `svg` thumbnail, plus a portable `elements` projection (opacity to 0–100, renaming `cross-hachure` to `cross-hatch`, mapping `dashdot` to `solid`, turning line geometry into `points`, dropping `component` elements). A re-import therefore restores the native elements, not the lossy Excalidraw projection.
- Re-importing a file that was already imported replaces nothing: a new group is added under the file name. Tiles captured from a library imported by an older build keep their raster `component` until the file is imported again.

### 5.2 Element schema (Excalidraw, for items without natives)

This section describes `elements`, the Excalidraw-shaped array, and it applies **only to an item that has no `archidrawElements`** — a foreign `.excalidrawlib`, or a hand-written item that accepts being a static image. Such an item is rasterized into one self-contained SVG, so only the fields below are read. The section 3 element model does **not** transfer: there are no `id`s, no bindings, no `label`, no `component` or `context`, and unknown fields are ignored. A workspace element pasted into the `elements` array keeps the shape of the app model but loses meaning: its `borderRadius`, `roughness`, `strokeOpacity`, `fillOpacity`, `label` and `lineType` are never read from there.

An item that carries a valid `archidrawElements` array is parsed with the section 3 model instead — no field is lost — and is re-inserted as a native editable group; see section 5.5. `elements` is then only the portable projection and the fallback thumbnail, and nothing in this section applies to it. In other words: the recipes below (`closed` silhouettes, `draw`, `roundness` smoothing, hachure alpha) are raster-only, and an item that needs them gives up editability and the line-style toggle.

| Field | Type | Notes |
|---|---|---|
| type | string | `rectangle`, `ellipse`, `diamond`, `line`, `draw`, `arrow`, `text`; anything else (including `component` and `context`) is dropped silently |
| x, y | number | top-left corner for shapes and text; origin of `points` for line, arrow and draw |
| width, height | number | bounding box for rectangle, ellipse, diamond and text (also the rotation center of every element); line, arrow and draw geometry comes from `points`, so these two only feed the box |
| points | array of `[dx, dy]` or `{x, y}` | required for line, arrow and draw: offsets relative to `x`, `y`; fewer than two entries drops the element. Tuples and objects may be mixed inside one array: every entry is normalized on its own, an entry that is neither shape is dropped alone, and the two-entry minimum counts only what survives |
| strokeColor | string | default `#000000`; for `text` it is the glyph color |
| backgroundColor | string | `transparent` or missing → no fill; ignored by `text` |
| fillStyle | string | `hachure` renders the fill at 0.4 alpha, `cross-hatch` at 0.6, `solid` and any other value at full alpha |
| strokeWidth | number | default 1 when missing or not positive |
| strokeStyle | string | `dashed` → `8 5`, `dotted` → dots, anything else (including `dashdot`) solid |
| opacity | number | **0 to 100** (not 0 to 1); `100` or higher renders fully opaque |
| roundness | object or null | truthy (e.g. `{"type": 2}`) or `strokeSharpness: "round"`: on `rectangle` the corners become 25% of the smaller side; on `line`, `draw` and `arrow` it smooths the vertices into quadratic curves, which only matters from three points up (two-point strokes stay straight and `draw` is always smoothed anyway); no effect on `ellipse` and `diamond`; there is no percent knob like `borderRadius` |
| angle | number | radians, clockwise, around the box center |
| startArrowhead, endArrowhead | string or null | arrow only; the end head is drawn unless the value is `null` or `"none"`, the start head only when set to a value other than `"none"`; head size is fixed |
| text, fontSize | string, number | text only; `fontSize` defaults to 20; lines split on `\n`, line step `fontSize * 1.25` |
| fontFamily | number or string | text only; `1` (or a Virgil/Excalifont name) → sketch, `3` (or `cascadia`) → mono, anything else → system-ui |
| closed | boolean | `line` or `draw`: appends the closing segment, also implied when the first point equals the last; the full contour is stroked with `strokeColor`/`strokeWidth`, and only a `line` is then filled per `fillStyle` — `draw` never fills, and an open contour never fills either, so `fillStyle` has nothing to act on there; wherever a fill does exist the `fillStyle` row applies as written (hachure → 0.4 alpha) |

### 5.3 Layout and rendering rules

These rules describe the rasterized item — the `elements`-only path of section 5.2. A native item skips them: its tile is rendered from `archidrawElements` at the item's own proportions, and clicking it inserts the elements at their scene size.

**Native items and color.** On the native path the clamping of section 3.2 is the whole game: the tile is a plain SVG that keeps every hex, while the canvas clamps anything outside the palette table. Take every fill and stroke from that table, or the tile will show a pastel icon and the canvas a darkened one.

- Each item is centered on a square canvas of its bounding box plus 4 px on every side, always inserted at 64 × 64 with `aspect` 1 — a wide icon shrinks to fit the square. When the box is not square, the slack is split equally between the two margins of the axis that has room to spare (a tall icon ends up with equal left and right margins), and everything scales together: a 16 px caption inside an item about 130 px wide lands near 8 px on the canvas.
- Bounding boxes honor `points`, so a line or arrow can reach outside `x` .. `x + width`.
- Text is drawn from `x` left to right with the baseline at `y + fontSize * 0.8`; the SVG carries no `text-anchor`, so `textAlign` is never read and captions must be centered by hand. Horizontally, estimate the rendered width as `fontSize × 0.6 × text.length` (system-ui, mixed case) and set `x = boxCenterX − width / 2` — overestimating by a couple of pixels is invisible after the shrink to 64 px, while underestimating can push glyphs past the 4 px padding of the item box. Vertically, a caption centered in a box of height `H` starts at `y = boxTop + H / 2 − fontSize / 2`, within about a pixel of the optical center.
- Colors are never validated: the string lands in the SVG `fill`/`stroke` as it is and the import still succeeds. A value the browser cannot parse is dropped as an invalid declaration, leaving the SVG default for that property — black fill, no stroke, glyphs included — so stick to hex, `rgb()` or named colors.
- `opacity` below 100 applies to the whole group (the 0 to 100 scale of this dialect); missing `strokeColor` falls back to `#000000`.

**Arcs and silhouettes.** To draw something rounder than the built-in shapes:

- Sample the arc into three or more `points`; with two points the stroke stays straight and the smoothing of section 5.2 never kicks in.
- An open curve — stroke only, nothing drawn back to the start — keeps `closed` off and `backgroundColor: "transparent"`; the path simply stops at the last point.
- A filled silhouette with a curved outline is a `line` with `closed: true` and a `backgroundColor`: the whole contour, closing segment included, is stroked and the area filled. `draw` cannot do that, it never fills.
- Seams are hidden by array order: elements render bottom-up, so an `ellipse` listed after an open `draw` body covers its open end (cylinder: body first, lid ellipse on top).

Filled areas exist natively only through the built-in shapes: a `rectangle`, `ellipse` or `diamond` carries `backgroundColor`/`fillStyle`, and a native `line` or `arrow` is a stroke with no fill of its own. So a silhouette like a cloud or a database cylinder cannot be one native element — compose it instead of falling back to a raster item:

- cylinder = `rectangle` plus an `ellipse` over its top and one under its bottom, all sharing `backgroundColor` and `strokeColor`;
- cloud = three or four overlapping `ellipse` with the same fill;
- globe = one `ellipse` plus two `ellipse` with `fillOpacity: 0` (or two `line` with `bendPoints`) for the meridians;
- inner detail (screen rows, slots, LEDs, bolts) = plain `rectangle`, `ellipse` and `line` drawn on top.

Elements paint bottom-up, so list the body first and the detail last. Overlapping pieces keep their own outlines: if the seams bother you, give the body pieces `strokeColor: "transparent"` and draw a single outline piece over them, or accept the crossing strokes as part of the sketch look. Either way the item stays editable and answers the line-style toggle.
