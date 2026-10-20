# KB — E2E specs must go through `tests/fixtures.ts`

**Symptom:**
- A spec that imports `test` from `@playwright/test` passes while a real
  console warning (`console.error`, `console.warning`) or `pageerror` happens
  in the app, and a regression lands.
- A spec that skips `open()` times out waiting for selectors — the page is
  still hydrating.
- Reading `window.__editor__` in a fresh browser via `npm run dev` returns
  `undefined` even though the spec-visible editor state is fine.

**Root cause:** the app's contract with tests is provided by custom fixtures,
not the stock Playwright API. The fixture-wrapped `test` installs listeners
that fail the suite on **any** `console.error` / `console.warning` /
`pageerror`; `open(page)` performs navigation **and** waits for the
`__appReady__` flag set after hydration; `__editor__` is only exposed when
`MODE === "test"` (the Playwright `webServer` build) or `DEV`.

**Rule (always follow):**

1. In `tests/**`, import `test` (and `open`, `editorState`,
   `pressPaste`, `importFile`, ...) from `tests/fixtures.ts` — never from
   `@playwright/test`.
2. Always enter a spec through `open(page)`; don't do raw
   `page.goto("/")` followed by ad-hoc waits.
3. Read editor state via the `editorState()` fixture instead of poking at
   `window.__editor__` directly.
4. Remember `__editor__` does not exist in a plain production build — only
   `MODE === "test"` (the `webServer` build) or `DEV` expose it.
