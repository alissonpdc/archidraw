import { test, expect, drag, selectTool, open } from "../fixtures";

test.describe("tools", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await selectTool(page, "1"); // ensure clean state
  });

  test("drag with rectangle tool creates a rectangle", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 320 });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.selectedIds).toHaveLength(1);
  });

  test("tiny drag (click) does not create a rectangle", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 201, y: 201 });

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("drag with arrow tool creates an arrow", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "6");
    await drag(page, { x: 400, y: 300 }, { x: 600, y: 450 });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.selectedIds).toHaveLength(1);
  });

  test("drag with diamond tool creates a diamond", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "3");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 320 });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.elements[0].type).toBe("diamond");
    expect(s.selectedIds).toHaveLength(1);
  });

  test("drag with ellipse tool creates an ellipse", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "4");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 320 });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.elements[0].type).toBe("ellipse");
    expect(s.selectedIds).toHaveLength(1);
  });

  test("drag with line tool creates a line", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "5");
    await drag(page, { x: 400, y: 300 }, { x: 600, y: 450 });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.elements[0].type).toBe("line");
    expect(s.selectedIds).toHaveLength(1);
  });

  test("new shapes are hit-testable by their geometry", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "4");
    await drag(page, { x: 200, y: 200 }, { x: 400, y: 400 });
    await selectTool(page, "3");
    await drag(page, { x: 500, y: 200 }, { x: 700, y: 400 });
    await selectTool(page, "1");

    // ellipse corner (inside bbox, outside the circle) should not select it
    await page.mouse.click(210, 210);
    let s = await editorState();
    expect(s.selectedIds).toHaveLength(0);

    // ellipse center should select it
    await page.mouse.click(300, 300);
    s = await editorState();
    expect(s.selectedIds).toHaveLength(1);

    // diamond center should select it
    await page.mouse.click(600, 300);
    s = await editorState();
    expect(s.selectedIds).toHaveLength(1);
  });

  test("text tool: click opens overlay and typed text creates element", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "7");
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
    await selectTool(page, "7");
    await page.mouse.click(250, 250);
    await page.keyboard.press("Escape");

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("text element is selectable and dimensions update with font size", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Hello");
    await page.keyboard.press("Escape");

    const s1 = await editorState();
    expect(s1.elementCount).toBe(1);

    // click on the text element to select it (not edit it)
    await page.mouse.click(300, 300);

    const s2 = await editorState();
    expect(s2.selectedIds).toHaveLength(1);

    // read initial dimensions
    const dims1 = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return { width: el.width, height: el.height, fontSize: el.fontSize };
    });

    // change font size via editor API (simulates Properties panel button)
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.updateElements([id], { fontSize: 36 });
    });

    const dims2 = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return { width: el.width, height: el.height, fontSize: el.fontSize };
    });

    expect(dims2.fontSize).toBe(36);
    expect(dims2.height).toBeGreaterThan(dims1.height);
    expect(dims2.width).toBeGreaterThanOrEqual(dims1.width);
  });
});
