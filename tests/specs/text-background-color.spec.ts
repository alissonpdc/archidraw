import { test, expect, open, selectTool, drag } from "../fixtures";
import type { Page } from "@playwright/test";

async function createTextElement(page: Page, text: string = "Hello World", x = 300, y = 300) {
  await selectTool(page, "7");
  await page.mouse.click(x, y);
  await page.keyboard.type(text);
  await page.keyboard.press("Escape");
  await selectTool(page, "1");
  await page.mouse.click(x + 20, y + 10);
}

test.describe("text element background color", () => {
  test("text element shows Background color selector below Color in Text tab with grey5 COLOR and grey1 BG in light mode", async ({
    page,
  }) => {
    await open(page);
    await createTextElement(page);

    const activeTab = page.locator(".panel-tab-content:not(.hidden)");
    const subtitles = activeTab.locator(".panel-subtitle");
    await expect(subtitles.nth(0)).toHaveText("Color");
    await expect(subtitles.nth(1)).toHaveText("Background");

    const colorBtn = page.getByRole("button", { name: "Text color current" });
    await expect(colorBtn).toBeVisible();
    await expect(colorBtn.locator(".chip-name")).toHaveText("Grey · 5");

    const bgBtn = page.getByRole("button", { name: "Background current" });
    await expect(bgBtn).toBeVisible();
    await expect(bgBtn.locator(".chip-name")).toHaveText("Grey · 1");

    const el = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0];
    });

    expect(el.textColor).toBe("#3d4248");
    expect(el.backgroundColor).toBe("#dfe0e2");
    expect(el.fillOpacity).toBe(0);
  });

  test("dark mode inverts default COLOR to grey1 and default BG to grey5", async ({
    page,
  }) => {
    await open(page);
    await createTextElement(page);

    await page.evaluate(() => {
      (window as any).__editor__.correlateColorsForTheme(true);
      document.documentElement.setAttribute("data-theme", "dark");
    });

    const colorBtn = page.getByRole("button", { name: "Text color current" });
    await expect(colorBtn.locator(".chip-name")).toHaveText("Grey · 1");

    const bgBtn = page.getByRole("button", { name: "Background current" });
    await expect(bgBtn.locator(".chip-name")).toHaveText("Grey · 5");

    const resolved = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const s = getComputedStyle(document.documentElement);
      const stroke = s.getPropertyValue("--element-stroke").trim();
      return { stroke, bg: el.backgroundColor, fillOpacity: el.fillOpacity };
    });

    expect(resolved.stroke).toBe("#dfe0e2");
    expect(resolved.bg).toBe("#dfe0e2");
    expect(resolved.fillOpacity).toBe(0);
  });

  test("polygonal elements default text COLOR to Auto", async ({ page }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 150 }, { x: 360, y: 260 });
    await selectTool(page, "1");
    await page.locator(".panel-tab", { hasText: "Text" }).click();

    const colorBtn = page.getByRole("button", { name: "Text color current" });
    await expect(colorBtn).toBeVisible();
    await expect(colorBtn.locator(".chip-name")).toHaveText("Auto");
  });

  test("clicking Background opens popover with opacity at 0%, and picking shade applies color and sets fillOpacity to 1", async ({
    page,
  }) => {
    await open(page);
    await createTextElement(page);

    const bgBtn = page.getByRole("button", { name: "Background current" });
    await bgBtn.click();

    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const slider = popover.getByRole("slider", { name: "Opacity" });
    await expect(slider).toHaveValue("0");

    const matrixCells = popover.locator(".matrix-cell");
    await expect(matrixCells).toHaveCount(15);

    await page.getByRole("button", { name: "Background Blue" }).click();
    const rampCells = popover.locator(".ramp-cell");
    await expect(rampCells).toHaveCount(5);

    await rampCells.nth(2).click();
    await expect(popover).toHaveCount(0);

    const el = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0];
    });

    expect(el.backgroundColor).toBe("#1971c2");
    expect(el.fillOpacity).toBe(1);
    await expect(bgBtn.locator(".chip-name")).toHaveText("Blue · 3");
  });

  test("entering custom hex color sets text background color", async ({
    page,
  }) => {
    await open(page);
    await createTextElement(page);

    await page.getByRole("button", { name: "Background current" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();

    const hexInput = popover.locator(".pop-hex-input");
    await hexInput.fill("#457b9d");
    await hexInput.press("Enter");

    await expect(popover).toHaveCount(0);

    const el = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0];
    });

    expect(el.backgroundColor).toBe("#457b9d");
    expect(el.fillOpacity).toBe(1);

    const bgBtn = page.getByRole("button", { name: "Background current" });
    await expect(bgBtn.locator(".chip-name")).toHaveText("#457B9D");
  });

  test("opacity slider adjusts text background fillOpacity from 0%", async ({
    page,
  }) => {
    await open(page);
    await createTextElement(page);

    await page.getByRole("button", { name: "Background current" }).click();
    const slider = page.locator(".color-popover").getByRole("slider", { name: "Opacity" });
    await expect(slider).toHaveValue("0");
    await slider.fill("60");

    const el = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0];
    });

    expect(el.backgroundColor).toBe("#dfe0e2");
    expect(el.fillOpacity).toBe(0.6);
  });

  test("text background is rendered on canvas", async ({
    page,
  }) => {
    await open(page);
    await createTextElement(page, "Canvas text", 300, 300);

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { backgroundColor: "#f5c518", fillOpacity: 1 });
      ed.selectedIds = new Set();
      ed.emit();
    });

    const pixel = await page.evaluate(async () => {
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      const canvas = document.querySelector(".canvas-host canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const data = ctx?.getImageData(Math.round(302 * dpr), Math.round(302 * dpr), 1, 1).data;
      return data ? { r: data[0], g: data[1], b: data[2], a: data[3] } : null;
    });

    expect(pixel).not.toBeNull();
    expect(pixel!.r).toBeGreaterThan(200);
    expect(pixel!.g).toBeGreaterThan(150);
    expect(pixel!.b).toBeLessThan(50);
  });

  test("SVG export includes background rect for text element with background", async ({
    page,
  }) => {
    await open(page);
    await createTextElement(page, "Export text", 200, 200);

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { backgroundColor: "#1971c2", fillOpacity: 0.8 });
    });

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");

    expect(svg).toContain('<rect x="200" y="200"');
    expect(svg).toContain('fill="#1971c2"');
    expect(svg).toContain('opacity="0.8"');
    expect(svg).toContain("<text");
  });

  test("multi-selection of text elements with differing backgrounds shows mixed dash", async ({
    page,
  }) => {
    await open(page);
    await createTextElement(page, "First", 300, 200);
    await createTextElement(page, "Second", 300, 300);

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      ed.updateElements([els[0].id], { backgroundColor: "#e03131" });
      ed.updateElements([els[1].id], { backgroundColor: "#1971c2" });
      ed.selectedIds = new Set([els[0].id, els[1].id]);
      ed.emit();
    });

    const bgBtn = page.getByRole("button", { name: "Background current" });
    await expect(bgBtn.locator(".chip-name")).toHaveText("—");

    await bgBtn.click();
    const popover = page.locator(".color-popover");
    await page.getByRole("button", { name: "Background Green" }).click();
    await popover.locator(".ramp-cell").nth(2).click();

    const elements = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements;
    });

    expect(elements[0].backgroundColor).toBe("#2f9e44");
    expect(elements[1].backgroundColor).toBe("#2f9e44");
    await expect(bgBtn.locator(".chip-name")).toHaveText("Green · 3");
  });

  test("undo and redo restore background color on text element", async ({
    page,
  }) => {
    await open(page);
    await createTextElement(page);

    const bgBtn = page.getByRole("button", { name: "Background current" });
    await bgBtn.click();
    const popover = page.locator(".color-popover");
    await page.getByRole("button", { name: "Background Blue" }).click();
    await page.keyboard.press("Escape");

    let color = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].backgroundColor;
    });
    expect(color).toBe("#1971c2");

    await page.getByRole("button", { name: "Undo" }).click();

    color = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].backgroundColor;
    });
    expect(color).toBe("#dfe0e2");

    await page.getByRole("button", { name: "Redo" }).click();

    color = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].backgroundColor;
    });
    expect(color).toBe("#1971c2");
  });
});
