# Visual Recommendations & Layout Guidelines

This document provides visual guidelines and layout rules for generating clean, legible, and aesthetically consistent diagrams in Archidraw. It focuses purely on visual appearance, element spacing, collision avoidance, and styling defaults.

## 1. Hand-Drawn Draft Aesthetic by Default

To maintain an organic, sketch-like consistency across all drawn shapes and make them match Archidraw's native library items seamlessly:

- **Roughness (`"roughness": 1`)**: Always use `"roughness": 1` (`style: draft` / Artist) as the default for shapes (`rectangle`, `diamond`, `ellipse`), connectors (`arrow`, `line`), and boundary boxes (`context`). Avoid `"roughness": 0` unless specifically creating technical CAD-like schematics.
- **Roundness (`"borderRadius": 8`)**: Apply soft corner roundness (`borderRadius: 8`) to rectangular shapes and cards, and `borderRadius: 10` to `context` bounding boxes. Set `borderRadius: 0` for sharp geometric boxes or straight connection lines.

## 2. Preventing Element Overlapping & Collision

Never generate overlapping elements or allow text labels to intersect shape boundaries:

- **20px Grid Alignment**: Snap coordinates (`x`, `y`) and dimensions (`width`, `height`) to multiples of 20px (e.g. `x: 100`, `width: 240`, `height: 100`).
- **Node Spacing**: Keep a minimum clear gap between adjacent shapes:
  - **Horizontal gap**: At least 80px to 120px between horizontal peers.
  - **Vertical gap**: At least 60px to 100px between vertical tiers.
- **Label Clearance**: Never position a floating `text` element directly on top of an unconnected shape. For elements with inner labels, ensure the shape dimensions (`width`, `height`) provide at least 16px horizontal and vertical padding around the rendered text.

## 3. Container Padding (`context`)

A `context` element represents a visual grouping boundary on the canvas. To prevent child items from cluttering container boundaries:

- **Internal Padding**: Provide at least 30px to 40px padding between the boundary of a `context` box and any child elements enclosed inside it.
- **Header Space**: The context title is rendered at the top-left or top-center inside the container. Reserve at least 50px of vertical space at the top of the container before placing the first row of child elements.
- **Child Membership**: List child identifiers in `childIds: ["id1", "id2", ...]`. Elements inside a context must have coordinates that strictly fall within the context bounding rectangle `[x, y, x + width, y + height]`.

## 4. Clean Edge & Arrow Routing

Lines and arrows convey direction and relationships. Poor routing creates visual clutter:

- **Orthogonal & Curved Paths**:
  - Prefer orthogonal paths for standard horizontal/vertical layouts (`"edgeMode": "orthogonal"`).
  - Use smooth curves (`"edgeMode": "curved"`) only for feedback loops or bypass routes.
- **Avoid Crossing Shapes**: Never route an arrow straight through the body of an unrelated intermediate node. Route around nodes or insert intermediate waypoints (`bendPoints`) to create clear channels.
- **Connector Labels**:
  - Keep arrow labels short and concise (ideally <= 14 characters) so they do not overlap source or target nodes.
  - Position labels along the connection using `labelPosition: 0.5` (centered) and `labelSide: "left"` or `"right"` to prevent collision with line strokes.
- **Binding to Anchor Points**: Always bind arrows to shapes using `startBinding` and `endBinding` with `focus: 0` (or edge center points) and a clean `gap: 8` or `gap: 12`.

## 5. Visual Hierarchy & Typography Scale

Use standard UI font sizes to maintain visual balance across the canvas:

| UI Size | Value | Recommended Usage |
|---|---|---|
| **Caption** | `fontSize: 12` | Icon captions, component labels, secondary annotations |
| **Small (S)** | `fontSize: 14` | Default element labels, edge labels, body text |
| **Medium (M)** | `fontSize: 20` | Container (`context`) titles, subsystem headings |
| **Large (L)** | `fontSize: 28` | Main diagram title |
| **Extra Large (XL)**| `fontSize: 36` | Major banner headings |

Always set `"textColor": ""` (`Auto`) on shapes and text elements so that text dynamically inherits contrast against the active theme (light/dark canvas).

## 6. Color Harmony & Contrast

- **Subtle Fills with Defined Borders**: Pair light pastel fills (Intensity 1, e.g. `#d3e1ed`, `#f1e3d0`, `#d7eadb`) with defined strokes (Intensity 4, e.g. `#114c83`, `#a35f00`, `#216e2f`).
- **Context Boundaries**: Use the neutral boundary color `#c4c7ca` for `context` borders, or use `"strokeColor": "#3d4248"` for theme-following strokes.
- **Never Use Off-Palette Random Hexes**: Stick exclusively to the 15-hue palette defined in `elements.md` to avoid automatic lightness clamping.

## 7. Visual Pre-Flight Checklist

Before outputting diagram JSON, verify:

1. [ ] Every shape has `"roughness": 1` for consistent hand-drawn styling.
2. [ ] All node coordinates and sizes align with the 20px grid.
3. [ ] No shapes overlap or collide. Minimum 80px horizontal gap and 60px vertical gap.
4. [ ] All containers (`context`) have at least 40px internal margin around child elements.
5. [ ] Arrow labels are concise (<= 14 chars) and do not obstruct shape borders.
6. [ ] Arrow bindings have explicit `startBinding` and `endBinding` references.
7. [ ] All colors belong to the official 15-hue UI palette.
8. [ ] For `.archidraw` workspace files, all System Design items (`sd-*`) are unpacked as native vector groups (`archidrawElements`) with a shared `groupId` and translated `(x, y)` coordinates, instead of unresolved `component` elements (SVG cloud icons `aws-*`/`k8s-*` remain `type: "component"`).
