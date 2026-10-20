import { test, expect, drag, open } from "../fixtures";

test.describe("viewport", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("space+drag pans the camera", async ({ page, editorState }) => {
    await page.keyboard.down("Space");
    await drag(page, { x: 640, y: 400 }, { x: 740, y: 480 });
    await page.keyboard.up("Space");

    const s = await editorState();
    expect(s.camera.scrollX).toBe(100);
    expect(s.camera.scrollY).toBe(80);
  });

  test("ctrl+wheel zooms in at cursor", async ({ page, editorState }) => {
    const before = await editorState();
    expect(before.camera.zoom).toBe(1);

    await page.mouse.move(640, 400);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -240);
    await page.keyboard.up("Control");

    const after = await editorState();
    expect(after.camera.zoom).toBeGreaterThan(1);
  });

  test("zoom is clamped between 0.1x and 8x", async ({
    page,
    editorState,
  }) => {
    await page.mouse.move(640, 400);
    await page.keyboard.down("Control");
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -300); // zoom in a lot
    }
    await page.keyboard.up("Control");

    const zoomedIn = await editorState();
    expect(zoomedIn.camera.zoom).toBeLessThanOrEqual(8);

    await page.keyboard.down("Control");
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, 300); // zoom out a lot
    }
    await page.keyboard.up("Control");

    const zoomedOut = await editorState();
    expect(zoomedOut.camera.zoom).toBeGreaterThanOrEqual(0.1);
  });
});
