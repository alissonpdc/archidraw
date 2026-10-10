import { test, expect, drag, selectTool, open, type Page } from "../fixtures";

interface ElPos {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  groupId?: string;
  locked?: boolean;
  childIds?: string[];
}

/** reads full geometry (the shared fixture only exposes a light projection) */
async function readAll(page: Page): Promise<ElPos[]> {
  return page.evaluate(() => {
    const s = (window as any).__editor__.getSnapshot();
    return s.doc.elements.map((el: any) => ({
      id: el.id,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      groupId: el.groupId,
      locked: el.locked,
      childIds: el.childIds,
    }));
  });
}

/** one rectangle at (220,100)-(340,180), selected, with the selection tool */
async function selectedRect(page: Page): Promise<ElPos> {
  await selectTool(page, "2");
  await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 });
  await selectTool(page, "1");
  await page.mouse.click(280, 140);
  return (await readAll(page))[0];
}

test.describe("keyboard nudge", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("arrow keys move the selected element", async ({ page }) => {
    const before = await selectedRect(page);

    await page.keyboard.press("ArrowRight");
    let els = await readAll(page);
    expect(els[0].x).toBe(before.x + 2);
    expect(els[0].y).toBe(before.y);

    await page.keyboard.press("ArrowDown");
    els = await readAll(page);
    expect(els[0].x).toBe(before.x + 2);
    expect(els[0].y).toBe(before.y + 2);

    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    els = await readAll(page);
    expect(els[0].x).toBe(before.x);
    expect(els[0].y).toBe(before.y);
  });

  test("shift+arrow moves by the larger step", async ({ page }) => {
    const before = await selectedRect(page);

    await page.keyboard.press("Shift+ArrowRight");

    const els = await readAll(page);
    expect(els[0].x).toBe(before.x + 10);
    expect(els[0].y).toBe(before.y);
  });

  test("no nudge without a selection, and mod+arrow is ignored", async ({
    page,
  }) => {
    const before = await selectedRect(page);

    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowRight");
    expect((await readAll(page))[0].x).toBe(before.x);

    await page.mouse.click(280, 140); // select again
    await page.keyboard.press("Control+ArrowRight");
    expect((await readAll(page))[0].x).toBe(before.x);
  });

  test("repeated nudges collapse into a single undo step", async ({ page }) => {
    const before = await selectedRect(page);

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("ArrowRight", { delay: 5 });
    }
    expect((await readAll(page))[0].x).toBe(before.x + 6);

    await page.keyboard.press("Control+z");
    expect((await readAll(page))[0].x).toBe(before.x);
  });

  test("a pause between nudges starts a new undo step", async ({ page }) => {
    const before = await selectedRect(page);

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700);
    await page.keyboard.press("ArrowRight");
    expect((await readAll(page))[0].x).toBe(before.x + 4);

    await page.keyboard.press("Control+z");
    expect((await readAll(page))[0].x).toBe(before.x + 2);
    await page.keyboard.press("Control+z");
    expect((await readAll(page))[0].x).toBe(before.x);
  });

  test("locked elements never move", async ({ page }) => {
    const before = await selectedRect(page);

    await page.keyboard.press("Control+Shift+l");
    expect((await readAll(page))[0].locked).toBe(true);

    await page.keyboard.press("ArrowRight");
    const els = await readAll(page);
    expect(els[0].x).toBe(before.x);
    expect(els[0].y).toBe(before.y);
  });

  test("a partially selected group moves as a whole", async ({ page }) => {
    await selectTool(page, "2");
    await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 });
    await drag(page, { x: 400, y: 100 }, { x: 520, y: 180 });
    await selectTool(page, "1");

    // marquee both rects, then group them (start above the properties
    // panel so the pointerdown lands on the canvas)
    await drag(page, { x: 80, y: 30 }, { x: 540, y: 200 });
    await page.keyboard.press("Control+g");

    // marquee only the first rect: the group sibling must follow it
    await drag(page, { x: 80, y: 30 }, { x: 370, y: 200 });
    const before = await readAll(page);
    expect(before[0].groupId).toBe(before[1].groupId);

    await page.keyboard.press("ArrowRight");

    const after = await readAll(page);
    expect(after[0].x).toBe(before[0].x + 2);
    expect(after[1].x).toBe(before[1].x + 2);
  });

  test("a bound arrow follows the nudged shape", async ({ page }) => {
    await selectTool(page, "2");
    await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 }); // A
    await drag(page, { x: 500, y: 320 }, { x: 620, y: 400 }); // B

    await selectTool(page, "6");
    await drag(page, { x: 342, y: 140 }, { x: 498, y: 360 });
    await selectTool(page, "1");

    const arrowBefore = (await readAll(page)).find((e) => e.type === "arrow")!;
    expect(arrowBefore.x).toBeCloseTo(340, 0);

    await page.mouse.click(280, 140); // select shape A
    await page.keyboard.press("ArrowRight");

    const els = await readAll(page);
    const arrowAfter = els.find((e) => e.type === "arrow")!;
    const rectAfter = els.find((e) => e.type === "rectangle")!;
    // the bound start follows A, the free end stays where it was
    expect(arrowAfter.x).toBeCloseTo(arrowBefore.x + 2, 5);
    expect(arrowAfter.x + arrowAfter.width).toBeCloseTo(
      arrowBefore.x + arrowBefore.width,
      5,
    );
    expect(rectAfter.x).toBe(222);
  });

  test("nudging a context carries its children along", async ({ page }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });
    await selectTool(page, "1");

    const before = await readAll(page);
    const ctxBefore = before.find((e) => e.type === "context")!;
    const rectBefore = before.find((e) => e.type === "rectangle")!;
    expect(ctxBefore.childIds).toContain(rectBefore.id);

    // grab the context on an empty spot inside it, then nudge
    await page.mouse.click(350, 300);
    await page.keyboard.press("ArrowDown");

    const after = await readAll(page);
    const ctxAfter = after.find((e) => e.type === "context")!;
    const rectAfter = after.find((e) => e.type === "rectangle")!;
    expect(ctxAfter.y - ctxBefore.y).toBe(2);
    expect(rectAfter.y - rectBefore.y).toBe(2);
    expect(ctxAfter.childIds).toContain(rectAfter.id);
  });

  test("nudging a child out of its context updates membership", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });
    await selectTool(page, "1");

    await page.mouse.click(250, 250); // select the child rect
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Shift+ArrowRight", { delay: 1 });
    }

    const after = await readAll(page);
    const ctxAfter = after.find((e) => e.type === "context")!;
    const rectAfter = after.find((e) => e.type === "rectangle")!;
    // the child walked out of the container and lost its membership
    expect(ctxAfter.childIds ?? []).toHaveLength(0);
    expect(rectAfter.x).toBe(200 + 600);
  });

  test("nudge is ignored during an interaction or text editing", async ({
    page,
  }) => {
    const before = await selectedRect(page);

    // pointer still down on the shape: the drag interaction owns the move
    await page.mouse.move(280, 140);
    await page.mouse.down();
    const duringDrag = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.nudgeSelected(50, 0);
      return ed.getSnapshot().doc.elements[0].x;
    });
    await page.mouse.up();
    expect(duringDrag).toBe(before.x);

    // text editing owns the keyboard
    await selectTool(page, "7");
    await page.mouse.click(340, 250);
    await page.keyboard.type("hi");
    const textBefore = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[1].x,
    );
    const duringEdit = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.nudgeSelected(50, 0);
      return ed.getSnapshot().doc.elements[1].x;
    });
    await page.keyboard.press("Escape");
    expect(duringEdit).toBe(textBefore);
    expect((await readAll(page))[0].x).toBe(before.x);
  });
});