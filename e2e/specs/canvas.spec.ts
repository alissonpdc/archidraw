import {
  test,
  expect,
  drag,
  selectTool,
  open,
  pressPaste,
} from "../fixtures";

async function createRect(
  page: import("@playwright/test").Page,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  await selectTool(page, "r");
  await drag(page, { x: x1, y: y1 }, { x: x2, y: y2 });
}

test.describe("resize handles", () => {
  test("corner handle keeps aspect ratio", async ({ page }) => {
    await open(page);
    await createRect(page, 100, 100, 220, 180);
    await selectTool(page, "v");

    // grab SE handle at (220,180) and pull out diagonally
    await drag(page, { x: 220, y: 180 }, { x: 260, y: 215 });

    const el = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return { w: s.doc.elements[0].width, h: s.doc.elements[0].height };
    });
    // proportional: original ratio 120/80 = 1.5 is preserved
    expect(el.w / el.h).toBeCloseTo(1.5, 1);
    expect(el.w).toBeGreaterThan(120);
  });

  test("edge handle resizes on a single axis only", async ({ page }) => {
    await open(page);
    await createRect(page, 100, 100, 220, 180);
    await selectTool(page, "v");

    // grab E handle (220,140) and pull right+down: width grows, height unchanged
    await drag(page, { x: 220, y: 140 }, { x: 280, y: 200 });

    const el = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return {
        w: s.doc.elements[0].width,
        h: s.doc.elements[0].height,
        y: s.doc.elements[0].y,
      };
    });
    expect(el.w).toBeCloseTo(180, 0);
    expect(el.h).toBeCloseTo(80, 0);
    expect(el.y).toBeCloseTo(100, 0);
  });

  test("edge handle on library component keeps aspect ratio", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => window.__editor__.insertComponent("sqs"));

    const before = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      const el = s.doc.elements[0];
      return {
        w: el.width,
        h: el.height,
        x: el.x,
        handleX: (el.x + el.width) * s.camera.zoom + s.camera.scrollX,
        handleY: (el.y + el.height / 2) * s.camera.zoom + s.camera.scrollY,
      };
    });

    // grab E handle and pull right+down: both axes follow the original ratio
    await drag(
      page,
      { x: before.handleX, y: before.handleY },
      { x: before.handleX + 40, y: before.handleY + 30 },
    );

    const after = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      const el = s.doc.elements[0];
      return { w: el.width, h: el.height, x: el.x };
    });
    expect(after.w).toBeCloseTo(before.w + 40, 0);
    expect(after.h / after.w).toBeCloseTo(before.h / before.w, 1);
    expect(after.x).toBeCloseTo(before.x, 0); // left edge stays anchored
  });

  test("resize is undoable", async ({ page }) => {
    await open(page);
    await createRect(page, 100, 100, 220, 180);
    await selectTool(page, "v");
    await drag(page, { x: 220, y: 180 }, { x: 260, y: 180 });
    await page.keyboard.press("Control+z");

    const el = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return { w: s.doc.elements[0].width };
    });
    expect(el.w).toBe(120);
  });
});

test.describe("snap guides", () => {
  test("moving near an aligned edge snaps into place", async ({ page }) => {
    await open(page);
    // A placed right of the properties panel strip (x < ~200), which
    // overlays the left side of the canvas while a shape is selected
    await createRect(page, 220, 100, 340, 180); // A: centerY 140
    await createRect(page, 300, 300, 420, 400); // B: centerY 350
    await selectTool(page, "v");
    await page.mouse.click(280, 140); // select A

    // drop A so its centerY lands 3px above B's (within 4px snap tolerance)
    await drag(page, { x: 280, y: 140 }, { x: 280, y: 347 });

    const a = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return s.doc.elements[0];
    });
    // snapped so that centerY === 350 -> y = 310
    expect(a.y).toBeCloseTo(310, 0);
  });

  test("moving far from alignment does not snap", async ({ page }) => {
    await open(page);
    await createRect(page, 220, 100, 340, 180);
    await createRect(page, 300, 300, 420, 400);
    await selectTool(page, "v");
    await page.mouse.click(280, 140);

    await drag(page, { x: 280, y: 140 }, { x: 280, y: 500 });

    const a = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return s.doc.elements[0];
    });
    expect(a.y).toBeCloseTo(460, 0); // exact delta, no snapping
  });
});

