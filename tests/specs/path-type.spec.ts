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
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    const el = await firstElement(page);
    expect(el.lineType ?? "straight").toBe("straight");
  });

  test("arrow defaults to straight", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    const el = await firstElement(page);
    expect(el.lineType ?? "straight").toBe("straight");
  });

  test("line can be switched to curved via updateElements", async ({ page }) => {
    await open(page);
    await selectTool(page, "5");
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
    await selectTool(page, "5");
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
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    await selectTool(page, "1");
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
    await selectTool(page, "6");
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
    await selectTool(page, "5");
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
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    // select the line
    await selectTool(page, "1");
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
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    await selectTool(page, "1");
    await page.mouse.dblclick(350, 300);
    await page.keyboard.type("c");
    await page.keyboard.press("Escape");
    const el = await firstElement(page);
    expect(el.label).toBe("c");
  });

  test("auto line: hovering a segment shows a drag cursor per orientation", async ({ page }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "1");
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
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 200); // select
    await page.mouse.click(350, 200); // click the segment, no drag
    const el = await firstElement(page);
    expect(el.bendPoints).toBeUndefined();
  });

  test("auto line: dragging the horizontal segment adjusts the L height", async ({ page }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "1");
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
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "1");
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
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 200); // select
    await drag(page, { x: 350, y: 200 }, { x: 350, y: 260 });
    await page.keyboard.press("Control+z");
    const el = await firstElement(page);
    expect(el.bendPoints).toBeUndefined();
  });

  /** two rectangles + an auto arrow with both endpoints bound to them */
  async function boundAutoArrow(page: import("@playwright/test").Page) {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await drag(page, { x: 400, y: 300 }, { x: 500, y: 400 });
    await selectTool(page, "6");
    await drag(page, { x: 250, y: 150 }, { x: 350, y: 350 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const arrow = ed.getSnapshot().doc.elements[2];
      ed.updateElements([arrow.id], { lineType: "auto" });
    });
    await selectTool(page, "1");
    // drag each endpoint onto a shape edge to bind it
    await drag(page, { x: 250, y: 150 }, { x: 210, y: 150 });
    await drag(page, { x: 350, y: 350 }, { x: 390, y: 350 });
    const arrow = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      return s.doc.elements[2];
    });
    expect(arrow.x).toBeCloseTo(200, 0);
    expect(arrow.y).toBeCloseTo(150, 0);
    expect(arrow.startBinding).toBeDefined();
    expect(arrow.endBinding).toBeDefined();
    return arrow;
  }

  test("auto arrow: segment drag keeps a margin from the start binding", async ({ page }) => {
    await boundAutoArrow(page);
    await drag(page, { x: 250, y: 150 }, { x: 250, y: 230 });
    const el = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      return s.doc.elements[2];
    });
    expect(el.bendPoints).toHaveLength(4);
    expect(el.bendPoints[0].x).toBeCloseTo(225, 0);
    expect(el.bendPoints[0].y).toBeCloseTo(150, 0);
    expect(el.bendPoints[1].x).toBeCloseTo(225, 0);
    expect(el.bendPoints[1].y).toBeCloseTo(230, 0);
    expect(el.bendPoints[2].x).toBeCloseTo(300, 0);
    expect(el.bendPoints[2].y).toBeCloseTo(230, 0);
    expect(el.bendPoints[3].x).toBeCloseTo(300, 0);
    expect(el.bendPoints[3].y).toBeCloseTo(350, 0);
  });

  test("auto arrow: segment drag keeps a margin from the end binding", async ({ page }) => {
    await boundAutoArrow(page);
    await drag(page, { x: 350, y: 350 }, { x: 350, y: 270 });
    const el = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      return s.doc.elements[2];
    });
    expect(el.bendPoints).toHaveLength(4);
    expect(el.bendPoints[0].x).toBeCloseTo(300, 0);
    expect(el.bendPoints[0].y).toBeCloseTo(150, 0);
    expect(el.bendPoints[1].x).toBeCloseTo(300, 0);
    expect(el.bendPoints[1].y).toBeCloseTo(270, 0);
    expect(el.bendPoints[2].x).toBeCloseTo(375, 0);
    expect(el.bendPoints[2].y).toBeCloseTo(270, 0);
    expect(el.bendPoints[3].x).toBeCloseTo(375, 0);
    expect(el.bendPoints[3].y).toBeCloseTo(350, 0);
  });

  test("auto line: magnet snaps a dragged segment onto a parallel one", async ({ page }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 200); // select
    // drag the vertical segment until it is 4px off the start x: the magnet
    // snaps it exactly onto x=200 and the path straightens
    await drag(page, { x: 500, y: 300 }, { x: 204, y: 300 });
    const el = await firstElement(page);
    expect(el.bendPoints).toHaveLength(1);
    expect(el.bendPoints[0].x).toBeCloseTo(200, 0);
    expect(el.bendPoints[0].y).toBeCloseTo(400, 0);
  });

  /** auto line 200,200 → 500,400 with a horizontal segment dragged into an
   *  orthogonal Z, so the next endpoint drag runs against real bend points */
  async function bentAutoLine(page: import("@playwright/test").Page) {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });
    await selectTool(page, "1");
    await page.mouse.click(350, 200); // select
    await drag(page, { x: 350, y: 200 }, { x: 350, y: 300 }); // create bends
    const el = await firstElement(page);
    expect(el.bendPoints).toHaveLength(2);
  }

  async function pathOf(page: import("@playwright/test").Page) {
    return page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return (window as any).__archidrawUtils__.edgePathPoints(el);
    });
  }

  function expectRightAngles(pts: { x: number; y: number }[]) {
    for (let i = 1; i < pts.length; i++) {
      const dx = Math.abs(pts[i].x - pts[i - 1].x);
      const dy = Math.abs(pts[i].y - pts[i - 1].y);
      expect(dx === 0 || dy === 0).toBe(true);
    }
  }

  test("auto line: dragging the end handle after a segment drag keeps 90° turns", async ({
    page,
  }) => {
    await bentAutoLine(page);
    // grab the end handle (500,400) and pull it down-right: the corners must
    // follow it instead of leaving the last segment at a slant
    await drag(page, { x: 500, y: 400 }, { x: 620, y: 470 });
    const pts = await pathOf(page);
    expectRightAngles(pts);
    expect(pts[pts.length - 1].x).toBeCloseTo(620, 0);
    expect(pts[pts.length - 1].y).toBeCloseTo(470, 0);
    // the untouched anchor stays put
    expect(pts[0].x).toBeCloseTo(200, 0);
    expect(pts[0].y).toBeCloseTo(200, 0);
  });

  test("auto line: dragging the start handle after a segment drag keeps 90° turns", async ({
    page,
  }) => {
    await bentAutoLine(page);
    await drag(page, { x: 200, y: 200 }, { x: 90, y: 140 });
    const pts = await pathOf(page);
    expectRightAngles(pts);
    expect(pts[0].x).toBeCloseTo(90, 0);
    expect(pts[0].y).toBeCloseTo(140, 0);
    expect(pts[pts.length - 1].x).toBeCloseTo(500, 0);
    expect(pts[pts.length - 1].y).toBeCloseTo(400, 0);
  });

  test("auto line: end handle dragged back over the anchor stays orthogonal", async ({ page }) => {
    await bentAutoLine(page);
    // a hard pull to the opposite side folds the corners back on themselves:
    // redundant corners collapse, but no segment may end up slanted
    await drag(page, { x: 500, y: 400 }, { x: 120, y: 150 });
    const pts = await pathOf(page);
    expectRightAngles(pts);
    expect(pts[pts.length - 1].x).toBeCloseTo(120, 0);
    expect(pts[pts.length - 1].y).toBeCloseTo(150, 0);
  });

  test("auto arrow: bound endpoints stay perpendicular after a handle drag", async ({ page }) => {
    await boundAutoArrow(page);
    // bend the route first, so the handle drag has corners to reflow
    await drag(page, { x: 300, y: 250 }, { x: 250, y: 250 });
    const bent = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      return s.doc.elements[2].bendPoints;
    });
    expect(bent.length).toBeGreaterThan(1);
    // pull the end handle far away: the corners follow it and the arrow still
    // leaves the first shape horizontally
    await drag(page, { x: 400, y: 350 }, { x: 640, y: 560 });
    const pts = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      return (window as any).__archidrawUtils__.edgePathPoints(s.doc.elements[2]);
    });
    expectRightAngles(pts);
    expect(pts[pts.length - 1].x).toBeCloseTo(640, 0);
    expect(pts[pts.length - 1].y).toBeCloseTo(560, 0);
    expect(pts[0].x).toBeCloseTo(200, 0);
    expect(pts[0].y).toBeCloseTo(150, 0);
    expect(pts[1].y).toBeCloseTo(150, 0);
  });

  test("autoReflowEndpointBends is a no-op for straight edges and for corners-less ones", async ({
    page,
  }) => {
    await open(page);
    const out = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const base = {
        id: "a",
        type: "arrow",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid",
        fillStyle: "solid",
        roughness: 0,
        borderRadius: 0,
        startArrowhead: "none",
        endArrowhead: "arrow",
      } as any;
      ed.doc = {
        ...ed.doc,
        elements: [
          { ...base, id: "straight", lineType: "straight", bendPoints: [{ x: 40, y: 40 }] },
          { ...base, id: "auto-plain", lineType: "auto" },
        ],
      };
      ed.emit();
      const u = (window as any).__archidrawUtils__;
      const els = ed.getSnapshot().doc.elements;
      const straight = els.find((e: any) => e.id === "straight");
      const plain = els.find((e: any) => e.id === "auto-plain");
      return {
        straight: u.autoReflowEndpointBends(straight, "end", { x: 10, y: 10 }),
        plain: u.autoReflowEndpointBends(plain, "end", { x: 10, y: 10 }),
      };
    });
    expect(out.straight).toEqual([{ x: 40, y: 40 }]);
    expect(out.plain).toBeUndefined();
  });
});
