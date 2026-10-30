# Native Elements, UI Controls & Syntax Reference

This document covers the complete native element model of Archidraw, mapping JSON attributes directly to the UI Controls available in the canvas toolbar and the Properties Panel.

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

### 3.2 UI Color Palette & Contrast Rules

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

The two lightest columns carry fills, the three darkest columns carry strokes; a color from another hue's row is fine, a color outside the table is not. Four values are special-cased instead of clamped: `transparent`, `#c4c7ca` (the context-boundary stroke, drawn `#3b3835` on dark canvases) and the two sentinels of the default columns above — `#3d4248` is *replaced* by the active theme stroke (near-black `#26292c` on light canvases) and `#dfe0e2` by the theme fill (near-black on dark canvases). The sentinels therefore follow the theme instead of the tile: a shape stroked `#3d4248` shows the theme colour on the canvas, while the tile thumbnail and the SVG export keep the literal `#3d4248`. Use them for documents, which the app itself writes with them; for a library tile that must match the canvas, take an explicit colour from the table. When creating shapes, it belongs to the app palette: for example `#d3e1ed` for soft blue cards and `#545c63` for dark grey borders.

### 3.3 Common fields

Present on every element. The default column applies to the clipboard normalizer; in a `.archidraw` file write every base field explicitly.

| Field | Type | Default on paste | Notes |
|---|---|---|---|
| id | string | generated as `el_<base36>_<base36>` | unique within the document; always regenerated on paste |
| type | ElementType | required | an unknown value rejects the whole clipboard payload |
| x | number | 0 | scene X of the top-left corner |
| y | number | 0 | scene Y of the top-left corner |
| width | number | 100 | signed run for line and arrow |
| height | number | 100 | signed run for line and arrow |
| strokeColor | string | `#3d4248` | native UI palette hex (`15×5`) or sentinel (`#3d4248`, `#c4c7ca`, `transparent`) |
| backgroundColor | string | `#dfe0e2` | native UI palette hex (`15×5`), `#dfe0e2`, or `transparent` for no fill |
| strokeWidth | number | 1 | **Native UI Thickness presets: `0`, `1`, `2`, `4`, `8`** |
| opacity | number | 1 | alpha of the whole element, `0` to `1` |
| strokeOpacity | number | 1 | alpha of the outline (`0` to `1`) |
| fillOpacity | number | 1 | alpha of the fill (`1` for filled shapes, `0` for unfilled `component`/`context`) |
| strokeStyle | StrokeStyle | `solid` | **Native UI Stroke Type presets: `"solid"`, `"dashed"`, `"dotted"`, `"dashdot"`** |
| fillStyle | FillStyle | `solid` | **Native UI Fill Type presets: `"solid"`, `"hachure"`, `"cross-hachure"`** |
| roughness | integer 0 to 3 | 0 | **Native UI Stroke Style presets: `0` (Architect), `1` (Draft), `2` (Sketchy)** |
| borderRadius | number | 0 | **Native UI Roundness presets: `0` (Square), `8`–`25` (Round), `100` (Pill)** |
| angle | number | 0 | radians, clockwise, around the box center |
| groupId | string | none | elements sharing a groupId move, select and resize together |
| locked | boolean | false | disables direct manipulation |
| details | string | none | free-form Markdown shown as an "i" badge and rendered on demand — see section 3.8 |
| fontFamily | string | app default | **Omit `fontFamily`** (the app picks its native **Sans** or **Sketch** font from `roughness`), or use one of the **3 exact native UI Family strings**: Sans (`'"Segoe UI", system-ui, sans-serif'`), Sketch (`'"Architects Daughter", cursive'`), Monospace (`'Consolas, "SF Mono", monospace'`). Never invent font names like `"Inter"` or `"Arial"`. |
| bold | boolean | false | bold font weight |
| italic | boolean | false | italic font style |
| underline | boolean | false | underline text decoration |
| textColor | string | `""` (Auto) / `#3d4248` | `""` activates the native UI `Auto` button on shapes, components and arrows (inherits `strokeColor`, adapts to light/dark themes). Standalone `text` elements default to `#3d4248` (`Grey · 5` light, `Grey · 1` dark); set an explicit dark colour (`#26292c`) when `strokeColor` is the light `#c4c7ca` sentinel |
| lineSpacing | number | 1.25 | line height multiplier for multi-line text |
| fontSize | number | 20 for labels, 14 for context, 12 for component | UI presets: `12`, `14` (`S`), `20` (`M`), `28` (`L`), `36` (`XL`) |
| textAlign | TextAlign | `center` for labels, `left` for text | horizontal text alignment: `left`, `center`, `right` |
| textVAlign | TextVAlign | `middle` | vertical text alignment: `top`, `middle`, `bottom` |
| textOffsetGlobal | number | 0 for text, 8 for shape/context | base inset applied on the aligned side only |
| textOffsetTop | number | 0 | pixels added to top offset |
| textOffsetBottom | number | 0 | pixels added to bottom offset |
| textOffsetLeft | number | 0 | pixels added to left offset |
| textOffsetRight | number | 0 | pixels added to right offset |
| captionPosition | CaptionPosition | `bottom` | side that carries a `component` caption — the only place `captionPosition` applies |
| captionGap | number | 2 | pixels between element and caption |
| captionOffsetTop | number | 0 | caption fine tuning |
| captionOffsetBottom | number | 0 | caption fine tuning |
| captionOffsetLeft | number | 0 | caption fine tuning |
| captionOffsetRight | number | 0 | caption fine tuning |

