## 7. Validation endpoint (`POST /validate`)

An HTTP endpoint that answers "is this payload valid, and if not, what breaks it?". It exists so an agent that generated a `.archidraw`, `.archidrawlib` or clipboard payload can get a machine-readable verdict before importing it.

| Property | Value |
|---|---|
| Method and path | `POST /validate` |
| Request body | the payload itself, as raw JSON (`Content-Type: application/json`) |
| Response | `application/json`: `{valid, format, errors, warnings, summary}` |
| Availability | every serving mode: the Vite dev server and `vite preview` (middleware), and the production Node server (`server/index.ts`, run as `node dist-server/server.js`). The app is always served by Node — there is no static-file-only deployment |

Status codes: `200` for any parseable payload (even an invalid one, since the verdict is in the body), `400` when the body is not valid JSON, `405` for a non-POST method (`GET` returns the usage object), `413` when the body exceeds 8 MB.

### 7.1 Response shape

The response is not a payload you would feed back in; it is the verdict. Shown as plain text (not a ```` ```json ```` example) because it is an output shape, not an input the parsers accept:

```
{
  "valid": false,
  "format": "workspace",
  "errors": [
    {
      "path": "tabs[0].doc.elements[2].type",
      "message": "type inválido: \"hexagon\" — esperado um de [rectangle, diamond, ellipse, line, arrow, text, component, context]",
      "rule": "3.4"
    }
  ],
  "warnings": [
    {
      "path": "tabs[0].doc.elements[2].strokeColor",
      "message": "campo base ausente strokeColor — em .archidraw escreva explicitamente; no paste vira default",
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

`valid: true` means the parser accepts the payload — it is not a review of the drawing. Geometry and looks are never checked (section 5.4): a rectangle at the wrong coordinates, a label sitting on top of the shape it belongs to, a line ending nowhere or a figure that does not resemble its concept all validate cleanly. For that, render the result and look at it; the warnings are the only automatic signal of a field that was defaulted or dropped.

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

A single element is validated with clipboard rules (section 4.3) but reported as `element`.

### 7.3 errors versus warnings

The endpoint separates what the real parsers reject from what they silently repair:

- **workspace (sections 2.1 and 2.2)** — rejects on envelope shape only: `activeTabId` not a string, empty `tabs`, a tab that is not an object or lacks `id`, `name`, `doc` or `camera`, non-numeric camera fields, or an element whose `type` is not one of the nine. Geometry is *not* checked, matching `storage.parse`, so a non-finite `x` is a **warning**, not an error. A `activeTabId` that matches no `tab.id` is also a warning.
- **workspace-legacy (section 2.3)** — same `doc` and `camera` checks; the legacy `schemaVersion` itself is a warning, because the loader migrates it to tabs.
- **library (section 5.4)** — rejects only when the root carries neither `libraryItems` nor `library`, when that array is empty, or when no item leaves any surviving element. An item without `archidrawElements` is a **warning**: the parser accepts it, but the tile becomes a static image and the line-style toggle does nothing to it, so a generated library is almost always wrong in that shape. A single element with a bad `type`, or a `line`/`arrow`/`draw` with fewer than two `points`, is dropped from its item and reported as a **warning**: it never rejects the file. `opacity` outside the scale of its flavour (0 to 100 for Excalidraw-dialect elements, 0 to 1 for native ones) and non-finite geometry are warnings too. Native elements are validated with the section 3 rules, the ones used for a workspace document. That 5.1 warning is also the whole story of a foreign `.excalidrawlib`: it imports and renders, but nothing in it is editable.
- **clipboard (section 4.3)** — atomic: one item with a bad `type` produces an `error` and `valid: false`. Wrong-typed optional fields, non-finite geometry and missing base fields only warn, because the normalizer defaults them.
- **element** — the same rules as a one-item clipboard payload.

Across every format, `errors` are exactly the conditions that make the corresponding real parser fail; `warnings` are conditions it accepts.

### 7.4 Example

```
curl -X POST <archidraw-base-url>/validate \
  -H 'Content-Type: application/json' \
  --data-binary @my-diagram.archidraw
```

Feed each returned `error` back into your generator: `path` locates the offending field inside the payload you sent and `rule` names the section above that explains it.
