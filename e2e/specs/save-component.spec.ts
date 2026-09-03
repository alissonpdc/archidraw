import { type Page, test, expect, open, drag, selectTool } from "../fixtures";

const RECT1 = { a: { x: 200, y: 150 }, b: { x: 320, y: 220 } };
const RECT2 = { a: { x: 360, y: 150 }, b: { x: 480, y: 220 } };

async function drawRect(
  page: Page,
  from: { x: number; y: number } = RECT1.a,
  to: { x: number; y: number } = RECT1.b,
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

async function rightClickMenu(page: Page, x: number, y: number) {
  await page.mouse.click(x, y, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
}

/** saved SVG of the last custom library item from localStorage */
async function savedCustomSvg(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("archidraw:customLibrary");
    const arr = raw ? JSON.parse(raw) : [];
    return arr[arr.length - 1].svg as string;
  });
}

test.describe("save components (context menu → SAVE)", () => {
  test("right-click on an element offers the SAVE section", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickMenu(page, 260, 185);

    await expect(page.getByTestId("context-menu-save-header")).toHaveText(
      "SAVE",
    );
    await expect(page.getByTestId("context-menu-add-library")).toHaveText(
      "Add to Library",
    );
    await expect(page.getByTestId("context-menu-download-svg")).toHaveText(
      "Download SVG Image",
    );
  });

  test("Add to Library creates a Custom group with custom-1 and inserts it", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);

    await rightClickMenu(page, 260, 185);
    await page.getByTestId("context-menu-add-library").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    await page.keyboard.press("l");
    await expect(page.locator(".library-panel")).toBeVisible();
    const custom = page.locator('[data-testid="library-custom"]');
    await custom.locator(".library-section-header").click();

    const tile = custom.locator('[data-component-id="custom-1"]');
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute("data-tip", "custom-1");

    await tile.click();
    const state = await editorState();
    expect(state.elementCount).toBe(2);
    const inserted = state.elements.find((e) => e.type === "component");
    expect(inserted?.componentId).toBe("custom-1");
  });

  test("component names increment: custom-1, custom-2", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickMenu(page, 260, 185);
    await page.getByTestId("context-menu-add-library").click();
    await rightClickMenu(page, 260, 185);
    await page.getByTestId("context-menu-add-library").click();

    await page.keyboard.press("l");
    const custom = page.locator('[data-testid="library-custom"]');
    await custom.locator(".library-section-header").click();
    await expect(custom.locator('[data-component-id="custom-1"]')).toBeVisible();
    await expect(custom.locator('[data-component-id="custom-2"]')).toBeVisible();
  });

  test("Download SVG Image downloads custom-N.svg with the selection", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);

    await rightClickMenu(page, 260, 185);
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("context-menu-download-svg").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^custom-\d+\.svg$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("<rect");
  });

  test("multi-selection right-click keeps the selection and saves both shapes", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, RECT1.a, RECT1.b);
    await drawRect(page, RECT2.a, RECT2.b);

    // marquee-select both rectangles
    await drag(page, { x: 140, y: 90 }, { x: 560, y: 290 });
    await expect
      .poll(async () => (await editorState()).selectedIds.length)
      .toBe(2);

    // right-click one of the selected rectangles: selection must survive
    await rightClickMenu(page, 260, 185);
    const ids = (await editorState()).selectedIds;
    expect(ids).toHaveLength(2);

    await page.getByTestId("context-menu-add-library").click();
    const svg = await savedCustomSvg(page);
    expect(svg).toContain("<svg");
    expect((svg.match(/<rect/g) ?? []).length).toBe(2);
  });

  test("custom library items persist after reload", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickMenu(page, 260, 185);
    await page.getByTestId("context-menu-add-library").click();

    await page.reload();
    await open(page);
    await page.keyboard.press("l");
    const custom = page.locator('[data-testid="library-custom"]');
    await custom.locator(".library-section-header").click();
    await expect(custom.locator('[data-component-id="custom-1"]')).toBeVisible();
  });

  test("saving a partially-selected group still saves the whole group", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 360, y: 150 }, { x: 480, y: 220 });
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+g");
    await page.keyboard.press("Escape");

    // marquee that only touches the FIRST member of the group (box right edge
    // 335 < the second member's left edge 360; 140,90 is empty canvas)
    await drag(page, { x: 140, y: 90 }, { x: 335, y: 240 });
    const partialIds = await page.evaluate(() => [
      ...(window as any).__editor__.getSnapshot().selectedIds,
    ]);
    expect(partialIds).toHaveLength(1);
    const sec = await page.evaluate((selId) => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === selId);
      return ed.getScreenPoint({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
    }, partialIds[0]);

    // right-click the selected group member and save: the WHOLE group goes in
    await rightClickMenu(page, sec.x, sec.y);
    await page.getByTestId("context-menu-add-library").click();

    const svg = await savedCustomSvg(page);
    expect((svg.match(/<rect/g) ?? []).length).toBe(2);
  });

  test("right-click on an overlapping unselected element still saves the whole selection", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 360, y: 150 }, { x: 480, y: 220 });

    // marquee-select both rectangles
    await drag(page, { x: 140, y: 90 }, { x: 560, y: 290 });
    await expect
      .poll(async () => (await page.evaluate(() => [...(window as any).__editor__.getSnapshot().selectedIds].length)))
      .toBe(2);

    // draw an arrow BELOW the rectangles (y=300, outside the marquee box that
    // ends at y=290). Drawing auto-selects the arrow.
    await selectTool(page, "6");
    await drag(page, { x: 340, y: 300 }, { x: 640, y: 300 });
    await selectTool(page, "1");
    await expect
      .poll(async () => (await page.evaluate(() => [...(window as any).__editor__.getSnapshot().selectedIds].length)))
      .toBe(1); // the arrow is the only selection now

    // re-select ONLY the two rectangles (the arrow stays below the box)
    await drag(page, { x: 140, y: 90 }, { x: 560, y: 290 });
    await expect
      .poll(async () => (await page.evaluate(() => [...(window as any).__editor__.getSnapshot().selectedIds].length)))
      .toBe(2);

    // right-click ON the arrow (NOT in the selection): the whole selection
    // must remain the save target — never collapse to the hit element
    await rightClickMenu(page, 640, 300);
    await page.getByTestId("context-menu-add-library").click();

    const svg = await savedCustomSvg(page);
    expect((svg.match(/<rect/g) ?? []).length).toBe(2);
    // the unselected arrow is NOT part of the selection, so it is not saved
    expect((svg.match(/<(line|path)/g) ?? []).length).toBe(0);
  });

  test("grouped multiselection right-click saves every member", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 360, y: 150 }, { x: 480, y: 220 });
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+g");

    const c0 = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return ed.getScreenPoint({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
    });

    await rightClickMenu(page, c0.x, c0.y);
    await page.getByTestId("context-menu-add-library").click();

    const svg = await savedCustomSvg(page);
    expect((svg.match(/<rect/g) ?? []).length).toBe(2);
  });
});