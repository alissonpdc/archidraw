import { test, expect, open, drag, selectTool, pressPaste } from "../fixtures";

const RECT = { a: { x: 200, y: 150 }, b: { x: 320, y: 220 } };
const RECT2 = { a: { x: 360, y: 150 }, b: { x: 480, y: 220 } };

async function drawRect(
  page: import("@playwright/test").Page,
  from: { x: number; y: number } = RECT.a,
  to: { x: number; y: number } = RECT.b,
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

async function rightClickElement(page: import("@playwright/test").Page, x: number, y: number) {
  await page.mouse.click(x, y, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
}

test.describe("copy / cut (context menu)", () => {
  test("right-click on element shows Copy and Cut options", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);

    await expect(page.getByTestId("context-menu-copy")).toBeVisible();
    await expect(page.getByTestId("context-menu-copy")).toHaveText(/Copy/);
    await expect(page.getByTestId("context-menu-cut")).toBeVisible();
    await expect(page.getByTestId("context-menu-cut")).toHaveText(/Cut/);
  });

  test("Copy stores elements in internal clipboard", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page);
    const origCount = (await editorState()).elementCount;
    expect(origCount).toBe(1);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-copy").click();

    // selection is preserved after copy
    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.selectedIds).toHaveLength(1);

    // internal clipboard has data
    const hasClip = await page.evaluate(() =>
      localStorage.getItem("archidraw:clipboard") !== null,
    );
    expect(hasClip).toBe(true);
  });

  test("Paste after Copy adds a duplicate", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-copy").click();

    await pressPaste(page);

    const state = await editorState();
    expect(state.elementCount).toBe(2);
    expect(state.selectedIds).toHaveLength(1);
  });

  test("Cut removes elements from canvas and stores in clipboard", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-cut").click();

    const state = await editorState();
    expect(state.elementCount).toBe(0);
    expect(state.selectedIds).toHaveLength(0);

    const hasClip = await page.evaluate(() =>
      localStorage.getItem("archidraw:clipboard") !== null,
    );
    expect(hasClip).toBe(true);
  });

  test("Paste after Cut restores the elements", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-cut").click();
    expect((await editorState()).elementCount).toBe(0);

    await pressPaste(page);

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.selectedIds).toHaveLength(1);
  });

  test("Copy preserves multi-selection", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page, RECT.a, RECT.b);
    await drawRect(page, RECT2.a, RECT2.b);

    await page.keyboard.press("ControlOrMeta+a");
    await expect
      .poll(async () => (await editorState()).selectedIds.length)
      .toBe(2);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-copy").click();

    await pressPaste(page);

    const state = await editorState();
    expect(state.elementCount).toBe(4);
    expect(state.selectedIds).toHaveLength(2);
  });

  test("Cut multi-selection removes all selected elements", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, RECT.a, RECT.b);
    await drawRect(page, RECT2.a, RECT2.b);

    await page.keyboard.press("ControlOrMeta+a");
    await expect
      .poll(async () => (await editorState()).selectedIds.length)
      .toBe(2);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-cut").click();

    const state = await editorState();
    expect(state.elementCount).toBe(0);
  });

  test("right-click on empty canvas does not show Copy/Cut", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(600, 400);
    await expect
      .poll(async () => (await editorState()).selectedIds.length)
      .toBe(0);

    await page.mouse.click(600, 400, { button: "right" });
    await expect(page.getByTestId("context-menu")).toBeVisible();
    await expect(page.getByTestId("context-menu-copy")).toHaveCount(0);
    await expect(page.getByTestId("context-menu-cut")).toHaveCount(0);
  });

  test("context menu closes after Copy click", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-copy").click();

    await expect(page.getByTestId("context-menu")).toHaveCount(0);
  });

  test("context menu closes after Cut click", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-cut").click();

    await expect(page.getByTestId("context-menu")).toHaveCount(0);
  });

  test("Copy shortcut text is displayed in context menu", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);

    const copyText = await page.getByTestId("context-menu-copy").textContent();
    expect(copyText).toMatch(/\+[CX]/);

    const cutText = await page.getByTestId("context-menu-cut").textContent();
    expect(cutText).toMatch(/\+[CX]/);
  });
});
