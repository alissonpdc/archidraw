# AGENTS.md

## Definition of Done (MANDATORY)

**No task is complete until `make gate` passes.** Not "almost done", not "works locally" — green gate or it's not done.

```
make gate  →  make lint && make build && make test
```

Run it at the end of EVERY change: new feature, bug fix, refactor, config edit — everything. If gate fails, fix it before reporting done. No exceptions.

## Commands

```bash
make install      # npm install + playwright install chromium
make run          # Vite dev server (port 5173)
make build        # tsc -b && vite build
make lint         # oxlint (NOT eslint)
make test         # Playwright E2E against a real preview build
make gate         # lint + build + test — run before finishing any work
```

Single spec: `make build && npx playwright test e2e/specs/<name>.spec.ts`

## Architecture

- **`src/core/`** — pure logic, no React. `Editor` class (state machine), `types.ts` (document model), `renderer.ts` (Canvas 2D), `history.ts`, `hitTest.ts`, `roughPath.ts`.
- **`src/ui/`** — thin React 19 shell. Subscribes via `useSyncExternalStore(editor.subscribe, editor.getSnapshot)`.
- All state and interaction logic lives in `src/core/`. `src/ui/` is presentation only.

## Critical rules

1. **`Editor.getSnapshot()` must return a stable reference.** Cache invalidation only on `emit()`. Creating a new object per call → infinite render loop.
2. **E2E tests use `test` from `e2e/fixtures.ts`**, not from `@playwright/test`. The fixture monitors `console.error/warning` and `pageerror` — any of these fails the suite.
3. **Use `open(page)` helper** to navigate and wait for `__appReady__`.
4. **Editor internals** are exposed in test builds via `window.__editor__`. Read state via the `editorState()` fixture.
5. **Clipboard/paste**: NEVER call `navigator.clipboard.read()` in `keydown` of Cmd+V — use native `paste` event only. NEVER use `Meta+v` or `Control+v` in tests — use `pressPaste()` from `e2e/fixtures.ts` (cross-platform synthetic event).
6. **Tooltips in overflow containers**: Use `createPortal` + `position: fixed` with viewport clamp. CSS `::after` tooltips are only allowed in containers without `overflow` or `transform`. See `.agents/knowledge/tooltip-clipping.md`.
7. **Context menu**: `pointerDown` must return early on `button === 2`. Suppress native context menu only inside `.canvas-host`, not when a textarea is focused. See `.agents/knowledge/context-menu.md`.
8. **No comments in code** unless requested.
9. **Arrow pixel sampling**: Deselect elements before sampling canvas pixels (selection handles contaminate samples). See `.agents/knowledge/arrow-tip-guard.md`.

## Branches and CI

- Branches MUST use conventional prefixes: `feat/`, `fix/`, `chore/`, `refactor/`, `perf/`, `test/`, `docs/`, `ci/`, `style/`, `build/`.
- Push triggers CI (`.github/workflows/ci.yml`): lint, typecheck, security audit, E2E, build — in parallel. Auto-PR to `main` opens when green.
- Merge to `main` triggers release (`.github/workflows/release.yml`): semver bump from conventional commits, GitHub Release, Docker Hub push.

## Conventions

- Conventional Commits (pt-BR or English, be consistent).
- Node.js 22+.
- Linter: oxlint.
- Testing: E2E-only (Playwright, single worker). No unit tests.
- Knowledge base: `.agents/knowledge/` — check before fixing recurring bugs.
