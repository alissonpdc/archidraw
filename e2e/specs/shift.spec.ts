import { test, expect, drag, selectTool, open } from "../fixtures";

async function lastElement(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const s = window.__editor__.getSnapshot();
    const el = s.doc.elements[s.doc.elements.length - 1];
    return {
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    };
  });
}

test.describe("shift constraints", () => {
  test("shift while drawing rectangle creates a perfect square", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "r");
    await page.keyboard.down("Shift");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 320 });
    await page.keyboard.up("Shift");

    const el = await lastElement(page);
    expect(el.type).toBe("rectangle");
    // dx=150 wins over dy=120 -> 150x150
    expect(el.width).toBeCloseTo(150, 0);
    expect(el.height).toBeCloseTo(150, 0);
  });

  test("shift while drawing ellipse creates a perfect circle", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "e");
    await page.keyboard.down("Shift");
    await drag(page, { x: 200, y: 200 }, { x: 320, y: 350 });
    await page.keyboard.up("Shift");

    const el = await lastElement(page);
    expect(el.type).toBe("ellipse");
    expect(el.width).toBeCloseTo(150, 0);
    expect(el.height).toBeCloseTo(150, 0);
  });

  test("shift while drawing diamond creates a perfect diamond", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "d");
    await page.keyboard.down("Shift");
    await drag(page, { x: 200, y: 200 }, { x: 360, y: 280 });
    await page.keyboard.up("Shift");

    const el = await lastElement(page);
    expect(el.type).toBe("diamond");
    expect(el.width).toBeCloseTo(160, 0);
    expect(el.height).toBeCloseTo(160, 0);
  });

  test("shift while drawing line locks angle to 45 degrees", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "l");
    await page.keyboard.down("Shift");
    await drag(page, { x: 200, y: 200 }, { x: 340, y: 280 });
    await page.keyboard.up("Shift");

    const el = await lastElement(page);
    expect(el.type).toBe("line");
    // angle 29.7° snaps to 45° -> |width| === |height|
    expect(el.width).toBeCloseTo(el.height, 0);
    expect(el.width).toBeGreaterThan(100);
  });

  test("shift while drawing line locks angle to 0 degrees", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "l");
    await page.keyboard.down("Shift");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 212 });
    await page.keyboard.up("Shift");

    const el = await lastElement(page);
    expect(el.type).toBe("line");
    expect(el.height).toBeCloseTo(0, 0);
    expect(el.width).toBeGreaterThan(100);
  });

  test("shift while drawing arrow locks angle to 45 degrees", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "a");
    await page.keyboard.down("Shift");
    await drag(page, { x: 200, y: 200 }, { x: 345, y: 325 });
    await page.keyboard.up("Shift");

    const el = await lastElement(page);
    expect(el.type).toBe("arrow");
    expect(el.width).toBeCloseTo(el.height, 0);
    expect(el.width).toBeGreaterThan(100);
  });

  test("shift on edge resize keeps the original aspect ratio", async ({
    page,
  }) => {
    await open(page);
    // rect 120x80 at (100,100)
    await selectTool(page, "r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await selectTool(page, "v");

    await page.keyboard.down("Shift");
    // grab E handle (220,140) and pull right: h follows w * (80/120)
    await drag(page, { x: 220, y: 140 }, { x: 340, y: 170 });
    await page.keyboard.up("Shift");

    const el = await lastElement(page);
    expect(el.width).toBeCloseTo(240, 0);
    expect(el.height).toBeCloseTo(160, 0);
    expect(el.y).toBeCloseTo(100, 0); // top edge stays anchored
  });

  test("shift on edge resize keeps ratio when dragging north handle", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await selectTool(page, "v");

    await page.keyboard.down("Shift");
    // grab N handle (160,100) and pull up: w follows h * (120/80)
    await drag(page, { x: 160, y: 100 }, { x: 180, y: 40 });
    await page.keyboard.up("Shift");

    const el = await lastElement(page);
    expect(el.height).toBeCloseTo(140, 0);
    expect(el.width).toBeCloseTo(210, 0);
    expect(el.y).toBeCloseTo(40, 0);
  });

  test("shift on line endpoint resize snaps angle to 45 degrees", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 150 });
    await selectTool(page, "v");

    await page.keyboard.down("Shift");
    // grab SE endpoint (200,150); fixed point is (100,100):
    // pointer at (300,190) -> angle 24° snaps to 45° -> |w| === |h|
    await drag(page, { x: 200, y: 150 }, { x: 300, y: 190 });
    await page.keyboard.up("Shift");

    const el = await lastElement(page);
    expect(el.type).toBe("line");
    expect(el.width).toBeCloseTo(el.height, 0);
    expect(el.width).toBeGreaterThan(120);
  });

  test("without shift, drawing stays unconstrained", async ({ page }) => {
    await open(page);
    await selectTool(page, "r");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 320 });

    const el = await lastElement(page);
    expect(el.width).toBeCloseTo(150, 0);
    expect(el.height).toBeCloseTo(120, 0);
  });
});
