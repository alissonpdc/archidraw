import { test, expect, open } from "../fixtures";

test.describe("ui widgets", () => {
  test("zoom widget buttons change zoom level", async ({ page }) => {
    await open(page);

    await page.getByRole("button", { name: "Aumentar zoom" }).click();
    let pct = await page.locator(".zoom-level").textContent();
    expect(pct).toBe("120%");

    await page.getByRole("button", { name: "Reduzir zoom" }).click();
    pct = await page.locator(".zoom-level").textContent();
    expect(pct).toBe("100%");

    // dedicated reset button returns to 100%
    await page.getByRole("button", { name: "Aumentar zoom" }).click();
    await page
      .locator(".zoom-widget")
      .getByRole("button", { name: "Resetar zoom" })
      .click();
    pct = await page.locator(".zoom-level").textContent();
    expect(pct).toBe("100%");
  });

  test("theme selectable via app menu and persisted", async ({ page }) => {
    await open(page);
    const initial = await page.evaluate(() =>
      localStorage.getItem("archidraw:theme"),
    );

    await page.click('[data-testid="app-menu-button"]');
    await page.getByRole("button", { name: "Claro" }).click();

    expect(
      await page.evaluate(
        () => document.documentElement.getAttribute("data-theme"),
      ),
    ).toBe("light");
    expect(
      await page.evaluate(() => localStorage.getItem("archidraw:theme")),
    ).toBe("light");

    // restore initial pref
    await page.evaluate((c) => {
      if (c === null) localStorage.removeItem("archidraw:theme");
      else localStorage.setItem("archidraw:theme", c);
    }, initial);
  });

  test("grid defaults to none and switching persists", async ({ page }) => {
    await open(page);

    const storedBefore = await page.evaluate(() =>
      localStorage.getItem("archidraw:grid"),
    );
    expect(storedBefore).toBe(null); // default "none" is not written

    await page.click('[data-testid="app-menu-button"]');
    await page.getByRole("button", { name: "Linhas" }).click();

    expect(
      await page.evaluate(() => localStorage.getItem("archidraw:grid")),
    ).toBe("lines");

    // menu stays open after toggling; checkmark moved to "Linhas" in the Grade section
    const gridSection = page.locator(".menu-section", { hasText: "Grade" });
    await expect(gridSection.locator(".menu-item.active")).toHaveText(/Linhas/);
  });

  test("new elements use theme-aware stroke color", async ({ page }) => {
    await open(page);

    // force dark theme, create a rectangle, check its stroke
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await page.keyboard.press("r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });

    const stroke = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return s.doc.elements[0].strokeColor;
    });
    expect(stroke).toBe("#e8e8e8");

    // back to light theme: new elements are dark again
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    await page.keyboard.press("a");
    await drag(page, { x: 300, y: 300 }, { x: 420, y: 400 });
    const stroke2 = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return s.doc.elements[1].strokeColor;
    });
    expect(stroke2).toBe("#1e1e1e");
  });

  test("empty state hint shows on empty canvas and hides after creating", async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator(".empty-state")).toBeVisible();

    await page.keyboard.press("r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await expect(page.locator(".empty-state")).toHaveCount(0);
  });

  test("export shows a toast", async ({ page }) => {
    await open(page);
    await page.click('[data-testid="app-menu-button"]');
    await page.getByRole("button", { name: "Exportar JSON" }).click();

    await expect(page.locator(".toast")).toHaveText(/Workspace exportado/);
  });

  test("status bar shows shortcuts link", async ({ page }) => {
    await open(page);

    const bar = await page.locator(".status-bar").textContent();
    expect(bar).toContain("atalhos (?)");

    await page.click(".status-bar .status-link");
    await expect(page.locator(".shortcuts-modal")).toBeVisible();
  });

  test("shortcuts modal opens with ? and via menu, closes with Escape", async ({
    page,
  }) => {
    await open(page);

    await page.keyboard.press("?");
    await expect(page.locator(".shortcuts-modal")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".shortcuts-modal")).toHaveCount(0);

    await page.click('[data-testid="app-menu-button"]');
    await page.getByRole("button", { name: /Atalhos de teclado/ }).click();
    await expect(page.locator(".shortcuts-modal")).toBeVisible();
    await page.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(page.locator(".shortcuts-modal")).toHaveCount(0);
  });

  test("properties panel offers stroke width and opacity for shapes", async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press("r");
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(220, 180, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.press("v");

    await page.getByRole("button", { name: "Espessura 4" }).click();
    await page.getByRole("slider", { name: "Opacidade" }).fill("50");

    const el = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return { w: s.doc.elements[0].strokeWidth, o: s.doc.elements[0].opacity };
    });
    expect(el.w).toBe(4);
    expect(el.o).toBe(0.5);
  });

  test("roughness buttons update the stroke style of shapes", async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press("r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await page.keyboard.press("v");

    await page
      .getByRole("button", { name: "Seriedade Rascunho", exact: true })
      .click();
    let roughness = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
    );
    expect(roughness).toBe(1);

    await page
      .getByRole("button", { name: "Seriedade Caos", exact: true })
      .click();
    roughness = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
    );
    expect(roughness).toBe(3);

    await page.getByRole("button", { name: "Seriedade Arquiteto" }).click();
    roughness = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
    );
    expect(roughness).toBe(0);
  });

  test("custom border preset shows a radius slider", async ({ page }) => {
    await open(page);
    await page.keyboard.press("r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await page.keyboard.press("v");

    // no slider until the custom preset is activated
    await expect(page.getByRole("slider", { name: "Arredondamento personalizado" })).toHaveCount(0);
    await page.getByRole("button", { name: "Bordas personalizadas" }).click();

    const slider = page.getByRole("slider", { name: "Arredondamento personalizado" });
    await expect(slider).toBeVisible();
    await slider.fill("40");
    const radius = await page.evaluate(
      () =>
        (window as any).__editor__.getSnapshot().doc.elements[0].borderRadius,
    );
    expect(radius).toBe(40);
  });

  test("color swatch opens intensity popover that applies the color", async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press("r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await page.keyboard.press("v");

    // palette has exactly 10 options: transparent + 9 base colors
    const swatches = page.locator(".panel-group").first().locator(".swatch");
    await expect(swatches).toHaveCount(10);

    // clicking a color opens the floating intensity submenu
    await page
      .getByRole("button", { name: "Cor de traço Azul" })
      .click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    // picking an intensity applies it to the selection
    await popover.getByRole("button", { name: /intensidade 3/ }).click();
    const color = await page.evaluate(
      () =>
        (window as any).__editor__.getSnapshot().doc.elements[0].strokeColor,
    );
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("font size group appears only for text selections", async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press("t");
    await page.mouse.click(250, 250);
    const overlay = page.locator(".text-overlay:not(.label-overlay)");
    await overlay.waitFor();
    await page.keyboard.type("nota");
    await page.keyboard.press("Escape"); // commits and clears selection

    // select the text element -> panel shows Fonte group
    await page.mouse.click(255, 255);
    await expect(
      page.locator(".panel-group", { hasText: "Fonte" }),
    ).toBeVisible();

    // shape-only selection never shows Fonte
    await page.keyboard.press("r");
    await drag(page, { x: 500, y: 500 }, { x: 600, y: 580 });
    await expect(
      page.locator(".panel-group", { hasText: "Fonte" }),
    ).toHaveCount(0);

    // deselect hides panel entirely
    await page.keyboard.press("Escape");
    await expect(page.locator(".properties-panel")).toHaveCount(0);
  });
});

async function drag(
  page: import("@playwright/test").Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}
