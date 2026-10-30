# Library File Format (`.archidrawlib`)

This document defines the schema for reusable libraries imported via the Library panel.

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
| type | string | no | `"archidrawlib"` in files exported by this app |
| version | number | no | `2` in current files |
| libraryItems | array of LibraryItem | yes | list of library components |

### 5.2 Element schema (Excalidraw, for items without natives)

This section describes `elements`, the Excalidraw-shaped array, and it applies **only to an item that has no `archidrawElements`** — a foreign `.excalidrawlib`.

| Field | Type | Notes |
|---|---|---|
| type | string | `rectangle`, `ellipse`, `diamond`, `line`, `draw`, `arrow`, `text` |
| points | array of `[dx, dy]` or `{x, y}` | required for line, arrow and draw. Tuples and objects may be mixed inside one array |
| fillStyle | string | `hachure` renders at 0.4 alpha, `cross-hatch` at 0.6 |
| roundness | object or null | smooths the vertices into curves |
| closed | boolean | closed polygon; also implied when first point equals the last; an open contour never fills either |

### 5.3 Layout and rendering rules

Color note: On the native path the clamping of section 3.2 is the whole game. Take every fill and stroke from that table.

- Text width estimate: `fontSize × 0.6 × text.length`.
- Missing SVG color declarations fall back to the browser default: black fill, no stroke.
- Arcs and silhouettes: compose it instead of falling back to a raster item. That way the item answers the line-style toggle.

### 5.4 Validation and rejection rules

Library import is all-or-nothing. The file is rejected when any of these holds:
- The content is not valid JSON.
- The root is not an array and has neither a `libraryItems` nor a `library` array.
- After dropping empty entries, no item is left.

The Library panel reports every rejection with the single message `Invalid library file`.

### 5.6 Example

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
          "borderRadius": 8,
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
