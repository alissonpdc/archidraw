# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui.spec.ts >> ui widgets >> shortcuts modal opens with ? and via menu, closes with Escape
- Location: e2e/specs/ui.spec.ts:264:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Keyboard shortcuts/ })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic:
      - img:
        - generic: API
        - generic: DB
      - generic: Empty canvas — click and drag to create
      - generic:
        - generic: R rectangle
        - generic: A arrow
        - generic: T text
        - generic: "? shortcuts"
  - generic [ref=e6]:
    - generic [ref=e8] [cursor=pointer]:
      - button "Diagram 1" [ref=e9]
      - button "Close Diagram 1" [ref=e10]
    - button "New tab" [ref=e13] [cursor=pointer]
  - generic [ref=e17]:
    - button "Main menu" [expanded] [active] [ref=e18] [cursor=pointer]
    - generic [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]: File
        - button "Open" [ref=e25] [cursor=pointer]
        - button "Save" [ref=e31] [cursor=pointer]
        - button "Export Image…" [ref=e39] [cursor=pointer]
      - generic [ref=e47]:
        - generic [ref=e48]: Appearance
        - generic [ref=e49]:
          - generic [ref=e50]: Mode
          - generic [ref=e51]:
            - button "System" [ref=e52] [cursor=pointer]
            - button "Light" [ref=e56] [cursor=pointer]
            - button "Dark" [ref=e60] [cursor=pointer]
        - generic [ref=e63]:
          - generic [ref=e64]: Background
          - generic [ref=e65]:
            - button "White" [ref=e66] [cursor=pointer]
            - button "Cool Gray" [ref=e67] [cursor=pointer]
            - button "Cream" [ref=e68] [cursor=pointer]
            - button "Ice Blue" [ref=e69] [cursor=pointer]
            - button "Parchment" [ref=e70] [cursor=pointer]
        - button "Theme" [ref=e72] [cursor=pointer]
        - button "Grid" [ref=e84] [cursor=pointer]
      - generic [ref=e95]:
        - generic [ref=e96]: Help
        - button "Shortcuts" [ref=e97] [cursor=pointer]
  - generic [ref=e103]:
    - button "Selection" [ref=e104] [cursor=pointer]: Selection (V)
    - button "Hand" [ref=e107] [cursor=pointer]: Hand (H)
    - button "Rectangle" [ref=e114] [cursor=pointer]: Rectangle (R)
    - button "Diamond" [ref=e117] [cursor=pointer]: Diamond (D)
    - button "Ellipse" [ref=e120] [cursor=pointer]: Ellipse (E)
    - button "Line" [ref=e123] [cursor=pointer]: Line (L)
    - button "Arrow" [ref=e126] [cursor=pointer]: Arrow (A)
    - button "Text" [ref=e130] [cursor=pointer]: Text (T)
    - button "Import Image" [ref=e134] [cursor=pointer]
    - button "Component Library" [ref=e139] [cursor=pointer]: Component Library (B)
  - generic [ref=e145]:
    - button "Focus" [ref=e147] [cursor=pointer]: Focus (hide UI)
    - generic [ref=e151]:
      - button "Reset zoom" [ref=e152] [cursor=pointer]: Reset zoom (100%)
      - button "Zoom out" [ref=e159] [cursor=pointer]
      - generic [ref=e161]: 100% 100%
      - button "Zoom in" [ref=e162] [cursor=pointer]
      - button "Fit content" [ref=e166] [cursor=pointer]: Fit content (Shift+1)
    - generic [ref=e170]:
      - button "Undo" [disabled] [ref=e171]: Undo (⌘+Z)
      - button "Redo" [disabled] [ref=e175]: Redo (⌘+Y)
  - button "shortcuts (?)" [ref=e179] [cursor=pointer]
