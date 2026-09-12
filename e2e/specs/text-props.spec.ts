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

    // the base swatch expands the shade row; pick a shade to apply
    await page.getByRole("button", { name: "Text color Red" }).click();
    const shadeRow = page.locator(".color-popover--portal .swatch-shade-row");
    await expect(shadeRow).toBeVisible();
    await shadeRow.locator(".swatch").nth(3).click();

    const p = await elemProps(page);
    expect(p.textColor).toMatch(/^#[0-9a-fA-F]{6}$/);
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
});