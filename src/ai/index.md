# Archidraw File and Clipboard Syntax Reference

Machine-oriented reference for AI agents that create or edit Archidraw drawings programmatically. It documents the three interchange formats: the `.archidraw` file (complete workspace), the clipboard elements payload (copy/paste) and the `.archidrawlib` file (library of reusable elements). Every JSON example in these modules is executed by automated test suites against the real parsers, ensuring all schemas are guaranteed valid. Section 7 in `validation.md` describes in-browser validation via `window.archidrawValidate`.

## 0. Modular AI Documentation Map (`/ai` & `/ai/<slug>.md`)

This reference is available both as a single compiled stream at `GET /ai` and as focused, truncation-safe modular files at `GET /ai/<slug>.md` (source files in `src/ai/<slug>.md`).

> **CRITICAL FOR AGENT CONTEXT (TRUNCATION LIMIT ~46 KB):**
> Do not fetch all files at once. Fetch only the modular `/ai/<slug>.md` endpoints needed for your specific task as indicated in the matrix below. Each module is compact (< 35 KB) and never truncates.

### 0.1 Documentation Modules

- `/ai/index.md` — Catalog, format overview, schema version markers, and agent routing matrix.
- `/ai/recomendations.md` — Visual guidelines: draft hand-drawn style, spacing, collision avoidance, container padding, edge routing, typography, and checklist.
- `/ai/workspace.md` — Complete `.archidraw` workspace file schema, camera math, active tabs, and import examples.
- `/ai/elements.md` — Native visual elements, UI controls, 15-row color palette, stroke widths, fonts, arrow bindings, and markdown details.
- `/ai/clipboard.md` — Clipboard copy-paste envelope (`archidraw/elements`), bare element/array paste normalizer.
- `/ai/library.md` — Reusable `.archidrawlib` library file format and item schemas.
- `/ai/lib-svg.md` — Built-in SVG cloud and Kubernetes architecture icon catalog (AWS, GCP, Azure, K8s).
- `/ai/lib-native.md` — System Design native editable component items (`sd-*`), auto-expansion, visual descriptions, and `/ai/lib/<slug>.archidrawlib`.
- `/ai/validation.md` — In-browser validation contract via `window.archidrawValidate` and error diagnosis.

### 0.2 Task → Files to Read Matrix

| Agent Task | Read ONLY These Files | Skip These Files |
|---|---|---|
| **Create or edit an architecture diagram (.archidraw)** | `workspace.md` → `elements.md` → `recomendations.md` + (`lib-svg.md` for cloud/k8s icons via `type: "component"`, or `lib-native.md` to obtain ready-made `archidrawElements` via `GET /ai/lib/<slug>.archidrawlib` for `sd-*` items) | `clipboard.md`, `library.md` |
| **Generate a clipboard paste payload (`archidraw/elements`)** | `clipboard.md` → `elements.md` → `recomendations.md` | `workspace.md`, `library.md` |
| **Generate a reusable `.archidrawlib` library** | `library.md` → `elements.md` | `workspace.md`, `clipboard.md` |
| **Inspect or use official cloud/K8s SVG icons** | `lib-svg.md` | `lib-native.md` |
| **Inspect or use native System Design items** | `lib-native.md` | `lib-svg.md` |
| **Validate a generated payload or fix errors** | `validation.md` + file of rule finding | Unrelated format files |

## 1. Formats at a glance

| Format | Carrier | Top-level shape | Channel |
|---|---|---|---|
| Workspace file | `.archidraw` or `.archidraw.json` (UTF-8, `application/json`) | `{"schemaVersion": 2, "activeTabId": "...", "tabs": [...]}` | Import via the app menu (Open) |
| Clipboard payload | OS clipboard, plain text | `{"schemaVersion": 1, "type": "archidraw/elements", "elements": [...]}` | Paste into the open canvas (Ctrl+V) |
| Library file | `.archidrawlib` or `.excalidrawlib` (UTF-8, `application/json`) | `{"type": "archidrawlib", "version": 2, "libraryItems": [...]}` | Import via the Library panel |

The three carriers are disjoint: each parser accepts only its own top-level shape and reports a generic error for the others.

Three version markers exist and must not be confused:
- Workspace `schemaVersion` is currently `2`.
- Document `schemaVersion` is currently `1`. It lives inside every tab and is reused by the clipboard envelope, which is also `1`.
- The library file uses `version` (never `schemaVersion`), currently `2`.
