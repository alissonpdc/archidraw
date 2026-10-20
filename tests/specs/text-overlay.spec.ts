import { test, expect, open, selectTool } from "../fixtures";

test.describe("text overlay", () => {
  test("editing a styled multiline text keeps styles and renders fake selection", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Line one");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Line two");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");

    // center align + top vAlign + bold italic underline styled through the model
    await page.mouse.click(360, 310);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        textAlign: "center",
        textVAlign: "top",
        bold: true,
        italic: true,
        underline: true,
      });
    });
    await page.mouse.click(700, 600); // deselect
    await page.waitForTimeout(100);

    // re-edit: the overlay reflects the styles
    await page.mouse.dblclick(330, 310);
    const overlay = page.locator("textarea.text-overlay");
    await overlay.waitFor();

    const style = await page.evaluate(() => {
      const ta = document.querySelector(
        "textarea.text-overlay",
      ) as HTMLTextAreaElement;
      return {
        value: ta.value,
        fontWeight: getComputedStyle(ta).fontWeight,
        textDecoration: getComputedStyle(ta).textDecorationLine,
        textAlign: getComputedStyle(ta).textAlign,
      };
    });
    expect(style.value).toBe("Line one\nLine two");
    expect(style.fontWeight).toBe("700");
    expect(style.textDecoration).toContain("underline");
    expect(style.textAlign).toBe("center");

    // selecting text in the overlay surfaces the fake selection
    await page.keyboard.press("Shift+Home");
    const fakeSel = page.locator(".fake-selection");
    await expect(fakeSel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlay).toHaveCount(0);
  });
});