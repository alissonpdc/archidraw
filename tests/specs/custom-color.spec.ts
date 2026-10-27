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
  await page.keyboard.type("Custom text");
  await page.keyboard.press("Escape");
  await selectTool(page, "1");
  await page.mouse.click(320, 310);
}

test.describe("Custom hex color picker", () => {
  test("allows entering custom stroke color via hexadecimal input", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await expect(hexInput).toBeVisible();
    await hexInput.fill("e63946");
    await hexInput.press("Enter");

    await expect(popover).toHaveCount(0);

    const strokeColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor;
    });
    expect(strokeColor).toBe("#e63946");

    const strokeSection = page.locator(".panel-section").first();
    await expect(strokeSection.locator(".chip-name")).toHaveText("#E63946");
  });

  test("allows entering custom background/fill color via hexadecimal input with leading hash", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Fill current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.fill("#457b9d");
    await hexInput.press("Enter");

    await expect(popover).toHaveCount(0);

    const bgColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.backgroundColor;
    });
    expect(bgColor).toBe("#457b9d");

    const fillSection = page.locator(".panel-section").nth(1);
    await expect(fillSection.locator(".chip-name")).toHaveText("#457B9D");
  });

  test("allows entering custom text color via hexadecimal input", async ({
    page,
  }) => {
    await createTextSelection(page);
    await page.locator(".panel-tab", { hasText: "Text" }).click();

    await page.getByRole("button", { name: "Text color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.fill("2a9d8f");
    await hexInput.press("Enter");

    await expect(popover).toHaveCount(0);

    const textColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.textColor;
    });
    expect(textColor).toBe("#2a9d8f");

    const activeTab = page.locator(".panel-tab-content:not(.hidden)");
    await expect(activeTab.locator(".chip-name").first()).toHaveText("#2A9D8F");
  });

  test("expands 3-digit hex shorthand to 6-digit hex on Enter or blur", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.fill("f0a");
    await hexInput.press("Enter");

    const strokeColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor;
    });
    expect(strokeColor).toBe("#ff00aa");
  });

  test("choosing a HEX does not alter intensity ramp colors, and intensity no longer applies", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const rampCells = popover.locator(".ramp-cell");
    await expect(rampCells).toHaveCount(5);
    const initialShades = await rampCells.evaluateAll((els) =>
      els.map((el) => window.getComputedStyle(el).backgroundColor),
    );

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.fill("e03180");

    await expect(popover.locator(".pop-title")).toHaveText("CUSTOM");
    await expect(popover.locator(".ramp-cell.selected")).toHaveCount(0);
    await expect(popover.locator(".matrix-cell.active")).toHaveCount(0);

    const currentShades = await rampCells.evaluateAll((els) =>
      els.map((el) => window.getComputedStyle(el).backgroundColor),
    );
    expect(currentShades).toEqual(initialShades);

    await rampCells.nth(0).click();
    await expect(popover).toHaveCount(0);

    const strokeColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor;
    });
    expect(strokeColor).not.toBe("#e03180");
    expect(strokeColor.startsWith("#")).toBe(true);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    await expect(popover.locator(".pop-title")).toHaveText("GREY · 1");
    await expect(popover.locator(".ramp-cell.selected")).toHaveCount(1);
  });

  test("native color picker updates custom color live", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const nativePicker = popover.locator(".pop-hex-native");
    await expect(nativePicker).toBeAttached();

    await nativePicker.evaluate((input: HTMLInputElement) => {
      const prototype = Object.getPrototypeOf(input);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      descriptor?.set?.call(input, "#123456");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const strokeColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor;
    });
    expect(strokeColor).toBe("#123456");
    await expect(popover.locator(".pop-hex-input")).toHaveValue("123456");
    await expect(popover.locator(".pop-title")).toHaveText("CUSTOM");
  });

  test("switching between custom color and palette base resets state cleanly", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.fill("112233");

    await expect(popover.locator(".pop-title")).toHaveText("CUSTOM");
    await expect(popover.locator(".ramp-cell.selected")).toHaveCount(0);

    await popover.getByRole("button", { name: "Stroke color Blue", exact: true }).click();
    await expect(popover.locator(".pop-title")).toHaveText("BLUE · 3");
    await expect(hexInput).toHaveValue("1971c2");
    await expect(popover.locator(".ramp-cell.selected")).toHaveCount(1);

    await hexInput.fill("998877");
    await expect(popover.locator(".pop-title")).toHaveText("CUSTOM");
    await expect(popover.locator(".matrix-cell.active")).toHaveCount(0);
    await expect(popover.locator(".ramp-cell.selected")).toHaveCount(0);
  });

  test("invalid hex input resets to previous color on blur", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.fill("invalid");
    await hexInput.blur();

    const strokeColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor;
    });
    expect(strokeColor).toBe("#3d4248");
    await expect(hexInput).toHaveValue("26292c");
  });

  test("escape inside hex input closes the popover", async ({ page }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.focus();
    await page.keyboard.press("Escape");

    await expect(popover).toHaveCount(0);
  });

  test("opacity slider functions normally with custom hex color", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.fill("336699");

    const slider = popover.getByRole("slider", { name: "Opacity" });
    await slider.fill("40");

    const snapshot = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { strokeColor: el.strokeColor, strokeOpacity: el.strokeOpacity };
    });
    expect(snapshot.strokeColor).toBe("#336699");
    expect(snapshot.strokeOpacity).toBe(0.4);

    await expect(popover.locator(".opacity-bubble")).toHaveText("40%");
  });

  test("custom background fill renders faithfully on canvas without contrast clamping", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.evaluate(async () => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        backgroundColor: "#fef08a",
        fillStyle: "solid",
        fillOpacity: 1,
      });
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
    });

    await page.keyboard.press("Escape");

    const pixel = await page.evaluate(async () => {
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      const canvas = document.querySelector(".canvas-host canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const data = ctx?.getImageData(Math.round(160 * dpr), Math.round(140 * dpr), 1, 1).data;
      return data ? { r: data[0], g: data[1], b: data[2] } : null;
    });

    expect(pixel).not.toBeNull();
    expect(pixel!.r).toBeGreaterThan(240);
    expect(pixel!.g).toBeGreaterThan(230);
    expect(pixel!.b).toBeLessThan(160);
  });

  test("typing two characters does not auto-fill or commit prematurely", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await expect(hexInput).toHaveValue("26292c");

    await hexInput.click();
    await page.keyboard.type("ab");
    await expect(hexInput).toHaveValue("ab");

    const strokeColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor;
    });
    expect(strokeColor).toBe("#3d4248");

    await page.keyboard.type("1234");
    await expect(hexInput).toHaveValue("ab1234");

    const updatedColor = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeColor;
    });
    expect(updatedColor).toBe("#ab1234");
  });

  test("subsequent click on already focused input allows caret positioning without reselecting all", async ({
    page,
  }) => {
    await createRectangleSelection(page);

    await page.getByRole("button", { name: "Stroke color current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.click();
    await page.keyboard.type("112233");
    await expect(hexInput).toHaveValue("112233");

    await hexInput.click();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Backspace");
    await expect(hexInput).toHaveValue("11223");
  });
});
