# Archidraw File and Clipboard Syntax Reference

Machine-oriented reference for AI agents that create or edit Archidraw drawings programmatically. It documents the three interchange formats: the `.archidraw` file (complete workspace), the clipboard elements payload (copy/paste) and the `.archidrawlib` file (library of reusable elements). Every JSON example on this page is executed by the automated test suite against the real parser, so the examples are guaranteed valid. Section 7 describes `POST /validate`, an endpoint that reports whether a generated payload is valid and, when it is not, exactly what breaks it.

## 1. Formats at a glance

| Format | Carrier | Top-level shape | Channel |
|---|---|---|---|
| Workspace file | `.archidraw` or `.archidraw.json` (UTF-8, `application/json`) | `{"schemaVersion": 2, "activeTabId": "...", "tabs": [...]}` | Import via the app menu (Open) |
| Clipboard payload | OS clipboard, plain text | `{"schemaVersion": 1, "type": "archidraw/elements", "elements": [...]}` | Paste into the open canvas |
| Library file | `.archidrawlib` or `.excalidrawlib` (UTF-8, `application/json`) | `{"type": "archidrawlib", "version": 2, "libraryItems": [...]}` | Import via the Library panel (import button) |

The three carriers are disjoint: each parser accepts only its own top-level shape and reports a generic error for the others (sections 2.2, 4.3 and 5.4).

Three version markers exist and must not be confused:

- Workspace `schemaVersion` is currently `2`.
- Document `schemaVersion` is currently `1`. It lives inside every tab and is reused by the clipboard envelope, which is also `1`.
- The library file uses `version` (never `schemaVersion`), currently `2`.

## 2. The `.archidraw` file format

### 2.1 Envelope (workspace schema 2)

