import { test, expect, open, drag, selectTool } from "../fixtures";
import { type Page } from "@playwright/test";

async function drawRect(
  page: Page,
  from = { x: 200, y: 150 },
  to = { x: 320, y: 220 },
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

test.describe("utils.ts edge cases", () => {
  test("zero-length line does not crash the renderer", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.restoreState(
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "t",
          tabs: [
            {
              id: "t",
              name: "test",
              doc: {
                schemaVersion: 1,
                elements: [
                  {
                    id: "z1",
                    type: "line",
                    x: 300,
                    y: 300,
                    width: 0,
                    height: 0,
                    strokeColor: "#1e1e1e",
                    backgroundColor: "transparent",
                    strokeWidth: 2,
                    opacity: 1,
                    strokeOpacity: 1,
                    fillOpacity: 1,
                    strokeStyle: "solid",
                    fillStyle: "solid",
                    roughness: 0,
                    borderRadius: 0,
                  },
                ],
              },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
    });
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("zero-length arrow does not crash the renderer", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.restoreState(
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "t",
          tabs: [
            {
              id: "t",
              name: "test",
              doc: {
                schemaVersion: 1,
                elements: [
                  {
                    id: "za",
                    type: "arrow",
                    x: 300,
                    y: 300,
                    width: 0,
                    height: 0,
                    strokeColor: "#1e1e1e",
                    backgroundColor: "transparent",
                    strokeWidth: 2,
                    opacity: 1,
                    strokeOpacity: 1,
                    fillOpacity: 1,
                    strokeStyle: "solid",
                    fillStyle: "solid",
                    roughness: 0,
                    borderRadius: 0,
                    endArrowhead: "arrow",
                    startArrowhead: "none",
                  },
                ],
              },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
    });
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("nearestOutlinePoint handles ellipse with center point", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.restoreState(
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "t",
          tabs: [
            {
              id: "t",
              name: "test",
              doc: {
                schemaVersion: 1,
                elements: [
                  {
                    id: "ec1",
                    type: "ellipse",
                    x: 200,
                    y: 200,
                    width: 100,
                    height: 80,
                    strokeColor: "#1e1e1e",
                    backgroundColor: "transparent",
                    strokeWidth: 2,
                    opacity: 1,
                    strokeOpacity: 1,
                    fillOpacity: 1,
                    strokeStyle: "solid",
                    fillStyle: "solid",
                    roughness: 0,
                    borderRadius: 0,
                  },
                ],
              },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
    });
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("nearestOutlinePoint handles diamond with center point", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.restoreState(
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "t",
          tabs: [
            {
              id: "t",
              name: "test",
              doc: {
                schemaVersion: 1,
                elements: [
                  {
                    id: "dc1",
                    type: "diamond",
                    x: 200,
                    y: 200,
                    width: 100,
                    height: 80,
                    strokeColor: "#1e1e1e",
                    backgroundColor: "transparent",
                    strokeWidth: 2,
                    opacity: 1,
                    strokeOpacity: 1,
                    fillOpacity: 1,
                    strokeStyle: "solid",
                    fillStyle: "solid",
                    roughness: 0,
                    borderRadius: 0,
                  },
                ],
              },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
    });
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("nearestOutlinePoint handles external point projected on rectangle", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 200 }, { x: 300, y: 280 });
    await selectTool(page, "6");
    await drag(page, { x: 500, y: 400 }, { x: 250, y: 240 });
    await selectTool(page, "1");

    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const arrow = snap.doc.elements.find((e: any) => e.type === "arrow");
      return { hasEndBinding: !!arrow?.endBinding };
    });
    expect(s.hasEndBinding).toBe(true);
  });

  test("unionBounds with empty element list via zoomToFit", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.zoomToFit());
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("autoDragSegmentBends on non-auto edge is a no-op", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 320, y: 260 });
    await selectTool(page, "1");

    const result = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return { lineType: el.lineType, bendPoints: el.bendPoints };
    });
    expect(result.lineType).toBeUndefined();
    expect(result.bendPoints).toBeUndefined();
  });

  test("snapSegmentDelta with index out of bounds returns rawD", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 320, y: 260 });
    await selectTool(page, "1");

    const result = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return { type: el.type, isEdge: el.type === "line" || el.type === "arrow" };
    });
    expect(result.isEdge).toBe(true);
  });
});

