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
{ "type": "text", "x": 0, "y": 0, "width": 200, "height": 28, "text": "hello", "fontSize": 20 }
```