```

# Test source

```ts
  176 | 
  177 |     // restore initial pref
  178 |     await page.evaluate((c) => {
  179 |       if (c === null) localStorage.removeItem("archidraw:skin");
  180 |       else localStorage.setItem("archidraw:skin", c);
  181 |     }, initial);
  182 |   });
  183 | 
  184 |   test("grid defaults to none and switching persists", async ({ page }) => {
  185 |     await open(page);
  186 | 
  187 |     const storedBefore = await page.evaluate(() =>
  188 |       localStorage.getItem("archidraw:grid"),
  189 |     );
  190 |     expect(storedBefore).toBe(null); // default "none" is not written
  191 | 
  192 |     await page.click('[data-testid="app-menu-button"]');
  193 |     // Open the Grid submenu inside Appearance
  194 |     await page.getByRole("button", { name: "Grid" }).click();
  195 |     await page.getByRole("button", { name: "Lines" }).click();
  196 | 
  197 |     expect(
  198 |       await page.evaluate(() => localStorage.getItem("archidraw:grid")),
  199 |     ).toBe("lines");
  200 | 
  201 |     // menu stays open after toggling; checkmark moved to "Lines" in the Grid submenu
  202 |     const gridSubmenu = page.locator(".menu-submenu.open .menu-submenu-panel");
  203 |     await expect(gridSubmenu.locator(".menu-item.active")).toHaveText(/Lines/);
  204 |   });
  205 | 
  206 |   test("new elements use theme-aware stroke color", async ({ page }) => {
  207 |     await open(page);
  208 | 
  209 |     // force dark theme, create a rectangle, check its stroke
  210 |     await page.evaluate(() => {
  211 |       document.documentElement.dataset.theme = "dark";
  212 |     });
  213 |     await page.keyboard.press("r");
  214 |     await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
  215 | 
  216 |     const stroke = await page.evaluate(() => {
  217 |       const s = window.__editor__.getSnapshot();
  218 |       return s.doc.elements[0].strokeColor;
  219 |     });
  220 |     expect(stroke).toBe("#e2e7ee");
  221 | 
  222 |     // back to light theme: new elements are dark again
  223 |     await page.evaluate(() => {
  224 |       document.documentElement.dataset.theme = "light";
  225 |     });
  226 |     await page.keyboard.press("a");
  227 |     await drag(page, { x: 300, y: 300 }, { x: 420, y: 400 });
  228 |     const stroke2 = await page.evaluate(() => {
  229 |       const s = window.__editor__.getSnapshot();
  230 |       return s.doc.elements[1].strokeColor;
  231 |     });
  232 |     expect(stroke2).toBe("#1a2028");
  233 |   });
  234 | 
  235 |   test("empty state hint shows on empty canvas and hides after creating", async ({
  236 |     page,
  237 |   }) => {
  238 |     await open(page);
  239 |     await expect(page.locator(".empty-state")).toBeVisible();
  240 | 
  241 |     await page.keyboard.press("r");
  242 |     await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
  243 |     await expect(page.locator(".empty-state")).toHaveCount(0);
  244 |   });
  245 | 
  246 |   test("export shows a toast", async ({ page }) => {
  247 |     await open(page);
  248 |     await page.click('[data-testid="app-menu-button"]');
  249 |     await page.getByRole("button", { name: "Save" }).click();
  250 | 
  251 |     await expect(page.locator(".toast")).toHaveText(/Workspace exported/);
  252 |   });
  253 | 
  254 |   test("status bar shows shortcuts link", async ({ page }) => {
  255 |     await open(page);
  256 | 
  257 |     const bar = await page.locator(".status-bar").textContent();
  258 |     expect(bar).toContain("shortcuts (?)");
  259 | 
  260 |     await page.click(".status-bar .status-link");
  261 |     await expect(page.locator(".shortcuts-modal")).toBeVisible();
  262 |   });
  263 | 
  264 |   test("shortcuts modal opens with ? and via menu, closes with Escape", async ({
  265 |     page,
  266 |   }) => {
  267 |     await open(page);
  268 | 
  269 |     await page.keyboard.press("?");
  270 |     await expect(page.locator(".shortcuts-modal")).toBeVisible();
  271 | 
  272 |     await page.keyboard.press("Escape");
  273 |     await expect(page.locator(".shortcuts-modal")).toHaveCount(0);
  274 | 
  275 |     await page.click('[data-testid="app-menu-button"]');
> 276 |     await page.getByRole("button", { name: /Keyboard shortcuts/ }).click();
      |                                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  277 |     await expect(page.locator(".shortcuts-modal")).toBeVisible();
  278 |     await page.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } });
  279 |     await expect(page.locator(".shortcuts-modal")).toHaveCount(0);
  280 |   });
  281 | 
  282 |   test("properties panel offers stroke width and stroke opacity for shapes", async ({
  283 |     page,
  284 |   }) => {
  285 |     await open(page);
  286 |     await page.keyboard.press("r");
  287 |     await page.mouse.move(100, 100);
  288 |     await page.mouse.down();
  289 |     await page.mouse.move(220, 180, { steps: 5 });
  290 |     await page.mouse.up();
  291 |     await page.keyboard.press("v");
  292 | 
  293 |     await page.getByRole("button", { name: "Thickness 4" }).click();
  294 |     await page.getByRole("slider", { name: "Stroke opacity" }).fill("50");
  295 | 
  296 |     const el = await page.evaluate(() => {
  297 |       const s = window.__editor__.getSnapshot();
  298 |       return { w: s.doc.elements[0].strokeWidth, o: s.doc.elements[0].strokeOpacity };
  299 |     });
  300 |     expect(el.w).toBe(4);
  301 |     expect(el.o).toBe(0.5);
  302 |   });
  303 | 
  304 |   test("roughness buttons update the stroke style of shapes", async ({
  305 |     page,
  306 |   }) => {
  307 |     await open(page);
  308 |     await page.keyboard.press("r");
  309 |     await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
  310 |     await page.keyboard.press("v");
  311 | 
  312 |     await page
  313 |       .getByRole("button", { name: "Roughness Draft", exact: true })
  314 |       .click();
  315 |     let roughness = await page.evaluate(
  316 |       () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
  317 |     );
  318 |     expect(roughness).toBe(1);
  319 | 
  320 |     await page
  321 |       .getByRole("button", { name: "Roughness Chaos", exact: true })
  322 |       .click();
  323 |     roughness = await page.evaluate(
  324 |       () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
  325 |     );
  326 |     expect(roughness).toBe(3);
  327 | 
  328 |     await page.getByRole("button", { name: "Roughness Architect" }).click();
  329 |     roughness = await page.evaluate(
  330 |       () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
  331 |     );
  332 |     expect(roughness).toBe(0);
  333 |   });
  334 | 
  335 |   test("custom border preset shows a radius slider", async ({ page }) => {
  336 |     await open(page);
  337 |     await page.keyboard.press("r");
  338 |     await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
  339 |     await page.keyboard.press("v");
  340 | 
  341 |     // no slider until the custom preset is activated
  342 |     await expect(page.getByRole("slider", { name: "Custom rounding" })).toHaveCount(0);
  343 |     await page.getByRole("button", { name: "Custom borders" }).click();
  344 | 
  345 |     const slider = page.getByRole("slider", { name: "Custom rounding" });
  346 |     await expect(slider).toBeVisible();
  347 |     await slider.fill("40");
  348 |     const radius = await page.evaluate(
  349 |       () =>
  350 |         (window as any).__editor__.getSnapshot().doc.elements[0].borderRadius,
  351 |     );
  352 |     expect(radius).toBe(40);
  353 |   });
  354 | 
  355 |   test("color swatch opens intensity popover that applies the color", async ({
  356 |     page,
  357 |   }) => {
  358 |     await open(page);
  359 |     await page.keyboard.press("r");
  360 |     await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
  361 |     await page.keyboard.press("v");
  362 | 
  363 |     // palette has exactly 10 base colors
  364 |     const swatches = page.locator(".panel-group").first().locator(".swatch");
  365 |     await expect(swatches).toHaveCount(10);
  366 | 
  367 |     // clicking a color opens the floating intensity submenu
  368 |     await page
  369 |       .getByRole("button", { name: "Stroke color Blue" })
  370 |       .click();
  371 |     const popover = page.locator(".color-popover");
  372 |     await expect(popover).toBeVisible();
  373 | 
  374 |     // picking an intensity applies it to the selection
  375 |     await popover.getByRole("button", { name: /shade 3/ }).click();
  376 |     const color = await page.evaluate(
```