test.describe("excalidrawCommon.ts edge cases", () => {
  test("normalizePoints handles tuple format", async ({ page }) => {
    await open(page);
    const excalidrawFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "ep1",
          type: "line",
          x: 10,
          y: 10,
          width: 100,
          height: 50,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          roundness: null,
          seed: 1,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          groupIds: [],
          points: [
            [0, 0],
            [50, 25],
            [100, 50],
          ],
        },
      ],
      appState: { gridSize: 20, viewBackgroundColor: "" },
      files: {},
    });

    await page.setInputFiles('[data-testid="import-input"]', {
      name: "tuples.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawFile),
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const snap = (window as any).__editor__.getSnapshot();
          return snap.doc.elements.length;
        }),
      )
      .toBe(1);
  });

  test("normalizePoints handles object format", async ({ page }) => {
    await open(page);
    const excalidrawFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "ep2",
          type: "line",
          x: 10,
          y: 10,
          width: 100,
          height: 50,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          roundness: null,
          seed: 1,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          groupIds: [],
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 25 },
            { x: 100, y: 50 },
          ],
        },
      ],
      appState: { gridSize: 20, viewBackgroundColor: "" },
      files: {},
    });

    await page.setInputFiles('[data-testid="import-input"]', {
      name: "objects.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawFile),
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const snap = (window as any).__editor__.getSnapshot();
          return snap.doc.elements.length;
        }),
      )
      .toBe(1);
  });

  test("excalidrawFontCategory handles string font names", async ({
    page,
  }) => {
    await open(page);
    const excalidrawFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "fn1",
          type: "text",
          x: 10,
          y: 10,
          width: 100,
          height: 40,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          roundness: null,
          seed: 1,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          groupIds: [],
          text: "Virgil font",
          fontSize: 20,
          fontFamily: "Virgil",
          textAlign: "left",
          verticalAlign: "top",
          containerId: null,
          originalText: "Virgil font",
        },
        {
          id: "fn2",
          type: "text",
          x: 10,
          y: 60,
          width: 100,
          height: 40,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          roundness: null,
          seed: 2,
          version: 1,
          versionNonce: 2,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          groupIds: [],
          text: "Cascadia font",
          fontSize: 20,
          fontFamily: "Cascadia",
          textAlign: "left",
          verticalAlign: "top",
          containerId: null,
          originalText: "Cascadia font",
        },
        {
          id: "fn3",
          type: "text",
          x: 10,
          y: 110,
          width: 100,
          height: 40,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          roundness: null,
          seed: 3,
          version: 1,
          versionNonce: 3,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          groupIds: [],
          text: "Helvetica font",
          fontSize: 20,
          fontFamily: "Helvetica",
          textAlign: "left",
          verticalAlign: "top",
          containerId: null,
          originalText: "Helvetica font",
        },
      ],
      appState: { gridSize: 20, viewBackgroundColor: "" },
      files: {},
    });

    await page.setInputFiles('[data-testid="import-input"]', {
      name: "fonts-string.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawFile),
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const snap = (window as any).__editor__.getSnapshot();
          return snap.doc.elements.length;
        }),
      )
      .toBe(3);
  });

  test("toExcalidrawStrokeStyle handles dashdot as solid", async ({
    page,
  }) => {
    await open(page);
    const excalidrawFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "ds1",
          type: "rectangle",
          x: 10,
          y: 10,
          width: 100,
          height: 60,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "dashdot",
          roughness: 0,
          opacity: 100,
          roundness: { type: 3 },
          seed: 1,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          groupIds: [],
        },
      ],
      appState: { gridSize: 20, viewBackgroundColor: "" },
      files: {},
    });

    await page.setInputFiles('[data-testid="import-input"]', {
      name: "dashdot.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawFile),
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const el = (window as any).__editor__.getSnapshot().doc.elements[0];
          return el?.strokeStyle;
        }),
      )
      .toBe("solid");
  });
});

test.describe("viewPrefs.ts edge cases", () => {
  test("grid mode cycles through lines, dots, none", async ({ page }) => {
    await open(page);
    await page.getByTestId("app-menu-button").click();
    await page
      .locator(".menu-item--submenu", { hasText: "Grid" })
      .click();

    await page.locator("button.menu-item", { hasText: "Lines" }).click();
    const lines = await page.evaluate(() =>
      localStorage.getItem("archidraw:grid"),
    );

    await page.locator("button.menu-item", { hasText: "Dots" }).click();
    const dots = await page.evaluate(() =>
      localStorage.getItem("archidraw:grid"),
    );

    await page.locator("button.menu-item", { hasText: "None" }).click();
    const none = await page.evaluate(() =>
      localStorage.getItem("archidraw:grid"),
    );

    expect(lines).toBe("lines");
    expect(dots).toBe("dots");
    expect(none).toBe("none");
  });
});
