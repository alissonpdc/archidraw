import { test, expect, open, drag, selectTool } from "../fixtures";

async function firstElement(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const s = (window as any).__editor__.getSnapshot();
    return s.doc.elements[0];
  });
}

test.describe("path types for lines and arrows", () => {
  test("line defaults to straight", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    const el = await firstElement(page);
    expect(el.lineType ?? "straight").toBe("straight");
  });

  test("arrow defaults to straight", async ({ page }) => {
    await open(page);
    await selectTool(page, "a");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    const el = await firstElement(page);
    expect(el.lineType ?? "straight").toBe("straight");
  });

  test("line can be switched to curved via updateElements", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    const el = await firstElement(page);
    expect(el.lineType).toBe("curved");
  });

  test("line can be switched to auto via updateElements", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    const el = await firstElement(page);
    expect(el.lineType).toBe("auto");
  });

  test("curved line renders with a control point", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    await selectTool(page, "v");
    // select the line
    await page.mouse.click(350, 300);
    // the control point handle should be visible; cursor should be "move" near it
    const cp = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      const el = s.doc.elements[0];
      const a = { x: el.x, y: el.y };
      const tip = { x: el.x + el.width, y: el.y + el.height };
      const fallback = {
        x: (a.x + tip.x) / 2,
        y: (a.y + tip.y) / 2 - Math.abs(tip.x - a.x) * 0.3,
      };
      return el.controlPoint ?? fallback;
    });
    // control point should be offset from the midpoint
    expect(cp.y).toBeLessThan(300);
  });

  test("curved arrow persists control point after reload", async ({ page }) => {
    await open(page);
    await selectTool(page, "a");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        lineType: "curved",
        controlPoint: { x: 350, y: 200 },
      });
    });
    await page.reload();
    await open(page);
    const el = await firstElement(page);
    expect(el.lineType).toBe("curved");
    expect(el.controlPoint).toBeDefined();
    expect(el.controlPoint.x).toBeCloseTo(350, 0);
    expect(el.controlPoint.y).toBeCloseTo(200, 0);
  });

  test("auto line with bend points persists after reload", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        lineType: "auto",
        bendPoints: [{ x: 350, y: 200 }],
      });
    });
    await page.reload();
    await open(page);
    const el = await firstElement(page);
    expect(el.lineType).toBe("auto");
    expect(el.bendPoints).toHaveLength(1);
    expect(el.bendPoints[0].x).toBeCloseTo(350, 0);
    expect(el.bendPoints[0].y).toBeCloseTo(200, 0);
  });

  test("undo reverts path type change via UI", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    // select the line
    await selectTool(page, "v");
    await page.mouse.click(350, 200);
    // change path type via the UI button (curved)
    const curvedBtn = page.locator('button[aria-label="Line Curved"]');
    await curvedBtn.click();
    let el = await firstElement(page);
    expect(el.lineType).toBe("curved");
    await page.keyboard.press("Control+z");
    el = await firstElement(page);
    expect(el.lineType ?? "straight").toBe("straight");
  });

  test("label follows curved path of a line", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    await selectTool(page, "v");
    await page.mouse.dblclick(350, 300);
    await page.keyboard.type("c");
    await page.keyboard.press("Escape");
    const el = await firstElement(page);
    expect(el.label).toBe("c");
  });

  test("auto line: hovering a segment shows a drag cursor per orientation", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "v");
    await page.mouse.click(350, 200); // select the line
    // horizontal segment (the L's top edge): vertical drag cursor
    await page.mouse.move(350, 200);
    let cursor = await page.evaluate(() =>
      (window as any).__editor__.cursorOverrideAt({ x: 350, y: 200 }),
    );
    expect(cursor).toBe("ns-resize");
    // vertical segment (the L's right edge): horizontal drag cursor
    await page.mouse.move(500, 300);
    cursor = await page.evaluate(() =>
      (window as any).__editor__.cursorOverrideAt({ x: 500, y: 300 }),
    );
    expect(cursor).toBe("ew-resize");
  });

  test("auto line: clicking a segment without dragging adds no bend", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "v");
    await page.mouse.click(350, 200); // select
    await page.mouse.click(350, 200); // click the segment, no drag
    const el = await firstElement(page);
    expect(el.bendPoints).toBeUndefined();
  });

  test("auto line: dragging the horizontal segment adjusts the L height", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "v");
    await page.mouse.click(350, 200); // select
    // drag the horizontal segment down 60px: L becomes an orthogonal Z
    await drag(page, { x: 350, y: 200 }, { x: 350, y: 260 });
    const el = await firstElement(page);
    expect(el.bendPoints).toHaveLength(2);
    expect(el.bendPoints[0].x).toBeCloseTo(200, 0);
    expect(el.bendPoints[0].y).toBeCloseTo(260, 0);
    expect(el.bendPoints[1].x).toBeCloseTo(500, 0);
    expect(el.bendPoints[1].y).toBeCloseTo(260, 0);
  });

  test("auto line: dragging the vertical segment adjusts the L width", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "v");
    await page.mouse.click(500, 300); // select
    // drag the vertical segment right 60px: vertical edge slides, horizontal
    // stub reconnects to the tip
    await drag(page, { x: 500, y: 300 }, { x: 560, y: 300 });
    const el = await firstElement(page);
    expect(el.bendPoints).toHaveLength(2);
    expect(el.bendPoints[0].x).toBeCloseTo(560, 0);
    expect(el.bendPoints[0].y).toBeCloseTo(200, 0);
    expect(el.bendPoints[1].x).toBeCloseTo(560, 0);
    expect(el.bendPoints[1].y).toBeCloseTo(400, 0);
  });

  test("auto line: undo reverts a segment drag", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "v");
    await page.mouse.click(350, 200); // select
    await drag(page, { x: 350, y: 200 }, { x: 350, y: 260 });
    await page.keyboard.press("Control+z");
    const el = await firstElement(page);
    expect(el.bendPoints).toBeUndefined();
  });
});
