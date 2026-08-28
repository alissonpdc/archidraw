import { test, expect, open, selectTool } from "../fixtures";

interface EdgeData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startBinding?: { elementId: string; anchor: string };
  endBinding?: { elementId: string; anchor: string };
}

async function readEdges(
  page: import("@playwright/test").Page,
  type: "line" | "arrow",
): Promise<EdgeData[]> {
  return page.evaluate<EdgeData[]>((t) => {
    const s = (window as any).__editor__.getSnapshot();
    return s.doc.elements
      .filter((e: any) => e.type === t)
      .map((e: any) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        startBinding: e.startBinding,
        endBinding: e.endBinding,
      }));
  }, type);
}

async function readShape(
  page: import("@playwright/test").Page,
  index: number,
): Promise<{ id: string; x: number; y: number; width: number; height: number }> {
  return page.evaluate((i) => {
    const s = (window as any).__editor__.getSnapshot();
    const shapes = s.doc.elements.filter((e: any) => e.type === "rectangle");
    const e = shapes[i];
    return { id: e.id, x: e.x, y: e.y, width: e.width, height: e.height };
  }, index);
}

/** draws rectangles A (100,100)-(220,180) and B (400,300)-(500,360) */
async function drawTwoRects(page: import("@playwright/test").Page) {
  await selectTool(page, "r");
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(220, 180, { steps: 3 });
  await page.mouse.up();
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(500, 360, { steps: 3 });
  await page.mouse.up();
}

