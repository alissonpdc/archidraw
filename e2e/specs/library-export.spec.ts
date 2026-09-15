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

  test("export serializes arrows with relative bend points and arrowheads", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 150 }, { x: 360, y: 220 });
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        bendPoints: [
          { x: 300, y: 120 },
          { x: 310, y: 170 },
        ],
        startArrowhead: "circle",
        endArrowhead: "triangle",
        strokeColor: "#ff0000",
      });
    });

    await saveToLibrary(page);
    await openLibrary(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-testid="library-export"]').click();
    const download = await downloadPromise;
    const fs = await import("fs");
    const parsed = JSON.parse(fs.readFileSync((await download.path())!, "utf-8"));

    const el = parsed.libraryItems[0].elements[0];
    expect(el.type).toBe("arrow");
    expect(el.points).toHaveLength(4);
    expect(el.points[0]).toEqual({ x: 0, y: 0 });
    expect(el.points[1]).toEqual({ x: 100, y: -30 });
    expect(el.points[2]).toEqual({ x: 110, y: 20 });
    expect(el.points[3]).toEqual({ x: 160, y: 70 });
    expect(el.startArrowhead).toBe("circle");
    expect(el.endArrowhead).toBe("triangle");
  });

  test("export drops component elements instead of serializing raw assets", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await openLibrary(page);

    // insert a component from an imported .excalidrawlib
    await page.locator('[data-testid="library-import"]').click();
    await page.locator(".library-import-input").setInputFiles({
      name: "node.excalidrawlib",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          type: "excalidrawlib",
          version: 2,
          libraryItems: [
            {
              id: "n1",
              name: "Node",
              elements: [
                {
                  type: "ellipse",
                  x: 0,
                  y: 0,
                  width: 80,
                  height: 40,
                  strokeColor: "#1e1e1e",
                  backgroundColor: "transparent",
                  fillStyle: "solid",
                  strokeWidth: 2,
                  strokeStyle: "solid",
                  opacity: 100,
                  roundness: null,
                },
              ],
            },
          ],
        }),
      ),
    });

    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group).toHaveCount(1);
    await group.locator(".library-tile").click();

    let id = "";
    await expect.poll(() =>
      page.evaluate(() =>
        (window as any).__editor__
          .getSnapshot()
          .doc.elements.find((el: any) => el.type === "component")?.id ?? "",
      ),
    ).not.toBe("");
    id = await page.evaluate(() =>
      (window as any).__editor__
        .getSnapshot()
        .doc.elements.find((el: any) => el.type === "component")!.id,
    );
    const bounds = await page.evaluate((elId) => {
      const el = (window as any).__editor__
        .getSnapshot()
        .doc.elements.find((e: any) => e.id === elId);
      return { cx: el.x + el.width / 2, cy: el.y + el.height / 2 };
    }, id);

    // save the component into the custom library
    await page.mouse.click(bounds.cx, bounds.cy, { button: "right" });
    await page.getByTestId("context-menu-add-library").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    // the export button is visible (a custom item exists)
    const exportBtn = page.locator('[data-testid="library-export"]');
    await expect(exportBtn).toBeVisible();

    // but a component-only item serializes to nothing — no download fires
    let downloadFired = false;
    page.on("download", () => (downloadFired = true));
    await exportBtn.click();
    await page.waitForTimeout(300);
    expect(downloadFired).toBe(false);

    const s = await editorState();
    expect(s.elements.filter((e) => e.type === "component").length).toBe(1);
  });

  test("export serializes dashed strokes, hachure fills, text and bend edges", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const base = {
        strokeColor: "#3d4248",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid" as const,
        fillStyle: "solid" as const,
        roughness: 0,
        borderRadius: 0,
      };
      ed.restoreState(
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "t",
          tabs: [
            {
              id: "t",
              name: "lib",
              doc: {
                schemaVersion: 1,
                elements: [
                  { ...base, id: "a", type: "arrow", x: 200, y: 150, width: 100, height: 40, startArrowhead: "arrow", endArrowhead: "triangle", strokeStyle: "dashed" },
                  { ...base, id: "r", type: "rectangle", x: 200, y: 200, width: 80, height: 40, backgroundColor: "#ffc9c9", fillStyle: "hachure" },
                  { ...base, id: "t", type: "text", x: 200, y: 280, width: 80, height: 20, text: "TAG", fontSize: 16 },
                  { ...base, id: "l", type: "line", x: 200, y: 330, width: 100, height: 60, lineType: "auto", bendPoints: [{ x: 250, y: 360 }] },
                ],
              },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
    });

    // save each element to the custom library individually
    const centers = [
      { id: "a", x: 250, y: 170 },
      { id: "t", x: 240, y: 290 },
      { id: "l", x: 270, y: 360 },
    ];
    for (const c of centers) {
      await page.mouse.click(c.x, c.y, { button: "right" });
      await page.getByTestId("context-menu-add-library").click();
      await expect(page.getByTestId("context-menu")).toHaveCount(0);
      // a non-empty selection persists as the next "Save" target: deselect
      // so the following right-click picks up the element under the cursor
      await page.mouse.click(700, 700);
    }
    // hachure rectangle: select and click add-to-library on its center directly
    await page.mouse.click(240, 220, { button: "right" });
    await page.getByTestId("context-menu-add-library").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    await openLibrary(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-testid="library-export"]').click();
    const download = await downloadPromise;
    const fs = await import("fs");
    const parsed = JSON.parse(
      fs.readFileSync((await download.path())!, "utf-8"),
    );

    const byType = (t: string) =>
      parsed.libraryItems.flatMap((it: any) => it.elements).find(
        (el: any) => el.type === t,
      );
    const arrow = byType("arrow");
    expect(arrow.strokeStyle).toBe("dashed");
    expect(arrow.startArrowhead).toBe("arrow");
    expect(arrow.endArrowhead).toBe("triangle");

    const rect = byType("rectangle");
    expect(rect.fillStyle).toBe("hachure");

    const text = byType("text");
    expect(text.text).toBe("TAG");
    expect(text.fontSize).toBe(16);

    const line = byType("line");
    expect(line.points).toHaveLength(3);
    expect(line.points[0]).toEqual({ x: 0, y: 0 });
    expect(line.points[1]).toEqual({ x: 50, y: 30 });
    expect(line.points[2]).toEqual({ x: 100, y: 60 });
  });
});
