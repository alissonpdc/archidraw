import { test, expect, drag, selectTool, open } from "../fixtures";

test.describe("persistence", () => {
  test("elements survive a page reload", async ({ page, editorState }) => {
    await open(page);
    await selectTool(page, "r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });

    // wait for the debounced autosave to flush
    await page.waitForTimeout(700);

    await page.reload();
    await open(page);

    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });

  test("camera (pan/zoom) survives a reload", async ({ page, editorState }) => {
    await open(page);
    await page.keyboard.down("Space");
    await drag(page, { x: 640, y: 400 }, { x: 740, y: 480 });
    await page.keyboard.up("Space");
    await page.waitForTimeout(700);

    await page.reload();
    await open(page);

    const s = await editorState();
    expect(s.camera.scrollX).toBe(100);
    expect(s.camera.scrollY).toBe(80);
  });

  test("corrupted localStorage does not crash the app", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("archidraw:workspace", "{invalid json!!");
    });
    await open(page);

    const s = await page.evaluate(() => {
      const snap = window.__editor__.getSnapshot();
      return { elementCount: snap.doc.elements.length, tool: snap.tool };
    });
    expect(s.elementCount).toBe(0);
    expect(s.tool).toBe("selection");
  });

  test("workspace with future schemaVersion is ignored", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "archidraw:workspace",
        JSON.stringify({
          schemaVersion: 999,
          doc: { schemaVersion: 1, elements: [] },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        }),
      );
    });
    await open(page);

    const s = await page.evaluate(() => {
      const snap = window.__editor__.getSnapshot();
      return snap.doc.elements.length;
    });
    expect(s).toBe(0);
  });

  test("legacy v1 workspace migrates to a single tab", async ({
    page,
    editorState,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "archidraw:workspace",
        JSON.stringify({
          schemaVersion: 1,
          doc: { schemaVersion: 1, elements: [{ id: "el_1", type: "rectangle", x: 0, y: 0, width: 10, height: 10, strokeColor: "#000", backgroundColor: "transparent", strokeWidth: 1, opacity: 1 }] },
          camera: { scrollX: 5, scrollY: 7, zoom: 2 },
        }),
      );
    });
    await open(page);

    const s = await editorState();
    expect(s.tabs).toHaveLength(1);
    expect(s.elementCount).toBe(1);
    expect(s.camera.scrollX).toBe(5);
    expect(s.camera.zoom).toBe(2);
  });

  test("deleted element is removed from storage after reload", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await page.waitForTimeout(700);

    // delete and let autosave flush again
    await selectTool(page, "v");
    await page.mouse.click(160, 140);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(700);

    await page.reload();
    await open(page);

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });
});
