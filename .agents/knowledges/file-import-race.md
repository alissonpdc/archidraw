# KB — file input is async; `setInputFiles` does not wait for the handler

**Symptom:** import E2Es (`excalidraw-scene-legacy`, `excalidraw-scene-rich`,
`interactions`) fail **flakily** with the imported data simply **missing**
(`expect(els).toHaveLength(1)` received `[]`; tabs came out as
`["Diagram 1"]` only). Which test in the file fails **varies between runs** —
a timing signature, not logic. Passes in isolation, fails in `make test` with
`E2E_WORKERS=15`.

**Root cause:** `src/ui/components/AppMenu.tsx:342-352` — the
`<input type=file>` has `onChange={(e) => onImportFile(e.target.files?.[0])}`,
and `onImportFile` (`AppMenu.tsx:166`) is **`async`**, starting with
`await file.text()`. Playwright's `page.setInputFiles(...)` resolves as soon
as the `change` event has been **dispatched** — it does not wait for the
handler. Reading `editorState()` right after races `await file.text()`
(+ parse + editor mutation). With 15 browsers contending for CPU,
`file.text()` almost always loses.

**Not a product bug:** the handler completes correctly on all 4 branches
(successful `.excalidraw`, invalid `.excalidraw`, successful `.archidraw`,
invalid `.archidraw`) — all call `toast(...)`. The product is right; the test
assumed a settle it never observed.

**Rule (always follow):** never assert right after
`page.setInputFiles('[data-testid="import-input"]', ...)`. Use the
`importFile(page, file)` helper from `tests/fixtures.ts`, which arms a
`MutationObserver` **before** attaching the file and resolves when a **new**
`.toast-stack .toast` node (absent from the initial snapshot) enters the DOM:

```ts
import { importFile } from "../fixtures";
await importFile(page, { name: "x.excalidraw", mimeType: "application/json", buffer });
```

The helper also covers the "invalid import changes nothing" case
(`elementCount === 0`), where polling state changes wouldn't help — the signal
is the toast, not the state.

**Related variant:** the library import
(`.library-import-input`, `LibraryPanel.tsx:277` → `importExcalidrawLibFile`)
does **not** emit a toast. `tests/specs/library-import.spec.ts` waits for the
group to appear via locator — keep that pattern when touching that input.

## Variant 2 — keyboard shortcut that opens the native file picker

**Symptom:** `editor-flows.spec.ts` › *"img shortcut opens the image picker…"*
gets a **30s timeout** on `page.waitForEvent("filechooser")` (3 out of 4 runs).

**Root cause:** not the app. Diagnosis with a capture listener proved the
keydown **arrives** (`isTrusted: true`, `userActivation.isActive === true`)
and the handler calls `input.click()` — the click on the `<input>` happens
(`inputClicks === 1`). Chromium simply **doesn't emit the filechooser event**
on that path. Measured with 10 workers + 8 `yes` processes contending for CPU:

| path                                            | rate            |
| ----------------------------------------------- | --------------- |
| `page.keyboard.press("i")` (event via CDP)      | ~50%            |
| `page.keyboard.down("i")`                       | ~55%            |
| `dispatchEvent(new KeyboardEvent("keydown"))` in-page | **100% (20/20)** |
| real mouse click on the toolbar button          | 100% (20/20)    |

**Rule:** to open a file picker via a shortcut, use
`openFileChooserViaShortcut(page, key)` from `tests/fixtures.ts` — the same
technique `pressPaste` uses for the native `paste` event
(KB `clipboard-paste.md`).
Never `page.keyboard.press` + `waitForEvent("filechooser")`.

## Variant 3 — FPS governor must not measure rAF cadence

`performance.spec.ts` used to measure rAF-to-rAF intervals and demand
`> PERF_MIN_FPS` (45 local / 25 CI). That number is the **OS's scheduling
capacity**, not the app's work: with 10 workers + 8 `yes` the cadence swung
**35–58 fps** while the actual cost of `renderTo` with 500 elements stayed at
**0.3–0.8 ms (median)**. I.e., the 45 fps budget (22 ms/frame) had ~25x
headroom: the test was measuring contention, not performance.

**Rule:** the governor measures the **per-frame render cost**
(`performance.now()` around `editor.renderTo(...)`, after warmup) and compares
it with the `1000 / MIN_FPS` budget, median and p95. The 60-frame rAF loop
stays in the test, but only as a **liveness** assert (`frameCount === 60`)
and to cover the real pan pipeline.