test.describe("edge binding to elements", () => {
  test("arrow drawn between shapes binds and snaps both endpoints", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);
    const [a, b] = [
      await readShape(page, 0),
      await readShape(page, 1),
    ];

    // arrow from B's left anchor (400,330) to A's right anchor (220,140)
    await selectTool(page, "a");
    await page.mouse.move(402, 330);
    await page.mouse.down();
    await page.mouse.move(218, 150, { steps: 5 });
    await page.mouse.up();

    const edges = await readEdges(page, "arrow");
    expect(edges).toHaveLength(1);
    const arrow = edges[0];
    // both endpoints snapped exactly onto the anchors
    expect(arrow.x).toBeCloseTo(400, 0);
    expect(arrow.y).toBeCloseTo(330, 0);
    expect(arrow.x + arrow.width).toBeCloseTo(220, 0);
    expect(arrow.y + arrow.height).toBeCloseTo(140, 0);
    expect(arrow.startBinding).toEqual({ elementId: b.id, anchor: "left" });
    expect(arrow.endBinding).toEqual({ elementId: a.id, anchor: "right" });
  });

  test("line (not only arrow) binds and follows a moved shape", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);
    const a = await readShape(page, 0);
    const b = await readShape(page, 1);

    await selectTool(page, "l");
    await page.mouse.move(402, 330);
    await page.mouse.down();
    await page.mouse.move(218, 150, { steps: 5 });
    await page.mouse.up();

    const before = (await readEdges(page, "line"))[0];
    expect(before.startBinding).toEqual({ elementId: b.id, anchor: "left" });
    expect(before.endBinding).toEqual({ elementId: a.id, anchor: "right" });

    // move rect A by (+100,+50): line end follows A's right anchor
    await selectTool(page, "v");
    await page.mouse.move(160, 140);
    await page.mouse.down();
    await page.mouse.move(260, 190, { steps: 5 });
    await page.mouse.up();

    const after = (await readEdges(page, "line"))[0];
    expect(after.startBinding).toEqual({ elementId: b.id, anchor: "left" });
    expect(after.endBinding).toEqual({ elementId: a.id, anchor: "right" });
    // start (bound to B) unchanged; end on A's new right anchor (320,190)
    expect(after.x).toBeCloseTo(400, 0);
    expect(after.y).toBeCloseTo(330, 0);
    expect(after.x + after.width).toBeCloseTo(320, 0);
    expect(after.y + after.height).toBeCloseTo(190, 0);
  });

  test("dragging an arrow endpoint onto another shape rebinds it", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);
    const b = await readShape(page, 1);

    // arrow from A's right anchor to empty space (only start binds)
    await selectTool(page, "a");
    await page.mouse.move(222, 140);
    await page.mouse.down();
    await page.mouse.move(350, 400, { steps: 5 });
    await page.mouse.up();

    // select the arrow by clicking its midpoint
    await selectTool(page, "v");
    await page.mouse.click(286, 270);

    // grab the free end (350,400) and drop it near B's left anchor (400,330)
    await page.mouse.move(350, 400);
    await page.mouse.down();
    await page.mouse.move(405, 335, { steps: 5 });
    await page.mouse.up();

    const edges = await readEdges(page, "arrow");
    expect(edges).toHaveLength(1);
    const arrow = edges[0];
    expect(arrow.endBinding).toEqual({ elementId: b.id, anchor: "left" });
    expect(arrow.x + arrow.width).toBeCloseTo(400, 0);
    expect(arrow.y + arrow.height).toBeCloseTo(330, 0);
  });

  test("dragging a bound endpoint to empty space clears the binding", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);

    // arrow starting at B's left anchor, free end in empty space
    await selectTool(page, "a");
    await page.mouse.move(402, 330);
    await page.mouse.down();
    await page.mouse.move(300, 200, { steps: 5 });
    await page.mouse.up();

    // select the arrow and drag the bound start to empty space
    await selectTool(page, "v");
    await page.mouse.click(350, 265);
    await page.mouse.move(400, 330);
    await page.mouse.down();
    await page.mouse.move(600, 500, { steps: 5 });
    await page.mouse.up();

    const edges = await readEdges(page, "arrow");
    expect(edges).toHaveLength(1);
    const arrow = edges[0];
    expect(arrow.startBinding).toBeUndefined();
    expect(arrow.x).toBeCloseTo(600, 0);
    expect(arrow.y).toBeCloseTo(500, 0);
    // free end untouched
    expect(arrow.x + arrow.width).toBeCloseTo(300, 0);
    expect(arrow.y + arrow.height).toBeCloseTo(200, 0);
  });

  test("resizing a bound shape keeps the arrow attached to its anchor", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);

    // arrow ending on A's right anchor (220,140)
    await selectTool(page, "a");
    await page.mouse.move(300, 200);
    await page.mouse.down();
    await page.mouse.move(218, 142, { steps: 5 });
    await page.mouse.up();

    // select rect A and drag its east handle (220,140) to (320,140)
    await selectTool(page, "v");
    await page.mouse.click(160, 140);
    await page.mouse.move(220, 140);
    await page.mouse.down();
    await page.mouse.move(320, 140, { steps: 5 });
    await page.mouse.up();

    const edges = await readEdges(page, "arrow");
    expect(edges).toHaveLength(1);
    const arrow = edges[0];
    expect(arrow.x + arrow.width).toBeCloseTo(320, 0);
    expect(arrow.y + arrow.height).toBeCloseTo(140, 0);
  });

  test("duplicating a bound diagram remaps bindings to the clones", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);
    const b = await readShape(page, 1);

    await selectTool(page, "a");
    await page.mouse.move(402, 330);
    await page.mouse.down();
    await page.mouse.move(218, 150, { steps: 5 });
    await page.mouse.up();

    // select all and duplicate: the cloned arrow must bind to the cloned rects
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+d");

    const state = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      const rects = s.doc.elements.filter((e: any) => e.type === "rectangle");
      const arrows = s.doc.elements.filter((e: any) => e.type === "arrow");
      return {
        rectIds: rects.map((r: any) => r.id),
        arrowBindings: arrows.map((e: any) => ({
          start: e.startBinding,
          end: e.endBinding,
        })),
      };
    });
    expect(state.arrowBindings).toHaveLength(2);
    for (const arrow of state.arrowBindings) {
      expect(state.rectIds).toContain(arrow.start.elementId);
      expect(state.rectIds).toContain(arrow.end.elementId);
    }
    // the original arrow still binds to the original rects; the clone binds
    // to the cloned rects (its start is NOT the original rect id)
    const cloneArrow = state.arrowBindings.find(
      (e) => e.start.elementId !== b.id,
    );
    const origArrow = state.arrowBindings.find(
      (e) => e.start.elementId === b.id,
    );
    expect(cloneArrow).toBeTruthy();
    expect(origArrow).toBeTruthy();
  });
});
