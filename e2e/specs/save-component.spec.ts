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

async function drawDiamond(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await selectTool(page, "3");
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

/** saved SVG of the last custom library item from localStorage */
async function savedCustomSvg(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("archidraw:customLibrary");
    const arr = raw ? JSON.parse(raw) : [];
    return arr[arr.length - 1].svg as string;
  });
}

/** number of NATIVE elements stored in the last custom library item */
async function savedCustomElementCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("archidraw:customLibrary");
    const arr = raw ? JSON.parse(raw) : [];
    return ((arr[arr.length - 1]?.elements ?? []) as unknown[]).length;
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

  test("Add to Library stores native elements; inserting re-adds as a native editable group", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    const origId = (await editorState()).elements[0].id;
    const styles = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { strokeColor: el.strokeColor, backgroundColor: el.backgroundColor };
    });

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
    const inserted = state.elements.find((e) => e.id !== origId)!;
    // NOT a component/image: the original native element comes back
    expect(inserted.type).toBe("rectangle");
    expect(state.elements.filter((e) => e.type === "component")).toHaveLength(0);
    // and it is grouped (saved sets are re-inserted as a group)
    expect(inserted.groupId).toBeTruthy();

    const insertedStyles = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ins = ed.getSnapshot().doc.elements.find((e: any) => e.groupId);
      return { strokeColor: ins.strokeColor, backgroundColor: ins.backgroundColor };
    });
    expect(insertedStyles.strokeColor).toBe(styles.strokeColor);
    expect(insertedStyles.backgroundColor).toBe(styles.backgroundColor);

    // native = editable: applying a stroke change sticks
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ins = ed.getSnapshot().doc.elements.find((e: any) => e.groupId);
      ed.updateElements([ins.id], { strokeColor: "#ff0000" });
    });
    const edited = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ins = ed.getSnapshot().doc.elements.find((e: any) => e.groupId);
      return ins.strokeColor;
    });
    expect(edited).toBe("#ff0000");
  });

  test("saved multiselection returns as ONE group containing every element", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 360, y: 150 }, { x: 480, y: 220 });
    await drag(page, { x: 140, y: 90 }, { x: 560, y: 290 });
    await expect
      .poll(async () => (await page.evaluate(() => [...(window as any).__editor__.getSnapshot().selectedIds].length)))
      .toBe(2);

    await rightClickMenu(page, 260, 185);
    await page.getByTestId("context-menu-add-library").click();

    await page.keyboard.press("l");
    const custom = page.locator('[data-testid="library-custom"]');
    await custom.locator(".library-section-header").click();
    await custom.locator('[data-component-id="custom-1"]').click();

    const state = await editorState();
    expect(state.elementCount).toBe(4);
    const inserted = state.elements.filter((e) => e.groupId);
    expect(inserted).toHaveLength(2);
    expect(inserted[0].groupId).toBe(inserted[1].groupId);
    expect(inserted.every((e) => e.type === "rectangle")).toBe(true);

    // single click on a member selects the whole (native) group again
    await page.evaluate(() => (window as any).__editor__.clearSelection());
    const c = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.groupId);
      return ed.getScreenPoint({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
    });
    await page.mouse.click(c.x, c.y);
    expect((await editorState()).selectedIds).toHaveLength(2);
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

  test("Add to Library snapshot includes every selected shape type", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 280, y: 200 });
    await drawDiamond(page, { x: 320, y: 150 }, { x: 420, y: 200 });
    await drawEllipse(page, { x: 450, y: 150 }, { x: 560, y: 200 });
    await drag(page, { x: 140, y: 90 }, { x: 640, y: 260 });
    await expect
      .poll(async () => (await page.evaluate(() => [...(window as any).__editor__.getSnapshot().selectedIds].length)))
      .toBe(3);

    await rightClickMenu(page, 370, 175);
    await page.getByTestId("context-menu-add-library").click();

    const svg = await savedCustomSvg(page);
    expect(svg).toContain("<svg");
    expect((svg.match(/<rect/g) ?? []).length).toBe(1);
    expect((svg.match(/<polygon/g) ?? []).length).toBe(1);
    expect((svg.match(/<ellipse/g) ?? []).length).toBe(1);
    // stored native elements still match the whole selection (canvas insert)
    expect(await savedCustomElementCount(page)).toBe(3);
  });

  test("Download SVG includes every selected shape type", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 280, y: 200 });
    await drawDiamond(page, { x: 320, y: 150 }, { x: 420, y: 200 });
    await drawEllipse(page, { x: 450, y: 150 }, { x: 560, y: 200 });
    await drag(page, { x: 140, y: 90 }, { x: 640, y: 260 });
    await expect
      .poll(async () => (await page.evaluate(() => [...(window as any).__editor__.getSnapshot().selectedIds].length)))
      .toBe(3);

    await rightClickMenu(page, 370, 175);
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("context-menu-download-svg").click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");

    expect((svg.match(/<rect/g) ?? []).length).toBe(1);
    expect((svg.match(/<polygon/g) ?? []).length).toBe(1);
    expect((svg.match(/<ellipse/g) ?? []).length).toBe(1);
  });

  test("Add to Library escapes double quotes in text font-family (XML-safe)", async ({
    page,
  }) => {
    // regression: font families like "Architects Daughter", cursive (sketch
    // import) contain literal quotes that broke the saved SVG XML.
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(320, 185);
    await page.keyboard.type("handwritten");
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { fontFamily: '"Architects Daughter", cursive' });
    });

    await rightClickMenu(page, 320, 185);
    await page.getByTestId("context-menu-add-library").click();

    const svg = await savedCustomSvg(page);
    expect(svg).toContain('font-family="&quot;Architects Daughter&quot;, cursive"');
    expect(svg).not.toContain('font-family="\\"Architects Daughter');
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
    // the native elements (not just a flattened image) are what is stored
    expect(await savedCustomElementCount(page)).toBe(2);
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

  test("removing a Custom item from the library keeps canvas elements", async ({
    page,
  }) => {
    // regression: deleting a saved custom item must never delete the elements
    // the user already placed on the canvas from that item
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 360, y: 150 }, { x: 480, y: 220 });
    await drag(page, { x: 140, y: 90 }, { x: 560, y: 290 });
    await expect
      .poll(async () => (await page.evaluate(() => [...(window as any).__editor__.getSnapshot().selectedIds].length)))
      .toBe(2);

    await rightClickMenu(page, 260, 185);
    await page.getByTestId("context-menu-add-library").click();

    await page.keyboard.press("l");
    const custom = page.locator('[data-testid="library-custom"]');
    await custom.locator(".library-section-header").click();
    await custom.locator('[data-component-id="custom-1"]').click();
    const countBeforeRemove = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(countBeforeRemove).toBe(4);

    await custom.locator(".library-tile").first().hover();
    await custom.locator(".library-tile-remove").click();
    await expect(custom.locator(".library-tile")).toHaveCount(0);
    const countAfterRemove = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(countAfterRemove).toBe(4);
  });

  test("removing an imported library keeps placed components rendering", async ({
    page,
  }) => {
    // regression: components inserted from removable (non-bundled) libraries
    // must embed their asset so removing the library item from the palette
    // never makes them disappear from the canvas
    await open(page);
    await page.keyboard.press("l");
    const lib = JSON.stringify({
      type: "excalidrawlib",
      version: 2,
      libraryItems: [
        {
          id: "a1",
          name: "DB Box",
          elements: [
            {
              type: "rectangle",
              x: 0,
              y: 0,
              width: 80,
              height: 40,
              strokeColor: "#1e1e1e",
              backgroundColor: "#a5d8ff",
              fillStyle: "solid",
              strokeWidth: 2,
              strokeStyle: "solid",
              opacity: 100,
              roundness: null,
            },
          ],
        },
      ],
    });
    await page.locator('[data-testid="library-import"]').click();
    await page.locator(".library-import-input").setInputFiles({
      name: "lib.excalidrawlib",
      mimeType: "application/json",
      buffer: Buffer.from(lib),
    });
    await expect(
      page.locator('[data-testid="library-imported-group"]'),
    ).toHaveCount(1);
    await page
      .locator('[data-testid="library-imported-group"] .library-tile')
      .click();
    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__editor__.getSnapshot().doc.elements.length)))
      .toBe(1);

    await page
      .locator('[data-testid="library-imported-group"] .library-group-remove')
      .click();
    await expect(
      page.locator('[data-testid="library-imported-group"]'),
    ).toHaveCount(0);

    // placed component keeps its asset embedded (self-contained) after removal
    const state = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return {
        elementCount: ed.getSnapshot().doc.elements.length,
        type: el.type,
        hasSrc: typeof el.src === "string" && el.src.startsWith("data:image/svg+xml"),
      };
    });
    expect(state.elementCount).toBe(1);
    expect(state.type).toBe("component");
    expect(state.hasSrc).toBe(true);
  });

  test("sketch shapes export as hand-drawn SVG, not clean lines", async ({
    page,
  }) => {
    // regression: saved custom item thumbnails lost the sketch (rough) style
    // and came out with clean straight lines
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { roughness: 3 });
    });

    await rightClickMenu(page, 260, 185);
    await page.getByTestId("context-menu-add-library").click();

    const svg = await savedCustomSvg(page);
    expect(svg).not.toContain("<rect");
    expect(svg).toContain('fill="none"');
    expect(svg).toMatch(/<path d="M[^"]* Q /);
  });

  test("sketch line downloads as hand-drawn path", async ({ page }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 200 });
    await selectTool(page, "1");
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { roughness: 3 });
    });

    await rightClickMenu(page, 350, 200);
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("context-menu-download-svg").click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");

    expect(svg).toContain(" Q ");
    expect(svg).not.toContain("<line");
  });
});