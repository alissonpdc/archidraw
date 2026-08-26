import { test, expect, drag, selectTool, open } from "../fixtures";

test.describe("tools", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await selectTool(page, "v"); // ensure clean state
  });

  test("drag with rectangle tool creates a rectangle", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "r");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 320 });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.selectedIds).toHaveLength(1);
  });

  test("tiny drag (click) does not create a rectangle", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "r");
    await drag(page, { x: 200, y: 200 }, { x: 201, y: 201 });

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("drag with arrow tool creates an arrow", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "a");
    await drag(page, { x: 400, y: 300 }, { x: 600, y: 450 });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.selectedIds).toHaveLength(1);
  });

  test("text tool: click opens overlay and typed text creates element", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "t");
    await page.mouse.click(250, 250);

    let s = await editorState();
    expect(s.editingTextId).not.toBeNull();

    await page.keyboard.type("API Gateway");
    await page.keyboard.press("Escape");

    s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.editingTextId).toBeNull();

    const text = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].text;
    });
    expect(text).toBe("API Gateway");
  });

  test("empty text is discarded on Escape", async ({ page, editorState }) => {
    await selectTool(page, "t");
    await page.mouse.click(250, 250);
    await page.keyboard.press("Escape");

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });
});