### 3.4 Type-specific fields

| Element type | Extra fields |
|---|---|
| rectangle, diamond, ellipse | `label` (string) — drawn inside the box |
| polygon | `rings` (required; `rings[0]` is the outer ring, every following ring is a hole; open rings of `{x, y}` points with at least 3 each), `label` (string) |
| line | `label`, `labelT` (0..1), `labelSide` (`left`, `right`), `labelPosition` (0..1), `lineType` (`straight`, `curved`, `auto`), `controlPoint`, `bendPoints`, `startBinding`, `endBinding` |
| arrow | all line fields plus `startArrowhead`/`endArrowhead` (`none`, `circle`, `arrow`, `triangle`; defaults `none`/`arrow`) and `animated` (boolean, default false) |
| text | `text` (required string), `fontSize` (number, defaults to 20), optional `backgroundColor` and `fillOpacity` (background plate) |
| component | `componentId` (official SVG icon or `sd-*` native item), `label` (string outside box), `captionPosition`, `captionGap`, `src` (raster data URI), `fill` (boolean; true stretches the raster to the whole box) |

- **An edge never fills its interior**: Lines and arrows only paint strokes; `backgroundColor` and `fillOpacity` are ignored for connectors.
- **Inner labels**: For shapes, `label` sits inside the box. The box never wraps unless constrained.
- **Edge labels**: For arrows, `label` floats along the path. It sits on the side named by `labelSide` (`left` or `right`), at proportion `labelPosition` (or `labelT`).
- **Context containers**: A context the app itself creates is `strokeColor: "#c4c7ca"`, `backgroundColor: "transparent"`, `strokeWidth: 1`, `borderRadius: 10`, `fontSize: 14`, `labelPosition: "top-left"` and `labelSide: "internal"`. An opaque plate of the canvas background is maintained. Open never recomputes membership: `childIds` is read as written, edges included.
- **Dialect distinction**: Nothing from the section 5.2 dialect belongs here: properties like `points`, `roundness`, `closed` belong to legacy Excalidraw imports, not native Archidraw elements.

