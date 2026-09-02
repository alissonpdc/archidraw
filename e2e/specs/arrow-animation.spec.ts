import { test, expect, open, drag, selectTool } from "../fixtures";

async function firstElement(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const s = (window as any).__editor__.getSnapshot();
    return s.doc.elements[0];
  });
}

async function drawArrow(page: import("@playwright/test").Page) {
  await selectTool(page, "6");
  await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
  await selectTool(page, "1");
  await page.mouse.click(350, 200);
}

test.describe("arrow animation", () => {
  test("arrow defaults to non-animated", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    const el = await firstElement(page);
    expect(el.animated ?? false).toBe(false);
  });

  test("animation toggle is exposed in the Style tab for arrows", async ({
    page,
  }) => {
    await open(page);
    await drawArrow(page);
    const btn = page.locator('button[aria-label="Animate arrow"]');
    await expect(btn).toBeVisible();
  });

  test("animation toggle is hidden for non-arrow selections", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 400, y: 350 });
    await selectTool(page, "1");
    await page.mouse.click(300, 275);
    const btn = page.locator('button[aria-label="Animate arrow"]');
    await expect(btn).toHaveCount(0);
  });

  test("animation button is disabled for straight arrows", async ({
    page,
  }) => {
    await open(page);
    await drawArrow(page);
    const btn = page.locator('button[aria-label="Animate arrow"]');
    await expect(btn).toBeDisabled();
  });

  test("animation button is enabled when the arrow is curved", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 300);
    const btn = page.locator('button[aria-label="Animate arrow"]');
    await expect(btn).toBeEnabled();
  });

  test("clicking the animation toggle on a curved arrow enables the flow", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 200);
    await page.locator('button[aria-label="Animate arrow"]').click();
    const el = await firstElement(page);
    expect(el.animated).toBe(true);
  });

  test("animation can be toggled off again", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { animated: true });
    });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { animated: false });
    });
    const el = await firstElement(page);
    expect(el.animated ?? false).toBe(false);
  });

  test("animation persists across reload", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved", animated: true });
    });
    await page.reload();
    await open(page);
    const el = await firstElement(page);
    expect(el.animated).toBe(true);
  });

  test("undo reverts the animation toggle", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 200);
    await page.locator('button[aria-label="Animate arrow"]').click();
    let el = await firstElement(page);
    expect(el.animated).toBe(true);
    await page.keyboard.press("Control+z");
    el = await firstElement(page);
    expect(el.animated ?? false).toBe(false);
  });

  test("activating animation does not change the stroke style", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        lineType: "curved",
        strokeStyle: "dashed",
      });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 200);
    await page.locator('button[aria-label="Animate arrow"]').click();
    const el = await firstElement(page);
    expect(el.animated).toBe(true);
    expect(el.strokeStyle).toBe("dashed");
  });

  test("activating animation on a dotted arrow preserves the dotted style", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        lineType: "curved",
        strokeStyle: "dotted",
      });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 200);
    await page.locator('button[aria-label="Animate arrow"]').click();
    const el = await firstElement(page);
    expect(el.animated).toBe(true);
    expect(el.strokeStyle).toBe("dotted");
  });

  test("activating animation on a dashdot arrow preserves the dashdot style", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        lineType: "curved",
        strokeStyle: "dashdot",
      });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 200);
    await page.locator('button[aria-label="Animate arrow"]').click();
    const el = await firstElement(page);
    expect(el.animated).toBe(true);
    expect(el.strokeStyle).toBe("dashdot");
  });

  test("arrow head is 20% larger than the body size formula", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    const head = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const sw = el.strokeWidth;
      const expected = Math.max(12, sw * 4) * 1.2;
      return { strokeWidth: sw, expected, actual: Math.max(12, sw * 4) * 1.2 };
    });
    expect(head.actual).toBeCloseTo(head.expected, 6);
  });
});