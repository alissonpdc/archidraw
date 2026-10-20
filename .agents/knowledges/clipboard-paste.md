# KB — Paste via Cmd+V: don't use `navigator.clipboard.read()`; the only path = the `paste` event

**Symptom:**
- Cmd+V pastes the image **and** opens a native "Paste" menu (Chrome/macOS) —
  or opens only the "Paste" menu and pastes nothing.
- The bug came back even after being "fixed" once (see the App.tsx history of
  2026-08-31: four consecutive attempts).

**Root cause:**
- `navigator.clipboard.read()` called in the Cmd+V `keydown` makes Chrome
  (macOS) show the **native "Paste" menu** as clipboard consent/fallback UI —
  the image arrives (or not) either way, but the menu shows regardless.
- `e.preventDefault()` in the Cmd+V `keydown` **suppresses the browser's
  `paste` event** (documented in d156793), so external images stop arriving.
- On non-editable targets (canvas), an unhandled/`preventDefault`ed `paste`
  can open the native "Paste" menu.

**Rule (always follow):**

1. **The only paste path = the native `paste` event**
   (`window.addEventListener("paste")`). In the mod+V `keydown`: do NOT call
   `navigator.clipboard.read()` and do NOT `preventDefault()` — just `return`
   (let the browser fire `paste`).
2. In the `paste` handler: always `e.preventDefault()` (kills the native menu
   and the default insertion), except when focus is in a `TEXTAREA`/`INPUT`.
3. Handler priority: external image (`clipboardData.items` with
   `kind === "file"` and `type.startsWith("image/")`) → insert; else the OS
   clipboard text that validates as descriptive elements JSON
   (`src/core/clipboardJson.ts` → `editor.pasteFromText`) → insert; else the
   app's internal clipboard (localStorage) → `editor.paste()`; else nothing.
4. Never reintroduce an async fallback via `navigator.clipboard.read()` to fix
   internal paste; if the native `paste` doesn't fire headless, the test must
   dispatch the event manually via `page.evaluate` with
   `new ClipboardEvent("paste", { clipboardData: new DataTransfer() })`.
   **Do NOT use `Meta+v` in tests** — it doesn't fire `paste` on Linux (CI);
   `Control+v` doesn't fire on macOS. The synthetic dispatch is
   cross-platform.
5. **Copy/cut ALSO writes the descriptive elements JSON to the OS clipboard**
   (`navigator.clipboard.writeText`, fire-and-forget with `.catch`), so
   elements can be pasted into external text editors. The app's internal
   clipboard (localStorage, same `archidraw:clipboard` key) remains the
   fallback for the tests' synthetic `paste` (which arrives with empty
   `items`/`text`). Envelope format: `{schemaVersion: 1,
   type: "archidraw/elements", elements: [...]}` (pretty-printed). The parser
   also accepts a plain array of elements and a single element object — see
   `clipboardJson.ts`.
6. JSON pasted onto the canvas is normalized (`normalizeElement`): defaults
   for missing base fields, invalid optional fields dropped, out-of-domain
   enums fall back to the default; a payload with ANY invalid element is
   rejected atomically (never paste half a payload).

## Where it happened (reference)

- `src/ui/App.tsx` — handled in the effect registering
  `window.addEventListener("paste")`.
- Tests: `tests/fixtures.ts` exports `pressPaste()` which dispatches a
  synthetic `ClipboardEvent("paste")` — cross-platform, works on Linux CI.
  For external images (`image.spec.ts`), the test reads
  `navigator.clipboard.read()` and builds the `DataTransfer` with the file
  before dispatching.

## Checklist before touching clipboard/paste

- [ ] No `navigator.clipboard.read()`/`readText()` in the Cmd+V keydown?
- [ ] `preventDefault()` present in the Cmd+V keydown? (must be absent)
- [ ] Is the native `paste` event the only path for external image insertion?
- [ ] Does the `paste` handler `preventDefault()` on every
      handled/ignored path?
- [ ] Does `copySelected` still write the JSON to the OS clipboard **and**
      localStorage (tests' fallback)?
- [ ] Does externally pasted JSON go through `parseElementsClipboard`
      (atomic rejection) before reaching `insertPasted`?
- [ ] Does the E2E use `pressPaste()`/`pressPasteText()` (synthetic
      dispatch), never `Control+v`?