```json
{
  "schemaVersion": 2,
  "activeTabId": "tab_1",
  "tabs": [
    {
      "id": "tab_1",
      "name": "Diagram 1",
      "doc": {
        "schemaVersion": 1,
        "elements": []
      },
      "camera": { "scrollX": 0, "scrollY": 0, "zoom": 1 }
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| schemaVersion | number | yes | must be exactly `2` |
| activeTabId | string | yes | tab activated when the file is restored; on import the first tab is activated regardless |
| tabs | array of Tab | yes | at least one entry |

The `camera` of the tab being opened decides what the user sees first. It is a plain affine transform: a scene point lands at `screen = scene * zoom + scroll`, in CSS pixels from the top-left of the canvas, and the canvas fills the whole window (the side panels float on top of it). With the default `{scrollX: 0, scrollY: 0, zoom: 1}` everything inside `x` 0..windowWidth and `y` 0..windowHeight is on screen, so a diagram meant to show up whole should stay inside roughly `x` 0..1280 and `y` 110..700 on a 1280 × 800 window (see the chrome below) — or write a `camera` that centers it: `scrollX = windowWidth / 2 − centerX * zoom`, `scrollY` the same with the Y values.

On screen, the app draws its chrome over that canvas, and the chrome hides whatever sits under it: the centered toolbar across the top (`y` 0..75), the tab bar and the zoom controls across the bottom (`y` ≈ windowHeight − 90..windowHeight), the menu button in the top-right corner and the shortcuts hint in the bottom-left. On a 1280 × 800 window that leaves a clean band of roughly `y` 75..710, so a title is safer at `y` ≥ 110 and nothing meant to be read should touch the first or last 90 rows of the window. The user can always press zoom-to-fit, but the first impression is the camera you wrote.

| Tab field | Type | Required | Notes |
|---|---|---|---|
| id | string | yes | stable identifier inside the file; regenerated on import |
| name | string | yes | tab title shown in the tab bar |
| doc | Document | yes | `{"schemaVersion": 1, "elements": [...]}` |
| camera | Camera | yes | `{"scrollX": number, "scrollY": number, "zoom": number}`; zoom `1` means 100% |

### 2.2 Validation and rejection rules

File import is all-or-nothing. The whole file is rejected when any of these holds:

- The content is not valid JSON.
- `schemaVersion` is neither `1` (legacy) nor `2`.
- In schema 2: `activeTabId` is not a string, `tabs` is not a non-empty array, or any tab lacks a string `id`, a string `name`, a `doc` with an `elements` array, or a `camera` with the three numeric fields.

Unknown extra fields are tolerated and ignored. A rejected import adds nothing and reports an error toast.

### 2.3 Legacy schema 1 files and migrations

A legacy single-diagram file is accepted and migrated on load:

```json
{
  "schemaVersion": 1,
  "doc": {
    "schemaVersion": 1,
    "elements": []
  },
  "camera": { "scrollX": 0, "scrollY": 0, "zoom": 1 }
}
```

Migrations applied while loading any file, legacy or not:

- Legacy file envelope becomes one tab with id `tab_1` and name `Diagram 1`.
- Elements with `type: "image"` become `type: "component"` registered as an imported image, with `fill: true` and the raster kept in `src`; invalid images are dropped.
- Missing style fields are filled: `strokeStyle` `solid`, `fillStyle` `solid`, `roughness` `0`, `borderRadius` `0`, `strokeOpacity` `1`, `fillOpacity` `1`, `angle` `0`.
- Legacy bindings `{ "elementId": "...", "anchor": "top" }` become `{ "elementId": "...", "nx": 0.5, "ny": 0 }`. Anchor map: `top` to `0.5, 0`, `right` to `1, 0.5`, `bottom` to `0.5, 1`, `left` to `0, 0.5`, `center` to `0.5, 0.5`.

Important: in a schema 2 file the app does not default geometry or color fields. The base field set is `id`, `type`, `x`, `y`, `width`, `height`, `strokeColor`, `backgroundColor`, `strokeWidth`, `opacity` — nothing fills those — together with the seven style fields listed above, the only ones the loader adds. The elements of sections 2.5 and 2.6 carry exactly this base set plus the type-specific fields their types need, so the field list of the examples is the reference set to copy; every other section 3.2 field is optional fine-tuning (grouping, badges, text and caption offsets) that the examples omit without problem.

### 2.4 Import semantics

- Import is additive. Existing tabs are never replaced or removed.
- Tab ids are regenerated as `tab_<base36 timestamp>_<counter>`.
- Tab names and cameras are preserved.
- The first imported tab becomes the active tab: the tab order decides what you see first after an Open, while `activeTabId` (section 2.1) is honored only when the whole workspace is restored from the autosave when the app starts.
- The picker accepts `.archidraw`, `.archidraw.json` and plain `.json` files carrying this envelope. `.excalidraw` files take a separate import path that is out of scope here.

The same envelope is used for the localStorage autosave (key `archidraw:workspace`), for Save Diagram (active tab exported as a one-tab file `<slug>.archidraw`) and for Save All (`workspace.archidraw`).

### 2.5 Minimal example

```json
{
  "schemaVersion": 2,
  "activeTabId": "tab_1",
  "tabs": [
    {
      "id": "tab_1",
      "name": "Minimal",
      "doc": {
        "schemaVersion": 1,
        "elements": [
          {
            "id": "svc_api",
            "type": "rectangle",
            "x": 100,
            "y": 120,
            "width": 220,
            "height": 90,
            "strokeColor": "#3d4248",
            "backgroundColor": "#dfe0e2",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "solid",
            "fillStyle": "solid",
            "roughness": 0,
            "borderRadius": 8,
            "angle": 0,
            "label": "API"
          },
          {
            "id": "link_1",
            "type": "arrow",
            "x": 320,
            "y": 165,
            "width": 140,
            "height": 0,
            "strokeColor": "#3d4248",
            "backgroundColor": "#dfe0e2",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "solid",
            "fillStyle": "solid",
            "roughness": 0,
            "borderRadius": 0,
            "angle": 0,
            "startArrowhead": "none",
            "endArrowhead": "arrow"
          }
        ]
      },
      "camera": { "scrollX": 0, "scrollY": 0, "zoom": 1 }
    }
  ]
}
```

### 2.6 Complete example (all nine element types)

```json
{
  "schemaVersion": 2,
  "activeTabId": "tab_payments",
  "tabs": [
    {
      "id": "tab_payments",
      "name": "Payments",
      "doc": {
        "schemaVersion": 1,
        "elements": [
          {
            "id": "ctx_payments",
            "type": "context",
            "x": 40,
            "y": 40,
            "width": 640,
            "height": 360,
            "strokeColor": "#c4c7ca",
            "backgroundColor": "transparent",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "solid",
            "fillStyle": "solid",
            "roughness": 0,
            "borderRadius": 12,
            "angle": 0,
            "label": "Payments",
            "labelPosition": "top-left",
            "labelSide": "internal",
            "childIds": ["rect_api", "comp_ec2", "diamond_decide", "ellipse_cache", "shape_join", "line_1", "arrow_1", "text_note"]
          },
          {
            "id": "rect_api",
            "type": "rectangle",
            "x": 80,
            "y": 100,
            "width": 200,
            "height": 90,
            "strokeColor": "#3d4248",
            "backgroundColor": "#dfe0e2",
            "strokeWidth": 2,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "solid",
            "fillStyle": "solid",
            "roughness": 1,
            "borderRadius": 8,
            "angle": 0,
            "label": "API Service"
          },
          {
            "id": "comp_ec2",
            "type": "component",
            "x": 80,
            "y": 240,
            "width": 64,
            "height": 64,
            "strokeColor": "#3d4248",
            "backgroundColor": "#dfe0e2",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "solid",
            "fillStyle": "solid",
            "roughness": 0,
            "borderRadius": 0,
            "angle": 0,
            "componentId": "ec2",
            "label": "EC2",
            "fill": false
          },
          {
            "id": "diamond_decide",
            "type": "diamond",
            "x": 340,
            "y": 100,
            "width": 160,
            "height": 100,
            "strokeColor": "#3d4248",
            "backgroundColor": "#dfe0e2",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "dashed",
            "fillStyle": "solid",
            "roughness": 0,
            "borderRadius": 0,
            "angle": 0,
            "label": "Throttle?"
          },
          {
            "id": "ellipse_cache",
            "type": "ellipse",
            "x": 360,
            "y": 250,
            "width": 140,
            "height": 90,
            "strokeColor": "#3d4248",
            "backgroundColor": "#dfe0e2",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "solid",
            "fillStyle": "hachure",
            "roughness": 2,
            "borderRadius": 0,
            "angle": 0,
            "label": "Cache"
          },
          {
            "id": "shape_join",
            "type": "polygon",
            "x": 520,
            "y": 250,
            "width": 120,
            "height": 60,
            "strokeColor": "#3d4248",
            "backgroundColor": "#dfe0e2",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "solid",
            "fillStyle": "solid",
            "roughness": 1,
            "borderRadius": 0,
            "angle": 0,
            "label": "Joined",
            "rings": [
              [
                { "x": 0, "y": 0 }, { "x": 120, "y": 0 },
                { "x": 120, "y": 60 }, { "x": 0, "y": 60 }
              ]
            ]
          },
          {
            "id": "arrow_1",
            "type": "arrow",
            "x": 280,
            "y": 150,
            "width": 60,
            "height": 0,
            "strokeColor": "#3d4248",
            "backgroundColor": "#dfe0e2",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "solid",
            "fillStyle": "solid",
            "roughness": 0,
            "borderRadius": 0,
            "angle": 0,
            "startArrowhead": "none",
            "endArrowhead": "arrow",
            "label": "invoke",
            "labelT": 0.5,
            "lineType": "straight",
            "startBinding": { "elementId": "rect_api", "nx": 1, "ny": 0.5556, "side": "right" },
            "endBinding": { "elementId": "diamond_decide", "nx": 0, "ny": 0.5, "side": "left" }
          },
          {
            "id": "line_1",
            "type": "line",
            "x": 420,
            "y": 200,
            "width": 10,
            "height": 50,
            "strokeColor": "#3d4248",
            "backgroundColor": "#dfe0e2",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "dotted",
            "fillStyle": "solid",
            "roughness": 0,
            "borderRadius": 0,
            "angle": 0,
            "lineType": "straight",
            "startBinding": { "elementId": "diamond_decide", "nx": 0.5, "ny": 1, "side": "bottom" },
            "endBinding": { "elementId": "ellipse_cache", "nx": 0.5, "ny": 0, "side": "top" }
          },
          {
            "id": "text_note",
            "type": "text",
            "x": 380,
            "y": 360,
            "width": 220,
            "height": 24,
            "strokeColor": "#3d4248",
            "backgroundColor": "transparent",
            "strokeWidth": 1,
            "opacity": 1,
            "strokeOpacity": 1,
            "fillOpacity": 1,
            "strokeStyle": "solid",
            "fillStyle": "solid",
            "roughness": 0,
            "borderRadius": 0,
            "angle": 0,
            "text": "Latency budget: 50ms",
            "fontSize": 16,
            "bold": false,
            "textAlign": "left"
          }
        ]
      },
      "camera": { "scrollX": 0, "scrollY": 0, "zoom": 1 }
    }
  ]
}
```

## 3. Element model

### 3.1 Coordinate system and z-order

- Scene units are pixels at zoom `1`. The Y axis grows downward.
- For rectangles, diamonds, ellipses, polygons, components, contexts and text, `x` and `y` are the top-left corner of the bounding box and `width`/`height` are positive.
- A `polygon` (boolean result) keeps its real outline in `rings`; `x`, `y`, `width` and `height` are just the bounding box of those rings and must match it whenever you write the element by hand.
- For lines and arrows, `x` and `y` are the start point and `x + width`, `y + height` are the end point. `width` and `height` are signed, so a stroke going up-left uses negative values.
- `angle` is in radians, clockwise, around the center of the box. The `x`, `y`, `width` and `height` values always describe the unrotated box.
- `borderRadius` is a percentage of the smaller side, from `0` to `100`.
- `opacity`, `strokeOpacity` and `fillOpacity` range from `0` to `1` and multiply each other.
- Elements render in array order: index `0` is the bottommost layer. The app keeps context elements beneath their children, so list a context before the elements it contains.

### 3.2 Common fields

Present on every element. The default column applies to the clipboard normalizer; in a `.archidraw` file write every base field explicitly.

| Field | Type | Default on paste | Notes |
|---|---|---|---|
| id | string | generated as `el_<base36>_<base36>` | unique within the document; always regenerated on paste |
| type | ElementType | required | an unknown value rejects the whole clipboard payload |
| x | number | 0 | scene X of the top-left corner |
| y | number | 0 | scene Y of the top-left corner |
| width | number | 100 | signed run for line and arrow |
| height | number | 100 | signed run for line and arrow |
| strokeColor | string | `#3d4248` | any CSS color; read the color note below before picking one |
| backgroundColor | string | `#dfe0e2` | any CSS color, or `transparent` for no fill; read the color note below |
| strokeWidth | number | 1 | outline width in scene units |
| opacity | number | 1 | alpha of the whole element, 0 to 1. This is the scale everywhere in this document, including native library items; the only place that uses 0 to 100 is the Excalidraw dialect of section 5.2 |
| strokeOpacity | number | 1 | alpha of the outline |
| fillOpacity | number | 1 | alpha of the fill |
| strokeStyle | StrokeStyle | `solid` | |
| fillStyle | FillStyle | `solid` | |
| roughness | integer 0 to 3 | 0 | rounded and clamped; 0 clean, 1 draft, 2 sketchy, 3 chaos |
| borderRadius | number | 0 | percent of the smaller side |
| angle | number | 0 | radians, clockwise, around the box center |
| groupId | string | none | elements sharing a groupId move, select and resize together |
| locked | boolean | false | disables direct manipulation |
| details | string | none | free-form technical note rendered as a badge |
| fontFamily | string | app default | CSS family name |
| bold | boolean | false | |
| italic | boolean | false | |
| underline | boolean | false | |
| textColor | string | falls back to `strokeColor` | empty string also falls back |
| lineSpacing | number | 1.25 | line height multiplier for multi-line text |
| fontSize | number | 20 for labels and text, 16 for context labels, 12 for component labels | |
| textAlign | TextAlign | `center` for labels, `left` for text elements | |
| textVAlign | TextVAlign | `middle` | |
| textOffsetGlobal | number | 0 | pixels added to every side offset |
| textOffsetTop | number | 0 | pixels, vertical fine tuning of the text block |
| textOffsetBottom | number | 0 | pixels, vertical fine tuning of the text block |
| textOffsetLeft | number | 0 | pixels, horizontal fine tuning of the text block |
| textOffsetRight | number | 0 | pixels, horizontal fine tuning of the text block |
| captionPosition | CaptionPosition | `bottom` | side that carries a `component` caption — the only label it moves; the details badge has its own fixed anchor (bottom-right corner on shapes, below the label on edges) |
| captionGap | number | 2 | pixels between the element and its caption |
| captionOffsetTop | number | 0 | pixels, caption fine tuning |
| captionOffsetBottom | number | 0 | pixels, caption fine tuning |
| captionOffsetLeft | number | 0 | pixels, caption fine tuning |
| captionOffsetRight | number | 0 | pixels, caption fine tuning |

