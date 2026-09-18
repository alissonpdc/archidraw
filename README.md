<div align="center">

<img src="./public/favicon.svg" alt="ArchiDraw" height="72" />

# ArchiDraw

**Hand-drawn style architecture diagram editor that runs entirely in your browser.**

[![Build](https://img.shields.io/github/actions/workflow/status/alissonpdc/archidraw/ci.yml?style=flat-square&label=CI)](https://github.com/alissonpdc/archidraw/actions)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D22-3c873a?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-Apache_2.0-6b3cff?style=flat-square)](LICENSE)

</div>

ArchiDraw is a client-side canvas app for drawing [software architecture diagrams](https://en.wikipedia.org/wiki/Architecture_diagram) with a hand-sketched look. It ships with built-in AWS and Kubernetes component libraries, smart arrow binding, and multi-tab workspaces — with no backend, sign-up, or data leaving your machine.

![ArchiDraw Canvas](./public/canvas.png)

## Features

### Drawing & rendering
- **Sketch-style rendering** — clean to hand-drawn shapes via *roughness* (4 discrete levels), with hachure/cross-hachure fills and solid/dashed/dotted/dash-dot strokes.
- **Deterministic rough paths** — per-element seed ensures identical rendering on screen, SVG export, and re-open.
- **Rich text & labels** — in-place editing with fonts, bold/italic/underline, alignment, per-element text color, vertical alignment, and fine-grained text offsets.

### Architecture-first tools
- **Built-in AWS & Kubernetes library** — ~50+ icons organized by Compute, Network, Database, Storage, Messaging, Security, and Monitoring. No community library needed.
- **Bounded Context containers** — native `ContextElement` for DDD modeling with label positioning, internal/external sides, and child containment.
- **Smart edges** — auto-routing (`lineType: "auto"`), Bezier control points, bend points, segment dragging, parametric label positioning (`labelT`), and optional flowing-dash animation.
- **Details badge** — hidden technical metadata (payload, latency, notes) on any element, visible on demand.
- **Dependency highlighting** — BFS traversal from selection to illuminate connected elements.

### Workspace & productivity
- **Multi-tab workspaces** — several diagrams per session with per-tab undo/redo, renaming, and reordering.
- **Alignment & distribution** — align and distribute multi-selections horizontally or vertically.
- **Copy/paste style** — copy visual properties between elements.
- **Paste at cursor** — clipboard content lands exactly where you point.
- **Element locking** — lock elements to prevent accidental moves or edits.
- **Focus mode** — hide all UI chrome for distraction-free drawing.

### Theming & appearance
- **4 skins** — Midnight, Blueprint, Warm, and Ink.
- **Light / dark / system** theme with automatic background switching.
- **Dot or line grid** with master lines every 5 units.
- **Custom canvas backgrounds** per skin.

### No cloud, no lock-in
- Autosaved to `localStorage`. Import/export as JSON. No account, no server, no data leaving your machine.

## Excalidraw Compatible

ArchiDraw reads [Excalidraw](https://excalidraw.com/) files natively — open your existing diagrams and libraries without conversion.

| Format | Direction | What's preserved |
|---|---|---|
| `.excalidraw` | Import | Shapes, colors, roughness, arrow bindings, fonts, opacity, arrowheads, text |
| `.excalidrawlib` | Import (v1 + v2) | Library items → registered as reusable catalog components |
| `.archidrawlib` | Export | Custom library in Excalidraw v2-compatible format |

> [!NOTE]
> Compatibility is **one-way**: ArchiDraw imports Excalidraw files, but Excalidraw cannot open `.archidraw` or `.archidrawlib` files.

## ArchiDraw vs Excalidraw

ArchiDraw is not a general-purpose whiteboard — it's a **dedicated architecture diagram editor**. Here's what sets it apart.

### What ArchiDraw has that Excalidraw doesn't

| Feature | ArchiDraw | Excalidraw |
|---|---|---|
| Built-in AWS / Kubernetes icons | ✅ ~50+ native | ❌ community libraries only |
| Auto-routed edges | ✅ orthogonal with bend points | ❌ |
| Bezier control points | ✅ | ❌ |
| Animated arrows (data flow) | ✅ | ❌ |
| Dash-dot stroke style | ✅ | ❌ |
| Parametric label on edges (`labelT`) | ✅ | ❌ |
| Bounded Context containers (DDD semantics) | ✅ | Frames only (generic) |
| Details / hidden metadata per element | ✅ | ❌ |
| Split fill / stroke opacity | ✅ | ❌ |
| Vertical text alignment + text offsets | ✅ | ❌ |
| Multi-tab workspace | ✅ | ❌ |
| 4 skins (Midnight, Blueprint, Warm, Ink) | ✅ | ❌ |
| Dependency highlighting (BFS) | ✅ | ❌ |
| Alignment & distribution tools | ✅ | ❌ |
| Copy/paste style | ✅ | ❌ |
| Element locking | ✅ | ❌ |
| Deterministic rough-path export | ✅ | ❌ |
| Paste at cursor position | ✅ | ❌ |
| Dot **and** line grid | ✅ | grid only |

## Getting started

### With Docker (recommended)

```bash
docker run -d --name archidraw -p 5000:5000 alissonpdc/archidraw:latest
```

Open `http://localhost:5000` and start drawing.

### From source

Requirements: **Node.js 22+** and npm.

```bash
git clone https://github.com/alissonpdc/archidraw.git && cd archidraw
make install
make run
```

Open `http://localhost:5173` and start drawing.

## Usage

The toolbar holds the drawing tools: selection, hand, rectangle, diamond, ellipse, line, arrow, and text. Open the component library with `L`; drag or click an item to place it on the canvas.

| Shortcut | Action |
|---|---|
| `1`–`7` | Select drawing tool (selection, hand, rect, diamond, ellipse, line, arrow, text) |
| `Shift` | 45° angle snapping / perfect shapes while drawing |
| `Space` / middle-click | Pan |
| `⌘/Ctrl + scroll` | Zoom |
| `Shift + 1` | Zoom to fit |
| `⌘/Ctrl + G`/`⇧G` | Group / ungroup |
| `⌘/Ctrl + D` | Duplicate |
| `⌘/Ctrl + Z` / `⇧Z` or `Y` | Undo / redo |
| `⌘/Ctrl + O` / `S` | Open / save file |
| `?` | Shortcut reference |

Double-click an element to edit its label or text; double-click empty canvas to create free text.

## File formats

| Format | Direction | Description |
|---|---|---|
| `.archidraw` | Save / Open | ArchiDraw workspace (multi-tab, schema v2) or single diagram |
| `.excalidraw` | Import | [Excalidraw](https://excalidraw.com/) scene — shapes, bindings, fonts, roughness, opacity, arrowheads |
| `.excalidrawlib` | Import | Excalidraw library (v1 & v2) → items become reusable catalog components |
| `.archidrawlib` | Export | Custom library in Excalidraw v2-compatible format |
| `PNG` / `SVG` | Export | Active diagram as raster or vector (deterministic rough paths preserved) |
| `image/*` | Insert | Paste/drop raster images → embedded as library assets |