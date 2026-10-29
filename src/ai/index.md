# Archidraw File and Clipboard Syntax Reference

Machine-oriented reference for AI agents that create or edit Archidraw drawings programmatically. It documents the three interchange formats: the `.archidraw` file (complete workspace), the clipboard elements payload (copy/paste) and the `.archidrawlib` file (library of reusable elements). Every JSON example on this page is executed by the automated test suite against the real parser, so the examples are guaranteed valid. Section 7 describes in-browser validation via `window.archidrawValidate`, which reports whether a generated payload is valid and, when it is not, exactly what breaks it.

## 0. Modular AI Documentation Map (`/ai` & `/ai/<slug>.md`)

This reference is available both as a single compiled stream at `GET /ai` and as focused, truncation-safe modular files at `GET /ai/<slug>.md` (source files in `src/ai/<slug>.md`).

> **CRITICAL FOR HTTP / URL TOOLS (`GET /ai`):** The full compiled stream at `GET /ai` (~90 KB) exceeds the ~46 KB truncation limit of standard agent URL/file fetch tools, which cuts off **`/ai/recipes.md` (Section 6 layout & routing rules)** and **`/ai/validate.md` (Section 7)** at the end of `/ai`.
> - **If you fetched `GET /ai` first:** you already have `index.md`, `workspace.md` and `elements.md` in the first 46 KB — next, fetch **`GET /ai/catalog.md`** and **`GET /ai/recipes.md`** directly so nothing is truncated!
> - **If you have not fetched `/ai` yet:** fetch only the modular `/ai/<slug>.md` endpoints listed for your task in the matrix below. Each `/ai/<slug>.md` module is 5 KB–24 KB and never truncates.

### 0.1 File Tree (`src/ai/<slug>.md` / `GET /ai/<slug>.md`)

```text
/ai                          (full compiled reference — all modules below in order)
├── /ai/index.md             (Sec 0–1: Routing matrix, format overview & version markers)
├── /ai/workspace.md         (Sec 2: .archidraw workspace schema 2, camera math & examples)
├── /ai/elements.md          (Sec 3: Native element model, coordinates, bindings, labels & details)
├── /ai/catalog.md           (Sec 3.2 Palette & Sec 3.7 Component catalog: 62 cloud/K8s icons)
├── /ai/clipboard.md         (Sec 4: Clipboard archidraw/elements syntax & paste normalizer)
├── /ai/library.md           (Sec 5: .archidrawlib reusable library format & native vs raster rules)
├── /ai/recipes.md           (Sec 6 & 8: Deterministic grid layout, orthogonal routing & checklist)
└── /ai/validate.md          (Sec 7: In-browser validation, Ctrl+V & Open file syntax verification)
```

### 0.2 Task → Files to Read Matrix

| Agent Task | Read ONLY These Files | Skip These Files (Avoid Context Pollution) |
|---|---|---|
| **Generate or edit a `.archidraw` architecture diagram** | `workspace.md` → `elements.md` → `catalog.md` → `recipes.md` | `clipboard.md`, `library.md` |
| **Generate a clipboard paste payload (`archidraw/elements`)** | `clipboard.md` → `elements.md` → `catalog.md` | `workspace.md`, `library.md` |
| **Generate a `.archidrawlib` reusable library** | `library.md` → `elements.md` → `catalog.md` | `workspace.md`, `clipboard.md` |
| **Validate a payload or fix validation findings** | `validate.md` + the module mapped to `rule` below | All unrelated format modules |

### 0.3 Validation `rule` → Module Lookup

| `rule` Prefix | Topic | Module |
|---|---|---|
| `1` | Disjoint top-level format envelopes | `/ai/index.md` |
| `2.1` – `2.4` | `.archidraw` workspace envelope, tabs, camera, legacy schema 1 | `/ai/workspace.md` |
| `3.1` – `3.6`, `3.8` – `3.9` | Coordinates, z-order, base fields, enums, bindings, labels, `details` | `/ai/elements.md` |
| `3.2` (colors), `3.7` | App color palette (3:1 contrast) and official `componentId` catalog | `/ai/catalog.md` |
| `4.1` – `4.8` | Clipboard envelope, bare array/element paste, normalizer defaults | `/ai/clipboard.md` |
| `5.1` – `5.6` | `.archidrawlib` envelope, `archidrawElements` vs Excalidraw `elements` | `/ai/library.md` |
| `6.1` – `6.2`, `8` | Deterministic grid layout math, arrow binding math, pre-flight checklist | `/ai/recipes.md` |

## 1. Formats at a glance

| Format | Carrier | Top-level shape | Channel |
|---|---|---|---|
| Workspace file | `.archidraw` or `.archidraw.json` (UTF-8, `application/json`) | `{"schemaVersion": 2, "activeTabId": "...", "tabs": [...]}` | Import via the app menu (Open) |
| Clipboard payload | OS clipboard, plain text | `{"schemaVersion": 1, "type": "archidraw/elements", "elements": [...]}` | Paste into the open canvas |
| Library file | `.archidrawlib` or `.excalidrawlib` (UTF-8, `application/json`) | `{"type": "archidrawlib", "version": 2, "libraryItems": [...]}` | Import via the Library panel (import button) |

The three carriers are disjoint: each parser accepts only its own top-level shape and reports a generic error for the others (sections 2.2, 4.3 and 5.4).

Three version markers exist and must not be confused:

- Workspace `schemaVersion` is currently `2`.
- Document `schemaVersion` is currently `1`. It lives inside every tab and is reused by the clipboard envelope, which is also `1`.
- The library file uses `version` (never `schemaVersion`), currently `2`.
