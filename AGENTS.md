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
- `E2E_WORKERS` — default **15** (NOT single worker); CI sets `2`.
- `E2E_RETRIES` — default 0; CI sets `1`.
- `PERF_ELEMENTS` / `PERF_MIN_FPS` — performance.spec.governors; defaults `500` / `45` FPS locally, CI relaxes to `100` / `25`.
- oxlint ignores `e2e/**` and `playwright.config.ts`; `tsc -b` only covers `src/` + `vite.config.ts`. Nothing in the gate typechecks or lints specs — they're verified at runtime only.

## Architecture

- **`src/core/`** — pure logic, no React. `Editor` class (state machine, `editor.ts`), `types.ts` (document model), `renderer.ts` (Canvas 2D), `history.ts` (undo/redo), `hitTest.ts`, `roughPath.ts` (deterministic sketch geometry), plus storage, exporter, and excalidraw import/export pipelines.
- **`src/ui/`** — thin React 19 shell. Subscribes via `useSyncExternalStore(editor.subscribe, editor.getSnapshot)`.
- All state and interaction logic lives in `src/core/`. `src/ui/` is presentation only.

## Critical rules

1. **`Editor.getSnapshot()` must return a stable reference.** Cache invalidation only on `emit()`. Creating a new object per call → infinite render loop.
2. **E2E tests use `test` from `e2e/fixtures.ts`**, not from `@playwright/test`. The fixture monitors `console.error/warning` and `pageerror` — any of these fails the suite.
3. **Use `open(page)` helper** to navigate and wait for `__appReady__`.
4. **Editor internals** are exposed on `window.__editor__` only when `MODE === "test"` (the Playwright webServer build) or `DEV`. Read state via the `editorState()` fixture.
5. **Clipboard/paste**: NEVER call `navigator.clipboard.read()` in `keydown` of Cmd+V — use native `paste` event only. NEVER use `Meta+v` or `Control+v` in tests — use `pressPaste()` from `e2e/fixtures.ts` (cross-platform synthetic event). See `.agents/knowledge/clipboard-paste.md`.
6. **Tooltips in overflow containers**: Use `createPortal` + `position: fixed` with viewport clamp. CSS `::after` tooltips are only allowed in containers without `overflow` or `transform`. See `.agents/knowledge/tooltip-clipping.md`.
7. **Context menu**: `pointerDown` must return early on `button === 2`. Suppress native context menu only inside `.canvas-host`, not when a textarea is focused. See `.agents/knowledge/context-menu.md`.
8. **No comments in code** unless requested.
9. **Arrow pixel sampling**: Deselect elements before sampling canvas pixels (selection handles contaminate samples). See `.agents/knowledge/arrow-tip-guard.md`.

## Branches and CI

- Branches MUST use conventional prefixes: `feat/`, `fix/`, `chore/`, `refactor/`, `perf/`, `test/`, `docs/`, `ci/`, `style/`, `build/`. Anyone else won't trigger CI.
- Push triggers CI (`.github/workflows/ci.yml`): lint, typecheck, security audit, E2E (`E2E_WORKERS=2`, `E2E_RETRIES=1`, relaxed perf), build — in parallel. Auto-PR to `main` opens when green.
- Merge to `main` triggers release (`.github/workflows/release.yml`): semver bump derived from conventional commit history, GitHub Release, multi-arch Docker Hub push.

## Conventions

- Conventional Commits (pt-BR or English, be consistent). The commit message defines the release version bump.
- Node.js 22+.
- Testing: E2E-only (Playwright). No unit tests — coverage is derived from the E2E suite via monocart.
- Knowledge base: `.agents/knowledge/` — check before fixing recurring bugs; add a file there when a bug warrants a general rule, and reference it in this file.