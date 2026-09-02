import { test, expect, drag, selectTool, open } from "../fixtures";

test.describe("history", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 200 });
    await selectTool(page, "1");
  });

  test("undo removes created element", async ({ page, editorState }) => {
    await page.keyboard.press("Control+z");

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("redo restores undone element", async ({ page, editorState }) => {
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+Shift+z");

    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });

  test("Cmd/Ctrl+D duplicates selection", async ({ page, editorState }) => {
    await page.mouse.click(160, 150); // select
    await page.keyboard.press("Control+d");

    const s = await editorState();
    expect(s.elementCount).toBe(2);
    expect(s.selectedIds).toHaveLength(1);
  });

  test("Delete removes selected elements", async ({ page, editorState }) => {
    await page.mouse.click(160, 150);
    await page.keyboard.press("Delete");

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("undo restores deleted element", async ({ page, editorState }) => {
    await page.mouse.click(160, 150);
    await page.keyboard.press("Delete");
    await page.keyboard.press("Control+z");

    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});
