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
  test("left panel has no base dots; clicking color box opens submenu with 3x5 matrix and intensity applies shade", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    const strokeSection = page.locator(".panel-section").first();
    const dots = strokeSection.locator(".base-dot");
    await expect(dots).toHaveCount(0);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const matrixCells = popover.locator(".matrix-cell");
    await expect(matrixCells).toHaveCount(15);

    await page.getByRole("button", { name: "Stroke color Blue" }).click();
    const cells = popover.locator(".ramp-cell");
    await expect(cells).toHaveCount(5);

    await cells.nth(4).click();
    const color = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor;
    });
    expect(color).toBe("#0f4475");
    await expect(strokeSection.locator(".chip-name")).toHaveText("Blue · 5");
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

  test("text color has an Auto option in submenu that clears textColor to follow stroke", async ({
    page,
  }) => {
    await createTextSelection(page);
    await page.locator(".panel-tab", { hasText: "Text" }).click();

    const activeTab = page.locator(".panel-tab-content:not(.hidden)");
    await expect(activeTab.locator(".panel-subtitle").first()).toHaveText("Color");

    await page.getByRole("button", { name: "Text color current" }).click();
    const autoBtn = page.getByRole("button", { name: "Text color Auto" });
    await expect(autoBtn).toHaveText("Auto");
    await autoBtn.click();

    await expect(activeTab.locator(".chip-name").first()).toHaveText("Auto");

    const auto = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.textColor ?? "";
    });
    expect(auto).toBe("");

    await page.getByRole("button", { name: "Text color current" }).click();
    await page.getByRole("button", { name: "Text color Red" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();
    await popover.locator(".ramp-cell").nth(3).click();
    const explicit = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.textColor;
    });
    expect(explicit).toBe("#ba1c1c");
    await expect(activeTab.locator(".chip-name").first()).toHaveText("Red · 4");
  });

  test("Escape closes the popover without clearing the selection", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await expect(page.locator(".color-popover")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".color-popover")).toHaveCount(0);

    const selectedIds = await page.evaluate(
      () => [...(window as any).__editor__.getSnapshot().selectedIds].length,
    );
    expect(selectedIds).toBe(1);
  });

  test("clicking outside or toggling color box closes submenu, and ArrowLeft navigates intensities", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    const title = popover.locator(".pop-title");
    await expect(title).toBeVisible();

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await expect(popover).toHaveCount(0);

    await page.getByRole("button", { name: "Fill current" }).click();
    await expect(popover).toBeVisible();
    await page.getByRole("button", { name: "Fill current" }).click();
    await expect(popover).toHaveCount(0);

    await page.getByRole("button", { name: "Fill current" }).click();
    await expect(popover).toBeVisible();
    await page.mouse.click(500, 300);
    await expect(popover).toHaveCount(0);
  });

  test("mixed text colors show transparent checkerboard chip and text color box toggles", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(150, 150);
    await page.keyboard.type("A");
    await page.keyboard.press("Escape");

    await selectTool(page, "7");
    await page.mouse.click(250, 150);
    await page.keyboard.type("B");
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      ed.updateElements([els[0].id], { textColor: "#e03131" });
      ed.updateElements([els[1].id], { textColor: "#1971c2" });
      ed.selectAll();
    });

    await page.locator(".panel-tab", { hasText: "Text" }).click();
    const chip = page.locator(".transparent-checker");
    await expect(chip).toBeVisible();

    const textCurrentBtn = page.getByRole("button", { name: "Text color current" });
    await textCurrentBtn.click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();
    await textCurrentBtn.click();
    await expect(popover).toHaveCount(0);
  });

  test("submenu UI shows Coral instead of Dark Slate, uppercase title, and en-US labels", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    await expect(
      popover.getByRole("button", { name: "Stroke color Coral" }),
    ).toBeVisible();
    await expect(
      popover.getByRole("button", { name: "Stroke color Dark Slate" }),
    ).toHaveCount(0);

    const matrixButtons = popover.locator(".matrix-cell");
    const names = await matrixButtons.evaluateAll((els) =>
      els.map((el) => el.getAttribute("title")),
    );
    const yellowIdx = names.indexOf("Yellow");
    const orangeIdx = names.indexOf("Orange");
    const coralIdx = names.indexOf("Coral");
    const brownIdx = names.indexOf("Brown");
    expect(yellowIdx).toBeGreaterThanOrEqual(0);
    expect(orangeIdx).toBe(yellowIdx + 1);
    expect(coralIdx).toBe(orangeIdx + 1);
    expect(brownIdx).toBe(coralIdx + 1);

    await popover.getByRole("button", { name: "Stroke color Coral" }).click();

    const title = popover.locator(".pop-title");
    await expect(title).toHaveText("CORAL · 3");

    const fontStyle = await title.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        textTransform: s.textTransform,
        fontFamily: s.fontFamily,
      };
    });
    expect(fontStyle.textTransform).toBe("uppercase");

    await expect(popover.locator(".panel-subtitle").first()).toHaveText("Intensity");
    await expect(popover.locator(".pop-hint")).toContainText("esc to close");
  });

  test("Cyan, Teal, and Lime have strictly decreasing lightness across intensity cells", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const parseRgb = (rgbStr: string) => {
      const m = rgbStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (!m) return { r: 0, g: 0, b: 0 };
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
    };

    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };

    for (const colorName of ["Cyan", "Teal", "Lime"]) {
      await popover.getByRole("button", { name: `Stroke color ${colorName}` }).click();
      const cells = popover.locator(".ramp-cell");
      await expect(cells).toHaveCount(5);

      const lums: number[] = [];
      for (let i = 0; i < 5; i++) {
        const bg = await cells.nth(i).evaluate((el) => window.getComputedStyle(el).backgroundColor);
        lums.push(luminance(parseRgb(bg)));
      }

      for (let i = 0; i < 4; i++) {
        expect(lums[i]).toBeGreaterThan(lums[i + 1]);
      }
    }
  });

  test("submenu has square 28px buttons, no X/Y on intensity, and dynamic opacity bubble", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const matrixCell = popover.locator(".matrix-cell").first();
    await expect(matrixCell).toHaveCSS("width", "28px");
    await expect(matrixCell).toHaveCSS("height", "28px");
    await expect(matrixCell).toHaveCSS("border-radius", "3px");

    const rampCell = popover.locator(".ramp-cell").first();
    await expect(rampCell).toHaveCSS("width", "28px");
    await expect(rampCell).toHaveCSS("height", "28px");
    await expect(rampCell).toHaveCSS("border-radius", "3px");

    const intensitySection = popover.locator(".submenu-intensity");
    await expect(intensitySection).not.toContainText("/ 5");

    const opacitySection = popover.locator(".pop-opacity");
    const bubble = opacitySection.locator(".opacity-bubble");
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveText("100%");

    const slider = opacitySection.getByRole("slider", { name: "Opacity" });
    const sliderBox = (await slider.boundingBox())!;
    const bubbleBox = (await bubble.boundingBox())!;
    const thumbBottom = sliderBox.y + sliderBox.height / 2 + 7;
    expect(bubbleBox.y).toBeGreaterThanOrEqual(thumbBottom);

    await slider.fill("40");
    await expect(bubble).toHaveText("40%");
  });
});


