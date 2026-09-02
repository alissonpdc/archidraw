import { test, expect, open } from "../fixtures";

test.describe("focus mode", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("clicking Focus button enters focus mode", async ({ page }) => {
    await page.getByRole("button", { name: "Focus" }).click();

    // all UI controls should be hidden
    await expect(page.locator(".toolbar")).toHaveCount(0);
    await expect(page.locator(".top-right")).toHaveCount(0);
    await expect(page.locator(".bottom-right")).toHaveCount(0);
    await expect(page.locator(".status-bar")).toHaveCount(0);
    await expect(page.locator(".properties-panel")).toHaveCount(0);
    await expect(page.locator(".tabbar")).toHaveCount(0);
    // canvas remains visible
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("pressing any key exits focus mode", async ({ page }) => {
    await page.getByRole("button", { name: "Focus" }).click();
    await expect(page.locator(".toolbar")).toHaveCount(0);

    await page.keyboard.press("a");

    // UI controls reappear
    await expect(page.locator(".toolbar")).toBeVisible();
    await expect(page.locator(".bottom-right")).toBeVisible();
    await expect(page.locator(".status-bar")).toBeVisible();
  });

  test("clicking Focus button toggles focus mode off", async ({ page }) => {
    await page.getByRole("button", { name: "Focus" }).click();
    await expect(page.locator(".toolbar")).toHaveCount(0);

    // re-render the button via keyboard shortcut or re-click
    // since the button is hidden, we use keyboard shortcut
    await page.keyboard.press("f");

    await expect(page.locator(".toolbar")).toBeVisible();
  });

  test("mouse clicks still work on canvas while in focus mode", async ({
    page,
    editorState,
  }) => {
    // create a rectangle first
    await page.keyboard.press("r");
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(300, 280, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.press("v");

    const before = await editorState();
    expect(before.elementCount).toBe(1);

    // enter focus mode
    await page.getByRole("button", { name: "Focus" }).click();
    await expect(page.locator(".toolbar")).toHaveCount(0);

    // click on the rectangle to select it (mouse still works)
    await page.mouse.click(250, 240);

    const after = await editorState();
    expect(after.selectedIds.length).toBe(1);
  });

  test("focus mode does not exit on mouse click", async ({ page }) => {
    await page.getByRole("button", { name: "Focus" }).click();
    await expect(page.locator(".toolbar")).toHaveCount(0);

    // click somewhere on the canvas
    await page.mouse.click(500, 400);

    // still in focus mode
    await expect(page.locator(".toolbar")).toHaveCount(0);
  });
});