**Color note.** The canvas only draws a color exactly as written when it belongs to the app palette below; any other color is stepped in lightness until it reaches a 3:1 contrast ratio against the canvas background, so an off-palette pastel such as `#ffe8cc` lands visibly darker on a white canvas, and an off-palette near-black is lightened on a dark one. The SVG export and the library tile thumbnails do **not** clamp: they keep the color as written. A generated library that uses off-palette pastels therefore shows pale pastel tiles and much darker elements once inserted on the canvas. Here is the whole palette, one row per hue, lightest shade first:

| Hue | Lightest | Lighter | Base | Darker | Darkest |
|---|---|---|---|---|---|
| Grey | #dfe0e2 | #b3b8bc | #868e96 | #545c63 | #26292c |
| Red | #edd4d4 | #de8c8c | #e03131 | #9b1717 | #470b0b |
| Pink | #ecd5dd | #d98ca7 | #d6336c | #901d45 | #440e21 |
| Grape | #e6d7ea | #c692d3 | #ae3ec9 | #752687 | #371240 |
| Purple | #dbd5ec | #a694db | #6741d9 | #3d1f99 | #1b0e44 |
| Indigo | #d1d7ef | #94a6ea | #4c6ef5 | #0b2ebc | #04134d |
| Blue | #d3e1ed | #72a8d9 | #1971c2 | #114c83 | #092a48 |
| Cyan | #d4e9ec | #81ced9 | #22b8cf | #177d8c | #0c3e46 |
| Teal | #d4ede5 | #7dd9be | #20c997 | #168866 | #0b4635 |
| Green | #d7eadb | #7ec88c | #2f9e44 | #216e2f | #133f1b |
| Lime | #e3ecd5 | #bbda8b | #94d82d | #63921b | #2f450d |
| Yellow | #f0e9d1 | #e7d07e | #f5c518 | #a68407 | #4e3e03 |
| Orange | #f1e3d0 | #ebb870 | #f08c00 | #a35f00 | #523000 |
| Coral | #f0ddd0 | #e8a578 | #f76707 | #a44405 | #4f2102 |
| Brown | #e8ddd9 | #c69d8b | #a65e3f | #6f3f2a | #3b2116 |

