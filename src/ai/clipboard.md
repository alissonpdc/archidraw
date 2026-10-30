# Clipboard Syntax (Copy and Paste)

This document specifies the clipboard interchange syntax for copying and pasting elements into the active Archidraw canvas.

## 4. Clipboard Syntax & Normalizer

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
| type | string | the literal `archidraw/elements`; advisory metadata for external tools |
| elements | array of Element | the copied elements |

### 4.2 Accepted payload shapes

The paste parser accepts three primary formats:

1. The envelope object above (`archidraw/elements`).
2. A bare array of elements.
3. A single element object.

### 4.3 Validation and normalizer defaults

- Validation is atomic: if any item is not an object or carries an invalid `type`, the entire payload is rejected and nothing is pasted.
- Missing fields are filled with safe defaults (`strokeColor: "#3d4248"`, `backgroundColor: "#dfe0e2"`, `strokeWidth: 1`, `opacity: 1`, `strokeStyle: "solid"`, `fillStyle: "solid"`).

### 4.4 Clipboard examples

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
      "startBinding": { "elementId": "el_rect", "focus": 0, "gap": 8, "side": "right" }
    },
    {
      "id": "el_line",
      "type": "line",
      "x": 110,
      "y": 120,
      "width": 0,
      "height": 40,
      "lineType": "auto",
      "startBinding": { "elementId": "el_rect", "focus": 0, "gap": 8, "side": "bottom" },
      "endBinding": { "elementId": "el_ellipse", "focus": 0, "gap": 8, "side": "top" }
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
      "componentId": "aws-lambda",
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
