import { test, expect, drag, selectTool, open } from "../fixtures";

test.describe("persistence", () => {
  test("elements survive a page reload", async ({ page, editorState }) => {
    await open(page);
    await selectTool(page, "2");
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

  test("legacy v1 workspace migrates image elements and anchor bindings", async ({
    page,
    editorState,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "archidraw:workspace",
        JSON.stringify({
          schemaVersion: 1,
          doc: {
            schemaVersion: 1,
            elements: [
              {
                id: "leg_img",
                type: "image",
                src: "data:image/png;base64,iVBORw0KGgo=",
                x: 10,
                y: 20,
                width: 100,
                height: 80,
                naturalWidth: 100,
                naturalHeight: 80,
                strokeColor: "#000",
                backgroundColor: "transparent",
                strokeWidth: 2,
                opacity: 1,
              },
              {
                id: "leg_line",
                type: "line",
                x: 0,
                y: 0,
                width: 120,
                height: 0,
                strokeColor: "#000",
                backgroundColor: "transparent",
                strokeWidth: 2,
                opacity: 1,
                startBinding: { elementId: "other", anchor: "top" },
                endBinding: { elementId: "other", anchor: "right" },
              },
            ],
          },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        }),
      );
    });
    await open(page);

    const s = await page.evaluate(() => {
      const ed = window.__editor__;
      const els = ed.getSnapshot().doc.elements;
      return els.map((el: any) => ({
        type: el.type,
        src: el.src,
        fill: el.fill,
        componentId: el.componentId,
        startBinding: el.startBinding,
        endBinding: el.endBinding,
      }));
    });

    const [img, line] = s as [
      {
        type: string;
        src: string;
        fill: boolean;
        componentId?: string;
        startBinding?: unknown;
        endBinding?: unknown;
      },
      {
        type: string;
        src?: unknown;
        fill?: unknown;
        componentId?: unknown;
        startBinding?: unknown;
        endBinding?: unknown;
      },
    ];
    expect(img.type).toBe("component");
    expect(img.src).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(img.fill).toBe(true);
    expect(img.componentId).toMatch(/^img-/);
    expect(line.startBinding).toEqual({ elementId: "other", nx: 0.5, ny: 0 });
    expect(line.endBinding).toEqual({ elementId: "other", nx: 1, ny: 0.5 });
  });

  test("workspace with a malformed tab is ignored entirely", async ({
    page,
    editorState,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "archidraw:workspace",
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "ok",
          tabs: [
            {
              id: "ok",
              name: "Good",
              doc: { schemaVersion: 1, elements: [] },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
            {
              id: "bad",
              name: "Broken",
              doc: { schemaVersion: 1, elements: [] },
            },
          ],
        }),
      );
    });
    await open(page);

    const s = await editorState();
    expect(s.tabs).toHaveLength(1);
    expect(s.elementCount).toBe(0);
  });

  test("legacy v1 image without natural size falls back to element bounds", async ({
    page,
    editorState,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "archidraw:workspace",
        JSON.stringify({
          schemaVersion: 1,
          doc: {
            schemaVersion: 1,
            elements: [
              {
                id: "leg_img",
                type: "image",
                src: "data:image/png;base64,iVBORw0KGgo=",
                x: 10,
                y: 20,
                width: 40,
                height: 30,
                strokeColor: "#000",
                backgroundColor: "transparent",
                strokeWidth: 2,
                opacity: 1,
              },
            ],
          },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        }),
      );
    });
    await open(page);

    const img = await page.evaluate(() => {
      const ed = window.__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return { type: el.type, componentId: el.componentId, fill: el.fill };
    });
    expect(img.type).toBe("component");
    expect(img.componentId).toMatch(/^img-/);
    expect(img.fill).toBe(true);
    void editorState;
  });

  test("legacy bindings with unknown anchors fall back to the center", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "archidraw:workspace",
        JSON.stringify({
          schemaVersion: 1,
          doc: {
            schemaVersion: 1,
            elements: [
              {
                id: "leg_line",
                type: "line",
                x: 0,
                y: 0,
                width: 120,
                height: 0,
                strokeColor: "#000",
                backgroundColor: "transparent",
                strokeWidth: 2,
                opacity: 1,
                startBinding: { elementId: "other", anchor: "diagonal" },
              },
            ],
          },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        }),
      );
    });
    await open(page);

    const bindings = await page.evaluate(() => {
      const ed = window.__editor__;
      return ed.getSnapshot().doc.elements[0].startBinding;
    });
    expect(bindings).toEqual({ elementId: "other", nx: 0.5, ny: 0.5 });
  });

  test("legacy v1 workspace missing the camera is ignored", async ({
    page,
    editorState,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "archidraw:workspace",
        JSON.stringify({
          schemaVersion: 1,
          doc: { schemaVersion: 1, elements: [] },
        }),
      );
    });
    await open(page);

    const s = await editorState();
    expect(s.elementCount).toBe(0);
    expect(s.tabs).toHaveLength(1);
  });

  test("non-object workspace payloads are ignored", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("archidraw:workspace", "42");
    });
    await open(page);

    const s = await page.evaluate(() => {
      const snap = window.__editor__.getSnapshot();
      return snap.doc.elements.length;
    });
    expect(s).toBe(0);
  });

  test("deleted element is removed from storage after reload", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await page.waitForTimeout(700);

    // delete and let autosave flush again
    await selectTool(page, "1");
    await page.mouse.click(160, 140);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(700);

    await page.reload();
    await open(page);

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });
});