The two lightest columns carry fills, the three darkest columns carry strokes; a color from another hue's row is fine, a color outside the table is not. Four values are special-cased instead of clamped: `transparent`, `#c4c7ca` (the context-boundary stroke, drawn `#3b3835` on dark canvases) and the two sentinels of the default columns above — `#3d4248` is *replaced* by the active theme stroke (near-black `#26292c` on light canvases) and `#dfe0e2` by the theme fill (near-black on dark canvases). The sentinels therefore follow the theme instead of the tile: a shape stroked `#3d4248` shows the theme colour on the canvas, while the tile thumbnail and the SVG export keep the literal `#3d4248`. Use them for documents, which the app itself writes with them; for a library tile that must match the canvas, take an explicit colour from the table.

### 3.3 Type-specific fields

| Element type | Extra fields |
|---|---|
| rectangle, diamond, ellipse | `label` (string) — drawn inside the box |
| polygon | `rings` (required, array of rings of `{x, y}` points), `label` (string) — drawn inside the box. `rings[0]` is the outer ring; every following ring is a hole. Coordinates are local to the element: `(0, 0)` is the top-left corner `x, y`, so moving the element only rewrites `x`/`y`. Rings are open — do not repeat the first point at the end — and need at least 3 points each |
| line | `label`, `labelT`, `lineType`, `controlPoint`, `bendPoints`, `startBinding`, `endBinding` |
| arrow | all line fields plus `animated` (boolean, default false), `startArrowhead` (default `none`), `endArrowhead` (default `arrow`) |
| text | `text` (string, defaults to empty), `fontSize` (number, defaults to 20) |
| component | `componentId` (string, defaults to empty), `label` (caption drawn outside the box, on the `captionPosition` side), `src` (data URL of a raster), `fill` (boolean, default false; true stretches the raster to the whole box). The catalog id picks a bundled icon — see section 3.7 |
| context | `label`, `labelPosition` (default `top-left`), `labelSide` (`internal` when created in the app, `external` when missing), `childIds` (array of element id strings) |

Notes on edges:

- An edge never fills its interior: `backgroundColor`, `fillStyle` and `fillOpacity` on a `line` or `arrow` are read and then ignored when drawing it. Write `transparent` and move on.
- `labelT` positions the label along the edge from `0` (start) to `1` (end), default `0.5`.
- `controlPoint` is an absolute scene point that bends a `curved` line or arrow.
- `bendPoints` are intermediate vertices used by `auto` routing. The array is all-or-nothing: every item must be a valid `{x, y}` point or the field is dropped.
- File defaults: the loader (section 2.3) fills none of these, and the renderer falls back on every read — a missing `lineType` reads as `straight`, `startArrowhead` as `none`, `endArrowhead` as `arrow`, `labelT` as `0.5`, `animated` as `false`. Omitting them is safe; writing them, as the examples do, is just clearer.
- `componentId` picks the icon from the section 3.7 catalog (`ec2`, `lambda`, `ecs`, `eks`, `api-gateway`, `elb`, `route53`, `cloudfront`, `vpc`, `dynamodb`, `rds`, `elasticache`, `s3`, `sqs`, `sns` and many more, the GCP/Azure/Kubernetes sets included).
- `src` holds a self-contained raster such as `data:image/png;base64,...` for pasted or imported images.
- Nothing from the section 5.2 dialect belongs here: `points`, `roundness`, `closed` and the `draw` type exist only on the raster library path, and corner rounding is spelled `borderRadius` in this model. Writing them on a native element does nothing.

Notes on polygons (boolean results): the app writes them from the Layers panel → Merge actions (`union`, `subtract`, `intersect`, `crop`). The operation is destructive — the operands are removed and the result takes their place at the topmost operand's z-position, carrying its stroke and fill style. Each connected solid becomes its own `polygon` element, so joining two disjoint shapes yields two polygons, and a subtraction that leaves two pieces also yields two. `crop` and `subtract` read the topmost selected shape as cutter/mask (`crop` keeps only what falls inside it, `subtract` removes it). A `polygon` is itself a valid operand for a later operation, so results can be combined again. When writing one by hand, keep `x`/`y`/`width`/`height` equal to the ring bounding box; a ring set with an empty outer ring is invalid and the element is rejected on paste.

