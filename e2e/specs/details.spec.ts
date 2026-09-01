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

  test("arrow without label: badge sits at the stroke midpoint", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "a");
    await drag(page, { x: 200, y: 300 }, { x: 500, y: 300 });
    await selectTool(page, "v");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed
        .getSnapshot()
        .doc.elements.find((e: any) => e.type === "arrow");
      ed.updateElementDetails(el.id, "HTTP 200");
    });
    const pos = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const s = ed.getSnapshot();
      const el = s.doc.elements.find((e: any) => e.type === "arrow");
      const a = (window as any).__detailsBadgeAnchor__(el, s.camera.zoom);
      return ed.getScreenPoint(a);
    });
    // straight arrow from (200,300) → (500,300): the midpoint badge is exactly
    // at (350,300) on screen (zoom 1, no pan)
    expect(pos.x).toBeCloseTo(350, 0);
    // tip.y+1 guard on zero-height edges shifts the midpoint y by 0.5px
    expect(Math.abs(pos.y - 300)).toBeLessThanOrEqual(1);

    await page.mouse.move(pos.x, pos.y);
    const box = page.getByTestId("hover-info-box");
    await expect(box).toBeVisible();
    await expect(box).toContainText("HTTP 200");
  });

  test("line with a label: badge sits below the text and follows the label handle", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "l");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await selectTool(page, "v");
    await page.mouse.dblclick(350, 200); // stroke midpoint
    await page.keyboard.type("API");
    await page.keyboard.press("Escape");
    await page.mouse.click(450, 200); // re-select the line
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed
        .getSnapshot()
        .doc.elements.find((e: any) => e.type === "line");
      ed.updateElementDetails(el.id, "latency 120ms");
    });

    const pos = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const s = ed.getSnapshot();
      const el = s.doc.elements.find((e: any) => e.type === "line");
      const a = (window as any).__detailsBadgeAnchor__(el, s.camera.zoom);
      return { ...ed.getScreenPoint(a), labelT: el.labelT ?? 0.5 };
    });
    expect(pos.labelT).toBeCloseTo(0.5, 5);
    // same horizontal center as the label, right below it (midpoint y = 200)
    expect(pos.x).toBeCloseTo(350, 0);
    expect(pos.y).toBeGreaterThan(200);

    await page.mouse.move(pos.x, pos.y);
    await expect(page.getByTestId("hover-info-box")).toBeVisible();

    // drag the circular label handle towards the start: badge must follow
    await page.mouse.move(350, 200);
    await page.mouse.down();
    await page.mouse.move(240, 200, { steps: 5 });
    await page.mouse.up();

    const after = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const s = ed.getSnapshot();
      const el = s.doc.elements.find((e: any) => e.type === "line");
      const a = (window as any).__detailsBadgeAnchor__(el, s.camera.zoom);
      return { ...ed.getScreenPoint(a), labelT: el.labelT ?? 0.5 };
    });
    expect(after.labelT).toBeLessThan(0.5);
    expect(after.x).toBeLessThan(350);

    await page.mouse.move(after.x, after.y);
    await expect(page.getByTestId("hover-info-box")).toBeVisible();
  });
});