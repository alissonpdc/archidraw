# The `.archidraw` Workspace File Format

This document defines the schema, camera math, and file structure of complete `.archidraw` workspace files.

## 2. Workspace Format & Schema

### 2.1 Envelope (workspace schema 2)

The `.archidraw` file is the reference set to copy for saving and restoring multi-tab workspaces:

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
| activeTabId | string | yes | tab activated when the file is restored |
| tabs | array of Tab | yes | at least one entry |

The `camera` of the tab being opened decides what the user sees first. It is a plain affine transform: a scene point lands at `screen = scene * zoom + scroll`, in CSS pixels from the top-left of the canvas, and the canvas fills the whole window (the side panels float on top of it). With the default `{scrollX: 0, scrollY: 0, zoom: 1}` everything inside `x` 0..windowWidth and `y` 0..windowHeight is on screen, so a diagram meant to show up whole should stay inside roughly `x` 0..1280 and `y` 110..700 on a 1280 × 800 window.

On screen, the app draws its chrome over that canvas, and the chrome hides whatever sits under it: the centered toolbar across the top (`y` 0..75), the tab bar and the zoom controls across the bottom (`y` ≈ windowHeight − 90..windowHeight), the menu button in the top-right corner and the shortcuts hint in the bottom-left.

### 2.2 Import semantics

- Import is additive: existing tabs and workspaces are never replaced or removed.
- Tab names and cameras are preserved.
- The first imported tab becomes the active tab: the tab order decides what you see first after an Open, while `activeTabId` is honored when the whole workspace is restored from autosave (`archidraw:workspace`).

### 2.3 Legacy schema 1 files

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

### 2.4 Minimal example

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

### 2.5 Complete example (all nine element types)

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
            "borderRadius": 10,
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
            "startBinding": { "elementId": "rect_api", "focus": 0, "gap": 8, "side": "right" },
            "endBinding": { "elementId": "diamond_decide", "focus": 0, "gap": 8, "side": "left" }
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
            "startBinding": { "elementId": "diamond_decide", "focus": 0, "gap": 8, "side": "bottom" },
            "endBinding": { "elementId": "ellipse_cache", "focus": 0, "gap": 8, "side": "top" }
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