Note on contexts: `childIds` is read as written — Open never recomputes membership nor prunes the array; a dead id is ignored, not rejected. Fill it with the app's own rule: an element of any type — edges included — belongs to a context when its rotated bounds fall entirely inside the context's bounds, which is what the app records whenever an element is created, pasted or duplicated inside a context (contexts are never members of other contexts). A context the app itself creates is `strokeColor: "#c4c7ca"`, `backgroundColor: "transparent"`, `strokeWidth: 1`, `borderRadius: 10`, `fontSize: 16`, `labelPosition: "top-left"` and `labelSide: "internal"`; copy those values when the drawing needs a plain boundary, and remember that a fill is a real fill — take one from the section 3.2 palette if you want the region tinted. A context's caption is drawn in `textColor`, which falls back to `strokeColor`, so the `#c4c7ca` boundary an app-made context carries gives a deliberately faint region name: set `textColor` (a palette colour) or a darker `strokeColor` when the name has to be read.

### 3.4 Enumerations

| Name | Values |
|---|---|
| ElementType | `rectangle`, `diamond`, `ellipse`, `polygon`, `line`, `arrow`, `text`, `component`, `context` |
| StrokeStyle | `solid`, `dashed`, `dotted`, `dashdot` |
| FillStyle | `solid`, `hachure`, `cross-hachure` |
| LineType | `straight`, `curved`, `auto` |
| ArrowHeadType | `none`, `circle`, `arrow`, `triangle` |
| TextAlign | `left`, `center`, `right` |
| TextVAlign | `top`, `middle`, `bottom` |
| CaptionPosition | `top`, `bottom`, `left`, `right` |
| LabelPosition | `top-left`, `top-right`, `bottom-left`, `bottom-right` |
| BindingSide | `top`, `bottom`, `left`, `right` |
| ContextLabelSide | `internal`, `external` |

All enum values are lowercase strings. An invalid value falls back to the default on paste and is not an error by itself.

### 3.5 Edge bindings

Lines and arrows attach to other elements through `startBinding` and `endBinding`.

| Field | Type | Default | Notes |
|---|---|---|---|
| elementId | string | required | id of the bound element |
| nx | number | 0.5 | horizontal position inside the target bounds, 0 to 1 |
| ny | number | 0.5 | vertical position inside the target bounds, 0 to 1 |
| side | BindingSide | none | hint for the attach side |

A binding object without a string `elementId` is dropped. In a file, reference ids that exist in the same `elements` array. On paste, a binding to an element inside the same payload is remapped to its clone; a binding to an element outside the payload keeps referencing the original element in the scene.

### 3.6 Text and label layout

Text elements align inside their own box: `textAlign` picks the horizontal anchor and `textVAlign` the vertical one, then `textOffset*` values nudge the block in pixels. Multi-line text uses embedded newline characters and `lineSpacing` as the line height multiplier. `textColor` empty or missing falls back to `strokeColor`.

Label placement depends on the type: on `rectangle`, `diamond` and `ellipse` the label sits inside the box, anchored by `textAlign` (default `center`) and `textVAlign` (default `middle`) and inset by the `textOffset*` values; on `line` and `arrow` it is centred exactly on the edge point given by `labelT` (midpoint by default), with no perpendicular shift, and the text is painted over an opaque plate of the canvas background padded by `max(2, fontSize × 0.3)`, which masks the stroke under it — a label wider than the clear run of the stroke therefore hides the line it belongs to, so keep it short, move it with `labelT`, or write a separate `text` element where it must sit clear of the stroke; on `component` it sits outside the icon on the `captionPosition` side (default `bottom`), spaced by `captionGap` and the `captionOffset*` values — the only place `captionPosition` applies; on `context` it goes to the corner named by `labelPosition` (default `top-left`), drawn inside the box when `labelSide` is `internal` and outside when `external` (a missing `labelSide` reads as `external` — contexts the app creates start with `internal`).

The box never wraps: lines break only on `\n`, and `width`/`height` are just the anchor rectangle inside which `textAlign` and `textVAlign` position the block — a line longer than `width` keeps drawing past the box, nothing is clipped. Size the box to the content before you place anything next to it: in the default sans font a line is about `fontSize × 0.6 × text.length` pixels wide and `fontSize × 1.25` tall, which is the same estimate section 5.3 uses when it lays the caption of a library tile.

### 3.7 Component catalog

`component` is the element that paints one of the app's built-in architecture icons, and it is the right element whenever a figure has a well-known logo: a cloud service, a Kubernetes object. The icon is looked up by `componentId` and drawn as a square of `min(width, height)` centred in the box, so a square box keeps the icon at full size — and an icon drawn at full size covers the whole box, fill included, which is why a tinted card only shows its fill when the box is larger than the icon on at least one axis. The box itself only paints if you ask it to: to get the icon and nothing else, copy what the panel inserts — `strokeWidth: 0` and `fillOpacity: 0` — and put the name in `label`, drawn outside the icon on the `captionPosition` side (section 3.6). Give the box a visible outline or fill only when the icon should sit inside a container.

The whole catalog, each id with its official bundled icon:

