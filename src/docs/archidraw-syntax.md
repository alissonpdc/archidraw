# Archidraw File and Clipboard Syntax Reference

Machine-oriented reference for AI agents that create or edit Archidraw drawings programmatically. It documents the three interchange formats: the `.archidraw` file (complete workspace), the clipboard elements payload (copy/paste) and the `.archidrawlib` file (library of reusable elements). Every JSON example on this page is executed by the automated test suite against the real parser, so the examples are guaranteed valid.

## 1. Formats at a glance

| Format | Carrier | Top-level shape | Channel |
|---|---|---|---|
| Workspace file | `.archidraw` or `.archidraw.json` (UTF-8, `application/json`) | `{"schemaVersion": 2, "activeTabId": "...", "tabs": [...]}` | Import via the app menu (Open) |
| Clipboard payload | OS clipboard, plain text | `{"schemaVersion": 1, "type": "archidraw/elements", "elements": [...]}` | Paste into the open canvas |
| Library file | `.archidrawlib` or `.excalidrawlib` (UTF-8, `application/json`) | `{"type": "archidrawlib", "version": 2, "libraryItems": [...]}` | Import via the Library panel (import button) |

The three carriers are disjoint: each parser accepts only its own top-level shape and reports a generic error for the others (sections 2.2, 4.3 and 5.3).

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

Important: in a schema 2 file the app does not default geometry or color fields. Always write the full base field set of section 3.2 explicitly. Only the seven style fields listed above are auto-filled when missing.

### 2.4 Import semantics

- Import is additive. Existing tabs are never replaced or removed.
- Tab ids are regenerated as `tab_<base36 timestamp>_<counter>`.
- Tab names and cameras are preserved.
- The first imported tab becomes the active tab.
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

### 2.6 Complete example (all eight element types)

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
            "backgroundColor": "#f3f5f6",
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
            "childIds": ["rect_api", "comp_ec2", "diamond_decide", "ellipse_cache", "line_1", "arrow_1", "text_note"]
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
            "backgroundColor": "#ffffff",
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
            "backgroundColor": "#ffffff",
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
- For rectangles, diamonds, ellipses, components, contexts and text, `x` and `y` are the top-left corner of the bounding box and `width`/`height` are positive.
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
| strokeColor | string | `#3d4248` | any CSS color |
| backgroundColor | string | `#dfe0e2` | any CSS color |
| strokeWidth | number | 1 | outline width in scene units |
| opacity | number | 1 | alpha of the whole element |
| strokeOpacity | number | 1 | alpha of the outline |
| fillOpacity | number | 1 | alpha of the fill |
| strokeStyle | StrokeStyle | `solid` | |
| fillStyle | FillStyle | `solid` | |
| roughness | integer 0 to 3 | 0 | rounded and clamped; 0 clean, 1 draft, 2 sketchy, 3 chaos |
| borderRadius | number | 0 | percent of the smaller side |
| angle | number | 0 | radians, clockwise, around the box center |
| groupId | string | none | elements sharing a groupId move and select together |
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
| captionPosition | CaptionPosition | `bottom` | side that carries the caption or details badge |
| captionGap | number | 2 | pixels between the element and its caption |
| captionOffsetTop | number | 0 | pixels, caption fine tuning |
| captionOffsetBottom | number | 0 | pixels, caption fine tuning |
| captionOffsetLeft | number | 0 | pixels, caption fine tuning |
| captionOffsetRight | number | 0 | pixels, caption fine tuning |

### 3.3 Type-specific fields

| Element type | Extra fields |
|---|---|
| rectangle, diamond, ellipse | `label` (string) |
| line | `label`, `labelT`, `lineType`, `controlPoint`, `bendPoints`, `startBinding`, `endBinding` |
| arrow | all line fields plus `animated` (boolean, default false), `startArrowhead` (default `none`), `endArrowhead` (default `arrow`) |
| text | `text` (string, defaults to empty), `fontSize` (number, defaults to 20) |
| component | `componentId` (string, defaults to empty), `label`, `src` (data URL of a raster), `fill` (boolean, default false; true stretches the raster to the whole box) |
| context | `label`, `labelPosition` (default `top-left`), `labelSide` (default `internal`), `childIds` (array of element id strings) |

Notes on edges:

- `labelT` positions the label along the edge from `0` (start) to `1` (end), default `0.5`.
- `controlPoint` is an absolute scene point that bends a `curved` line or arrow.
- `bendPoints` are intermediate vertices used by `auto` routing. The array is all-or-nothing: every item must be a valid `{x, y}` point or the field is dropped.
- `componentId` values from the built-in catalog include `ec2`, `lambda`, `ecs`, `eks`, `api-gateway`, `elb`, `route53`, `cloudfront`, `vpc`, `dynamodb`, `rds`, `elasticache`, `s3`, `sqs` and `sns`.
- `src` holds a self-contained raster such as `data:image/png;base64,...` for pasted or imported images.

### 3.4 Enumerations

| Name | Values |
|---|---|
| ElementType | `rectangle`, `diamond`, `ellipse`, `line`, `arrow`, `text`, `component`, `context` |
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

