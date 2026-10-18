import { test, expect, drag, selectTool, open, type Page } from "../fixtures";

async function createRects(page: Page) {
  await selectTool(page, "2");
  await drag(page, { x: 100, y: 100 }, { x: 180, y: 160 });
  await drag(page, { x: 260, y: 110 }, { x: 360, y: 190 });
  await selectTool(page, "1");
}

async function selectBoth(page: Page) {
  await drag(page, { x: 80, y: 30 }, { x: 380, y: 210 });
  await page.getByRole("button", { name: "Layers" }).click();
  await page.getByRole("button", { name: "Group", exact: true }).click();
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

  test("cursor hints resize over the group handle", async ({ page }) => {
    const se = await page.evaluate(() =>
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