| `componentId` | Renders as | Category |
|---|---|---|
| `ec2` | EC2 | Compute |
| `lambda` | Lambda | Compute |
| `ecs` | ECS | Compute |
| `eks` | EKS | Compute |
| `api-gateway` | API Gateway | Network |
| `elb` | Load Balancer | Network |
| `route53` | Route 53 | Network |
| `cloudfront` | CloudFront | Network |
| `vpc` | VPC | Network |
| `dynamodb` | DynamoDB | Database |
| `rds` | RDS | Database |
| `elasticache` | ElastiCache | Database |
| `s3` | S3 | Storage |
| `sqs` | SQS | Messaging |
| `sns` | SNS | Messaging |
| `eventbridge` | EventBridge | Messaging |
| `step-functions` | Step Functions | Messaging |
| `kinesis` | Kinesis | Messaging |
| `cognito` | Cognito | Security |
| `iam` | IAM | Security |
| `cloudwatch` | CloudWatch | Monitoring |
| `gcp-compute-engine` | Compute Engine | Compute |
| `gcp-cloud-run` | Cloud Run | Compute |
| `gcp-gke` | GKE | Compute |
| `gcp-cloud-functions` | Cloud Functions | Compute |
| `gcp-vpc` | VPC | Network |
| `gcp-bigquery` | BigQuery | Database |
| `gcp-spanner` | Cloud Spanner | Database |
| `gcp-cloud-storage` | Cloud Storage | Storage |
| `gcp-pubsub` | Pub/Sub | Messaging |
| `gcp-cloud-armor` | Cloud Armor | Security |
| `azure-vm` | Virtual Machines | Compute |
| `azure-app-service` | App Service | Compute |
| `azure-aks` | AKS | Compute |
| `azure-functions` | Azure Functions | Compute |
| `azure-vnet` | Virtual Network | Network |
| `azure-cosmos-db` | Cosmos DB | Database |
| `azure-sql` | Azure SQL | Database |
| `azure-blob-storage` | Blob Storage | Storage |
| `azure-service-bus` | Service Bus | Messaging |
| `azure-event-grid` | Event Grid | Messaging |
| `k8s-pod` | Pod | Compute |
| `k8s-deployment` | Deployment | Compute |
| `k8s-statefulset` | StatefulSet | Compute |
| `k8s-daemonset` | DaemonSet | Compute |
| `k8s-job` | Job | Compute |
| `k8s-cronjob` | CronJob | Compute |
| `k8s-replicaset` | ReplicaSet | Compute |
| `k8s-service` | Service | Networking |
| `k8s-ingress` | Ingress | Networking |
| `k8s-networkpolicy` | NetworkPolicy | Networking |
| `k8s-endpoint` | Endpoint | Networking |
| `k8s-persistentvolume` | PersistentVolume | Storage |
| `k8s-persistentvolumeclaim` | PersistentVolumeClaim | Storage |
| `k8s-storageclass` | StorageClass | Storage |
| `k8s-configmap` | ConfigMap | Config |
| `k8s-secret` | Secret | Config |
| `k8s-namespace` | Namespace | Cluster |
| `k8s-node` | Node | Cluster |
| `k8s-rbac` | RBAC | Cluster |
| `k8s-serviceaccount` | ServiceAccount | Cluster |
| `k8s-hpa` | HorizontalPodAutoscaler | Cluster |

An id outside this table is still a valid element: it draws a generic placeholder icon with a short caption of the id, which is what a pasted or generated diagram gets for a logo the app does not know. `fill: true` is for raster assets only (`src`, section 3.3): it stretches the image over the whole box instead of squaring it in the middle, and it is ignored for a catalog id.

## 4. Clipboard syntax (copy and paste)

### 4.1 Envelope

```json
{
  "schemaVersion": 1,
  "type": "archidraw/elements",
  "elements": []
}
```

| Field | Type | Notes |
|---|---|---|
| schemaVersion | number | clipboard format version, currently `1` |
| type | string | the literal `archidraw/elements`; advisory metadata for external tools, not checked by the parser |
| elements | array of Element | the copied elements |

The app writes this envelope pretty-printed with two-space indentation. The parser is whitespace-insensitive, so compact JSON works too.

### 4.2 Accepted payload shapes

The paste parser accepts four shapes:

1. The envelope object above.
2. A bare array of elements.
3. A single element object.
4. A library envelope (section 5.1) whose items carry native `archidrawElements`: every native element is pasted as one grouped set. A foreign library whose items only have Excalidraw `elements` has nothing native to paste and falls through to the internal store.

### 4.3 Validation, defaults and whitelisting

- The payload must parse as JSON.
- Validation is atomic. If any item is not an object or carries an `type` value outside the nine element types, the entire payload is rejected and nothing is pasted.
- Wrong-typed optional fields are dropped silently or replaced by their default. They never reject the payload.
- Geometry collections are all-or-nothing: `bendPoints` and `childIds` are kept only when every item is valid.
- Unknown fields are dropped. The parser keeps a whitelist per element type, listed in section 3.3.

### 4.4 Normalizer defaults

Applied when a field is missing or has the wrong type on paste:

| Case | Result |
|---|---|
| missing id or non-string id | generated `el_<base36 timestamp>_<base36 counter>` |
| missing x, y | 0 |
| missing width, height | 100 |
| missing strokeColor | `#3d4248` |
| missing backgroundColor | `#dfe0e2` |
| missing strokeWidth | 1 |
| missing opacity, strokeOpacity, fillOpacity | 1 |
| missing strokeStyle, fillStyle | `solid` |
| missing or invalid roughness | rounded and clamped into 0 to 3, default 0 |
| missing borderRadius, angle | 0 |
| text without text | empty string |
| text without fontSize | 20 |
| component without componentId | empty string |
| binding without nx, ny | 0.5 each |

### 4.5 Paste semantics

- Pasted clones are appended at the end of the active tab element array, so they land on top of the z-order, and they become the current selection.
- Every clone receives a fresh id. Bindings and context `childIds` that point to elements inside the same payload are remapped to the new ids. References to elements outside the payload are kept as-is.
- A `groupId` shared by two or more pasted elements is remapped to a fresh group id. A group left with a single pasted member loses its `groupId`.
- Consecutive pastes cascade a diagonal offset of 16 pixels per step: 16, 32, 48 and so on.
- Paste at pointer centers the bounding box of the pasted elements on the pointer position.
- A pasted library envelope (shape 4 of section 4.2) is exempt from the cascade: its native elements land as one group centered on the viewport, exactly like a tile click in the Library panel, and become the selection.
- Pasted elements fully inside an existing context are captured into that context `childIds`.

### 4.6 Copy and cut

- Copy serializes the selected elements into the envelope and writes it to the OS clipboard on a best-effort basis. The same text also lands in the internal store under the localStorage key `archidraw:clipboard`, which always works.
- Cut is copy followed by delete.
- Copy with an empty selection does nothing.

