import { test, expect, drag, selectTool, open } from "../fixtures";
import type { Page } from "@playwright/test";

const DEG = 180 / Math.PI;

/** rotate grip position in screen coords, read straight from the editor */
async function gripScreen(page: Page) {
  return page.evaluate(() => {
    const ed = (window as any).__editor__;
    const s = ed.getSnapshot();
    const p = ed.rotateHandlePoint();
    if (!p) return null;
    return {
      x: p.x * s.camera.zoom + s.camera.scrollX,
      y: p.y * s.camera.zoom + s.camera.scrollY,
    };
  });
}

async function createRect(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await selectTool(page, "2");
  await drag(page, { x: x1, y: y1 }, { x: x2, y: y2 });
}

async function angleOf(page: Page, index = 0) {
  return page.evaluate((i) => {
    const s = (window as any).__editor__.getSnapshot();
    return s.doc.elements[i].angle ?? 0;
  }, index);
}

test.describe("rotate handle", () => {
  test("grip appears above the selection and rotates around the center", async ({
    page,
  }) => {
    await open(page);
    await createRect(page, 200, 200, 320, 280);
    await selectTool(page, "1");

    const before = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      const el = s.doc.elements[0];
      return { x: el.x, y: el.y, w: el.width, h: el.height };
    });

    const grip = await gripScreen(page);
    expect(grip).not.toBeNull();
    // grip sits above the top edge, centered horizontally (120x80 box → cy 240)
    expect(grip!.x).toBeCloseTo(260, 0);
    expect(grip!.y).toBeLessThan(200);

    // drag the grip to the right of the center → ~90° clockwise
    await drag(page, grip!, { x: 460, y: 240 });

    const after = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      const el = s.doc.elements[0];
      return { x: el.x, y: el.y, w: el.width, h: el.height, angle: el.angle ?? 0 };
    });

    expect((after.angle * DEG) % 360).toBeCloseTo(90, 0);
    // rotation is around the center: the box size and center are untouched
    expect(after.w).toBeCloseTo(before.w, 3);
    expect(after.h).toBeCloseTo(before.h, 3);
    expect(after.x + after.w / 2).toBeCloseTo(before.x + before.w / 2, 3);
    expect(after.y + after.h / 2).toBeCloseTo(before.y + before.h / 2, 3);
  });

  test("shift snaps the rotation to 15° steps", async ({ page }) => {
    await open(page);
    await createRect(page, 200, 200, 320, 280);
    await selectTool(page, "1");

    const grip = await gripScreen(page);
    await page.keyboard.down("Shift");
    await drag(page, grip!, { x: 470, y: 232 });
    await page.keyboard.up("Shift");

    const deg = (await angleOf(page)) * DEG;
    expect(((deg % 360) + 360) % 360).toBeCloseTo(90, 0);
  });

  test("rotation is undoable and redoable", async ({ page }) => {
    await open(page);
    await createRect(page, 200, 200, 320, 280);
    await selectTool(page, "1");

    const grip = await gripScreen(page);
    await drag(page, grip!, { x: 460, y: 240 });
    expect(await angleOf(page)).not.toBe(0);

    await page.keyboard.press("Control+z");
    expect(await angleOf(page)).toBe(0);

    await page.keyboard.press("Control+Shift+z");
    expect(await angleOf(page)).not.toBe(0);
  });

  test("grabbing the grip without dragging does not create an undo step", async ({
    page,
  }) => {
    await open(page);
    await createRect(page, 200, 200, 320, 280);
    await selectTool(page, "1");

    const grip = await gripScreen(page);
    await drag(page, grip!, { x: grip!.x, y: grip!.y });

    // a stray undo would wipe the shape itself
    await page.keyboard.press("Control+z");
    const count = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(count).toBe(1);
  });

  test("a rotated element is still hit-tested by its real outline", async ({
    page,
  }) => {
    await open(page);
    await createRect(page, 200, 200, 320, 280);
    await selectTool(page, "1");

    const grip = await gripScreen(page);
    await drag(page, grip!, { x: 460, y: 240 });

    // click a corner of the unrotated box: outside the turned shape now
    await page.mouse.click(205, 205);
    let s = await page.evaluate(() => {
      const st = (window as any).__editor__.getSnapshot();
      return [...st.selectedIds].length;
    });
    expect(s).toBe(0);

    // click the visual center of the rotated shape: inside
    await page.mouse.click(260, 240);
    s = await page.evaluate(() => {
      const st = (window as any).__editor__.getSnapshot();
      return [...st.selectedIds].length;
    });
    expect(s).toBe(1);
  });

  test("resize handles follow the rotated frame", async ({ page }) => {
    await open(page);
    await createRect(page, 200, 200, 320, 280);
    await selectTool(page, "1");

    const grip = await gripScreen(page);
    await drag(page, grip!, { x: 460, y: 240 }); // 90°

    // the "e" resize handle sits at the middle of the element's local right
    // edge; after a quarter turn that lands straight below the center
    const handle = await page.evaluate(() => {
      const st = (window as any).__editor__.getSnapshot();
      const el = st.doc.elements[0];
      const a = el.angle ?? 0;
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const hx = el.width / 2;
      const x = cx + hx * Math.cos(a);
      const y = cy + hx * Math.sin(a);
      return {
        x: x * st.camera.zoom + st.camera.scrollX,
        y: y * st.camera.zoom + st.camera.scrollY,
      };
    });

    const before = await page.evaluate(() => {
      const st = (window as any).__editor__.getSnapshot();
      const el = st.doc.elements[0];
      return { w: el.width, h: el.height };
    });

    // pull the handle away from the element along its own local x axis
    await drag(page, { x: handle.x, y: handle.y }, { x: handle.x, y: handle.y + 40 });

    const after = await page.evaluate(() => {
      const st = (window as any).__editor__.getSnapshot();
      const el = st.doc.elements[0];
      return { w: el.width, h: el.height };
    });
    // the width grows in the element's own frame, and the angle is preserved
    expect(after.w).toBeGreaterThan(before.w);
    expect(after.h).toBeCloseTo(before.h, 3);
    expect((await angleOf(page)) * DEG).toBeCloseTo(90, 0);
  });

  test("lines and arrows expose no rotate grip", async ({ page }) => {
    await open(page);
    await selectTool(page, "5"); // arrow
    await drag(page, { x: 200, y: 200 }, { x: 320, y: 260 });
    await selectTool(page, "1");

    const grip = await gripScreen(page);
    expect(grip).toBeNull();
    expect(await angleOf(page)).toBe(0);
  });

  test("locked elements are not rotatable", async ({ page }) => {
    await open(page);
    await createRect(page, 200, 200, 320, 280);
    // the shape is still selected from the creation drag
    await page.evaluate(() => (window as any).__editor__.toggleLockSelected());

    const grip = await gripScreen(page);
    expect(grip).toBeNull();
  });

  test("rotation survives save/restore", async ({ page }) => {
    await open(page);
    await createRect(page, 200, 200, 320, 280);
    await selectTool(page, "1");
    const grip = await gripScreen(page);
    await drag(page, grip!, { x: 460, y: 240 });

    const json = await page.evaluate(() =>
      (window as any).__editor__.serializeState(),
    );
    await page.evaluate((j: string) => {
      (window as any).__editor__.restoreState(j);
    }, json);

    expect((await angleOf(page)) * DEG).toBeCloseTo(90, 0);
  });
});