Text elements align inside their own box: `textAlign` picks the horizontal anchor and `textVAlign` the vertical one, then `textOffset*` values nudge the block in pixels. Multi-line text uses embedded newline characters and `lineSpacing` as the line height multiplier. Labels on shapes behave like captions: `captionPosition` chooses the side, `captionGap` the distance in pixels, and the `captionOffset*` values fine tune the placement. `textColor` empty or missing falls back to `strokeColor`.

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

The paste parser accepts three shapes:

1. The envelope object above.
2. A bare array of elements.
3. A single element object.

### 4.3 Validation, defaults and whitelisting

- The payload must parse as JSON.
- Validation is atomic. If any item is not an object or carries an `type` value outside the eight element types, the entire payload is rejected and nothing is pasted.
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

The envelope with all eight element types:

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

A library file is a palette of reusable elements imported through the Library panel; it never becomes a tab. It is parsed by the Excalidraw library parser, so both the envelope and the element schema are the ones in this section — the `schemaVersion`/`tabs` envelope of section 2 does not apply.

### 5.1 Envelope (library version 2)

```json
{
  "type": "archidrawlib",
  "version": 2,
  "libraryItems": [
    {
      "name": "Box",
      "elements": [
        {
          "type": "rectangle",
          "x": 0,
          "y": 0,
          "width": 96,
          "height": 48,
          "strokeColor": "#3d4248",
          "backgroundColor": "#dfe0e2",
          "fillStyle": "solid",
          "strokeWidth": 1,
          "strokeStyle": "solid",
          "opacity": 100,
          "roundness": null
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
| elements | array of ExcalidrawElement | yes, non-empty | an entry with an empty `elements` array is dropped |

Accepted roots, in order of lookup:

1. The v2 object above: `{libraryItems: [{name, elements}, ...]}`.
2. A legacy object: `{library: [[element, ...], ...]}` (v1), where every entry is already a bare element array.
3. A root array of element arrays.

Any other root — including a workspace envelope with `tabs` — is rejected (section 5.3).

### 5.2 Element schema (Excalidraw, not section 3)

Each item is rasterized into one self-contained SVG, so only the fields below are read. The section 3 element model does **not** transfer: there are no `id`s, no bindings, no `label`, no `component` or `context`, and unknown fields are ignored. A workspace element pasted into a library file keeps the shape of the app model but loses meaning: its `borderRadius`, `roughness`, `strokeOpacity`, `fillOpacity`, `label` and `lineType` are never read.

| Field | Type | Notes |
|---|---|---|
| type | string | `rectangle`, `ellipse`, `diamond`, `line`, `draw`, `arrow`, `text`; anything else (including `component` and `context`) is dropped silently |
| x, y | number | top-left corner for shapes and text; origin of `points` for line, arrow and draw |
| width, height | number | bounding box for rectangle, ellipse, diamond and text (also the rotation center of every element); line, arrow and draw geometry comes from `points`, so these two only feed the box |
| points | array of `[dx, dy]` or `{x, y}` | required for line, arrow and draw: offsets relative to `x`, `y`; fewer than two entries drops the element |
| strokeColor | string | default `#000000`; for `text` it is the glyph color |
| backgroundColor | string | `transparent` or missing → no fill; ignored by `text` |
| fillStyle | string | `hachure` renders the fill at 0.4 alpha, `cross-hatch` at 0.6, `solid` and any other value at full alpha |
| strokeWidth | number | default 1 when missing or not positive |
| strokeStyle | string | `dashed` → `8 5`, `dotted` → dots, anything else (including `dashdot`) solid |
| opacity | number | **0 to 100** (not 0 to 1); `100` or higher renders fully opaque |
| roundness | object or null | truthy (e.g. `{"type": 2}`) rounds corners to 25% of the smaller side; `strokeSharpness: "round"` does the same; there is no percent knob like `borderRadius` |
| angle | number | radians, clockwise, around the box center |
| startArrowhead, endArrowhead | string or null | arrow only; the end head is drawn unless the value is `null` or `"none"`, the start head only when set to a value other than `"none"`; head size is fixed |
| text, fontSize | string, number | text only; `fontSize` defaults to 20; lines split on `\n`, line step `fontSize * 1.25` |
| fontFamily | number or string | text only; `1` (or a Virgil/Excalifont name) → sketch, `3` (or `cascadia`) → mono, anything else → system-ui |
| closed | boolean | line only; closes the path so `fillStyle` applies |

Layout and rendering rules:

- Each item is centered on a square canvas of its bounding box plus 4 px of padding, always inserted at 64 × 64 with `aspect` 1 — a wide icon shrinks to fit the square.
- Bounding boxes honor `points`, so a line or arrow can reach outside `x` .. `x + width`.
- Text is drawn from `x` left to right with the baseline at `y + fontSize * 0.8`. `textAlign` is not read: center a caption by computing `x` yourself from the text width.
- `opacity` below 100 applies to the whole group; missing `strokeColor` falls back to `#000000`.

### 5.3 Validation and rejection rules