### 4.7 Paste resolution priority in the app

On a paste event the app tries, in order:

1. An image file item, inserted as a raster component.
2. The plain text content, parsed as the clipboard format of this section.
3. The internal localStorage store, when the text channel produced nothing.

Paste is ignored while a text field or input is focused. Rejection is silent at the data level: an invalid text payload falls through to the internal store, and when that store is empty nothing happens. The import channel, by contrast, reports a toast on failure.

### 4.8 Clipboard examples

The envelope with all nine element types:

```json
{
  "schemaVersion": 1,
  "type": "archidraw/elements",
  "elements": [
    {
      "id": "el_ctx",
      "type": "context",
      "x": 0,
      "y": 0,
      "width": 420,
      "height": 300,
      "label": "Pasted zone",
      "labelPosition": "top-left",
      "labelSide": "internal",
      "childIds": ["el_rect", "el_text"]
    },
    {
      "id": "el_rect",
      "type": "rectangle",
      "x": 40,
      "y": 40,
      "width": 180,
      "height": 80,
      "label": "Gateway",
      "backgroundColor": "#dfe0e2",
      "borderRadius": 8
    },
    {
      "id": "el_diamond",
      "type": "diamond",
      "x": 260,
      "y": 30,
      "width": 140,
      "height": 100,
      "label": "Route?",
      "strokeStyle": "dashed"
    },
    {
      "id": "el_ellipse",
      "type": "ellipse",
      "x": 40,
      "y": 160,
      "width": 140,
      "height": 90,
      "label": "Store",
      "fillStyle": "cross-hachure"
    },
    {
      "id": "el_arrow",
      "type": "arrow",
      "x": 220,
      "y": 80,
      "width": 40,
      "height": 0,
      "endArrowhead": "triangle",
      "startBinding": { "elementId": "el_rect", "nx": 1, "ny": 0.5, "side": "right" }
    },
    {
      "id": "el_line",
      "type": "line",
      "x": 110,
      "y": 120,
      "width": 0,
      "height": 40,
      "lineType": "auto",
      "startBinding": { "elementId": "el_rect", "nx": 0.39, "ny": 1, "side": "bottom" },
      "endBinding": { "elementId": "el_ellipse", "nx": 0.5, "ny": 0, "side": "top" }
    },
    {
      "id": "el_text",
      "type": "text",
      "x": 240,
      "y": 220,
      "width": 160,
      "height": 24,
      "text": "pasted by an agent",
      "fontSize": 14,
      "textAlign": "left"
    },
    {
      "id": "el_comp",
      "type": "component",
      "x": 260,
      "y": 160,
      "width": 48,
      "height": 48,
      "componentId": "lambda",
      "label": "Fn",
      "fill": false
    }
  ]
}
```

A bare array is also accepted:

```json
[
  { "type": "rectangle", "x": 0, "y": 0, "width": 160, "height": 60, "label": "A" },
  { "type": "rectangle", "x": 220, "y": 0, "width": 160, "height": 60, "label": "B" }
]
```

So is a single element:

```json
{ "type": "text", "x": 0, "y": 0, "width": 200, "height": 28, "text": "hello", "fontSize": 18 }
```

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

## 6. Recipes for agents

### 6.1 Deterministic layout math

Keep coordinates on a grid so shapes align. A column-major layout:

```
originX = 80, originY = 80
boxW = 200, boxH = 90, gutterX = 80, gutterY = 60

column(i) x = originX + i * (boxW + gutterX)
row(j)    y = originY + j * (boxH + gutterY)
```

An arrow between the right edge of box A and the left edge of box B:

```
x      = A.x + A.width
y      = A.y + A.height / 2
width  = B.x - (A.x + A.width)
height = 0
startBinding = { elementId: A.id, nx: 1, ny: 0.5, side: "right" }
endBinding   = { elementId: B.id, nx: 0, ny: 0.5, side: "left" }
```

### 6.2 Operating the three channels

- Import channel: write the workspace JSON to a file named `<name>.archidraw` and open it through the app menu. Success adds one tab per file tab; failure adds nothing and shows an error toast.
- Paste channel: put the clipboard envelope, a bare array or a single element on the clipboard as plain text and trigger paste on the canvas. Success adds one element per array entry; failure is a silent no-op unless the internal store has content.
- Library channel: write the envelope of section 5.1 to a file named `<name>.archidrawlib` and import it through the Library panel. Success adds one group with one tile per item and inserts nothing on the canvas; failure adds nothing and shows `Invalid library file`. Give every item an `archidrawElements` array (section 5.1): that is what makes the tile insert an editable group. An item with only `elements` imports fine but lands as a static image, and the line-style toggle has no effect on it.
- The import and paste channels end with the new elements selected, so a follow-up move or style edit applies to them immediately.

## 7. Validation endpoint (`POST /validate`)

An HTTP endpoint that answers "is this payload valid, and if not, what breaks it?". It exists so an agent that generated a `.archidraw`, `.archidrawlib` or clipboard payload can get a machine-readable verdict before importing it.

| Property | Value |
|---|---|
| Method and path | `POST /validate` |
| Request body | the payload itself, as raw JSON (`Content-Type: application/json`) |
| Response | `application/json`: `{valid, format, errors, warnings, summary}` |
| Availability | every serving mode: the Vite dev server and `vite preview` (middleware), and the production Node server (`server/index.ts`, run as `node dist-server/server.js`). The app is always served by Node — there is no static-file-only deployment |

Status codes: `200` for any parseable payload (even an invalid one, since the verdict is in the body), `400` when the body is not valid JSON, `405` for a non-POST method (`GET` returns the usage object), `413` when the body exceeds 8 MB.

### 7.1 Response shape

