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

Single spec: `npx playwright test tests/specs/<name>.spec.ts` — the Playwright `webServer` auto-builds the test build (`npm run build:test && npm run preview`), no `make build` needed.
First `make quality` on a clean clone just saves a baseline (no comparison).
`.coverage-baseline/` and `test-results/` are gitignored — never commit coverage artifacts.

## Test env vars

- `E2E_PORT` — preview port (default `4173`; `make test` picks a random one).
- `E2E_COVERAGE=1` — enabled by `make test`; collects JS coverage via monocart. Raw `npm run test:e2e` does NOT collect coverage.
- `E2E_WORKERS` — default **half of the available CPUs** (min 2), NOT single worker; CI sets `2`.
- `E2E_RETRIES` — default 0; CI sets `1`.
- `PERF_ELEMENTS` / `PERF_MIN_FPS` — performance.spec.governors; defaults `500` / `45` FPS locally, CI relaxes to `100` / `25`.
- oxlint ignores `tests/**` and `playwright.config.ts`; `tsc -b` only covers `src/` + `vite.config.ts`. Nothing in the gate typechecks or lints specs — they're verified at runtime only.

## Architecture

- **`src/core/`** — pure logic, no React. `Editor` class (state machine, `editor.ts`), `types.ts` (document model), `renderer.ts` (Canvas 2D), `history.ts` (undo/redo), `hitTest.ts`, `roughPath.ts` (deterministic sketch geometry), plus storage, exporter, and excalidraw import/export pipelines.
- **`src/docs/`** — AI-facing syntax reference served at `/docs` (`DocsPage` renders `archidraw-syntax.md` via `Markdown`). Keep it in sync with `core/types.ts`, `core/clipboardJson.ts`, `core/storage.ts`, `core/excalidrawImport.ts` and `core/archidrawLibExport.ts` — `tests/specs/docs-route.spec.ts` pastes and imports every JSON example (workspace, clipboard and `.archidrawlib`), so stale examples fail the gate.
- **`src/ui/`** — thin React 19 shell. Subscribes via `useSyncExternalStore(editor.subscribe, editor.getSnapshot)`.
- All state and interaction logic lives in `src/core/`. `src/ui/` is presentation only.

## Critical rules — knowledge base

All critical rules live as knowledge entries in `.agents/knowledges/`. **Read the directory before fixing bugs, touching critical subsystems, or writing UI/E2E code** — each file carries a symptom, root cause and the mandatory rule that fixes it:

| Entry | Rule |
| --- | --- |
| `editor-snapshot-stability.md` | `Editor.getSnapshot()` must return a stable reference; rebuild only on `emit()`. New object per call → infinite render loop. |
| `e2e-fixtures.md` | Use `test`/`open`/`editorState()` from `tests/fixtures.ts` — never `@playwright/test`. Any `console.error/warning`/`pageerror` fails the suite. `open(page)` waits for `__appReady__`; `window.__editor__` exists only in the test/DEV build. |
| `clipboard-paste.md` | Never call `navigator.clipboard.read()` in `keydown` of Cmd+V — native `paste` event only. In tests use `pressPaste()`/`pressPasteText()`, never `Meta+v`/`Control+v`. |
| `tooltip-clipping.md` | Tooltips in overflow containers: `createPortal` + `position: fixed` + viewport clamp, with `width: max-content`. |
| `context-menu.md` | `pointerDown` returns early on `button === 2`; suppress native menu only inside `.canvas-host`; 8px viewport gap via `offset*` metrics. |
| `canvas-pixel-sampling.md` / `arrow-tip-guard.md` | Pixel sampling: deselect elements first; one `getImageData` per page; sample rows between group handles. |
| `file-import-race.md` | Never assert right after `setInputFiles` — the app's `onChange` is async. Use `importFile()`; file pickers via `openFileChooserViaShortcut()`. FPS governors measure per-frame cost, never rAF cadence. |
| `absolute-import-path.md` | E2E imports are always relative (`from "../fixtures"`); never assert-less probes. |
| `panel-intercepts-canvas-clicks.md` | Once a selection exists, synthetic canvas clicks must stay at `x > 260` (and `y > 80` below the toolbar) — the properties panel floats over the canvas. |
| `stroke-path-duplication.md` | Exactly ONE `Path2D` construction site (`getStrokePath(el)`); inline rebuilds defeat DRY and make the helper's branches uncoverable. |
| `theme-reload-color-flip.md` | Install `data-theme` observers only after applying the persisted pref; attribute appliers and theme autosave handlers must be idempotent. |
| `workspace-file-sync-races.md` | Synchronize file writes with `inFlightWrites` and `pendingFlushes`; skip polling during active saves; never trigger parallel writes from polling while debounce timer is active. |
| `canvas-performance.md` | `translatedOrigin` on pure translations, cached grid `CanvasPattern`s, algebraic hachure pre-clip, `getRenderToken()` gate, `getDocIndex()` O(1) lookups, immutable `Document` history snapshots. |

Add a new `.md` entry there whenever a fix or architectural constraint warrants a general rule, and reference it in this file.

## CI

- Push triggers CI (`.github/workflows/ci.yml`): lint, typecheck, security audit, E2E (`E2E_WORKERS=2`, `E2E_RETRIES=1`, relaxed perf), build — in parallel. Auto-PR to `main` opens when green.
- Merge to `main` triggers release (`.github/workflows/release.yml`): semver bump derived from conventional commit history, GitHub Release, multi-arch Docker Hub push.

## Conventions

- No comments in code unless requested.
- Node.js 22+.
- Testing: E2E-only (Playwright). No unit tests — coverage is derived from the E2E suite via monocart.