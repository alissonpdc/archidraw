import { test, expect, drag, open, selectTool, pressPasteText } from "../fixtures";

type DocEl = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rings?: { x: number; y: number }[][];
  fillStyle?: string;
};

async function docElements(page: import("@playwright/test").Page): Promise<DocEl[]> {
  return page.evaluate(() =>
    (window as any).__editor__.getSnapshot().doc.elements.map((el: DocEl) => ({
      ...el,
    })),
  );
}

async function rect(
  page: import("@playwright/test").Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await selectTool(page, "2");
  await drag(page, from, to);
}

/** A = 100..300 square, B = 200..400 square (B drawn last → topmost) */
async function twoOverlapping(page: import("@playwright/test").Page) {
  await rect(page, { x: 100, y: 100 }, { x: 300, y: 300 });
  await rect(page, { x: 200, y: 200 }, { x: 400, y: 400 });
  await page.keyboard.press("Control+a");
}

async function openLayers(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Layers" }).click();
}

async function applyOp(page: import("@playwright/test").Page, op: string) {
  await openLayers(page);
  await page.getByRole("button", { name: `Boolean ${op}` }).click();
}

function ringBounds(rings: { x: number; y: number }[][]) {
  const pts = rings.flat();
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

test.describe("boolean shape ops", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("union joins two rectangles into a single polygon", async ({ page, editorState }) => {
    await twoOverlapping(page);
    await applyOp(page, "union");

    const els = await docElements(page);
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("polygon");
    expect(els[0].x).toBeCloseTo(100, 3);
    expect(els[0].y).toBeCloseTo(100, 3);
    expect(els[0].width).toBeCloseTo(300, 3);
    expect(els[0].height).toBeCloseTo(300, 3);
    expect(els[0].rings).toHaveLength(1);
    expect(els[0].rings![0].length).toBe(8);
    const b = ringBounds(els[0].rings!);
    expect(b.x).toBeCloseTo(0, 3);
    expect(b.y).toBeCloseTo(0, 3);
    expect(b.width).toBeCloseTo(300, 3);
    expect(b.height).toBeCloseTo(300, 3);

    const s = await editorState();
    expect(s.selectedIds).toEqual([els[0].id]);
  });

  test("subtract cuts the bottom shape with the topmost one", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "subtract");

    const els = await docElements(page);
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("polygon");
    // the cutter (B) removes A's bottom-right quadrant
    expect(els[0].x).toBeCloseTo(100, 3);
    expect(els[0].y).toBeCloseTo(100, 3);
    expect(els[0].width).toBeCloseTo(200, 3);
    expect(els[0].height).toBeCloseTo(200, 3);
    expect(els[0].rings).toHaveLength(1);
    expect(els[0].rings![0].length).toBe(6);
  });

  test("intersect keeps only the common area", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "intersect");

    const els = await docElements(page);
    expect(els).toHaveLength(1);
    expect(els[0].x).toBeCloseTo(200, 3);
    expect(els[0].y).toBeCloseTo(200, 3);
    expect(els[0].width).toBeCloseTo(100, 3);
    expect(els[0].height).toBeCloseTo(100, 3);
    expect(els[0].rings![0].length).toBe(4);
  });

  test("crop masks everything below with the topmost shape", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "crop");

    const els = await docElements(page);
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("polygon");
    expect(els[0].x).toBeCloseTo(200, 3);
    expect(els[0].y).toBeCloseTo(200, 3);
    expect(els[0].width).toBeCloseTo(100, 3);
    expect(els[0].height).toBeCloseTo(100, 3);
  });

  test("a fully contained cutter leaves a hole that hit-test skips", async ({ page, editorState }) => {
    await rect(page, { x: 100, y: 100 }, { x: 300, y: 300 });
    await rect(page, { x: 150, y: 150 }, { x: 250, y: 250 });
    await page.keyboard.press("Control+a");
    await applyOp(page, "subtract");

    const els = await docElements(page);
    expect(els).toHaveLength(1);
    expect(els[0].rings).toHaveLength(2);

    // center of the hole (200,200) clears the selection
    await page.mouse.click(200, 200);
    let s = await editorState();
    expect(s.selectedIds).toHaveLength(0);

    // a point on the solid ring selects the polygon again
    await page.mouse.click(120, 120);
    s = await editorState();
    expect(s.selectedIds).toEqual([els[0].id]);
  });

  test("boolean buttons are disabled for invalid selections", async ({ page }) => {
    await rect(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await page.keyboard.press("Control+a");
    await openLayers(page);
    for (const op of ["union", "subtract", "intersect", "crop"]) {
      await expect(page.getByRole("button", { name: `Boolean ${op}` })).toBeDisabled();
    }

    // a line is not a closed shape: the whole selection becomes ineligible
    await selectTool(page, "5");
    await drag(page, { x: 260, y: 260 }, { x: 360, y: 300 });
    await page.keyboard.press("Control+a");
    await openLayers(page);
    await expect(page.getByRole("button", { name: "Boolean union" })).toBeDisabled();
  });

  test("undo restores the operand shapes", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "union");
    expect((await docElements(page)).map((el) => el.type)).toEqual(["polygon"]);

    await page.keyboard.press("Control+z");
    const els = await docElements(page);
    expect(els.map((el) => el.type)).toEqual(["rectangle", "rectangle"]);
  });

  test("a polygon is a valid operand for a later op", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "union");

    await rect(page, { x: 350, y: 350 }, { x: 450, y: 450 });
    await page.keyboard.press("Control+a");
    await applyOp(page, "union");

    const els = await docElements(page);
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("polygon");
    expect(els[0].width).toBeCloseTo(350, 3);
    expect(els[0].height).toBeCloseTo(350, 3);
  });

  test("dragging the polygon moves its rings with the box", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "union");

    await drag(page, { x: 250, y: 150 }, { x: 310, y: 190 });

    const els = await docElements(page);
    expect(els[0].x).toBeCloseTo(160, 3);
    expect(els[0].y).toBeCloseTo(140, 3);
    const b = ringBounds(els[0].rings!);
    expect(b.width).toBeCloseTo(els[0].width, 3);
    expect(b.height).toBeCloseTo(els[0].height, 3);
  });

  test("resizing the polygon scales its rings", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "union");

    // bottom-right handle of the 100..400 box stretched by 1.5
    await drag(page, { x: 400, y: 400 }, { x: 550, y: 550 });

    const els = await docElements(page);
    expect(els[0].width).toBeCloseTo(450, 3);
    expect(els[0].height).toBeCloseTo(450, 3);
    const b = ringBounds(els[0].rings!);
    expect(b.width).toBeCloseTo(450, 3);
    expect(b.height).toBeCloseTo(450, 3);
  });

  test("context membership follows the combined result", async ({ page }) => {
    await selectTool(page, "8");
    await drag(page, { x: 300, y: 80 }, { x: 600, y: 340 });
    await rect(page, { x: 330, y: 110 }, { x: 390, y: 170 });
    await rect(page, { x: 370, y: 150 }, { x: 460, y: 240 });
    await selectTool(page, "1");

    await page.mouse.click(350, 130);
    await page.keyboard.down("Shift");
    await page.mouse.click(440, 230);
    await page.keyboard.up("Shift");
    await applyOp(page, "union");

    const els = await docElements(page);
    const context = els.find((el) => el.type === "context") as unknown as {
      childIds: string[];
    };
    const polygon = els.find((el) => el.type === "polygon")!;
    expect(context.childIds).toContain(polygon.id);
    expect(context.childIds).toHaveLength(1);
  });

  test("diamond and ellipse are valid operands", async ({ page }) => {
    await rect(page, { x: 320, y: 100 }, { x: 400, y: 180 });
    await selectTool(page, "3");
    await drag(page, { x: 360, y: 160 }, { x: 460, y: 260 });
    await selectTool(page, "4");
    await drag(page, { x: 420, y: 220 }, { x: 520, y: 320 });
    await page.keyboard.press("Control+a");
    await applyOp(page, "union");

    const els = await docElements(page);
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("polygon");
    expect(els[0].x).toBeCloseTo(320, 3);
    expect(els[0].y).toBeCloseTo(100, 3);
    expect(els[0].width).toBeCloseTo(200, 3);
    expect(els[0].height).toBeCloseTo(220, 3);
  });

  test("rotated shapes combine in their rotated frame", async ({ page }) => {
    await rect(page, { x: 320, y: 120 }, { x: 420, y: 220 });
    await rect(page, { x: 380, y: 160 }, { x: 480, y: 260 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const first = ed.getSnapshot().doc.elements[0].id;
      ed.updateElements([first], { angle: Math.PI / 4 });
    });
    await page.keyboard.press("Control+a");
    await applyOp(page, "union");

    const els = await docElements(page);
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("polygon");
    // the rotated operand pokes out well past its unrotated 320..420 box
    expect(els[0].x).toBeLessThan(310);
    expect(els[0].width).toBeGreaterThan(120);
  });

  test("locked shapes disqualify the selection", async ({ page }) => {
    await twoOverlapping(page);
    await page.keyboard.press("Control+Shift+l");
    await openLayers(page);
    await expect(page.getByRole("button", { name: "Boolean union" })).toBeDisabled();
  });

  test("disjoint intersect leaves nothing on the canvas", async ({ page }) => {
    await rect(page, { x: 320, y: 120 }, { x: 380, y: 180 });
    await rect(page, { x: 500, y: 300 }, { x: 560, y: 360 });
    await page.keyboard.press("Control+a");
    await applyOp(page, "intersect");
    expect(await docElements(page)).toHaveLength(0);
  });

  test("an invalid selection throws instead of mutating the document", async ({ page }) => {
    await rect(page, { x: 320, y: 120 }, { x: 380, y: 180 });
    await page.keyboard.press("Control+a");
    const message = await page.evaluate(() => {
      try {
        (window as any).__editor__.applyBooleanOp("union");
        return "no-throw";
      } catch (error) {
        return (error as Error).message;
      }
    });
    expect(message).toContain(">= 2 unlocked closed shapes");
    expect(await docElements(page)).toHaveLength(1);
  });

  test("an edge binds to the polygon outline", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "union");
    const polygonId = (await docElements(page))[0].id;
    await rect(page, { x: 460, y: 140 }, { x: 560, y: 240 });

    await selectTool(page, "6");
    await drag(page, { x: 250, y: 150 }, { x: 460, y: 190 });

    const els = await docElements(page);
    const arrow = els.find((el) => el.type === "arrow") as unknown as {
      startBinding?: { elementId: string };
    };
    expect(arrow.startBinding?.elementId).toBe(polygonId);
  });

  test("hachure fill renders on the polygon", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "union");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.updateElements([id], { fillStyle: "cross-hachure" });
    });
    await expect
      .poll(async () => (await docElements(page))[0].fillStyle)
      .toBe("cross-hachure");
    // a frame goes by: the hachure clip runs over the rings without errors
    await page.waitForTimeout(80);
  });

  test("Download as SVG emits the polygon path", async ({ page }) => {
    await twoOverlapping(page);
    await applyOp(page, "union");

    const exportSvg = async () => {
      await page.mouse.click(250, 150, { button: "right" });
      const svgPromise = page.waitForEvent("download");
      await page.getByTestId("context-menu-download").hover();
      await page.getByTestId("context-menu-download-svg").click();
      const download = await svgPromise;
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks).toString("utf-8");
    };

    const svg = await exportSvg();
    expect(svg).toContain("<path");
    expect(svg).toContain('fill-rule="evenodd"');

    // hachure + clean stroke exports through the clipPath/solid outline path
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.updateElements([id], { fillStyle: "hachure", roughness: 0 });
    });
    const hatchSvg = await exportSvg();
    expect(hatchSvg).toContain("clipPath");
    expect(hatchSvg).toContain('fill-rule="evenodd"');
  });

  test("polygon round-trips through the clipboard JSON", async ({ page }) => {
    const payload = {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        {
          id: "el_paste_poly",
          type: "polygon",
          x: 120,
          y: 120,
          width: 80,
          height: 60,
          strokeColor: "#3d4248",
          backgroundColor: "#dfe0e2",
          rings: [
            [
              { x: 0, y: 0 },
              { x: 80, y: 0 },
              { x: 80, y: 60 },
              { x: 0, y: 60 },
            ],
          ],
        },
      ],
    };
    await pressPasteText(page, JSON.stringify(payload));

    const els = await docElements(page);
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("polygon");
    expect(els[0].rings).toHaveLength(1);
    expect(els[0].rings![0]).toHaveLength(4);
  });

  test("a polygon without rings is rejected on paste", async ({ page }) => {
    const payload = {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        {
          id: "el_bad_poly",
          type: "polygon",
          x: 10,
          y: 10,
          width: 80,
          height: 60,
        },
      ],
    };
    await pressPasteText(page, JSON.stringify(payload));
    expect(await docElements(page)).toHaveLength(0);
  });
});