- **Text color and plate**: a `text` element draws glyphs with `textColor` (empty or omitted falls back to `strokeColor`; the app writes `#3d4248` on standalone text) and supports an optional background rectangle via `backgroundColor` + `fillOpacity`, drawn when `fillOpacity > 0` and `backgroundColor !== "transparent"`, both on the canvas and in the SVG export.
- **Boolean polygons**: hand-written polygons come from the Layers panel Merge actions (`union`, `subtract`, `intersect`, `crop`); the operation is destructive (operands are removed, the result takes the topmost operand's z-position and stroke/fill style), each connected solid becomes its own `polygon`, and `x`/`y`/`width`/`height` must equal the ring bounding box — a polygon with an empty outer ring is rejected on paste.

### 3.5 Enumerations

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
| LabelSide | `internal`, `external`, `left`, `right` |

### 3.6 Bindings on Arrows

Arrows bind to elements through `startBinding` and `endBinding`:

```json
{
  "elementId": "svc_orders",
  "focus": 0,
  "gap": 8,
  "side": "right"
}
```

- `elementId`: The unique ID of the target element.
- `focus`: Position along the target edge (`-1` to `1`, `0` is center).
- `gap`: Spacing between arrow tip and target border (typically `8`).
- `side`: Cardinal side of attachment (`"top"`, `"bottom"`, `"left"`, `"right"`).

### 3.8 Additional information (`details`)

Every shape, component, context and edge supports a `details` string. It contains free-form Markdown rendered for human reading on the canvas on demand when clicking or hovering the "i" info badge on the element:

- The info badge is placed at the bottom-right corner of shapes, and below the label on edges.
- Raw HTML is never interpreted: it is safely escaped.
- SVG and PNG exports contain the drawing only: `details` is an interactive canvas capability and is omitted from standard raster exports.

Example with `details`:

```json
{
  "id": "svc_orders",
  "type": "rectangle",
  "x": 280,
  "y": 140,
  "width": 240,
  "height": 90,
  "strokeColor": "#114c83",
  "backgroundColor": "#d3e1ed",
  "strokeWidth": 2,
  "borderRadius": 8,
  "roughness": 1,
  "label": "Orders API",
  "fontSize": 14,
  "textColor": "",
  "details": "## Orders API\n\n- Production service\n- [runbook](https://example.com/runbooks/orders)"
}
```

### 3.9 Which fields take effect

Every field in section 3.3 is accepted on every element — the parser never rejects a known field — but the renderer only reads it on the types below. Write a field the type ignores and nothing happens (it is still stored and re-exported).

| Field group | Read by | Not read by |
|---|---|---|
| geometry `x`/`y`/`width`/`height` | all nine types (signed run on `line`/`arrow`) | — |
| `opacity`, `angle`, `groupId`, `locked`, `details` | all nine types | — |
| `strokeColor`, `strokeWidth`, `strokeStyle`, `strokeOpacity`, `roughness` | every type except `text`, which paints glyphs instead of a stroke: it uses a glyph colour from `textColor`/`strokeColor` and ignores `strokeStyle`, `strokeWidth` and `strokeOpacity`. `roughness` does not sketch the glyphs, but it still selects the default font family when `fontFamily` is missing | `text` |
| `backgroundColor`, `fillOpacity` | `rectangle`, `diamond`, `ellipse`, `polygon`, `component`, `context`, `text` | `line`, `arrow` |
| `fillStyle` | `rectangle`, `diamond`, `ellipse`, `polygon`, `component` | `line`, `arrow`, `context`, `text` |
| `borderRadius` | `rectangle`, `component`, `context` | `diamond`, `ellipse`, `polygon`, `line`, `arrow`, `text` |
| `fontFamily`, `bold`, `italic`, `underline`, `fontSize`, `textColor`, `lineSpacing` | `text` elements and every kind of label; a `context` caption accepts all of them except `underline` | — |
| `textAlign`, `textVAlign` | `text` elements, shape labels and edge labels | `component` and `context` captions, whose position comes from `captionPosition` / `labelPosition` |
| `textOffset*` | shape labels and `context` captions (base inset 8); `text` elements (base inset 0); **not** edge labels, which move with `labelT` and the alignment only | `line`, `arrow`, `component` |
| `captionPosition`, `captionGap`, `captionOffset*` | `component` only | every other type |
| `label` | `rectangle`, `diamond`, `ellipse`, `polygon`, `line`, `arrow`, `component`, `context` | `text` (use `text`) |

Two fill interactions are easy to get wrong:

- **Hachure over a transparent fill.** With `fillStyle: "hachure"` or `"cross-hachure"` and `backgroundColor: "transparent"`, the hachure lines are drawn in `strokeColor` — a transparent background means "no solid block", not "no hatch", so the shape still reads as filled.
- **Contexts always fill solid.** A `context` paints its interior as a flat block and ignores `fillStyle`: `hachure` on a context is silently a solid fill. Set `backgroundColor`/`fillOpacity` to control it.

`angle` is stored on every type and honoured by the canvas and the SVG export, but the UI rotate grip only appears for `rectangle`, `diamond`, `ellipse`, `polygon`, `text`, `component` and `context` — a `line` or `arrow` only rotates when the JSON sets `angle` itself.

Edge routing details:

- `lineType: "auto"` with no `bendPoints` routes orthogonally on its own: the path leaves and enters through the `side` recorded in each binding (falling back to the nearest cardinal side). `bendPoints`, when present, replace that automatic polyline, and the array is all-or-nothing: every item must be a valid `{x, y}` point or the field is dropped.
- When an edge has no explicit `controlPoint`, a curved connector forms an arc whose control point sits above the midpoint by 30% of the horizontal span.

Fallback defaults: optional fields gracefully fall back to native defaults when omitted.

- `fontFamily`: omit or leave empty to use default sans font.
- `textOffsetGlobal` default: 0 for text elements, 8 for shape and context labels.
- Inset offsets affect only the side named by the alignment (e.g. left inset for left-aligned text).

Omitting them is safe: the renderer falls back on every read, so a partial element still draws with native presets.

For complete component catalogs:

- Official cloud and Kubernetes SVG icons: see `/ai/lib-svg.md`.
- Native System Design editable items: see `/ai/lib-native.md`.
