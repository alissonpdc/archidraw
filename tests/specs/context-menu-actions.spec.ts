import { test, expect, open, drag, selectTool } from "../fixtures";
import { type Page } from "@playwright/test";

async function drawRect(
  page: Page,
  from = { x: 200, y: 150 },
  to = { x: 320, y: 220 },
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

async function rightClick(page: Page, x: number, y: number) {
  await page.mouse.click(x, y, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
}

test.describe("context menu actions", () => {
  test("delete removes the selected element", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page);

    await rightClick(page, 260, 185);
    await page.getByTestId("context-menu-delete").click();

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("fit to view runs on an empty canvas", async ({ page }) => {
    await open(page);
    await rightClick(page, 400, 300);
    await page.getByTestId("context-menu-fit-view").click();

    await expect(page.getByTestId("context-menu")).toHaveCount(0);
  });

  test("select all highlights every element", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page);
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await selectTool(page, "1");

    await rightClick(page, 600, 400);
    await page.getByTestId("context-menu-select-all").click();

    const s = await editorState();
    expect(s.elementCount).toBe(2);
    expect(s.selectedIds).toHaveLength(2);
  });

  test("paste here inserts an internal-clipboard copy at the pointer", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);

    // copy first using the element context menu
    await rightClick(page, 260, 185);
    await page.getByTestId("context-menu-copy").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    // paste into the empty area through that area's menu
    await rightClick(page, 500, 350);
    await page.getByTestId("context-menu-paste-here").click();

    const s = await editorState();
    expect(s.elementCount).toBe(2);
  });
});