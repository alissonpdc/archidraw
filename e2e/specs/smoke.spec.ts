import { test, expect, open } from "../fixtures";

test.describe("smoke", () => {
  test("app loads with toolbar and no console errors", async ({ page }) => {
    await open(page);
    await expect(page.locator(".toolbar")).toBeVisible();
    await expect(page.locator("canvas.canvas")).toBeVisible();

    const state = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().tool;
    });
    expect(state).toBe("selection");
  });
});
