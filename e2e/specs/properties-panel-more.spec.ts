import { test, expect, open, drag, selectTool } from "../fixtures";
import { type Page } from "@playwright/test";

async function drawRect(
  page: Page,
  from = { x: 200, y: 150 },
  to = { x: 320, y: 220 },
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

function selectAll(page: Page) {
  return page.evaluate(() => (window as any).__editor__.selectAll());
}

test.describe("PropertiesPanel extra controls", () => {
  test("line spacing slider grows the text line spacing", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Panel text");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(330, 310);
    await page.locator(".panel-tab", { hasText: "Text" }).click();
    await page.waitForTimeout(150);

    const slider = page.locator('input[aria-label="Line spacing"]');
    await slider.focus();
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");

    const v = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].lineSpacing;
    });
    expect(v).toBeGreaterThan(1.25);
  });

  test("dashed arrow enables and toggles the animation flag", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 320, y: 260 });
    await selectTool(page, "1");
    await selectAll(page);
    await page.locator(".size-btn[aria-label='Line dashed']").click();

    const animated = page.getByRole("button", { name: "Animate arrow" });
    const disabled = await animated.isDisabled();
    expect(disabled).toBe(false);
    await animated.click();

    const a = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].animated;
    });
    expect(a).toBe(true);
  });

  test("selecting a single arrow activates its end arrowhead button", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 320, y: 260 });
    await selectTool(page, "1");
    await selectAll(page);

    await page.locator(".size-btn[aria-label='End arrowhead triangle']").click();
    const activeCount = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          ".size-btn[aria-label^='End arrowhead'].active",
        ),
      ).length;
    });
    expect(activeCount).toBe(1);
    const v = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].endArrowhead;
    });
    expect(v).toBe("triangle");
  });

  test("roughness mixed selection leaves no roughness button active", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[1];
      ed.updateElements([el.id], { roughness: 2 });
    });
    await selectAll(page);
    await page.waitForTimeout(200);

    const active = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll('.properties-panel .size-btn[data-tip="Architect"], .properties-panel .size-btn[data-tip="Draft"], .properties-panel .size-btn[data-tip="Sketchy"], .properties-panel .size-btn[data-tip="Chaos"]'),
      ).filter((b) => b.classList.contains("active")).length;
    });
    expect(active).toBe(0);
  });

  test("font size mixed selection leaves no size button active", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Small");
    await page.keyboard.press("Escape");
    await selectTool(page, "7");
    await page.mouse.click(500, 300);
    await page.keyboard.type("Large");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[1];
      ed.updateElements([el.id], { fontSize: 32 });
    });
    await selectAll(page);
    await page.locator(".panel-tab", { hasText: "Text" }).click();
    await page.waitForTimeout(200);

    const active = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".properties-panel .size-btn.text-btn.active"),
      ).length;
    });
    expect(active).toBe(0);
  });
});