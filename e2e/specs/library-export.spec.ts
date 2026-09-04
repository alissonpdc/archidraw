import { type Page, test, expect, open, drag, selectTool } from "../fixtures";

async function drawRect(
  page: Page,
  from: { x: number; y: number } = { x: 200, y: 150 },
  to: { x: number; y: number } = { x: 320, y: 220 },
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

async function drawEllipse(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await selectTool(page, "4");
  await drag(page, from, to);
  await selectTool(page, "1");
}

async function rightClickMenu(page: Page, x: number, y: number) {
  await page.mouse.click(x, y, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
}

async function openLibrary(page: Page) {
  await open(page);
  await page.keyboard.press("l");
  await expect(page.locator(".library-panel")).toBeVisible();
}

async function saveToLibrary(page: Page) {
  await rightClickMenu(page, 260, 185);
  await page.getByTestId("context-menu-add-library").click();
  await expect(page.getByTestId("context-menu")).toHaveCount(0);
}

test.describe("custom library export (.archidrawlib)", () => {
  test("export button is visible when custom items exist", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await saveToLibrary(page);

    await page.keyboard.press("l");
    await expect(page.locator(".library-panel")).toBeVisible();
    await expect(page.locator('[data-testid="library-export"]')).toBeVisible();
  });

  test("export button is hidden when custom library is empty", async ({
    page,
  }) => {
    await openLibrary(page);
    await expect(page.locator('[data-testid="library-export"]')).toHaveCount(0);
  });

  test("export downloads a .archidrawlib file with correct format", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await saveToLibrary(page);

    await openLibrary(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-testid="library-export"]').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/custom-library\.archidrawlib$/);
    const path = await download.path();
    const fs = await import("fs");
    const content = fs.readFileSync(path!, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.type).toBe("archidrawlib");
    expect(parsed.version).toBe(2);
    expect(Array.isArray(parsed.libraryItems)).toBe(true);
    expect(parsed.libraryItems.length).toBe(1);
    expect(parsed.libraryItems[0].name).toBe("custom-1");
    expect(Array.isArray(parsed.libraryItems[0].elements)).toBe(true);
    expect(parsed.libraryItems[0].elements.length).toBe(1);
    expect(parsed.libraryItems[0].elements[0].type).toBe("rectangle");
  });

  test("exported file can be re-imported and renders on canvas", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await saveToLibrary(page);

    await openLibrary(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-testid="library-export"]').click();
    const download = await downloadPromise;
    const path = await download.path();
    const fs = await import("fs");
    const content = fs.readFileSync(path!, "utf-8");

    // import the exported file
    await page.locator('[data-testid="library-import"]').click();
    await page.locator(".library-import-input").setInputFiles({
      name: "custom-library.archidrawlib",
      mimeType: "application/json",
      buffer: Buffer.from(content, "utf-8"),
    });

    // a new imported group appears (auto-expanded on import)
    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group).toHaveCount(1);

    // click the imported item to insert it (group is already open)
    await group.locator(".library-tile").click();

    const state = await editorState();
    expect(state.elementCount).toBe(2);
    const imported = state.elements.find((e) => e.type === "component");
    expect(imported).toBeTruthy();
  });

  test("export includes all custom items", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await saveToLibrary(page);
    await drawEllipse(page, { x: 360, y: 150 }, { x: 480, y: 220 });
    await saveToLibrary(page);

    await openLibrary(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-testid="library-export"]').click();
    const download = await downloadPromise;
    const path = await download.path();
    const fs = await import("fs");
    const content = fs.readFileSync(path!, "utf-8");

    const parsed = JSON.parse(content);
    expect(parsed.libraryItems.length).toBe(2);
    expect(parsed.libraryItems[0].name).toBe("custom-1");
    expect(parsed.libraryItems[1].name).toBe("custom-2");
  });

  test("export preserves element properties (colors, stroke)", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        strokeColor: "#ff0000",
        backgroundColor: "#00ff00",
        strokeWidth: 3,
      });
    });
    await saveToLibrary(page);

    await openLibrary(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-testid="library-export"]').click();
    const download = await downloadPromise;
    const path = await download.path();
    const fs = await import("fs");
    const content = fs.readFileSync(path!, "utf-8");

    const parsed = JSON.parse(content);
    const el = parsed.libraryItems[0].elements[0];
    expect(el.strokeColor).toBe("#ff0000");
    expect(el.backgroundColor).toBe("#00ff00");
    expect(el.strokeWidth).toBe(3);
  });
});
