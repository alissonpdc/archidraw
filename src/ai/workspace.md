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

#### Quick Camera & Viewport Calculator (1280 × 800 Reference Window)

| Parameter | Safe Formula / Value | Rule |
|---|---|---|
| Safe screen band | `screenX` ∈ `[40, 1240]`, `screenY` ∈ `[110, 700]` | Keeps titles and bottom contexts clear of top toolbar (`0..75`) and bottom tab bar (`710..800`) |
| Diagram bounds | `minX, minY` to `maxX, maxY` (`spanX = maxX - minX`, `spanY = maxY - minY`) | Compute from outermost elements/contexts |
| Optimal `zoom` | `min(1, 1200 / spanX, 590 / spanY)` | Fits the entire diagram inside the safe 1200 × 590 screen band |
| Optimal `scrollX` | `round(640 - ((minX + maxX) / 2) * zoom)` | Horizontally centers diagram at `screenX = 640` |
| Optimal `scrollY` | `round(405 - ((minY + maxY) / 2) * zoom)` | Vertically centers diagram inside the safe band (`(110 + 700) / 2 = 405`) |

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
            "componentId": "aws-ec2",
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
            "fontSize": 14,
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

### 2.4 Import semantics

- Import is additive. Existing tabs and workspaces are never replaced or removed.
- A file with one tab is added as a new canvas to the workspace that is currently selected. A tab still carrying the default `Diagram N` name is renamed to the file name.
- A file with two or more tabs becomes a new workspace named after the file (`.archidraw`, `.archidraw.json` and `.json` suffixes stripped). The new workspace is activated and holds every imported tab as one of its canvases; the previously selected workspace is left untouched.
- Tab ids are regenerated as `tab_<base36 timestamp>_<counter>`.
- Tab names and cameras are preserved.
- The first imported tab becomes the active tab: the tab order decides what you see first after an Open, while `activeTabId` (section 2.1) is honored only when the whole workspace is restored from the autosave when the app starts.
- The picker accepts `.archidraw`, `.archidraw.json` and plain `.json` files carrying this envelope. `.excalidraw` files take a separate import path that is out of scope here; they always behave like a one-tab file and land in the selected workspace.

The same envelope is used for the localStorage autosave (key `archidraw:workspace`), for Save Diagram (active tab exported as a one-tab file `<slug>.archidraw`) and for Save All (`workspace.archidraw`).

### 2.3 Legacy schema 1 files and migrations

> **Note for AI Generators:** Always generate **Schema 2** (`"schemaVersion": 2` with `tabs`, sections 2.1, 2.5 and 2.6). Schema 1 below is documented only for backward-compatible file migrations.

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
