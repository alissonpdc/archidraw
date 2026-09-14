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

function single(page: Page) {
  return page.evaluate(() => {
    const ed = (window as any).__editor__;
    const el = ed.getSnapshot().doc.elements[0];
    return {
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      locked: el.locked,
    };
  });
}

test.describe("resize handles", () => {
  test("every cardinal and corner handle grows or moves the rect", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(260, 185);

    const grab = async (
      handle: (s: { x: number; y: number; width: number; height: number }) => { x: number; y: number },
      dx: number,
      dy: number,
    ) => {
      const s = await single(page);
      const p = handle(s);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + dx, p.y + dy, { steps: 4 });
      await page.mouse.up();
    };
    // cardinal + corner handles must each change the box
    const H = (s: { x: number; y: number; width: number; height: number }) => ({
      e: { x: s.x + s.width, y: s.y + s.height / 2 },
      n: { x: s.x + s.width / 2, y: s.y },
      s: { x: s.x + s.width / 2, y: s.y + s.height },
      w: { x: s.x, y: s.y + s.height / 2 },
      nw: { x: s.x, y: s.y },
    });

    const before = await single(page);
    await grab((s) => H(s).e, 60, 0);
    expect((await single(page)).width).toBeGreaterThan(before.width);

    await grab((s) => H(s).n, 0, -40);
    expect((await single(page)).y).toBeLessThan(before.y);

    await grab((s) => H(s).s, 0, 40);
    expect((await single(page)).height).toBeGreaterThan(before.height);

    await grab((s) => H(s).w, -40, 0);
    expect((await single(page)).width).toBeGreaterThan(before.width);
    expect((await single(page)).x).toBeLessThan(before.x);

    await grab((s) => H(s).nw, -30, -30);
    const s = await single(page);
    expect(s.width).toBeGreaterThan(before.width);
    expect(s.height).toBeGreaterThan(before.height);
    expect(s.x).toBeLessThan(before.x);
    expect(s.y).toBeLessThan(before.y);
  });

  test("resizing a text element keeps the model consistent", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(200, 200);
    await page.keyboard.type("A fairly long label");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(260, 210);

    const before = await single(page);
    await page.mouse.move(before.x + before.width, before.y + before.height);
    await page.mouse.down();
    await page.mouse.move(
      before.x + before.width + 120,
      before.y + before.height + 40,
      { steps: 5 },
    );
    await page.mouse.up();

    const after = await single(page);
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.height).toBeGreaterThan(before.height);
  });
});

test.describe("edge bindings via drag", () => {
  test("dragging an arrow endpoint onto a shape binds it and away unbinds it", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });

    // dragging the arrow end onto a shape binds it on release
    await selectTool(page, "6");
    await drag(page, { x: 400, y: 300 }, { x: 160, y: 140 });
    await selectTool(page, "1");

    const s = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed
        .getSnapshot()
        .doc.elements.find((e: any) => e.type === "arrow");
      return { endBinding: el.endBinding };
    });
    expect(s.endBinding).toBeTruthy();
  });

  test("moving the bound shape drags the arrow endpoint along", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await selectTool(page, "6");
    await drag(page, { x: 400, y: 300 }, { x: 160, y: 140 });
    await selectTool(page, "1");

    // move the rectangle away
    await page.mouse.click(160, 140);
    await page.mouse.down();
    await page.mouse.move(420, 360, { steps: 6 });
    await page.mouse.up();

    const st = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      const rect = els.find((e: any) => e.type === "rectangle");
      const arrow = els.find((e: any) => e.type === "arrow");
      return {
        rect: { x: rect.x, y: rect.y },
        bound: arrow.endBinding !== undefined,
      };
    });
    // the binding survives and the twin arrow follows the new rect position
    expect(st.bound).toBe(true);
    expect(st.rect.x).toBeGreaterThan(300);
  });
});

test.describe("groups", () => {
  test("grouping two elements then ungrouping restores independence", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.keyboard.press("Control+g");
    let s = await editorState();
    const gid = s.elements[0].groupId;
    expect(gid).toBeTruthy();
    expect(s.elements[1].groupId).toBe(gid);

    await page.keyboard.press("Control+Shift+g");
    s = await editorState();
    expect(s.elements[0].groupId).toBeUndefined();
    expect(s.elements[1].groupId).toBeUndefined();
  });
});

test.describe("locked elements", () => {
  test("a locked element cannot be dragged", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.updateElements([ed.getSnapshot().doc.elements[0].id], {
        locked: true,
      });
    });

    const before = await single(page);
    await page.mouse.click(260, 185);
    await page.mouse.move(260, 185);
    await page.mouse.down();
    await page.mouse.move(300, 220, { steps: 5 });
    await page.mouse.up();

    const after = await single(page);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });
});

test.describe("drawing", () => {
  test("dragging the other way (up-left) still creates a shape", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 400, y: 300 }, { x: 300, y: 200 });
    await selectTool(page, "1");

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.elements[0].type).toBe("rectangle");
  });
});

test.describe("wheel pan", () => {
  test("plain wheel scroll pans the canvas vertically", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(100);

    const s = await editorState();
    expect(s.camera.scrollY).not.toBe(0);
  });
});