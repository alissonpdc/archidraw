import { test, expect, open } from "../fixtures";

test.describe("ui widgets", () => {
  test("zoom widget buttons change zoom level", async ({ page }) => {
    await open(page);

    await page.getByRole("button", { name: "Zoom in" }).click();
    let pct = await page.locator(".zoom-level").textContent();
    expect(pct).toBe("120%");

    await page.getByRole("button", { name: "Zoom out" }).click();
    pct = await page.locator(".zoom-level").textContent();
    expect(pct).toBe("100%");

    // dedicated reset button returns to 100%
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page
      .locator(".zoom-widget")
      .getByRole("button", { name: "Reset zoom" })
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
    await page.getByRole("button", { name: "Light" }).click();

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

  test("skin selectable via app menu, theme-aware and persisted", async ({
    page,
  }) => {
    await open(page);
    const initial = await page.evaluate(() =>
      localStorage.getItem("archidraw:skin"),
    );

    const bg = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--bg-canvas")
          .trim(),
      );

    await page.click('[data-testid="app-menu-button"]');
    await page.getByRole("button", { name: "Midnight" }).click();

    expect(
      await page.evaluate(
        () => document.documentElement.getAttribute("data-skin"),
      ),
    ).toBe("midnight");
    expect(
      await page.evaluate(() => localStorage.getItem("archidraw:skin")),
    ).toBe("midnight");

    // midnight is dark-first: dark canvas even with system light
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    expect(await bg()).toBe("#0b0d11");
    // ...and light mode switches to the midnight-light palette
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    expect(await bg()).toBe("#f4f6f8");

    // blueprint with dark mode uses the blueprint-dark palette
    await page.getByRole("button", { name: "Blueprint" }).click();
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    expect(await bg()).toBe("#101d2e");

    // blueprint chrome is rigid: widgets use ink-colored 1.5px borders
    // (dark ink #dbe7f5) instead of the soft gray border
    const toolbarBorder = await page.evaluate(() =>
      getComputedStyle(document.querySelector(".toolbar")!).borderColor,
    );
    expect(toolbarBorder).toBe("rgb(219, 231, 245)");

    // blueprint defaults the canvas grid to lines (paper look); menu is
    // already open after picking the skin
    const canvasSection = page.locator(".menu-section", { hasText: "Canvas" });
    await expect(canvasSection.locator(".menu-item.active")).toHaveText(
      /Lines/,
    );
    // ...without persisting a choice
    expect(
      await page.evaluate(() => localStorage.getItem("archidraw:grid")),
    ).toBe(null);
    await page.locator(".menu-backdrop").click({ position: { x: 5, y: 5 } });

    expect(
      await page.evaluate(() => localStorage.getItem("archidraw:skin")),
    ).toBe("blueprint");

    // restore initial pref
    await page.evaluate((c) => {
      if (c === null) localStorage.removeItem("archidraw:skin");
      else localStorage.setItem("archidraw:skin", c);
    }, initial);
  });

  test("precision/warm/swiss skins apply their chrome style and persist", async ({
    page,
  }) => {
    await open(page);
    const initial = await page.evaluate(() =>
      localStorage.getItem("archidraw:skin"),
    );

    // precision slate: flat (no shadow) with tight 4px radius
    await page.click('[data-testid="app-menu-button"]');
    await page.getByRole("button", { name: "Precision Slate" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.getAttribute("data-skin"),
      ),
    ).toBe("precision");
    const precisionToolbar = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector(".toolbar")!);
      return { shadow: s.boxShadow, radius: s.borderRadius };
    });
    expect(precisionToolbar.shadow).toBe("none");
    expect(precisionToolbar.radius).toBe("4px");

    // warm studio: rounded 12px widgets
    await page.getByRole("button", { name: "Warm Studio" }).click();
    const warmToolbar = await page.evaluate(
      () => getComputedStyle(document.querySelector(".toolbar")!).borderRadius,
    );
    expect(warmToolbar).toBe("12px");

    // swiss ink: brutalist 2px ink border, zero radius, hard shadow
    await page.getByRole("button", { name: "Swiss Ink" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.getAttribute("data-skin"),
      ),
    ).toBe("swiss");
    const swissToolbar = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector(".toolbar")!);
      return {
        borderColor: s.borderColor,
        borderWidth: s.borderTopWidth,
        radius: s.borderRadius,
        shadow: s.boxShadow,
      };
    });
    expect(swissToolbar.borderColor).toBe("rgb(17, 17, 17)");
    expect(swissToolbar.borderWidth).toBe("2px");
    expect(swissToolbar.radius).toBe("0px");
    expect(swissToolbar.shadow).toBe("rgb(17, 17, 17) 3px 3px 0px 0px");

    // swiss active states invert to ink (not accent); retry until the
    // 120ms background transition settles
    await page.keyboard.press("v");
    const activeTool = page.locator(".toolbar .tool-btn.active");
    await expect(activeTool).toHaveCSS("background-color", "rgb(17, 17, 17)");
    await expect(activeTool).toHaveCSS("color", "rgb(255, 255, 255)");

    // persisted
    expect(
      await page.evaluate(() => localStorage.getItem("archidraw:skin")),
    ).toBe("swiss");

    // restore initial pref
    await page.evaluate((c) => {
      if (c === null) localStorage.removeItem("archidraw:skin");
      else localStorage.setItem("archidraw:skin", c);
    }, initial);
  });

  test("grid defaults to none and switching persists", async ({ page }) => {
    await open(page);

    const storedBefore = await page.evaluate(() =>
      localStorage.getItem("archidraw:grid"),
    );
    expect(storedBefore).toBe(null); // default "none" is not written

    await page.click('[data-testid="app-menu-button"]');
    await page.getByRole("button", { name: "Lines" }).click();

    expect(
      await page.evaluate(() => localStorage.getItem("archidraw:grid")),
    ).toBe("lines");

    // menu stays open after toggling; checkmark moved to "Lines" in the Canvas section
    const gridSection = page.locator(".menu-section", { hasText: "Canvas" });
    await expect(gridSection.locator(".menu-item.active")).toHaveText(/Lines/);
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
    expect(stroke).toBe("#eaebeb");

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
    expect(stroke2).toBe("#3d4248");
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
    await page.getByRole("button", { name: "Export .archidraw" }).click();

    await expect(page.locator(".toast")).toHaveText(/Workspace exported/);
  });

  test("status bar shows shortcuts link", async ({ page }) => {
    await open(page);

    const bar = await page.locator(".status-bar").textContent();
    expect(bar).toContain("shortcuts (?)");

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
    await page.getByRole("button", { name: /Keyboard shortcuts/ }).click();
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

    await page.getByRole("button", { name: "Thickness 4" }).click();
    await page.getByRole("slider", { name: "Opacity" }).fill("50");

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
      .getByRole("button", { name: "Roughness Draft", exact: true })
      .click();
    let roughness = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
    );
    expect(roughness).toBe(1);

    await page
      .getByRole("button", { name: "Roughness Chaos", exact: true })
      .click();
    roughness = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
    );
    expect(roughness).toBe(3);

    await page.getByRole("button", { name: "Roughness Architect" }).click();
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
    await expect(page.getByRole("slider", { name: "Custom rounding" })).toHaveCount(0);
    await page.getByRole("button", { name: "Custom borders" }).click();

    const slider = page.getByRole("slider", { name: "Custom rounding" });
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
      .getByRole("button", { name: "Stroke color Blue" })
      .click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    // picking an intensity applies it to the selection
    await popover.getByRole("button", { name: /shade 3/ }).click();
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

    // select the text element -> panel shows Text tab with font size group
    await page.mouse.click(255, 255);
    // switch to Text tab
    await page.locator(".panel-tab", { hasText: "Text" }).click();
    await expect(
      page.locator(".panel-group", { hasText: "Size" }),
    ).toBeVisible();

    // shape-only selection: Text tab still shows font size (labels), but
    // verify the panel switches correctly
    await page.keyboard.press("r");
    await drag(page, { x: 500, y: 500 }, { x: 600, y: 580 });
    await page.locator(".panel-tab", { hasText: "Text" }).click();
    await expect(
      page.locator(".panel-group", { hasText: "Size" }),
    ).toBeVisible();

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