The response is not a payload you would feed back in; it is the verdict. Shown as plain text (not a ```` ```json ```` example) because it is an output shape, not an input the parsers accept:

```
{
  "valid": false,
  "format": "workspace",
  "errors": [
    {
      "path": "tabs[0].doc.elements[2].type",
      "message": "type inválido: \"hexagon\" — esperado um de [rectangle, diamond, ellipse, line, arrow, text, component, context]",
      "rule": "3.4"
    }
  ],
  "warnings": [
    {
      "path": "tabs[0].doc.elements[2].strokeColor",
      "message": "campo base ausente strokeColor — em .archidraw escreva explicitamente; no paste vira default",
      "rule": "3.2"
    }
  ],
  "summary": { "tabs": 1, "elements": 3 }
}
```

| Field | Meaning |
|---|---|
| `valid` | `true` only when the real parser for the detected format would accept the payload |
| `format` | one of `workspace`, `workspace-legacy`, `library`, `clipboard`, `element`, `unknown` |
| `errors` | findings that **reject** the payload; each has a JSON-pointer-style `path`, a human `message` and the `rule` (a section number in this document) |
| `warnings` | findings the parser tolerates (defaults or drops) but that usually mean a mistake |
| `summary` | counts (`tabs`, `items`, `elements`) so the agent can sanity-check what it generated |

`valid` is derived only from `errors`. A payload can be `valid: true` and still carry warnings.

`valid: true` means the parser accepts the payload — it is not a review of the drawing. Geometry and looks are never checked (section 5.4): a rectangle at the wrong coordinates, a label sitting on top of the shape it belongs to, a line ending nowhere or a figure that does not resemble its concept all validate cleanly. For that, render the result and look at it; the warnings are the only automatic signal of a field that was defaulted or dropped.

### 7.2 Format detection

Detection mirrors the disjointness of section 1 and runs in this order; the first match wins:

1. `schemaVersion: 2` together with `tabs` or `activeTabId` → `workspace`
2. `schemaVersion: 1` together with `doc` or `camera` → `workspace-legacy`
3. a `libraryItems` (or `library`) array → `library`
4. a `type` of `archidrawlib` or `excalidrawlib` → `library`
5. a root array: all entries arrays → `library`, otherwise → `clipboard`
6. `type: "archidraw/elements"` or an `elements` array → `clipboard`
7. an object whose `type` is one of the nine element types → `element`
8. anything else → `unknown`, which is always `valid: false`

A single element is validated with clipboard rules (section 4.3) but reported as `element`.

### 7.3 errors versus warnings

The endpoint separates what the real parsers reject from what they silently repair:

- **workspace (sections 2.1 and 2.2)** — rejects on envelope shape only: `activeTabId` not a string, empty `tabs`, a tab that is not an object or lacks `id`, `name`, `doc` or `camera`, non-numeric camera fields, or an element whose `type` is not one of the nine. Geometry is *not* checked, matching `storage.parse`, so a non-finite `x` is a **warning**, not an error. A `activeTabId` that matches no `tab.id` is also a warning.
- **workspace-legacy (section 2.3)** — same `doc` and `camera` checks; the legacy `schemaVersion` itself is a warning, because the loader migrates it to tabs.
- **library (section 5.4)** — rejects only when the root carries neither `libraryItems` nor `library`, when that array is empty, or when no item leaves any surviving element. An item without `archidrawElements` is a **warning**: the parser accepts it, but the tile becomes a static image and the line-style toggle does nothing to it, so a generated library is almost always wrong in that shape. A single element with a bad `type`, or a `line`/`arrow`/`draw` with fewer than two `points`, is dropped from its item and reported as a **warning**: it never rejects the file. `opacity` outside the scale of its flavour (0 to 100 for Excalidraw-dialect elements, 0 to 1 for native ones) and non-finite geometry are warnings too. Native elements are validated with the section 3 rules, the ones used for a workspace document. That 5.1 warning is also the whole story of a foreign `.excalidrawlib`: it imports and renders, but nothing in it is editable.
- **clipboard (section 4.3)** — atomic: one item with a bad `type` produces an `error` and `valid: false`. Wrong-typed optional fields, non-finite geometry and missing base fields only warn, because the normalizer defaults them.
- **element** — the same rules as a one-item clipboard payload.

Across every format, `errors` are exactly the conditions that make the corresponding real parser fail; `warnings` are conditions it accepts.

### 7.4 Example

```
curl -X POST <archidraw-base-url>/validate \
  -H 'Content-Type: application/json' \
  --data-binary @my-diagram.archidraw
```

Feed each returned `error` back into your generator: `path` locates the offending field inside the payload you sent and `rule` names the section above that explains it.

## 8. Agent checklist

- The payload is valid JSON, UTF-8 encoded.
- A file uses `schemaVersion` 2 with a non-empty `tabs` array; every tab has `id`, `name`, `doc` and `camera`.
- A library file uses `version` 2 with a non-empty `libraryItems` array; it never carries `schemaVersion` or `tabs`.
- Every library item carries a non-empty `archidrawElements` array (section 5.1), spelled with the section 3 model: ids, `roughness`, `borderRadius`, `label` and bindings included. An item without it still imports, but it becomes a static image and the line-style / hand-drawn toggle has nothing to act on — `POST /validate` reports that as a warning on rule 5.1.
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
- Line and arrow geometry uses signed `width` and `height` from start to end.
- A well-known logo (cloud service, Kubernetes object) is a `component` with a `componentId` from the section 3.7 catalog, not a labelled box: the catalog draws the official icon, and a plain box draws only what you wrote. Use a labelled `rectangle`/`ellipse` for a concept the catalog does not cover.
- The drawing is inside the area the camera shows (section 2.1): with the default camera, keep every element inside roughly `x` 0..1280 and `y` 110..700 — the toolbar sits over the top of the window and the tab bar over the bottom, so a title at `y` < 110 opens hidden — or write a `camera` that centres the drawing.
- Before importing, `POST` the payload to `/validate` (section 7) and fix every returned `error`; a `warning` usually means a defaulted or dropped field you meant to set. In a library, a 5.1 warning means an item would import as a static image instead of an editable group.
