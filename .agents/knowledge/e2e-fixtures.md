# KB — E2E specs import `test` from `e2e/fixtures.ts`, never from `@playwright/test`

**Symptom:**
- A spec passes locally while real bugs (console errors/warnings, page errors)
  slip through; or coverage is silently missing for a spec.

**Root cause:**
- `e2e/fixtures.ts` extends the base Playwright fixture to (a) monitor
  `console.error`, `console.warning` and `pageerror` — any occurrence fails the
  test — and (b) collect JS coverage via monocart when `E2E_COVERAGE=1`.
- Importing `test` from `@playwright/test` bypasses BOTH mechanisms.

**Rule (always follow):**
1. Every spec uses `import { test, open, ... } from "../fixtures"` — never
   `import { test } from "@playwright/test"`.
2. **Navigate only through `open(page)`** (exported by `e2e/fixtures.ts`): it
   waits for `window.__appReady__ === true` and `window.__editor__` to exist.
   Asserting before `open()` returns races app initialization.
3. **Editor internals on `window.__editor__` are only exposed when
   `MODE === "test"`** (the Playwright webServer test build) `or DEV`. Reads of
   editor state inside specs go through the `editorState()` fixture (a typed
   mirror of `EditorSnapshot`; see `EditorSnapshotLike` in `fixtures.ts`), not
   by poking arbitrary globals.
4. Never call `page.goto()` manually; if a spec needs a different entry state,
   drive it through the editor/UI after `open(page)`.

## Where it happened (reference)

- `e2e/fixtures.ts` — `test` custom fixture (console/pageerror monitor +
  coverage), `open()`, `editorState()`, plus helpers `pressPaste()`,
  `pressPasteText()`, `importFile()`, `openFileChooserViaShortcut()`.

## Checklist before writing/updating a spec

- [ ] `test` and helpers imported from `../fixtures` (relative path)?
- [ ] Navigation via `open(page)` only?
- [ ] State reads via `editorState()` fixture, not raw globals?
