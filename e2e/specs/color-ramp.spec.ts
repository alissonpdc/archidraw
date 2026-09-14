import { test, expect, open, drag, selectTool } from "../fixtures";
import type { Page } from "@playwright/test";

async function createRectangleSelection(page: Page) {
  await open(page);
  await selectTool(page, "2");
  await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
  await selectTool(page, "1");
}

async function createTextSelection(page: Page) {
  await open(page);
  await selectTool(page, "7");
  await page.mouse.click(300, 300);
  await page.keyboard.type("Ramp text");
  await page.keyboard.press("Escape");
  await selectTool(page, "1");
  await page.mouse.click(320, 310);
}

test.describe("ColorRampPicker (base + intensity)", () => {
  test("stroke palette shows 8 base dots and an intensity pick applies the shade", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    const strokeSection = page.locator(".panel-section").first();
    const dots = strokeSection.locator(".base-dot");
    await expect(dots).toHaveCount(8);

    await page.getByRole("button", { name: "Stroke color Blue" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();
    const cells = popover.locator(".ramp-cell");
    await expect(cells).toHaveCount(5);

    await cells.nth(4).click();
    const color = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor;
    });
    expect(color).toBe("#0f4475");
  });

  test("opacity lives inside the color popover and applies live", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await expect(
      page.getByRole("slider", { name: "Stroke opacity" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();
    const slider = popover.getByRole("slider", { name: "Opacity" });
    await expect(slider).toBeVisible();
    await slider.fill("50");

    const opacity = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeOpacity;
    });
    expect(opacity).toBe(0.5);
  });

  test("text color has an Auto dot that clears textColor to follow the stroke", async ({
    page,
  }) => {
    await createTextSelection(page);
    await page.locator(".panel-tab", { hasText: "Text" }).click();

    await page.getByRole("button", { name: "Text color Auto" }).click();

    const auto = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.textColor ?? "";
    });
    expect(auto).toBe("");

    await page.getByRole("button", { name: "Text color Red" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();
    await popover.locator(".ramp-cell").nth(3).click();
    const explicit = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.textColor;
    });
    expect(explicit).toBe("#ba1c1c");
  });

  test("Escape closes the popover without clearing the selection", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color Blue" }).click();
    await expect(page.locator(".color-popover")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".color-popover")).toHaveCount(0);

    const selectedIds = await page.evaluate(
      () => [...(window as any).__editor__.getSnapshot().selectedIds].length,
    );
    expect(selectedIds).toBe(1);
  });
});
