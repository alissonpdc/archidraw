import { test, expect, drag, selectTool, open } from "../fixtures";

async function createThreeRectangles(page: any) {
  await selectTool(page, "2");
  // Rect A: x ~220-340
  await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 });
  // Rect B: x ~420-540 (gap from A)
  await drag(page, { x: 420, y: 100 }, { x: 540, y: 180 });
  // Rect C: x ~700-820 (bigger gap from B)
  await drag(page, { x: 700, y: 100 }, { x: 820, y: 180 });
}

function getElements(page: any) {
  return page.evaluate(() => {
    const ed = (window as any).__editor__;
    const snap = ed.getSnapshot();
    return snap.doc.elements.map((el: any) => ({
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    }));
  });
}

test.describe("distribute", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await createThreeRectangles(page);
    await selectTool(page, "1");
  });

  test("horizontal distribute spaces elements evenly", async ({ page }) => {
    // Select all three rectangles via marquee
    await drag(page, { x: 200, y: 50 }, { x: 850, y: 200 });

    const before = await getElements(page);
    expect(before).toHaveLength(3);

    // Sort by x to identify first/middle/last
    const sorted = [...before].sort((a, b) => a.x - b.x);
    const firstX = sorted[0].x;
    const lastX = sorted[2].x;
    const firstW = sorted[0].width;
    const lastW = sorted[2].width;

    // Trigger horizontal distribute via editor API
    await page.evaluate(() => {
      (window as any).__editor__.distributeSelected("horizontal");
    });

    const after = await getElements(page);
    const sortedAfter = [...after].sort((a, b) => a.x - b.x);

    // First and last elements should not move
    expect(sortedAfter[0].x).toBeCloseTo(firstX, 0);
    expect(sortedAfter[2].x).toBeCloseTo(lastX, 0);

    // Middle element should NOT overlap with the first element
    const midX = sortedAfter[1].x;
    expect(midX).not.toBeCloseTo(firstX, 0);

    // Gaps should be equal: gap1 = mid.x - (first.x + first.w), gap2 = last.x - (mid.x + mid.w)
    const gap1 = sortedAfter[1].x - (sortedAfter[0].x + sortedAfter[0].width);
    const gap2 = sortedAfter[2].x - (sortedAfter[1].x + sortedAfter[1].width);
    expect(gap1).toBeCloseTo(gap2, 0);
  });

  test("vertical distribute spaces elements evenly", async ({ page }) => {
    // Clear canvas first, then create 3 rectangles with different y positions
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.selectAll();
      ed.deleteSelected();
    });

    await selectTool(page, "2");
    await drag(page, { x: 300, y: 50 }, { x: 420, y: 130 });   // top
    await drag(page, { x: 300, y: 250 }, { x: 420, y: 330 });  // middle
    await drag(page, { x: 300, y: 500 }, { x: 420, y: 580 });  // bottom
    await selectTool(page, "1");

    // Select all 3 via marquee (tight around them)
    await drag(page, { x: 290, y: 40 }, { x: 430, y: 590 });

    const before = await getElements(page);
    const sorted = [...before].sort((a, b) => a.y - b.y);
    const firstY = sorted[0].y;
    const lastY = sorted[2].y;

    await page.evaluate(() => {
      (window as any).__editor__.distributeSelected("vertical");
    });

    const after = await getElements(page);
    const sortedAfter = [...after].sort((a, b) => a.y - b.y);

    expect(sortedAfter).toHaveLength(3);

    // First and last should not move
    expect(sortedAfter[0].y).toBeCloseTo(firstY, 0);
    expect(sortedAfter[2].y).toBeCloseTo(lastY, 0);

    // Middle should not overlap with first
    expect(sortedAfter[1].y).not.toBeCloseTo(firstY, 0);

    // Equal gaps
    const gap1 = sortedAfter[1].y - (sortedAfter[0].y + sortedAfter[0].height);
    const gap2 = sortedAfter[2].y - (sortedAfter[1].y + sortedAfter[1].height);
    expect(gap1).toBeCloseTo(gap2, 0);
  });
});
