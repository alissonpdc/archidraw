# AGENTS.md

## Definition of Done (MANDATORY)

**No task is complete until `make gate` passes.** Green gate or it's not done.

```
make gate  →  make lint && make build && make quality
```

`make gate` is heavy: it runs the FULL Playwright E2E suite (coverage run), enforces ≥90% coverage on all metrics, and fails on any coverage regression vs the previous baseline. Adding `src/` code without corresponding E2E specs **will** fail gate. No exceptions.

## Commands

```bash
make install      # npm install + playwright install chromium
make run          # Vite dev server (port 5173)
make build        # tsc -b && vite build
make lint         # oxlint (NOT eslint)
make test         # full E2E suite with coverage collection (E2E_COVERAGE=1, random port)
make coverage     # make test + hard gate: 90% coverage in ALL metrics
make quality      # coverage + regression check vs .coverage-baseline/ (gitignored)
make gate         # lint + build + quality — always run before finishing
```

Single spec: `npx playwright test e2e/specs/<name>.spec.ts` — the Playwright `webServer` auto-builds the test build (`npm run build:test && npm run preview`), no `make build` needed.
First `make quality` on a clean clone just saves a baseline (no comparison).
`.coverage-baseline/` and `test-results/` are gitignored — never commit coverage artifacts.

## Test env vars

- `E2E_PORT` — preview port (default `4173`; `make test` picks a random one).
- `E2E_COVERAGE=1` — enabled by `make test`; collects JS coverage via monocart. Raw `npm run test:e2e` does NOT collect coverage.
- `E2E_WORKERS` — default **half of the available CPUs** (min 2), NOT single worker; CI sets `2`.
- `E2E_RETRIES` — default 0; CI sets `1`.
- `PERF_ELEMENTS` / `PERF_MIN_FPS` — performance.spec.governors; defaults `500` / `45` FPS locally, CI relaxes to `100` / `25`.
- oxlint ignores `e2e/**` and `playwright.config.ts`; `tsc -b` only covers `src/` + `vite.config.ts`. Nothing in the gate typechecks or lints specs — they're verified at runtime only.

## Architecture

- **`src/core/`** — pure logic, no React. `Editor` class (state machine, `editor.ts`), `types.ts` (document model), `renderer.ts` (Canvas 2D), `history.ts` (undo/redo), `hitTest.ts`, `roughPath.ts` (deterministic sketch geometry), plus storage, exporter, and excalidraw import/export pipelines.
- **`src/docs/`** — AI-facing syntax reference served at `/docs` (`DocsPage` renders `archidraw-syntax.md` via `Markdown`). Keep it in sync with `core/types.ts`, `core/clipboardJson.ts`, `core/storage.ts`, `core/excalidrawImport.ts` and `core/archidrawLibExport.ts` — `e2e/specs/docs-route.spec.ts` pastes and imports every JSON example (workspace, clipboard and `.archidrawlib`), so stale examples fail the gate.
- **`src/ui/`** — thin React 19 shell. Subscribes via `useSyncExternalStore(editor.subscribe, editor.getSnapshot)`.
- All state and interaction logic lives in `src/core/`. `src/ui/` is presentation only.

## Critical rules

Each rule has a full KB entry (symptom, root cause, checklist) in `.agents/knowledges/`. Read the linked file before touching the affected code.

1. **Snapshot stability** — `Editor.getSnapshot()` must return a stable reference; cache invalidation only on `emit()`. A new object per call → infinite render loop. → `.agents/knowledges/snapshot-stability.md`
2. **E2E fixtures** — use `test` from `e2e/fixtures.ts` (not `@playwright/test`); navigate only via `open(page)`; read editor state via the `editorState()` fixture, not raw globals. → `.agents/knowledges/e2e-fixtures.md`
3. **Clipboard/paste** — native `paste` event only (no `navigator.clipboard.read()` in Cmd+V keydown); in tests use `pressPaste()`/`pressPasteText()`; copy/cut writes element JSON to the OS clipboard; pasted JSON goes through `editor.pasteFromText`. → `.agents/knowledges/clipboard-paste.md`
4. **Tooltip clipping** — `createPortal` + `position: fixed` with viewport clamp in overflow containers; clamp requires `width: max-content`. → `.agents/knowledges/tooltip-clipping.md`
5. **Context menu** — early return on `button === 2` in `pointerDown`; suppress native menu only inside `.canvas-host`; keep an 8px gap from every viewport edge via `offset*` metrics. → `.agents/knowledges/context-menu.md`
6. **No comments** — no comments in code unless requested. → `.agents/knowledges/no-comments.md`
7. **Arrow pixel sampling** — deselect elements before sampling canvas pixels (selection handles contaminate samples). → `.agents/knowledges/arrow-tip-guard.md`
8. **File inputs** — never assert right after `setInputFiles`; use `importFile(page, file)` and `openFileChooserViaShortcut(page, key)`. → `.agents/knowledges/file-import-race.md`
9. **FPS governors** — never assert on rAF cadence; measure per-frame render cost vs `1000 / PERF_MIN_FPS`. → `.agents/knowledges/fps-governors.md`
10. **E2E imports** — always relative (`from "../fixtures"`), never absolute paths inside `e2e/**`; no probes that assert nothing. → `.agents/knowledges/absolute-import-path.md`