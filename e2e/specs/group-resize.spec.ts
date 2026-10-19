import { test, expect, drag, selectTool, open, type Page } from "../fixtures";

async function createRects(page: Page) {
  await selectTool(page, "2");
  await drag(page, { x: 100, y: 100 }, { x: 180, y: 160 });
  await drag(page, { x: 260, y: 110 }, { x: 360, y: 190 });
  await selectTool(page, "1");
}

async function selectBoth(page: Page) {
  await drag(page, { x: 80, y: 30 }, { x: 380, y: 210 });
  await page.keyboard.press("Control+g");
  await page.mouse.click(140, 130);
}

function geom(page: Page) {
  return page.evaluate(() => {
    const s = window.__editor__.getSnapshot();
    return {
      selected: [...s.selectedIds],
      elements: s.doc.elements.map((el) => ({
        x: el.x,
        y: el.y,
        w: el.width,
        h: el.height,
      })),
    };
  });
}

/** counts selection-color pixels in a canvas region (single readback) */
function selectionPixels(
  page: Page,
  region: { x1: number; y1: number; x2: number; y2: number },
) {
  return page.evaluate(({ x1, y1, x2, y2 }) => {
    const canvas = document.querySelector(".canvas") as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    const data = canvas
      .getContext("2d")!
      .getImageData(x1 * dpr, y1 * dpr, (x2 - x1) * dpr, (y2 - y1) * dpr).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (data[i + 3] > 100 && b > 90 && b - r > 40 && g > 50 && g < b) {
        count++;
      }
    }
    return count;
  }, region);
}

test.describe("group resize", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await createRects(page);
    await selectBoth(page);
  });

  test("clicking a group member selects all members for resize", async ({
    page,
  }) => {
    const g = await geom(page);
    expect(g.selected).toHaveLength(2);
  });

  test("corner handle scales the whole group proportionally", async ({
    page,
  }) => {
    const s0 = (310 / 260 + 130 / 90) / 2;
    await drag(page, { x: 360, y: 190 }, { x: 410, y: 230 });

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(g.selected).toHaveLength(2);
    expect(a.w).toBeCloseTo(80 * s0, 1);
    expect(a.h).toBeCloseTo(60 * s0, 1);
    expect(b.x).toBeCloseTo(100 + 160 * s0, 1);
    expect(b.y).toBeCloseTo(100 + (110 - 100) * s0, 1);
    expect(b.w).toBeCloseTo(100 * s0, 1);
    expect(b.h).toBeCloseTo(80 * s0, 1);
    // equal zoom factor keeps the relative distance between the two boxes
    expect(b.x - (a.x + a.w)).toBeCloseTo(80 * s0, 1);
    expect(b.y - a.y).toBeCloseTo(10 * s0, 1);
  });

  test("edge handle scales one axis only", async ({ page }) => {
    const sx = 340 / 260;
    await drag(page, { x: 360, y: 145 }, { x: 440, y: 145 });

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(a.w).toBeCloseTo(80 * sx, 1);
    expect(a.y).toBeCloseTo(100, 0);
    expect(a.h).toBeCloseTo(60, 0);
    expect(b.w).toBeCloseTo(100 * sx, 1);
    expect(b.h).toBeCloseTo(80, 0);
    expect(b.y).toBeCloseTo(110, 0);
  });

  test("group resize keeps every element's own aspect ratio", async ({
    page,
  }) => {
    await drag(page, { x: 360, y: 190 }, { x: 410, y: 230 });

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(a.w / a.h).toBeCloseTo(80 / 60, 1);
    expect(b.w / b.h).toBeCloseTo(100 / 80, 1);
  });

  test("undo reverts a group resize", async ({ page }) => {
    await drag(page, { x: 360, y: 190 }, { x: 410, y: 230 });
    await page.keyboard.press("Control+z");

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(a.x).toBeCloseTo(100, 0);
    expect(a.w).toBeCloseTo(80, 0);
    expect(a.h).toBeCloseTo(60, 0);
    expect(b.x).toBeCloseTo(260, 0);
    expect(b.y).toBeCloseTo(110, 0);
    expect(b.w).toBeCloseTo(100, 0);
    expect(b.h).toBeCloseTo(80, 0);
  });

  test("individual selection outlines are hidden for a group", async ({
    page,
  }) => {
    await page.waitForTimeout(200);
    const insideGroup = await selectionPixels(page, {
      x1: 120,
      y1: 161,
      x2: 145,
      y2: 168,
    });
    expect(insideGroup).toBe(0);
  });

  test("individual outline remains for a single selection", async ({
    page,
  }) => {
    await page.keyboard.press("Control+Shift+g");
    await page.mouse.click(420, 220);
    await page.mouse.click(140, 130);
    await page.waitForTimeout(200);

    const single = await selectionPixels(page, {
      x1: 120,
      y1: 161,
      x2: 145,
      y2: 168,
    });
    expect(single).toBeGreaterThan(0);
  });

  test("group outline is drawn around the selection", async ({ page }) => {
    await page.waitForTimeout(200);
    const onGroupEdge = await selectionPixels(page, {
      x1: 356,
      y1: 112,
      x2: 366,
      y2: 134,
    });
    expect(onGroupEdge).toBeGreaterThan(0);
  });

  test("cursor hints resize over the group handle", async ({ page }) => {    const se = await page.evaluate(() =>
      window.__editor__.cursorOverrideAt({ x: 360, y: 190 }),
    );
    expect(se).toBe("nwse-resize");

    const away = await page.evaluate(() =>
      window.__editor__.cursorOverrideAt({ x: 200, y: 200 }),
    );
    expect(away).toBeNull();
  });

  test("shrinking a group scales members toward the group corner", async ({
    page,
  }) => {
    const s0 = (58 / 260 + 5 / 90) / 2;
    await drag(page, { x: 360, y: 190 }, { x: 158, y: 105 });

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(a.w).toBeCloseTo(80 * s0, 1);
    expect(a.h).toBeCloseTo(60 * s0, 1);
    expect(b.x).toBeCloseTo(100 + 160 * s0, 1);
    expect(b.x + b.w).toBeCloseTo(100 + 260 * s0, 1);
    expect(b.y + b.h).toBeCloseTo(100 + 90 * s0, 1);
  });
});
