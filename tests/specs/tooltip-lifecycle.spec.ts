import { test, expect, open } from "../fixtures";

test.describe("global tooltip lifecycle", () => {
  test("tooltip disappears when the mouse leaves the button", async ({ page }) => {
    await open(page);
    const btn = page.getByRole("button", { name: "Component Library" });
    await btn.hover();
    const tooltip = page.locator(".panel-tooltip");
    await expect(tooltip).toBeVisible();
    await page.mouse.move(600, 400);
    await expect(tooltip).toHaveCount(0);
  });

  test("buttons without data-tip get a tooltip from their label", async ({ page }) => {
    await open(page);
    const btn = page.getByRole("button", { name: "Import Image" });
    await btn.hover();
    await expect(page.locator(".panel-tooltip")).toHaveText("Import Image (I)");
  });

  test("tooltip is removed when the hovered button leaves the DOM", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Component Library" }).hover();
    await expect(page.locator(".panel-tooltip")).toBeVisible();
    await page.getByRole("button", { name: "Component Library" }).evaluate((el) => el.remove());
    await expect(page.locator(".panel-tooltip")).toHaveCount(0);
  });

  test("tooltip hides on pointer down", async ({ page }) => {
    await open(page);
    const btn = page.getByRole("button", { name: "Component Library" });
    await btn.hover();
    await expect(page.locator(".panel-tooltip")).toBeVisible();
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator(".panel-tooltip")).toHaveCount(0);
  });
});
