import { test, expect, open, drag, selectTool } from "../fixtures";
import { type Page } from "@playwright/test";

async function openPanel(page: Page, tab: "Style" | "Text" | "Layers") {
  await page.locator(".panel-tab", { hasText: tab }).click();
  await page.waitForTimeout(150);
}

function elemProps(page: Page) {
  return page.evaluate(() => {
    const ed = (window as any).__editor__;
    const el = ed.getSnapshot().doc.elements[0];
    return {
      bold: el.bold,
      italic: el.italic,
      underline: el.underline,
      textAlign: el.textAlign,
      textVAlign: el.textVAlign,
      fontSize: el.fontSize,
      textColor: el.textColor,
      strokeColor: el.strokeColor,
      lineSpacing: el.lineSpacing,
    };
  });
}

test.describe("PropertiesPanel text controls", () => {
  test("applies bold, italic, underline, alignment and size to a text element", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Panel text");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(330, 310);
    await openPanel(page, "Text");

    await page.getByRole("button", { name: "Bold" }).click();
    await page.getByRole("button", { name: "Italic" }).click();
    await page.getByRole("button", { name: "Underline" }).click();
    await page.locator(".size-btn", { hasText: "L" }).first().click();

    let p = await elemProps(page);
    expect(p.bold).toBe(true);
    expect(p.italic).toBe(true);
    expect(p.underline).toBe(true);
    expect(p.fontSize).toBeGreaterThan(20);

    await page.locator(".size-btn[data-tip='Center']").click();
    p = await elemProps(page);
    expect(p.textAlign).toBe("center");

    await page.locator(".size-btn[data-tip='Right']").click();
    p = await elemProps(page);
    expect(p.textAlign).toBe("right");
  });

  test("text color palette sets the element textColor", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Red text");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(320, 310);
    await openPanel(page, "Text");

    // the base dot opens the intensity popover; pick a ramp cell to apply
    await page.getByRole("button", { name: "Text color Red" }).click();
    const popover = page.locator(".color-popover");
    await expect(popover).toBeVisible();
    await popover.locator(".ramp-cell").nth(3).click();

    const p = await elemProps(page);
    expect(p.textColor).toBe("#ba1c1c");
  });

  test("vertical alignment of a rectangle label via the panel", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 150 }, { x: 360, y: 260 });
    await selectTool(page, "1");
    await page.mouse.dblclick(280, 205);
    await page.locator("textarea.text-overlay").waitFor();
    await page.keyboard.type("Centered");
    await page.keyboard.press("Escape");
    await page.mouse.click(280, 205);
    await openPanel(page, "Text");

    await page.locator(".size-btn[data-tip='Top']").click();
    let p = await elemProps(page);
    expect(p.textVAlign).toBe("top");

    await page.locator(".size-btn[data-tip='Bottom']").click();
    p = await elemProps(page);
    expect(p.textVAlign).toBe("bottom");
  });

  test("draft or higher style elements default to sketch font in properties panel", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 150 }, { x: 360, y: 260 });
    await selectTool(page, "1");
    await page.mouse.click(280, 205);
    await openPanel(page, "Style");

    await page.getByRole("button", { name: "Roughness Draft" }).click();
    await openPanel(page, "Text");

    const sketchBtn = page.locator('.properties-panel .size-btn[data-tip="Sketch"]');
    const sansBtn = page.locator('.properties-panel .size-btn[data-tip="Sans"]');
    await expect(sketchBtn).toHaveClass(/active/);
    await expect(sansBtn).not.toHaveClass(/active/);

    await openPanel(page, "Style");
    await page.getByRole("button", { name: "Roughness Architect" }).click();
    await openPanel(page, "Text");
    await expect(sansBtn).toHaveClass(/active/);
    await expect(sketchBtn).not.toHaveClass(/active/);

    await openPanel(page, "Style");
    await page.getByRole("button", { name: "Roughness Sketchy" }).click();
    await openPanel(page, "Text");
    await expect(sketchBtn).toHaveClass(/active/);

    await openPanel(page, "Style");
    await page.getByRole("button", { name: "Roughness Chaos" }).click();
    await openPanel(page, "Text");
    await expect(sketchBtn).toHaveClass(/active/);

    await sansBtn.click();
    await expect(sansBtn).toHaveClass(/active/);
    await expect(sketchBtn).not.toHaveClass(/active/);

    await openPanel(page, "Style");
    await page.getByRole("button", { name: "Roughness Draft" }).click();
    await openPanel(page, "Text");
    await expect(sansBtn).toHaveClass(/active/);
    await expect(sketchBtn).not.toHaveClass(/active/);
  });

  test("text element created under draft style inherits sketch font default", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 180 });
    await selectTool(page, "1");
    await page.mouse.click(150, 140);
    await openPanel(page, "Style");
    await page.getByRole("button", { name: "Roughness Draft" }).click();

    await selectTool(page, "7");
    await page.mouse.click(350, 200);
    await page.keyboard.type("Draft text");
    await page.keyboard.press("Escape");

    await selectTool(page, "1");
    await page.mouse.click(370, 205);
    await openPanel(page, "Text");

    const sketchBtn = page.locator('.properties-panel .size-btn[data-tip="Sketch"]');
    await expect(sketchBtn).toHaveClass(/active/);
  });
});