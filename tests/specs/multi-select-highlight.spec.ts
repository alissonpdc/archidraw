import { test, expect, drag, selectTool, open, pressPasteText, type Page } from "../fixtures";

async function createRects(page: Page) {
  await selectTool(page, "2");
  await drag(page, { x: 100, y: 100 }, { x: 180, y: 160 });
  await drag(page, { x: 260, y: 100 }, { x: 340, y: 160 });
  await selectTool(page, "1");
}

/** one getImageData readback per call (batched strip scan) */
function scanPage(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    // single readback: y 110..150 covers all sampled rows
    const y0 = 110;
    const h = 40;
    const data = ctx.getImageData(0, y0, canvas.width, h).data;
    const pick = (x: number, y: number) => {
      const o = ((Math.round(y * dpr) - y0 * dpr) * canvas.width + Math.round(x * dpr)) * 4;
      return { x, y, r: data[o], g: data[o + 1], b: data[o + 2] };
    };
    const rows = [115, 140, 145];
    return rows.map((y) => ({
      y,
      left: Array.from({ length: 10 }, (_, i) => pick(98 + i, y)),
      right: Array.from({ length: 10 }, (_, i) => pick(256 + i, y)),
    }));
  });
}

const isGreen = (px: { r: number; g: number; b: number }) =>
  px.g > px.r + 60 && px.g > px.b + 60;

/**
 * one getImageData readback over the whole multi-selection area; returns which
 * expected outline segments carry selection-colored pixels.
 */
function probeOutlines(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const x0 = Math.round(90 * dpr);
    const y0 = Math.round(90 * dpr);
    const w = Math.round(260 * dpr);
    const h = Math.round(80 * dpr);
    const data = ctx.getImageData(x0, y0, w, h).data;
    const green = (x: number, y: number) => {
      const o =
        ((Math.round(y * dpr) - y0) * w + (Math.round(x * dpr) - x0)) * 4;
      return (
        data[o + 3] > 60 &&
        data[o + 1] > data[o] + 60 &&
        data[o + 1] > data[o + 2] + 60
      );
    };
    const row = (y: number, x1: number, x2: number) => {
      for (let x = x1; x <= x2; x++) if (green(x, y)) return true;
      return false;
    };
    const col = (x: number, y1: number, y2: number) => {
      for (let y = y1; y <= y2; y++) if (green(x, y)) return true;
      return false;
    };
    return {
      // per-member dashed boxes, 3px off the elements' own bounds
      leftTopEdge: row(97, 105, 175),
      rightTopEdge: row(97, 265, 335),
      leftLeftEdge: col(97, 110, 150),
      rightRightEdge: col(343, 110, 125),
      // the members' own stroke (no halo on the outline)
      leftStrokeRow: row(100, 105, 175),
      // group outline: a further 3px out, so it never coincides with the
      // members' own boxes
      groupTopGap: row(94, 190, 212),
      groupBottomGap: row(166, 190, 212),
      groupLeftEdge: col(94, 110, 125),
      groupRightEdge: col(346, 110, 125),
      // the members' box lines stay clear of the group frame in the gap
      memberLineGap: row(97, 190, 212),
      rawBoundsGap: row(100, 190, 212),
    };
  });
}

/** one readback: counts highlight-colored pixels across the pasted cluster */
function countGreen(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const x0 = 200;
    const y0 = 100;
    const data = ctx.getImageData(x0 * dpr, y0 * dpr, 600 * dpr, 340 * dpr).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 60 && data[i + 1] > data[i] + 60 && data[i + 1] > data[i + 2] + 60) {
        count++;
      }
    }
    return count;
  });
}

