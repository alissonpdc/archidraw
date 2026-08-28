import { test, expect, open, drag, selectTool } from "../fixtures";

/** reads the first element of the active tab */
async function firstElement(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const s = (window as any).__editor__.getSnapshot();
    return s.doc.elements[0];
  });
}

test.describe("edge labels (line/arrow)", () => {
  test("double-click on a line adds a label centered on the stroke", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await selectTool(page, "v");

    await page.mouse.dblclick(350, 200); // stroke midpoint
    const overlay = page.locator(".label-overlay");
    await expect(overlay).toBeVisible();

    await page.keyboard.type("API");
    await page.keyboard.press("Escape");

    const el = await firstElement(page);
    expect(el.label).toBe("API");
    // no explicit position yet: label sits at the center (t = 0.5)
    expect(el.labelT ?? 0.5).toBeCloseTo(0.5, 5);
  });

  test("double-click on an arrow adds a label centered on the stroke", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "a");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    await selectTool(page, "v");

    await page.mouse.dblclick(350, 300);
    await page.keyboard.type("sync");
    await page.keyboard.press("Escape");

    const el = await firstElement(page);
    expect(el.label).toBe("sync");
    expect(el.labelT ?? 0.5).toBeCloseTo(0.5, 5);
  });

  test("dragging the label handle moves the label along the stroke", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await selectTool(page, "v");
    await page.mouse.dblclick(350, 200);
    await page.keyboard.type("API");
    await page.keyboard.press("Escape");

    // Escape clears the selection: re-select the line (click, no drag)
    await page.mouse.click(450, 200);
    // the circular label handle sits on the stroke at the label anchor;
    // drag it towards the start point (t ≈ (240-200)/300 ≈ 0.133)
    await page.mouse.move(350, 200);
    await page.mouse.down();
    await page.mouse.move(240, 200, { steps: 5 });
    await page.mouse.up();

    const el = await firstElement(page);
    expect(el.label).toBe("API"); // label content untouched
    expect(el.labelT).toBeCloseTo(40 / 300, 1);
  });

  test("dragging the label handle is undoable", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await selectTool(page, "v");
    await page.mouse.dblclick(350, 200);
    await page.keyboard.type("API");
    await page.keyboard.press("Escape");

    await page.mouse.click(450, 200); // re-select after Escape
    await page.mouse.move(350, 200);
    await page.mouse.down();
    await page.mouse.move(450, 200, { steps: 5 });
    await page.mouse.up();

    await page.keyboard.press("Control+z");
    const el = await firstElement(page);
    expect(el.labelT ?? 0.5).toBeCloseTo(0.5, 1);
    expect(el.label).toBe("API");
  });

  test("label follows the curved path of a curved arrow", async ({ page }) => {
    await open(page);
    await selectTool(page, "a");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    // switch the arrow to a curved line type
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    await selectTool(page, "v");

    // dblclick on the chord midpoint (hit-testing follows the chord);
    // the label renders at the curve midpoint (B(0.5) = (A + 2*CP + B)/4)
    await page.mouse.dblclick(350, 300);
    await page.keyboard.type("c");
    await page.keyboard.press("Escape");

    const el = await firstElement(page);
    expect(el.label).toBe("c");

    const anchor = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      const el = s.doc.elements[0];
      // quadratic Bézier at t=0.5 with the shared default control point
      const a = { x: el.x, y: el.y };
      const tip = { x: el.x + el.width, y: el.y + el.height };
      const cp = {
        x: (a.x + tip.x) / 2,
        y: (a.y + tip.y) / 2 - Math.abs(tip.x - a.x) * 0.3,
      };
      return {
        x: (a.x + 2 * cp.x + tip.x) / 4,
        y: (a.y + 2 * cp.y + tip.y) / 4,
      };
    });
    // arc-length midpoint of the curve is off the straight chord
    expect(anchor.y).toBeLessThan(300 - 20);
    // Escape cleared the selection: re-select via the chord, then drag
    await page.mouse.click(480, 300);
    await page.mouse.move(anchor.x, anchor.y);
    await page.mouse.down();
    await page.mouse.move(anchor.x - 60, anchor.y + 30, { steps: 5 });
    await page.mouse.up();
    const after = await firstElement(page);
    expect(after.labelT).toBeGreaterThan(0.2);
    expect(after.labelT).toBeLessThan(0.8);
  });
});