Library import is all-or-nothing. The file is rejected when any of these holds:

- The content is not valid JSON.
- The root is not an array and has neither a `libraryItems` nor a `library` array — which is always the case for a section 2 workspace envelope.
- After dropping empty entries, no item is left.

The Library panel reports every rejection with the single message `Invalid library file`.

Everything else is tolerated and never rejects: unknown fields are ignored, an entry that is neither an array nor an object with an `elements` array is skipped, and element-level problems only cost that element. An unsupported `type` or a `line`/`arrow` without a usable `points` array disappears; mistyped style fields fall back to their defaults (`strokeWidth` 1, `strokeColor` `#000000`, `fillStyle` `solid`). Geometry, by contrast, is never checked at all: `x`, `y`, `width`, `height` and `points` must already be finite numbers, because a non-numeric value lands as `NaN` in the SVG.

### 5.4 Import semantics

- Channel: Library panel → import button, which accepts `.excalidrawlib` and `.archidrawlib` files. This is not the app menu Open of section 2.4; the two parsers are disjoint, so a workspace envelope fails here and a `libraryItems` file fails there.
- The group takes the file name without extension (`_` becomes a space, an empty base becomes `Imported library`) and opens expanded.
- Every item becomes one tile rendered from its SVG, registered as an image asset; the group persists in localStorage under `archidraw:importedLibraries` and survives reloads until removed.
- Clicking a tile inserts a `component` element whose `componentId` starts with `imp-` and carries no label.
- The app's own Export .archidrawlib button writes exactly the envelope of section 5.1, converting `opacity` to 0–100, renaming `cross-hachure` to `cross-hatch`, mapping `dashdot` to `solid`, turning line geometry into `points` and dropping `component` elements, whose image assets do not translate.

### 5.5 Example

```json
{
  "type": "archidrawlib",
  "version": 2,
  "libraryItems": [
    {
      "name": "API",
      "elements": [
        {
          "type": "rectangle",
          "x": 0,
          "y": 0,
          "width": 120,
          "height": 64,
          "strokeColor": "#3d4248",
          "backgroundColor": "#d0ebff",
          "fillStyle": "solid",
          "strokeWidth": 1,
          "strokeStyle": "solid",
          "opacity": 100,
          "roundness": { "type": 2 }
        },
        {
          "type": "text",
          "x": 46,
          "y": 22,
          "width": 28,
          "height": 20,
          "text": "API",
          "fontSize": 16,
          "strokeColor": "#3d4248",
          "opacity": 100
        }
      ]
    },
    {
      "name": "Invoke",
      "elements": [
        {
          "type": "arrow",
          "x": 0,
          "y": 32,
          "width": 96,
          "height": 0,
          "points": [[0, 0], [48, 0], [96, 0]],
          "strokeColor": "#3d4248",
          "strokeWidth": 2,
          "strokeStyle": "dashed",
          "opacity": 100,
          "startArrowhead": null,
          "endArrowhead": "arrow"
        },
        {
          "type": "ellipse",
          "x": 96,
          "y": 8,
          "width": 48,
          "height": 48,
          "strokeColor": "#3d4248",
          "backgroundColor": "#ebfbee",
          "fillStyle": "hachure",
          "strokeWidth": 1,
          "strokeStyle": "solid",
          "opacity": 100,
          "roundness": null
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
- Library channel: write the envelope of section 5.1 to a file named `<name>.archidrawlib` and import it through the Library panel. Success adds one group with one tile per item and inserts nothing on the canvas; failure adds nothing and shows `Invalid library file`.
- The import and paste channels end with the new elements selected, so a follow-up move or style edit applies to them immediately.

## 7. Agent checklist

- The payload is valid JSON, UTF-8 encoded.
- A file uses `schemaVersion` 2 with a non-empty `tabs` array; every tab has `id`, `name`, `doc` and `camera`.
- A library file uses `version` 2 with a non-empty `libraryItems` array of `{name, elements}` entries whose `elements` are non-empty; it never carries `schemaVersion` or `tabs`.
- Each channel rejects the other envelopes: a workspace file fails the Library import and a `libraryItems` file fails Open, both with a generic error (sections 2.2 and 5.3).
- Library elements follow section 5.2: `opacity` runs from 0 to 100, corners use `roundness` instead of `borderRadius`, line and arrow geometry lives in `points`, and there are no ids, bindings or labels — captions are `text` elements positioned manually.
- Every element uses one of the eight ElementType values, spelled exactly as in section 3.4.
- Files spell out all base fields explicitly; only clipboard payloads may rely on defaults.
- Element ids are unique inside their document, and bindings reference ids that exist in the same array or payload.
- Numbers are finite. Angles are radians, `borderRadius` is a percentage and opacities range from 0 to 1 (library files excepted: 0 to 100).
- Enum values are lowercase strings from the tables above.
- Clipboard payloads are atomic: one invalid item rejects everything, so validate every element before writing the payload.
- Unknown fields are dropped silently, not errors.
- Text elements always carry `text` and `fontSize`.
- Line and arrow geometry uses signed `width` and `height` from start to end.
