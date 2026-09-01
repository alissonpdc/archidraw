import { test, expect, drag, selectTool, open } from "../fixtures";

test.describe("additional information (hover info box)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await selectTool(page, "r");
    await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 });
    await selectTool(page, "v");
  });

  test("right-click on an element opens the ArchiDraw context menu", async ({
    page,
  }) => {
    await page.mouse.click(280, 140, { button: "right" });
    await expect(page.getByTestId("context-menu")).toBeVisible();
    await expect(page.getByTestId("context-menu-info")).toContainText(
      "Additional Information",
    );
  });

  test("right-click on empty canvas shows an empty custom menu", async ({
    page,
  }) => {
    await page.mouse.click(700, 500, { button: "right" });
    await expect(page.getByTestId("context-menu")).toBeVisible();
    await expect(page.getByTestId("context-menu-info")).toHaveCount(0);
    await expect(page.getByTestId("context-menu-empty")).toBeVisible();
  });

  test("context menu closes on a left click outside", async ({ page }) => {
    await page.mouse.click(280, 140, { button: "right" });
    await expect(page.getByTestId("context-menu")).toBeVisible();
    await page.mouse.click(700, 500);
    await expect(page.getByTestId("context-menu")).toHaveCount(0);
  });

  test("Additional Information modal persists details and undo reverts it", async ({
    page,
    editorState,
  }) => {
    await page.mouse.click(280, 140, { button: "right" });
    await page.getByTestId("context-menu-info").click();
    const dialog = page.getByRole("dialog", {
      name: "Additional Information",
    });
    await expect(dialog).toBeVisible();
    await dialog.locator("textarea").fill("GET /orders — 120ms p95");
    await page.getByTestId("details-save").click();

    let s = await editorState();
    expect(s.elements[0].details).toBe("GET /orders — 120ms p95");

    await page.keyboard.press("Control+z");
    s = await editorState();
    expect(s.elements[0].details).toBeUndefined();
  });

  test("badge 'i' stays visible on the element", async ({ page }) => {
    await page.mouse.click(280, 140, { button: "right" });
    await page.getByTestId("context-menu-info").click();
    await page
      .getByRole("dialog", { name: "Additional Information" })
      .locator("textarea")
      .fill("latency: 120ms");
    await page.getByTestId("details-save").click();

    const badge = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const cam = ed.getSnapshot().camera;
      const inset = 12;
      const sx = el.x + el.width - inset;
      const sy = el.y + el.height - inset;
      return {
        x: sx * cam.zoom + cam.scrollX,
        y: sy * cam.zoom + cam.scrollY,
      };
    });
    // hover the badge: the readonly info box must appear with the text
    await page.mouse.move(badge.x, badge.y);
    const box = page.getByTestId("hover-info-box");
    await expect(box).toBeVisible();
    await expect(box).toContainText("Additional Information");
    await expect(box).toContainText("latency: 120ms");

    // moving away hides the readonly box again
    await page.mouse.move(50, 600);
    await expect(box).toHaveCount(0);
  });
});