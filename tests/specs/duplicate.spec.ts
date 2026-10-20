import { test, expect, open, drag, selectTool } from "../fixtures";

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

async function rightClickElement(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
) {
  await page.mouse.click(x, y, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
}

test.describe("duplicate (context menu)", () => {
  test("right-click on element shows Duplicate option", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);

    await expect(page.getByTestId("context-menu-duplicate")).toBeVisible();
    await expect(page.getByTestId("context-menu-duplicate")).toHaveText(
      /Duplicate/,
    );
  });

  test("Duplicate creates a copy of the selected element", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    expect((await editorState()).elementCount).toBe(1);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-duplicate").click();

    const state = await editorState();
    expect(state.elementCount).toBe(2);
    expect(state.selectedIds).toHaveLength(1);
  });

  test("Duplicate selects the new copy, not the original", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);

    const origState = await editorState();
    const origId = origState.elements[0].id;

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-duplicate").click();

    const state = await editorState();
    expect(state.selectedIds).toHaveLength(1);
    expect(state.selectedIds[0]).not.toBe(origId);
  });

  test("Duplicate multi-selection creates copies of all elements", async ({
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
    await page.getByTestId("context-menu-duplicate").click();

    const state = await editorState();
    expect(state.elementCount).toBe(4);
    expect(state.selectedIds).toHaveLength(2);
  });

  test("Duplicate shortcut Ctrl+D / Cmd+D works", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);

    await page.keyboard.press("ControlOrMeta+d");

    const state = await editorState();
    expect(state.elementCount).toBe(2);
    expect(state.selectedIds).toHaveLength(1);
  });

  test("context menu closes after Duplicate click", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-duplicate").click();

    await expect(page.getByTestId("context-menu")).toHaveCount(0);
  });

  test("Duplicate shortcut text is displayed in context menu", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);

    const text = await page
      .getByTestId("context-menu-duplicate")
      .textContent();
    expect(text).toMatch(/\+[Dd]/);
  });

  test("right-click on empty canvas does not show Duplicate", async ({
    editorState,
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(600, 400);
    await expect
      .poll(async () => (await editorState()).selectedIds.length)
      .toBe(0);

    await page.mouse.click(600, 400, { button: "right" });
    await expect(page.getByTestId("context-menu")).toBeVisible();
    await expect(page.getByTestId("context-menu-duplicate")).toHaveCount(0);
  });

  test("Duplicate is undoable", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-duplicate").click();
    expect((await editorState()).elementCount).toBe(2);

    await page.keyboard.press("ControlOrMeta+z");

    const state = await editorState();
    expect(state.elementCount).toBe(1);
  });

  test("Duplicate does nothing when nothing is selected", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);

    await page.mouse.click(600, 400);
    await expect
      .poll(async () => (await editorState()).selectedIds.length)
      .toBe(0);

    await page.keyboard.press("ControlOrMeta+d");

    const state = await editorState();
    expect(state.elementCount).toBe(1);
  });
});
