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

function callEditor(page: Page, fn: string, ...args: unknown[]) {
  return page.evaluate(
    ([f, a]) => {
      const ed = (window as any).__editor__;
      return ed[f](...a);
    },
    [fn, args],
  );
}

test.describe("clipboard guards", () => {
  test("copy, cut and paste with an empty clipboard are safe no-ops", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await callEditor(page, "copySelected");
    await callEditor(page, "cutSelected");
    await callEditor(page, "paste");
    await callEditor(page, "pasteAt", { x: 400, y: 300 });

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("paste with content inserts clones displaced from the pointer", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(260, 185);
    await page.keyboard.press("Control+c");

    const count = await callEditor(page, "pasteAt", { x: 500, y: 400 });
    expect(count).toBe(1);

    const s = await editorState();
    expect(s.elementCount).toBe(2);
    const pos = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[1];
      return { x: el.x, y: el.y };
    });
    // clone is centered at the paste point
    expect(Math.abs(pos.x + 60 - 500)).toBeLessThan(2);
    expect(Math.abs(pos.y + 35 - 400)).toBeLessThan(2);
  });
});

test.describe("group selection", () => {
  test("clicking a group member selects the whole group", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.keyboard.press("Control+g");
    await page.keyboard.press("Escape");

    await page.mouse.click(260, 185);
    const s = await editorState();
    expect(s.selectedIds).toHaveLength(2);
  });
});

test.describe("zoom to fit", () => {
  test("Shift+1 fits all content into the viewport", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 300, y: 250 });
    await drawRect(page, { x: 1200, y: 600 }, { x: 1450, y: 800 });
    await page.keyboard.press("Shift+1");

    const camera = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().camera;
    });
    expect(camera.zoom).toBeLessThan(1);
  });
});

test.describe("color popover", () => {
  test("clicking a shade applies it and the popover closes", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.waitForTimeout(200);

    await page.getByRole("button", { name: "Stroke color Red" }).click();
    const popover = page.locator(".color-popover--portal");
    await expect(popover).toBeVisible();
    const shade = popover.locator(".swatch").nth(2);
    await shade.click();

    await expect(popover).toHaveCount(0);
    const stroke = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].strokeColor;
    });
    expect(stroke).toMatch(/^#/);
    expect(stroke).not.toBe("#3d4248");
  });
});