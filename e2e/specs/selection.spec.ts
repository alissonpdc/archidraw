import { test, expect, drag, selectTool, open } from "../fixtures";

async function createRectangles(page: any) {
  await selectTool(page, "r");
  await drag(page, { x: 100, y: 100 }, { x: 200, y: 180 }); // rect A
  await drag(page, { x: 300, y: 300 }, { x: 420, y: 400 }); // rect B
}

test.describe("selection", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await createRectangles(page);
    await selectTool(page, "v");
  });

  test("click selects an element", async ({ page, editorState }) => {
    await page.mouse.click(150, 140);

    const s = await editorState();
    expect(s.selectedIds).toHaveLength(1);
  });

  test("shift+click adds to selection", async ({ page, editorState }) => {
    await page.mouse.click(150, 140);
    await page.keyboard.down("Shift");
    await page.mouse.click(360, 350);
    await page.keyboard.up("Shift");

    const s = await editorState();
    expect(s.selectedIds).toHaveLength(2);
  });

  test("marquee selects multiple elements", async ({
    page,
    editorState,
  }) => {
    await drag(page, { x: 50, y: 50 }, { x: 500, y: 500 });

    const s = await editorState();
    expect(s.selectedIds).toHaveLength(2);
  });

  test("drag moves selected element", async ({ page, editorState }) => {
    await page.mouse.click(150, 140);

    // read original position
    const before = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].x;
    });

    // drag inside the element
    await drag(page, { x: 150, y: 140 }, { x: 260, y: 200 });

    const after = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].x;
    });
    expect(after).toBeCloseTo(before + 110, 0);
    void editorState;
  });
});
