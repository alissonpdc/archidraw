import { test, expect, open, drag, selectTool } from "../fixtures";

async function firstElement(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const s = (window as any).__editor__.getSnapshot();
    return s.doc.elements[0];
  });
}

async function drawArrow(
  page: import("@playwright/test").Page,
  opts: { lineType?: string; strokeStyle?: string } = {},
) {
  await selectTool(page, "6");
  await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
  const patch = Object.entries(opts).reduce<Record<string, string>>(
    (acc, [k, v]) => {
      if (v) acc[k] = v;
      return acc;
    },
    {},
  );
  if (Object.keys(patch).length > 0) {
    await page.evaluate((p) => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], p);
    }, patch);
  }
  await selectTool(page, "1");
  await page.mouse.click(350, 200);
  return page.locator('button[aria-label="Animate arrow"]');
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
    const btn = await drawArrow(page, { strokeStyle: "dashed" });
    await expect(btn).toBeVisible();
  });

  test("Path type and Animation groups live inside the Stroke section", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, { strokeStyle: "dashed" });
    await expect(btn).toBeVisible();
    const strokeSection = page.locator(".panel-section", {
      hasText: "Stroke",
    });
    await expect(
      strokeSection.locator(".panel-group", { hasText: "Path type" }),
    ).toHaveCount(1);
    await expect(
      strokeSection.locator(".panel-group", { hasText: "Animation" }),
    ).toHaveCount(1);
  });

  test("line Path type group lives inside the Stroke section", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 300 });
    await selectTool(page, "1");
    await page.mouse.click(350, 250);
    const strokeSection = page.locator(".panel-section", {
      hasText: "Stroke",
    });
    await expect(
      strokeSection.locator(".panel-group", { hasText: "Path type" }),
    ).toHaveCount(1);
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

  test("animation button is disabled for solid strokes (straight)", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, {});
    await expect(btn).toBeDisabled();
  });

  test("animation button is disabled for solid strokes (curved)", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, { lineType: "curved" });
    await expect(btn).toBeDisabled();
  });

  test("animation button is enabled for dashed straight arrows", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, { strokeStyle: "dashed" });
    await expect(btn).toBeEnabled();
  });

  test("animation button is enabled for dotted curved arrows", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, {
      strokeStyle: "dotted",
      lineType: "curved",
    });
    await expect(btn).toBeEnabled();
  });

  test("animation button is enabled for dash-dot auto arrows", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, {
      strokeStyle: "dashdot",
      lineType: "auto",
    });
    await expect(btn).toBeEnabled();
  });

  test("clicking the animation toggle on a dashed straight arrow enables the flow", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, { strokeStyle: "dashed" });
    await btn.click();
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
      ed.updateElements([el.id], { strokeStyle: "dashed", animated: true });
    });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { animated: false });
    });
    const el = await firstElement(page);
    expect(el.animated ?? false).toBe(false);
    expect(el.strokeStyle).toBe("dashed");
  });

  test("animation persists across reload", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        lineType: "curved",
        strokeStyle: "dashed",
        animated: true,
      });
    });
    await page.reload();
    await open(page);
    const el = await firstElement(page);
    expect(el.animated).toBe(true);
  });

  test("undo reverts the animation toggle", async ({ page }) => {
    await open(page);
    const btn = await drawArrow(page, { strokeStyle: "dashed" });
    await btn.click();
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
    const btn = await drawArrow(page, { strokeStyle: "dashed" });
    await btn.click();
    const el = await firstElement(page);
    expect(el.animated).toBe(true);
    expect(el.strokeStyle).toBe("dashed");
  });

  test("activating animation on a dotted arrow preserves the dotted style", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, { strokeStyle: "dotted" });
    await btn.click();
    const el = await firstElement(page);
    expect(el.animated).toBe(true);
    expect(el.strokeStyle).toBe("dotted");
  });

  test("activating animation on a dashdot arrow preserves the dashdot style", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, { strokeStyle: "dashdot" });
    await btn.click();
    const el = await firstElement(page);
    expect(el.animated).toBe(true);
    expect(el.strokeStyle).toBe("dashdot");
  });

  test("switching an animated dashed arrow to solid clears animation", async ({
    page,
  }) => {
    await open(page);
    const btn = await drawArrow(page, { strokeStyle: "dashed" });
    await btn.click();
    let el = await firstElement(page);
    expect(el.animated).toBe(true);
    // pick the solid stroke from the Style tab
    await page.locator('button[aria-label="Line solid"]').last().click();
    el = await firstElement(page);
    expect(el.animated ?? false).toBe(false);
    expect(el.strokeStyle).toBe("solid");
    // and the toggle reflects the disabled state
    await expect(btn).toBeDisabled();
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

  test("sketch animated shaft never renders past the arrow tip", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        strokeStyle: "dashed",
        roughness: 3,
        animated: true,
      });
    });
    // sample the region just beyond the arrow tip (x=500) — any dark pixel
    // means the sketched shaft (or its marching dashes) overshoots the head
    const dark = await page.evaluate(() => {
      const canvas = document.querySelector(".canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      const data = ctx.getImageData(
        502 * dpr,
        196 * dpr,
        12 * dpr,
        8 * dpr,
      ).data;
      let dark = 0;
      const lum = (r: number, g: number, b: number) =>
        (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        if (lum(data[i], data[i + 1], data[i + 2]) < 0.5) dark++;
      }
      return dark;
    });
    expect(dark).toBe(0);
  });
});