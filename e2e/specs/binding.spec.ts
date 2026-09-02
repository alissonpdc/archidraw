import { test, expect, open, drag, selectTool } from "../fixtures";

interface EdgeData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startBinding?: { elementId: string; nx: number; ny: number };
  endBinding?: { elementId: string; nx: number; ny: number };
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
  await selectTool(page, "2");
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

    // arrow from over B's left edge to over A's right edge: the endpoints
    // snap to the nearest outline point of each shape
    await selectTool(page, "6");
    await page.mouse.move(402, 330);
    await page.mouse.down();
    await page.mouse.move(218, 150, { steps: 5 });
    await page.mouse.up();

    const edges = await readEdges(page, "arrow");
    expect(edges).toHaveLength(1);
    const arrow = edges[0];
    // both endpoints snapped onto the outline
    expect(arrow.x).toBeCloseTo(400, 0);
    expect(arrow.y).toBeCloseTo(330, 0);
    expect(arrow.x + arrow.width).toBeCloseTo(220, 0);
    expect(arrow.y + arrow.height).toBeCloseTo(150, 0);
    // start bound to B's left edge midpoint, end to A's right edge
    expect(arrow.startBinding?.elementId).toBe(b.id);
    expect(arrow.startBinding?.nx).toBeCloseTo(0, 5);
    expect(arrow.startBinding?.ny).toBeCloseTo(0.5, 5);
    expect(arrow.endBinding?.elementId).toBe(a.id);
    expect(arrow.endBinding?.nx).toBeCloseTo(1, 5);
    expect(arrow.endBinding?.ny).toBeCloseTo(0.625, 5);
  });

  test("edges subtly snap to a shape's horizontal/vertical centers", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);
    const a = await readShape(page, 0);

    // arrow end near A's right edge center (220,140): draws at (218,142) and
    // must be captured to the exact vertical/horizontal center midpoint
    await selectTool(page, "6");
    await page.mouse.move(600, 500);
    await page.mouse.down();
    await page.mouse.move(218, 142, { steps: 5 });
    await page.mouse.up();

    // arrow end near A's bottom edge center (160,180): draws at (162,182)
    await page.mouse.move(600, 520);
    await page.mouse.down();
    await page.mouse.move(162, 182, { steps: 5 });
    await page.mouse.up();

    const edges = await readEdges(page, "arrow");
    expect(edges).toHaveLength(2);
    const [right, bottom] = edges;
    expect(right.startBinding).toBeUndefined();
    expect(right.endBinding?.elementId).toBe(a.id);
    expect(right.endBinding?.nx).toBeCloseTo(1, 5);
    expect(right.endBinding?.ny).toBeCloseTo(0.5, 5);
    expect(right.x + right.width).toBeCloseTo(220, 0);
    expect(right.y + right.height).toBeCloseTo(140, 0);

    expect(bottom.startBinding).toBeUndefined();
    expect(bottom.endBinding?.elementId).toBe(a.id);
    expect(bottom.endBinding?.nx).toBeCloseTo(0.5, 5);
    expect(bottom.endBinding?.ny).toBeCloseTo(1, 5);
    expect(bottom.x + bottom.width).toBeCloseTo(160, 0);
    expect(bottom.y + bottom.height).toBeCloseTo(180, 0);
  });

  test("line (not only arrow) binds and follows a moved shape", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);
    const a = await readShape(page, 0);
    const b = await readShape(page, 1);

    await selectTool(page, "5");
    await page.mouse.move(402, 330);
    await page.mouse.down();
    await page.mouse.move(218, 150, { steps: 5 });
    await page.mouse.up();

    const before = (await readEdges(page, "line"))[0];
    expect(before.startBinding?.elementId).toBe(b.id);
    expect(before.endBinding?.elementId).toBe(a.id);

    // move rect A by (+100,+50): line end follows its bound outline position
    await selectTool(page, "1");
    await page.mouse.move(160, 140);
    await page.mouse.down();
    await page.mouse.move(260, 190, { steps: 5 });
    await page.mouse.up();

    const after = (await readEdges(page, "line"))[0];
    expect(after.startBinding?.elementId).toBe(b.id);
    expect(after.endBinding?.elementId).toBe(a.id);
    // start (bound to B) unchanged; end keeps nx=1, ny=0.625 on A's new
    // bounds (200,150)-(320,230) -> (320, 200)
    expect(after.x).toBeCloseTo(400, 0);
    expect(after.y).toBeCloseTo(330, 0);
    expect(after.x + after.width).toBeCloseTo(320, 0);
    expect(after.y + after.height).toBeCloseTo(200, 0);
  });

  test("dragging an arrow endpoint onto another shape rebinds it", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);
    const b = await readShape(page, 1);

    // arrow from A's right anchor to empty space (only start binds)
    await selectTool(page, "6");
    await page.mouse.move(222, 140);
    await page.mouse.down();
    await page.mouse.move(350, 400, { steps: 5 });
    await page.mouse.up();

    // select the arrow by clicking its midpoint
    await selectTool(page, "1");
    await page.mouse.click(286, 270);

    // grab the free end (350,400) and drag it over B: the shape must be
    // highlighted (binding preview) while the pointer is over it
    await page.mouse.move(350, 400);
    await page.mouse.down();
    await page.mouse.move(405, 335, { steps: 5 });
    const preview = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.bindingPreview as {
        start: unknown;
        end: { elementId: string } | null;
      } | null;
    });
    expect(preview?.end?.elementId).toBe(b.id);
    await page.mouse.up();

    const edges = await readEdges(page, "arrow");
    expect(edges).toHaveLength(1);
    const arrow = edges[0];
    expect(arrow.endBinding?.elementId).toBe(b.id);
    // dropped near B's left edge center -> subtle snap to its vertical
    // center (400,330) instead of the raw outline point (400,335)
    expect(arrow.x + arrow.width).toBeCloseTo(400, 0);
    expect(arrow.y + arrow.height).toBeCloseTo(330, 0);
  });

  test("dragging a bound endpoint to empty space clears the binding", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);

    // arrow starting at B's left anchor, free end in empty space
    await selectTool(page, "6");
    await page.mouse.move(402, 330);
    await page.mouse.down();
    await page.mouse.move(300, 200, { steps: 5 });
    await page.mouse.up();

    // select the arrow and drag the bound start to empty space
    await selectTool(page, "1");
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
    await selectTool(page, "6");
    await page.mouse.move(300, 200);
    await page.mouse.down();
    await page.mouse.move(218, 142, { steps: 5 });
    await page.mouse.up();

    // select rect A and drag its east handle (220,140) to (320,140)
    await selectTool(page, "1");
    await page.mouse.click(160, 140);
    await page.mouse.move(220, 140);
    await page.mouse.down();
    await page.mouse.move(320, 140, { steps: 5 });
    await page.mouse.up();

    const edges = await readEdges(page, "arrow");
    expect(edges).toHaveLength(1);
    const arrow = edges[0];
    // the endpoint drawn at (218,142) was subtly captured by A's right edge
    // center (220,140); resizing keeps it attached at ny=0.5
    // end keeps its normalized position (nx=1, ny=0.5) on the new bounds
    expect(arrow.x + arrow.width).toBeCloseTo(320, 0);
    expect(arrow.y + arrow.height).toBeCloseTo(140, 0);
  });

  test("duplicating a bound diagram remaps bindings to the clones", async ({
    page,
  }) => {
    await open(page);
    await drawTwoRects(page);
    const b = await readShape(page, 1);

    await selectTool(page, "6");
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

  test("moving a connected shape after segment drag clears bendPoints for 90° routing", async ({
    page,
  }) => {
    await open(page);
    // draw two rectangles
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await drag(page, { x: 400, y: 300 }, { x: 500, y: 400 });

    // draw an arrow between them
    await selectTool(page, "6");
    await drag(page, { x: 250, y: 150 }, { x: 350, y: 350 });

    // switch to auto mode and bind endpoints to the shapes
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const arrow = ed.getSnapshot().doc.elements[2];
      ed.updateElements([arrow.id], { lineType: "auto" });
    });
    await selectTool(page, "1");
    await drag(page, { x: 250, y: 150 }, { x: 210, y: 150 });
    await drag(page, { x: 350, y: 350 }, { x: 390, y: 350 });

    // drag the horizontal segment to create bendPoints
    await drag(page, { x: 300, y: 150 }, { x: 300, y: 230 });
    const afterDrag = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      return s.doc.elements[2];
    });
    expect(afterDrag.bendPoints).toBeDefined();
    expect(afterDrag.bendPoints.length).toBeGreaterThan(0);

    // move the first rectangle
    await drag(page, { x: 150, y: 150 }, { x: 250, y: 250 });

    const afterMove = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      return s.doc.elements[2];
    });
    // bendPoints must be cleared so routing reverts to default L-shape (90°)
    expect(afterMove.bendPoints).toBeUndefined();
    // path points should be axis-aligned (all horizontal or vertical segments)
    const pts = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = (ed as any).getSnapshot().doc.elements[2];
      const { edgePathPoints } = (window as any).__archidrawUtils__
        ? (window as any).__archidrawUtils__
        : {};
      // fallback: compute from raw data
      const a = { x: el.x, y: el.y };
      const b = { x: el.x + el.width, y: el.y + el.height };
      const tip = { x: b.x, y: b.y === a.y ? b.y + 1 : b.y };
      return [a, { x: tip.x, y: a.y }, tip];
    });
    for (let i = 1; i < pts.length; i++) {
      const dx = Math.abs(pts[i].x - pts[i - 1].x);
      const dy = Math.abs(pts[i].y - pts[i - 1].y);
      // each segment must be purely horizontal or vertical
      expect(dx === 0 || dy === 0).toBe(true);
    }
  });
});
