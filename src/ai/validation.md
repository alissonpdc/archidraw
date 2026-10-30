# In-Browser Validation (`validation.md`)

## 7. In-Browser Validation (`window.archidrawValidate`)

Client-side JavaScript function that answers "is this payload valid, and if not, what breaks it?". It exists so an agent or automated tool that generated a `.archidraw`, `.archidrawlib` or clipboard payload can obtain a machine-readable verdict directly in the browser runtime before importing or pasting it.

Archidraw is hosted as a pure static SPA (on AWS S3 + CloudFront). There is no remote HTTP `/validate` endpoint; validation executes entirely **in-browser** in memory with zero network latency.

Its validation logic strictly mirrors the parsing and normalization rules of **Ctrl+V (Clipboard Paste)** and **Open file (Ctrl+O / File -> Open)**, guaranteeing 100% syntax coherence with the application's ingestion pipelines:

- **Ctrl+V (Clipboard Paste, Section 4):** Validates clipboard payloads (`archidraw/elements` envelope, bare array of elements, or single element). Ingestion is atomic: any element with an invalid `type` rejects the entire payload (`valid: false`). Missing base fields or wrong-typed optional fields (colors, opacity, strokeWidth, roughness, etc.) are defaulted by the normalizer and reported as `warnings`.
- **Open file (Workspace File, Section 2):** Validates `.archidraw` workspace files (`schemaVersion: 2`, `activeTabId`, `tabs` array). The envelope is all-or-nothing: missing required envelope fields or malformed camera/tabs reject the file (`valid: false`).
- **Library Import (Section 5):** Validates `.archidrawlib` reusable libraries (`libraryItems`). Items without native `archidrawElements` trigger rule 5.1 warnings (they import as static raster graphics).

| Property | Value |
|---|---|
| Function and identifier | `window.archidrawValidate(payload)` (also aliased as `window.__archidrawValidate__`) |
| Request payload | raw JSON string (`string`) or parsed JavaScript object (`unknown`) |
| Response | `{ valid, format, errors, warnings, summary }` |
| Availability | Global on `window` in all environments (development, preview, and production on S3 + CloudFront) |
| Latency / Execution | Synchronous in-memory execution (0 ms network, works offline) |

### 7.1 Response shape

The response is not a payload you would feed back into the canvas; it is the verdict. Shown as plain text (not a ```` ```json ```` example) because it is an output shape, not an input the parsers accept:

```
{
  "valid": false,
  "format": "workspace",
  "errors": [
    {
      "path": "tabs[0].doc.elements[2].type",
      "message": "invalid type: \"hexagon\" — expected one of [rectangle, diamond, ellipse, polygon, line, arrow, text, component, context]",
      "rule": "3.4"
    }
  ],
  "warnings": [
    {
      "path": "tabs[0].doc.elements[2].strokeColor",
      "message": "missing base field strokeColor — write it explicitly in .archidraw; on paste it falls back to the default",
      "rule": "3.2"
    }
  ],
  "summary": { "tabs": 1, "elements": 3 }
}
```

| Field | Meaning |
|---|---|
| `valid` | `true` only when the real parser for the detected format would accept the payload |
| `format` | one of `workspace`, `workspace-legacy`, `library`, `clipboard`, `element`, `unknown` |
| `errors` | findings that **reject** the payload; each has a JSON-pointer-style `path`, a human `message` and the `rule` (a section number in this document) |
| `warnings` | findings the parser tolerates (defaults or drops) but that usually mean a mistake |
| `summary` | counts (`tabs`, `items`, `elements`) so the agent can sanity-check what it generated |

`valid` is derived only from `errors`. A payload can be `valid: true` and still carry warnings.

`valid: true` means the parser accepts the payload — it is not a review of the drawing. Geometry and looks are never checked: a rectangle at the wrong coordinates, a label sitting on top of the shape it belongs to, a line ending nowhere or a figure that does not resemble its concept all validate cleanly. For that, render the result and look at it; the warnings are the only automatic signal of a field that was defaulted or dropped.

### 7.2 Format detection

Detection mirrors the disjointness of section 1 and runs in this order; the first match wins:

1. `schemaVersion: 2` together with `tabs` or `activeTabId` → `workspace`
2. `schemaVersion: 1` together with `doc` or `camera` → `workspace-legacy`
3. a `libraryItems` (or `library`) array → `library`
4. a `type` of `archidrawlib` or `excalidrawlib` → `library`
5. a root array: all entries arrays → `library`, otherwise → `clipboard`
6. `type: "archidraw/elements"` or an `elements` array → `clipboard`
7. an object whose `type` is one of the nine element types → `element`
8. anything else → `unknown`, which is always `valid: false`

A single element is validated with clipboard rules but reported as `element`.

### 7.3 errors versus warnings

The in-browser validator separates what the real parsers reject from what they silently repair:

- **workspace** — rejects on envelope shape only: `activeTabId` not a string, empty `tabs`, a tab that is not an object or lacks `id`, `name`, `doc` or `camera`, non-numeric camera fields, or an element whose `type` is not one of the nine. Warnings are emitted for missing base fields, non-finite geometry, or when an element has `type: "component"` with an `sd-*` componentId (rule `lib-native`: in `.archidraw` files, unpack `archidrawElements` from `/ai/lib/<slug>.archidrawlib` directly into `doc.elements`).
- **workspace-legacy** — same `doc` and `camera` checks; the legacy `schemaVersion` itself is a warning, because the loader migrates it to tabs. Emits the same `sd-*` component warning if unexpanded items are present.
- **library** — rejects only when the root carries neither `libraryItems` nor `library`, when that array is empty, or when no item leaves any surviving element.
- **clipboard** — atomic: one item with a bad `type` produces an `error` and `valid: false`.
- **element** — the same rules as a one-item clipboard payload.

Across every format, `errors` are exactly the conditions that make the corresponding real parser fail; `warnings` are conditions it accepts.

### 7.4 Agent Usage Examples

```javascript
// Validate in-browser before pasting or importing
const verdict = await page.evaluate((payload) => {
  return window.archidrawValidate(payload);
}, myGeneratedDiagramJson);

if (!verdict.valid) {
  console.error("Payload rejected:", verdict.errors);
}
```
