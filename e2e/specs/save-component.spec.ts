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

    // marquee that only touches the FIRST member of the group
    await drag(page, { x: 180, y: 130 }, { x: 340, y: 240 });
    await expect
      .poll(async () => (await page.evaluate(() => [...(window as any).__editor__.getSnapshot().selectedIds].length)))
      .toBe(1);
    const ids = await page.evaluate(() => [...(window as any).__editor__.getSnapshot().selectedIds]);
    const sec = await page.evaluate((selId) => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === selId);
      return ed.getScreenPoint({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
    }, ids[0]);

    // right-click the selected group member and save: the WHOLE group goes in
    await rightClickMenu(page, sec.x, sec.y);
    await page.getByTestId("context-menu-add-library").click();

    const svg = await savedCustomSvg(page);
    expect((svg.match(/<rect/g) ?? []).length).toBe(2);
  });
});