test.describe("labels", () => {
  test("double-click edits shape label", async ({ page }) => {
    await open(page);
    // right of the properties panel strip (see snap guides note)
    await createRect(page, 220, 100, 340, 180);
    await selectTool(page, "v");

    await page.mouse.dblclick(280, 140);
    const overlay = page.locator(".label-overlay");
    await expect(overlay).toBeVisible();

    await page.keyboard.type("API Gateway");
    await page.keyboard.press("Escape");

    const label = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return (s.doc.elements[0] as { label?: string }).label;
    });
    expect(label).toBe("API Gateway");
  });

  test("emptying label removes it", async ({ page }) => {
    await open(page);
    // right of the properties panel strip (see snap guides note)
    await createRect(page, 220, 100, 340, 180);
    await selectTool(page, "v");
    await page.mouse.dblclick(280, 140);
    await page.keyboard.type("Temp");
    await page.keyboard.press("Escape");

    await page.mouse.dblclick(280, 140);
    const overlay = page.locator(".label-overlay");
    await expect(overlay).toBeVisible();
    await overlay.fill(""); // clear existing label
    await page.keyboard.press("Escape");

    const label = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return (s.doc.elements[0] as { label?: string }).label;
    });
    expect(label).toBeUndefined();
  });

  test("double-click on empty canvas creates free text", async ({ page }) => {
    await open(page);
    await selectTool(page, "v");
    await page.mouse.dblclick(600, 600);
    const overlay = page.locator(".text-overlay:not(.label-overlay)");
    await expect(overlay).toBeVisible();
    await page.keyboard.type("nota");
    await page.keyboard.press("Escape");

    const els = await page.evaluate(() => {
      const s = window.__editor__.getSnapshot();
      return s.doc.elements.map((e) => e.type);
    });
    expect(els).toEqual(["text"]);
  });
});

test.describe("clipboard", () => {
  test("copy/paste duplicates elements", async ({ page }) => {
    await open(page);
    await createRect(page, 100, 100, 220, 180);
    await selectTool(page, "v");
    await page.mouse.click(150, 140);

    await page.keyboard.press("Control+c");
    await pressPaste(page);

    // paste interno agora é tratado no evento `paste` nativo (Meta+V no menu
    // macOS; em headless o Control+V não dispara o evento), então aguarda o
    // elemento duplicar
    await expect
      .poll(() =>
        page.evaluate(() => window.__editor__.getSnapshot().doc.elements.length),
      )
      .toBe(2);

    await pressPaste(page);
    await expect
      .poll(() =>
        page.evaluate(() => window.__editor__.getSnapshot().doc.elements.length),
      )
      .toBe(3);
  });

  test("cut removes and paste restores", async ({ page }) => {
    await open(page);
    await createRect(page, 100, 100, 220, 180);
    await selectTool(page, "v");
    await page.mouse.click(150, 140);

    await page.keyboard.press("Control+x");
    let n = await page.evaluate(() => window.__editor__.getSnapshot().doc.elements.length);
    expect(n).toBe(0);

    await pressPaste(page);
    await expect
      .poll(() =>
        page.evaluate(() => window.__editor__.getSnapshot().doc.elements.length),
      )
      .toBe(1);
  });

  test("paste works across tabs", async ({ page }) => {
    await open(page);
    await createRect(page, 100, 100, 220, 180);
    await selectTool(page, "v");
    await page.mouse.click(150, 140);
    await page.keyboard.press("Control+c");

    await page.click('[data-testid="tab-add"]'); // new empty tab
    await pressPaste(page);

    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__editor__.getSnapshot().doc.elements.length,
        ),
      )
      .toBe(1);
  });
});

test.describe("fit to content", () => {
  test("Shift+1 frames all content", async ({ page }) => {
    await open(page);
    await createRect(page, 100, 100, 220, 180);
    await createRect(page, 900, 700, 1020, 780);

    // mess up the view
    await page.keyboard.down("Space");
    await drag(page, { x: 640, y: 400 }, { x: 200, y: 200 });
    await page.keyboard.up("Space");
    await page.mouse.move(640, 400);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -400);
    await page.keyboard.up("Control");

    await page.keyboard.press("Shift+!"); // Shift+1

    const fits = await page.evaluate(() => {
      const cam = window.__editor__.getSnapshot().camera;
      const els = window.__editor__.getSnapshot().doc.elements;
      return els.every((el) => {
        const sx = el.x * cam.zoom + cam.scrollX;
        const sy = el.y * cam.zoom + cam.scrollY;
        const ex = (el.x + el.width) * cam.zoom + cam.scrollX;
        const ey = (el.y + el.height) * cam.zoom + cam.scrollY;
        return (
          sx >= 0 && sy >= 0 && ex <= window.innerWidth && ey <= window.innerHeight
        );
      });
    });
    expect(fits).toBe(true);
  });

  test("fit button in zoom widget does the same", async ({ page }) => {
    await open(page);
    await createRect(page, 100, 100, 220, 180);
    await createRect(page, 900, 700, 1020, 780);

    await page.getByRole("button", { name: "Fit content" }).click();

    const fits = await page.evaluate(() => {
      const cam = window.__editor__.getSnapshot().camera;
      const els = window.__editor__.getSnapshot().doc.elements;
      return els.every((el) => {
        const sx = el.x * cam.zoom + cam.scrollX;
        const sy = el.y * cam.zoom + cam.scrollY;
        const ex = (el.x + el.width) * cam.zoom + cam.scrollX;
        const ey = (el.y + el.height) * cam.zoom + cam.scrollY;
        return (
          sx >= 0 && sy >= 0 && ex <= window.innerWidth && ey <= window.innerHeight
        );
      });
    });
    expect(fits).toBe(true);
  });
});
