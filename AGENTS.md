# AGENTS.md

ArchiDraw: React 19 + Vite + TypeScript canvas app for drawing software architecture. No unit tests — verification is E2E-only (Playwright).

Full conventions: see `CONTRIBUTING.md` (branch/PR flow, release pipeline, code style). This file covers what agents most often get wrong.

## Verification (Definition of Done)

Run the full GATE before reporting any task complete:

```bash
npm run lint && npm run build && npm run test:e2e
```

- `npm run build` includes typecheck (`tsc -b`). There is no separate typecheck script (`CI` typechecks standalone).
- `tsconfig.app.json` sets `verbatimModuleSyntax` + `erasableSyntaxOnly`: type-only imports **must** use `import type`, and enums/namespaces/parameter-properties are compile errors.
- Run a single E2E spec: `npx playwright test e2e/specs/history.spec.ts`
- First run requires: `npm install && npx playwright install chromium`
- Node 22+ required (CI runs Node 22).

## E2E gotchas

- Playwright's `webServer` builds in **test mode** and previews on port 4173 with `reuseExistingServer: false` — it will fail if something else holds that port, and a plain `npm run dev` server won't be used. A test build (`build:test`) is what exposes `window.__editor__`; `npm run dev` also exposes it (`MODE === "test" || DEV` in `src/main.tsx`).
- Always import `test`/`expect` from `e2e/fixtures.ts`, never `@playwright/test` directly. The fixture fails the test if **any** `console.error`/`console.warning`/`pageerror` occurs — React key warnings etc. will break CI.
- Use `open(page)` to navigate and wait for hydration (`__appReady__`); read editor state via the `editorState()` fixture (`window.__editor__.getSnapshot()`).
- Never simulate paste with `Control+v`/`Meta+v` (platform-dependent in headless); use the `pressPaste()` helper (synthetic `ClipboardEvent` dispatch).
- Tests run with `workers: 1` and no retries.

## Architecture rules

- `src/core/` is pure, framework-free logic (document model, `Editor` state machine, renderer, history, hit-testing). `src/ui/` is a thin React presentation shell; state/interaction must live in core.
- `Editor.getSnapshot()` must return a **stable reference** (only invalidated on `emit()`). Allocating a new object per call causes an infinite render loop with `useSyncExternalStore`.

## Read `.agents/knowledge/` before UI work

Recurring-bug rules with mandatory patterns — check them before implementing canvas/UI interactions:
- `clipboard-paste.md` — paste only via the native `paste` event; never `navigator.clipboard.read()` in mod+V keydown, never `preventDefault()` there.
- `context-menu.md` — right-click (`button === 2`) must early-return in `pointerDown`; portal-based menus with viewport clamping.
- `tooltip-clipping.md` — tooltips inside `overflow-*`/`transform` ancestors must use portal + `position: fixed`, not CSS `::after`.
- `arrow-tip-guard.md` — pixel-sampling tests must deselect first (tip selection handle pollutes the region); clamped arrow tips need a zero-translation rigid pivot.

When fixing a recurring bug, add a new entry there and reference it in `AGENTS.md`.

## Workflow constraints

- Branch names must use a conventional prefix (`feat/`, `fix/`, `chore/`, …) — **other prefixes don't trigger CI**. On green CI, a PR to `main` is opened automatically.
- Commits follow Conventional Commits (pt-BR or English); the message type drives automatic semver on merge (`feat` → minor, `!:`/`BREAKING CHANGE` → major, else patch).
- Lint is oxlint (`.oxlintrc.json`); it ignores `e2e/**`.
- **No code comments** unless strictly necessary (differs from the global "keep comments" rule in `~/.agents/rules/development.md`).