test.describe("multi-selection outline", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const set = () => {
        document.documentElement.style.setProperty("--selection-color", "#00ff00");
      };
      try {
        set();
      } catch {
        document.addEventListener("DOMContentLoaded", set);
      }
    });
    await open(page);
    await createRects(page);
  });

  test("every selected member gets its own dashed selection box", async ({
    page,
    editorState,
  }) => {
    await drag(page, { x: 80, y: 30 }, { x: 360, y: 180 });
    const s = await editorState();
    expect(s.selectedIds).toHaveLength(2);

    // the dashed box sits 3px off each member's visual bounds
    const p = await probeOutlines(page);
    expect(p.leftTopEdge, "left member top box edge").toBe(true);
    expect(p.rightTopEdge, "right member top box edge").toBe(true);
    expect(p.leftLeftEdge, "left member left box edge").toBe(true);
    expect(p.rightRightEdge, "right member right box edge").toBe(true);

    // the member's own stroke is NOT tinted anymore (no halo on the outline)
    expect(p.leftStrokeRow, "left member stroke clean").toBe(false);
  });

  test("group outline stays clear of the members' own boxes", async ({
    page,
  }) => {
    await drag(page, { x: 80, y: 30 }, { x: 360, y: 180 });

    const p = await probeOutlines(page);
    // the group frame runs through the gap between members, 3px outside the
    // members' own boxes on every side
    expect(p.groupTopGap, "group top edge in the gap").toBe(true);
    expect(p.groupBottomGap, "group bottom edge in the gap").toBe(true);
    expect(p.groupLeftEdge, "group left edge").toBe(true);
    expect(p.groupRightEdge, "group right edge").toBe(true);
    // neither the members' box lines nor the raw element bounds are there
    expect(p.memberLineGap, "members' box lines clear in the gap").toBe(false);
    expect(p.rawBoundsGap, "no outline at the raw element bounds").toBe(false);
  });

  test("single selection keeps the plain element stroke (no halo)", async ({
    page,
  }) => {
    await page.mouse.click(140, 130);
    const rows = await scanPage(page);
    const { left } = rows[0];
    expect(left.some(isGreen)).toBe(false);
    expect(left.some((p) => p.r < 70 && p.g < 70 && p.b < 70)).toBe(true);
  });

  test("marquee with no member selected afterwards clears highlight", async ({
    page,
  }) => {
    await drag(page, { x: 500, y: 30 }, { x: 700, y: 180 });
    const rows = await scanPage(page);
    expect(rows[0].left.every((p) => !isGreen(p))).toBe(true);
  });

  test("every member kind gets its own outline highlighted", async ({
    page,
    editorState,
  }) => {
    // one stroke-covered element of every kind pasted at once; positions
    // avoid the two default rects created in beforeEach
    await page.keyboard.press("Escape");
    await pressPasteText(
      page,
      JSON.stringify({
        schemaVersion: 1,
        type: "archidraw/elements",
        elements: [
          { id: "el_msx_rect", type: "rectangle", x: 230, y: 120, width: 80, height: 60, angle: 0.3 },
          { id: "el_msx_diamond", type: "diamond", x: 230, y: 200, width: 60, height: 60 },
          { id: "el_msx_ellipse", type: "ellipse", x: 230, y: 290, width: 80, height: 50 },
          { id: "el_msx_component", type: "component", x: 420, y: 120, width: 60, height: 60, componentId: "" },
          { id: "el_msx_context", type: "context", x: 420, y: 220, width: 100, height: 80, label: "ctx", childIds: [] },
          { id: "el_msx_line", type: "line", x: 340, y: 150, width: 80, height: 40, lineType: "straight" },
          { id: "el_msx_arrow", type: "arrow", x: 340, y: 240, width: 60, height: 60, lineType: "curved", endArrowhead: "arrow" },
          { id: "el_msx_auto", type: "arrow", x: 540, y: 330, width: 80, height: 30, lineType: "auto", bendPoints: [{ x: 580, y: 340 }] },
          { id: "el_msx_text", type: "text", x: 540, y: 130, width: 100, height: 60, text: "AB\n\nCD", textAlign: "center" },
          { id: "el_msx_text2", type: "text", x: 650, y: 220, width: 100, height: 60, text: "EF\n\nGG", textAlign: "right" },
          { id: "el_msx_poly", type: "polygon", x: 540, y: 230, width: 80, height: 60, rings: [[{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 60 }, { x: 0, y: 60 }]] },
        ],
      }),
    );

    const s = await editorState();
    // paste rewrites ids — assert membership via type + the rotated rect's angle
    for (const t of ["diamond", "ellipse", "component", "context", "line", "arrow", "text", "polygon"]) {
      const member = s.elements.find((el) => el.type === t && s.selectedIds.includes(el.id));
      expect(member, `member kind ${t} selected`).toBeDefined();
    }
    const rotated = s.elements.find((el) => el.type === "rectangle" && (el.angle ?? 0) > 0.2);
    expect(rotated, "rotated rect member selected").toBeDefined();

    // rebuild all cached stroke paths in sketch mode to also exercise the
    // rough branches, then re-check the outline highlight still draws
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const snap = ed.getSnapshot();
      ed.updateElements([...snap.selectedIds], { roughness: 2, borderRadius: 12 });
    });
    await page.waitForTimeout(100);

    const green = await countGreen(page);
    expect(green).toBeGreaterThan(0);
  });});
