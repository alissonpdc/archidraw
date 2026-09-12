import { test, expect, open, drag, selectTool } from "../fixtures";
import { type Page } from "@playwright/test";

async function drawRect(
  page: Page,
  from = { x: 200, y: 150 },
  to = { x: 320, y: 220 },
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

function selectAll(page: Page) {
  return page.evaluate(() => (window as any).__editor__.selectAll());
}

function props(page: Page, index = 0) {
  return page.evaluate((i) => {
    const ed = (window as any).__editor__;
    const el = ed.getSnapshot().doc.elements[i];
    return {
      strokeOpacity: el.strokeOpacity,
      fillOpacity: el.fillOpacity,
      borderRadius: el.borderRadius,
      captionGap: el.captionGap,
      captionOffsetLeft: el.captionOffsetLeft,
      textOffsetGlobal: el.textOffsetGlobal,
      textOffsetTop: el.textOffsetTop,
      strokeStyle: el.strokeStyle,
      fillStyle: el.fillStyle,
      endArrowhead: el.endArrowhead,
    };
  }, index);
}

test.describe("PropertiesPanel style controls", () => {
  test("stroke and fill opacity sliders update the element", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await selectAll(page);
    await page.waitForTimeout(200);

    const stroke = page.locator('input[aria-label="Stroke opacity"]');
    await stroke.press("ArrowLeft"); // 100 → 95
    await stroke.press("ArrowLeft"); // → 90
    let p = await props(page);
    expect(p.strokeOpacity).toBeCloseTo(0.9, 5);

    const fill = page.locator('input[aria-label="Fill opacity"]');
    await fill.press("ArrowLeft"); // → 95
    p = await props(page);
    expect(p.fillOpacity).toBeCloseTo(0.95, 5);
  });

  test("border radius custom value is applied", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await selectAll(page);
    await page.waitForTimeout(200);

    await page.locator(".size-btn[data-tip='Custom']").click();
    const slider = page.locator('input[aria-label="Custom rounding"]');
    await expect(slider).toBeVisible();
    await slider.focus();
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");

    const p = await props(page);
    expect(p.borderRadius).toBe(45);
  });
});

test.describe("PropertiesPanel text offset controls", () => {
  test("rectangle text offset rows write textOffset fields", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await selectAll(page);
    await page.waitForTimeout(200);
    await page.locator(".panel-tab", { hasText: "Text" }).click();
    await page.waitForTimeout(150);

    const global = page
      .locator(".spacing-row", { hasText: "Global" })
      .locator("input");
    await global.fill("6");
    const top = page
      .locator(".spacing-row", { hasText: "Top" })
      .locator("input");
    await top.fill("3");

    const p = await props(page);
    expect(p.textOffsetGlobal).toBe(6);
    expect(p.textOffsetTop).toBe(3);
  });

  test("component caption offset rows write caption fields", async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press("l");
    await expect(page.locator(".library-panel")).toBeVisible();
    await page
      .locator(".library-section-header", { hasText: "Kubernetes" })
      .click();
    await page
      .locator('.library-section:has-text("Kubernetes") .library-tile')
      .first()
      .click();
    await page.keyboard.press("l");
    await page.waitForTimeout(200);
    await page.locator(".panel-tab", { hasText: "Text" }).click();
    await page.waitForTimeout(150);

    const global = page
      .locator(".spacing-row", { hasText: "Global" })
      .locator("input");
    await global.fill("7");
    const left = page
      .locator(".spacing-row", { hasText: "Left" })
      .locator("input");
    await left.fill("2");

    const p = await props(page);
    expect(p.captionGap).toBe(7);
    expect(p.captionOffsetLeft).toBe(2);
  });
});

test.describe("PropertiesPanel mixed selections", () => {
  test("mixed fill styles leave no fill button active", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    // make the second rect hachure
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[1];
      ed.updateElements([el.id], { fillStyle: "hachure" });
    });
    await selectAll(page);
    await page.waitForTimeout(200);

    const activeFill = await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll('.properties-panel .size-btn[data-tip="Solid"], .properties-panel .size-btn[data-tip="Hachure"], .properties-panel .size-btn[data-tip="Cross hachure"]'),
      );
      return btns.filter((b) => b.classList.contains("active")).length;
    });
    expect(activeFill).toBe(0);
  });

  test("mixed arrowheads leave the end-arrowhead group inactive", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 320, y: 270 });
    await drag(page, { x: 400, y: 200 }, { x: 520, y: 270 });
    await selectTool(page, "1");
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.updateElements([ed.getSnapshot().doc.elements[0].id], {
        endArrowhead: "arrow",
      });
      ed.updateElements([ed.getSnapshot().doc.elements[1].id], {
        endArrowhead: "triangle",
      });
    });
    await selectAll(page);
    await page.waitForTimeout(200);

    const activeEndHeads = await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll(".properties-panel .size-btn[data-tip='Arrow'], .properties-panel .size-btn[data-tip='Triangle']"),
      );
      return btns.filter((b) => b.classList.contains("active")).length;
    });
    expect(activeEndHeads).toBe(0);
  });
});

test.describe("PropertiesPanel non-solid arrow", () => {
  test("stroke style toggle applies to a selected arrow", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 320, y: 270 });
    await selectTool(page, "1");
    await selectAll(page);

    await page.locator(".size-btn[aria-label='Line dashed']").click();
    const p = await props(page);
    expect(p.strokeStyle).toBe("dashed");
  });
});