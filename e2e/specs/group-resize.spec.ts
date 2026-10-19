import { test, expect, drag, selectTool, open, type Page } from "../fixtures";

async function createRects(page: Page) {
  await selectTool(page, "2");
  await drag(page, { x: 100, y: 100 }, { x: 180, y: 160 });
  await drag(page, { x: 260, y: 110 }, { x: 360, y: 190 });
  await selectTool(page, "1");
}

async function selectBoth(page: Page) {
  await drag(page, { x: 80, y: 30 }, { x: 380, y: 210 });
  await page.keyboard.press("Control+g");
  await page.mouse.click(140, 130);
}

function geom(page: Page) {
  return page.evaluate(() => {
    const s = window.__editor__.getSnapshot();
    return {
      selected: [...s.selectedIds],
      elements: s.doc.elements.map((el) => ({
        id: el.id,
        type: el.type,
        groupId: el.groupId,
        text: "text" in el ? el.text : undefined,
        fontSize: "fontSize" in el ? el.fontSize : undefined,
        childIds: "childIds" in el ? el.childIds : undefined,
        startBinding: "startBinding" in el ? el.startBinding : undefined,
        endBinding: "endBinding" in el ? el.endBinding : undefined,
        bendPoints: "bendPoints" in el ? el.bendPoints : undefined,
        controlPoint: "controlPoint" in el ? el.controlPoint : undefined,
        x: el.x,
        y: el.y,
        w: el.width,
        h: el.height,
      })),
    };
  });
}

/** counts selection-color pixels in a canvas region (single readback) */
function selectionPixels(
  page: Page,
  region: { x1: number; y1: number; x2: number; y2: number },
) {
  return page.evaluate(({ x1, y1, x2, y2 }) => {
    const canvas = document.querySelector(".canvas") as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    const data = canvas
      .getContext("2d")!
      .getImageData(x1 * dpr, y1 * dpr, (x2 - x1) * dpr, (y2 - y1) * dpr).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (data[i + 3] > 100 && b > 90 && b - r > 40 && g > 50 && g < b) {
        count++;
      }
    }
    return count;
  }, region);
}

