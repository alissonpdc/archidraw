import { test, expect, open, selectTool } from "../fixtures";

interface LiveLine {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function readDraft(page: import("@playwright/test").Page) {
  return page.evaluate<LiveLine | null>(() => {
    const ed = (window as any).__editor__;
    const d = ed.draft;
    return d ? { x: d.x, y: d.y, width: d.width, height: d.height } : null;
  });
}

test.describe("line/arrow drawing anchors the start point", () => {
  test("line start stays anchored when drawing down-right", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(500, 460, { steps: 3 });
    const draft = await readDraft(page);
    expect(draft).toEqual({ x: 400, y: 400, width: 100, height: 60 });
    await page.mouse.up();
  });

  test("line start stays anchored when drawing up-left", async ({ page }) => {
    await open(page);
    await selectTool(page, "l");
    await page.mouse.move(600, 520);
    await page.mouse.down();
    await page.mouse.move(500, 460, { steps: 3 });
    const draft = await readDraft(page);
    // start (600,520) fixed; end follows the mouse with signed dims
    expect(draft).toEqual({ x: 600, y: 520, width: -100, height: -60 });
    await page.mouse.up();
    const el = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      const e = s.doc.elements[s.doc.elements.length - 1];
      return { x: e.x, y: e.y, width: e.width, height: e.height };
    });
    expect(el).toEqual({ x: 600, y: 520, width: -100, height: -60 });
  });

  test("arrow tip follows the mouse in any direction", async ({ page }) => {
    await open(page);
    await selectTool(page, "a");
    await page.mouse.move(600, 520);
    await page.mouse.down();
    await page.mouse.move(500, 460, { steps: 3 });
    const draft = await readDraft(page);
    // start (600,520) anchored, end (tip) at the pointer
    expect(draft).toEqual({ x: 600, y: 520, width: -100, height: -60 });
    await page.mouse.up();
  });

  test("dragging an endpoint keeps the opposite endpoint anchored", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "l");
    // draw a line from (600,520) up-left to (500,460)
    await page.mouse.move(600, 520);
    await page.mouse.down();
    await page.mouse.move(500, 460, { steps: 3 });
    await page.mouse.up();
    await selectTool(page, "v");

    // grab the start endpoint (at 600,520) and drag it; end (500,460) must stay
    await page.mouse.move(600, 520);
    await page.mouse.down();
    await page.mouse.move(650, 560, { steps: 3 });
    await page.mouse.up();

    const el = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      const e = s.doc.elements[s.doc.elements.length - 1];
      return { x: e.x, y: e.y, width: e.width, height: e.height };
    });
    // new start = (650,560); end stays (500,460) -> signed dims
    expect(el.x).toBeCloseTo(650, 0);
    expect(el.y).toBeCloseTo(560, 0);
    expect(el.width).toBeCloseTo(-150, 0);
    expect(el.height).toBeCloseTo(-100, 0);
  });

  test("arrow bound to a moved shape pivots on the start anchor", async ({
    page,
  }) => {
    await open(page);
    // rectangle A at (100,100)-(220,180)
    await selectTool(page, "r");
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(220, 180, { steps: 3 });
    await page.mouse.up();

    // rectangle B at (400,300)-(500,360)
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(500, 360, { steps: 3 });
    await page.mouse.up();

    // arrow from B's left anchor (400,330) to A's right anchor (220,140):
    // start binds to B, end binds to A
    await selectTool(page, "a");
    await page.mouse.move(402, 330);
    await page.mouse.down();
    await page.mouse.move(218, 150, { steps: 5 });
    await page.mouse.up();

    const before = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      const arrow = s.doc.elements.find((e: any) => e.type === "arrow");
      return {
        x: arrow.x,
        y: arrow.y,
        endX: arrow.x + arrow.width,
        endY: arrow.y + arrow.height,
      };
    });

    // move rectangle B (the bound start) by dragging its interior
    await selectTool(page, "v");
    await page.mouse.move(450, 330);
    await page.mouse.down();
    await page.mouse.move(550, 380, { steps: 5 });
    await page.mouse.up();

    const after = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      const arrow = s.doc.elements.find((e: any) => e.type === "arrow");
      return {
        x: arrow.x,
        y: arrow.y,
        endX: arrow.x + arrow.width,
        endY: arrow.y + arrow.height,
      };
    });

    // start follows the moved shape's anchor; the free end stays fixed
    expect(after.endX).toBeCloseTo(before.endX, 0);
    expect(after.endY).toBeCloseTo(before.endY, 0);
    expect(after.x).not.toBeCloseTo(before.x, 0);
  });
});
