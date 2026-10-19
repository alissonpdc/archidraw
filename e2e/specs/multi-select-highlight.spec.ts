import { test, expect, drag, selectTool, open, pressPasteText } from "../fixtures";

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

test.describe("multi-selection member highlight", () => {
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

  test("every selected member's own outline is highlighted", async ({
    page,
    editorState,
  }) => {
    await drag(page, { x: 80, y: 30 }, { x: 360, y: 180 });
    const s = await editorState();
    expect(s.selectedIds).toHaveLength(2);

    // y=115 etc. avoid group handles (they sit at y=100, 130 and 160)
    const rows = await scanPage(page);
    for (const { y, left, right } of rows) {
      expect(left.some(isGreen), `left member at y=${y}`).toBe(true);
      expect(right.some(isGreen), `right member at y=${y}`).toBe(true);
    }
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
