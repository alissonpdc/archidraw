import { test, expect, drag, selectTool, open } from "../fixtures";

async function createRectangles(page: any) {
  // rect A sits right of the properties panel strip (x < ~200), which
  // overlays the left side of the canvas while a shape is selected
  await selectTool(page, "2");
  await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 }); // rect A
  await drag(page, { x: 300, y: 300 }, { x: 420, y: 400 }); // rect B
}

test.describe("selection", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await createRectangles(page);
    await selectTool(page, "1");
  });

  test("click selects an element", async ({ page, editorState }) => {
    await page.mouse.click(280, 140);

    const s = await editorState();
    expect(s.selectedIds).toHaveLength(1);
  });

  test("shift+click adds to selection", async ({ page, editorState }) => {
    await page.mouse.click(280, 140);
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
    await page.mouse.click(280, 140);

    // read original position
    const before = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].x;
    });

    // drag inside the element
    await drag(page, { x: 280, y: 140 }, { x: 390, y: 200 });

    const after = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].x;
    });
    expect(after).toBeCloseTo(before + 110, 0);
    void editorState;
  });
});