test.describe("group resize", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await createRects(page);
    await selectBoth(page);
  });

  test("clicking a group member selects all members for resize", async ({
    page,
  }) => {
    const g = await geom(page);
    expect(g.selected).toHaveLength(2);
  });

  test("corner handle scales the whole group proportionally", async ({
    page,
  }) => {
    const s0 = (310 / 260 + 130 / 90) / 2;
    await drag(page, { x: 360, y: 190 }, { x: 410, y: 230 });

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(g.selected).toHaveLength(2);
    expect(a.w).toBeCloseTo(80 * s0, 1);
    expect(a.h).toBeCloseTo(60 * s0, 1);
    expect(b.x).toBeCloseTo(100 + 160 * s0, 1);
    expect(b.y).toBeCloseTo(100 + (110 - 100) * s0, 1);
    expect(b.w).toBeCloseTo(100 * s0, 1);
    expect(b.h).toBeCloseTo(80 * s0, 1);
    // equal zoom factor keeps the relative distance between the two boxes
    expect(b.x - (a.x + a.w)).toBeCloseTo(80 * s0, 1);
    expect(b.y - a.y).toBeCloseTo(10 * s0, 1);
  });

  test("edge handle scales one axis only", async ({ page }) => {
    const sx = 340 / 260;
    await drag(page, { x: 360, y: 145 }, { x: 440, y: 145 });

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(a.w).toBeCloseTo(80 * sx, 1);
    expect(a.y).toBeCloseTo(100, 0);
    expect(a.h).toBeCloseTo(60, 0);
    expect(b.w).toBeCloseTo(100 * sx, 1);
    expect(b.h).toBeCloseTo(80, 0);
    expect(b.y).toBeCloseTo(110, 0);
  });

  test("group resize keeps every element's own aspect ratio", async ({
    page,
  }) => {
    await drag(page, { x: 360, y: 190 }, { x: 410, y: 230 });

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(a.w / a.h).toBeCloseTo(80 / 60, 1);
    expect(b.w / b.h).toBeCloseTo(100 / 80, 1);
  });

  test("undo reverts a group resize", async ({ page }) => {
    await drag(page, { x: 360, y: 190 }, { x: 410, y: 230 });
    await page.keyboard.press("Control+z");

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(a.x).toBeCloseTo(100, 0);
    expect(a.w).toBeCloseTo(80, 0);
    expect(a.h).toBeCloseTo(60, 0);
    expect(b.x).toBeCloseTo(260, 0);
    expect(b.y).toBeCloseTo(110, 0);
    expect(b.w).toBeCloseTo(100, 0);
    expect(b.h).toBeCloseTo(80, 0);
  });

  test("individual selection outlines are hidden for a group", async ({
    page,
  }) => {
    await page.waitForTimeout(200);
    const insideGroup = await selectionPixels(page, {
      x1: 120,
      y1: 161,
      x2: 145,
      y2: 168,
    });
    expect(insideGroup).toBe(0);
  });

  test("individual outline remains for a single selection", async ({
    page,
  }) => {
    await page.keyboard.press("Control+Shift+g");
    await page.mouse.click(420, 220);
    await page.mouse.click(140, 130);
    await page.waitForTimeout(200);

    const single = await selectionPixels(page, {
      x1: 120,
      y1: 161,
      x2: 145,
      y2: 168,
    });
    expect(single).toBeGreaterThan(0);
  });

  test("group outline is drawn around the selection", async ({ page }) => {
    await page.waitForTimeout(200);
    const onGroupEdge = await selectionPixels(page, {
      x1: 356,
      y1: 112,
      x2: 366,
      y2: 134,
    });
    expect(onGroupEdge).toBeGreaterThan(0);
  });

  test("cursor hints resize over the group handle", async ({ page }) => {    const se = await page.evaluate(() =>
      window.__editor__.cursorOverrideAt({ x: 360, y: 190 }),
    );
    expect(se).toBe("nwse-resize");

    const away = await page.evaluate(() =>
      window.__editor__.cursorOverrideAt({ x: 200, y: 200 }),
    );
    expect(away).toBeNull();
  });

  test("shrinking a group scales members toward the group corner", async ({
    page,
  }) => {
    const s0 = (58 / 260 + 5 / 90) / 2;
    await drag(page, { x: 360, y: 190 }, { x: 158, y: 105 });

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(a.w).toBeCloseTo(80 * s0, 1);
    expect(a.h).toBeCloseTo(60 * s0, 1);
    expect(b.x).toBeCloseTo(100 + 160 * s0, 1);
    expect(b.x + b.w).toBeCloseTo(100 + 260 * s0, 1);
    expect(b.y + b.h).toBeCloseTo(100 + 90 * s0, 1);
  });

  test("s handle scales vertically only", async ({ page }) => {
    const sy = 130 / 90;
    await drag(page, { x: 230, y: 190 }, { x: 230, y: 230 });

    const g = await geom(page);
    const [a, b] = g.elements;
    expect(a.h).toBeCloseTo(60 * sy, 1);
    expect(a.w).toBeCloseTo(80, 0);
    expect(b.y).toBeCloseTo(100 + 10 * sy, 1);
    expect(b.h).toBeCloseTo(80 * sy, 1);
    expect(b.w).toBeCloseTo(100, 0);
  });

  test("text member scales its font size", async ({ page }) => {
    await selectTool(page, "7");
    await page.mouse.click(300, 105);
    await page.keyboard.type("Hi");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await drag(page, { x: 80, y: 30 }, { x: 380, y: 210 });
    await page.keyboard.press("Control+g");
    await page.mouse.click(140, 130);

    const before = await page.evaluate(() => {
      const els = window.__editor__.getSnapshot().doc.elements;
      const text = els.find((el) => el.type === "text");
      const rect = els.find((el) => el.type === "rectangle");
      return {
        fontSize: text.fontSize,
        rectW: rect.width,
        seX: Math.max(...els.map((el) => el.x + el.width)),
        seY: Math.max(...els.map((el) => el.y + el.height)),
      };
    });
    const s0 =
      1 + (40 / (before.seX - 100) + 30 / (before.seY - 100)) / 2;
    await drag(page, { x: before.seX, y: before.seY }, { x: before.seX + 40, y: before.seY + 30 });

    const g = await geom(page);
    const text = g.elements.find((el) => el.type === "text");
    const rect = g.elements.find((el) => el.type === "rectangle");
    expect(rect.w / before.rectW).toBeCloseTo(s0, 1);
    expect(text.fontSize).toBeCloseTo(Math.round(before.fontSize * s0), 0);
  });

  test("arrow member scales and keeps its bindings", async ({ page }) => {
    await selectTool(page, "6");
    await page.mouse.move(190, 130);
    await page.mouse.down();
    await page.mouse.move(250, 130, { steps: 5 });
    await page.mouse.up();
    await selectTool(page, "1");
    await drag(page, { x: 80, y: 30 }, { x: 380, y: 210 });
    await page.keyboard.press("Control+g");
    await page.mouse.click(140, 130);

    const s0 = (310 / 260 + 130 / 90) / 2;
    await drag(page, { x: 360, y: 190 }, { x: 410, y: 230 });

    const g = await geom(page);
    const arrow = g.elements.find((el) => el.type === "arrow");
    expect(arrow.x).toBeCloseTo(100 + 80 * s0, 1);
    expect(arrow.w).toBeCloseTo(80 * s0, 1);
    expect(arrow.h).toBeCloseTo(0, 1);
    expect([arrow.startBinding?.elementId, arrow.endBinding?.elementId]).toEqual(
      [g.selected[0], g.selected[1]],
    );
  });

  test("context child follows a resized group", async ({ page }) => {
    await selectTool(page, "2");
    await drag(page, { x: 560, y: 120 }, { x: 620, y: 160 });
    await selectTool(page, "8");
    await drag(page, { x: 520, y: 100 }, { x: 680, y: 200 });
    await selectTool(page, "2");
    await drag(page, { x: 300, y: 300 }, { x: 380, y: 360 });
    await selectTool(page, "1");
    await page.mouse.click(540, 180);
    await page.keyboard.down("Shift");
    await page.mouse.click(340, 330);
    await page.keyboard.up("Shift");
    await page.keyboard.press("Control+g");
    await page.mouse.click(540, 180);

    const init = await page.evaluate(() => {
      const els = window.__editor__.getSnapshot().doc.elements;
      const ctx = els.find((el) => el.type === "context");
      return {
        childId: ctx.childIds[0],
        seX: Math.max(...els.filter((el) => el.type !== "text").map((el) => el.x + el.width)),
        seY: Math.max(...els.filter((el) => el.type !== "text").map((el) => el.y + el.height)),
      };
    });
    expect(init.childId).toBeTruthy();
    const s0 = 1 + (40 / 380 + 40 / 260) / 2;
    await drag(page, { x: init.seX, y: init.seY }, { x: init.seX + 40, y: init.seY + 40 });

    const g = await geom(page);
    const ctx = g.elements.find((el) => el.type === "context");
    const child = g.elements.find((el) => el.id === init.childId);
    expect(ctx.x).toBeCloseTo(300 + 220 * s0, 1);
    expect(ctx.w).toBeCloseTo(160 * s0, 1);
    expect(child.x).toBeCloseTo(300 + 260 * s0, 1);
    expect(child.y).toBeCloseTo(100 + 20 * s0, 1);
    expect(child.w).toBeCloseTo(60 * s0, 1);
    expect(child.h).toBeCloseTo(40 * s0, 1);
  });

  test("mixed group scales every member kind and skips locked ones", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      const base = {
        groupId: "g1",
        strokeColor: "#3d4248",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 1,
        opacity: 100,
        locked: false,
      };
      (window as any).__editor__.importDocument({
        schemaVersion: 1,
        elements: [
          { ...base, id: "a", type: "rectangle", x: 100, y: 100, width: 80, height: 60 },
          { ...base, id: "b", type: "rectangle", x: 260, y: 110, width: 100, height: 80 },
          { ...base, id: "auto", type: "line", x: 100, y: 200, width: 60, height: 40, lineType: "auto", bendPoints: [{ x: 130, y: 240 }] },
          { ...base, id: "curve", type: "arrow", x: 200, y: 200, width: 50, height: 30, lineType: "curved", controlPoint: { x: 225, y: 240 }, startArrowhead: "none", endArrowhead: "arrow" },
          { ...base, id: "plain", type: "line", x: 260, y: 215, width: 80, height: 0 },
          { ...base, id: "lock", type: "rectangle", x: 420, y: 100, width: 50, height: 40, locked: true },
        ],
      });
    });
    await selectTool(page, "1");
    await page.mouse.click(140, 130);
    const sel = await page.evaluate(() => [
      ...(window as any).__editor__.getSnapshot().selectedIds,
    ]);
    expect(sel).toHaveLength(6);
    expect(sel).toContain("lock");

    const s0 = (296 / 260 + 200 / 140) / 2;
    await drag(page, { x: 360, y: 240 }, { x: 396, y: 300 });

    const g = await geom(page);
    const byId = Object.fromEntries(g.elements.map((el) => [el.id, el]));
    expect(byId["a"].w).toBeCloseTo(80 * s0, 1);
    expect(byId["b"].w).toBeCloseTo(100 * s0, 1);

    const curve = byId["curve"];
    expect(curve.x).toBeCloseTo(100 + 100 * s0, 1);
    expect(curve.w).toBeCloseTo(50 * s0, 1);
    expect(curve.controlPoint?.x).toBeCloseTo(100 + 125 * s0, 1);
    expect(curve.controlPoint?.y).toBeCloseTo(100 + 140 * s0, 1);

    const auto = byId["auto"];
    expect(auto.x).toBeCloseTo(100, 1);
    expect(auto.y).toBeCloseTo(100 + 100 * s0, 1);
    expect(auto.bendPoints?.[0].x).toBeCloseTo(100 + 30 * s0, 1);
    expect(auto.bendPoints?.[0].y).toBeCloseTo(100 + 140 * s0, 1);

    const plain = byId["plain"];
    expect(plain.x).toBeCloseTo(100 + 160 * s0, 1);
    expect(plain.w).toBeCloseTo(80 * s0, 1);

    expect(byId["lock"].x).toBe(420);
    expect(byId["lock"].y).toBe(100);
    expect(byId["lock"].w).toBe(50);
    expect(byId["lock"].h).toBe(40);
  });

  test("grabbing a group handle without dragging is not an undo step", async ({
    page,
  }) => {
    await page.mouse.move(360, 190);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.press("Control+z");

    const g = await geom(page);
    expect(g.elements.every((el) => !el.groupId)).toBe(true);
    expect(g.selected).toHaveLength(0);
    expect(g.elements.every((el) => el.w === 80 || el.w === 100)).toBe(true);
  });

  test("all-locked multi selection offers no group cursor", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const base = {
        groupId: "g1",
        strokeColor: "#3d4248",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 1,
        opacity: 100,
        locked: true,
      };
      (window as any).__editor__.importDocument({
        schemaVersion: 1,
        elements: [
          { ...base, id: "l1", type: "rectangle", x: 100, y: 100, width: 80, height: 60 },
          { ...base, id: "l2", type: "rectangle", x: 260, y: 110, width: 100, height: 80 },
        ],
      });
    });
    await selectTool(page, "1");
    await drag(page, { x: 80, y: 30 }, { x: 380, y: 210 });

    const cursor = await page.evaluate(() =>
      window.__editor__.cursorOverrideAt({ x: 360, y: 190 }),
    );
    expect(cursor).toBeNull();
  });
});
