import { test, expect, open, drag, selectTool } from "../fixtures";
import type { Page } from "@playwright/test";

async function createRectangleSelection(page: Page) {
  await open(page);
  await selectTool(page, "2");
  await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
  await selectTool(page, "1");
}

test.describe("ColorRampPicker intensity alignment", () => {
  test("clicking a base dot opens popover at the original base intensity (index 2)", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await page.getByRole("button", { name: "Stroke color Blue" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const title = popover.locator(".pop-title");
    await expect(title).toHaveText("BLUE · 3");

    const selectedCells = popover.locator(".ramp-cell.selected");
    await expect(selectedCells).toHaveCount(1);
    await expect(selectedCells.first()).toHaveAttribute(
      "aria-label",
      "Stroke color Blue intensity 3",
    );
  });

  test("selecting a lighter intensity produces a lighter stroke color than the base", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await page.getByRole("button", { name: "Stroke color Blue" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const BLUE_BASE = "#1971c2";

    await popover.locator(".ramp-cell").nth(0).click();
    const lighterColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor as string;
    });

    expect(lighterColor).not.toBe(BLUE_BASE);
    expect(lighterColor).not.toBe("#3d4248");

    const luminance = (hex: string) => {
      const n = parseInt(hex.replace("#", ""), 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    expect(luminance(lighterColor)).toBeGreaterThan(luminance(BLUE_BASE));
  });

  test("reopening palette shows the actually selected intensity instead of medium", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await page.getByRole("button", { name: "Stroke color Blue" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    await popover.locator(".ramp-cell").nth(0).click();
    await expect(popover).toHaveCount(0);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await expect(popover).toBeVisible();
    await expect(popover.locator(".pop-title")).toHaveText("BLUE · 1");

    const selectedCells = popover.locator(".ramp-cell.selected");
    await expect(selectedCells).toHaveCount(1);
    await expect(selectedCells.first()).toHaveAttribute(
      "aria-label",
      "Stroke color Blue intensity 1",
    );

    await popover.locator(".ramp-cell").nth(4).click();
    await expect(popover).toHaveCount(0);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await expect(popover).toBeVisible();
    await expect(popover.locator(".pop-title")).toHaveText("BLUE · 5");

    const reselectedCells = popover.locator(".ramp-cell.selected");
    await expect(reselectedCells).toHaveCount(1);
    await expect(reselectedCells.first()).toHaveAttribute(
      "aria-label",
      "Stroke color Blue intensity 5",
    );
  });

  test("hover and selection are differentiated: checkmark stays on selected while hover shows outline", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await page.getByRole("button", { name: "Stroke color Blue" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const selectedBefore = popover.locator(".ramp-cell.selected");
    await expect(selectedBefore).toHaveCount(1);
    await expect(selectedBefore).toHaveAttribute(
      "aria-label",
      "Stroke color Blue intensity 3",
    );

    const cell0 = popover.locator(".ramp-cell").nth(0);
    await cell0.hover();

    await expect(popover.locator(".pop-title")).toHaveText("BLUE · 1");
    await expect(cell0).toHaveClass(/hovered/);
    await expect(cell0).not.toHaveClass(/selected/);

    const selectedDuringHover = popover.locator(".ramp-cell.selected");
    await expect(selectedDuringHover).toHaveCount(1);
    await expect(selectedDuringHover).toHaveAttribute(
      "aria-label",
      "Stroke color Blue intensity 3",
    );

    const checkmarkContent = await selectedDuringHover.evaluate((el) => {
      return window.getComputedStyle(el, "::after").content;
    });
    expect(checkmarkContent).toContain("✓");

    const cell0After = await cell0.evaluate((el) => {
      return window.getComputedStyle(el, "::after").content;
    });
    expect(cell0After).not.toContain("✓");
  });

  test("lowest stroke intensity renders lighter than higher intensities without contrast darkening", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await page.getByRole("button", { name: "Stroke color Red" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    await popover.locator(".ramp-cell").nth(0).click();

    const resolved = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      const { themeColor, relativeLuminance, parseColor } = (window as any).__color__;
      const resolvedLowest = themeColor(el.strokeColor, "#1a2028", "#ffffff");
      const resolvedMedium = themeColor("#e03131", "#1a2028", "#ffffff");
      return {
        stored: el.strokeColor,
        resolvedLowest,
        lumLowest: relativeLuminance(parseColor(resolvedLowest)),
        lumMedium: relativeLuminance(parseColor(resolvedMedium)),
      };
    });

    expect(resolved.resolvedLowest).toBe(resolved.stored);
    expect(resolved.lumLowest).toBeGreaterThan(resolved.lumMedium);
  });
});
