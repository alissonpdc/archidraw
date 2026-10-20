import { test, expect, drag, selectTool, open } from "../fixtures";

async function createRect(page: import("@playwright/test").Page) {
  await selectTool(page, "2");
  await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
}

test.describe("export / import", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await createRect(page);
  });

  test("export .archidraw downloads a valid workspace file", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Save…" }).click();
    await page.getByRole("button", { name: "Save Diagram" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.archidraw$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

    expect(data.schemaVersion).toBe(2);
    expect(data.tabs).toHaveLength(1);
    expect(data.tabs[0].doc.elements).toHaveLength(1);
    expect(data.tabs[0].doc.elements[0].type).toBe("rectangle");
  });

  test("import .archidraw restores a workspace round-trip", async ({ page }) => {
    // export first
    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Save…" }).click();
    await page.getByRole("button", { name: "Save Diagram" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const download = await downloadPromise;
    const path = await download.path();

    // wipe state, then import the same file
    await page.evaluate(() =>
      window.__editor__.restoreState(
        JSON.stringify({ schemaVersion: 2, activeTabId: "t", tabs: [{ id: "t", name: "vazio", doc: { schemaVersion: 1, elements: [] }, camera: { scrollX: 0, scrollY: 0, zoom: 1 } }] }),
      ),
    );
    let s = await page.evaluate(() => {
      const snap = window.__editor__.getSnapshot();
      return snap.doc.elements.length;
    });
    expect(s).toBe(0);

    await page.setInputFiles('[data-testid="import-input"]', path);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const snap = window.__editor__.getSnapshot();
          return {
            n: snap.doc.elements.length,
            type: snap.doc.elements[0]?.type,
            tabs: snap.tabs.length,
          };
        }),
      )
      .toEqual({ n: 1, type: "rectangle", tabs: 2 });
  });

  test("import .excalidraw file creates elements on canvas", async ({ page }) => {
    // create an excalidraw scene file with a rectangle
    const excalidrawFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "exc_rect_1",
          type: "rectangle",
          x: 50,
          y: 50,
          width: 200,
          height: 100,
          strokeColor: "#1e1e1e",
          backgroundColor: "#a5d8ff",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
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
      name: "test.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawFile),
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const snap = window.__editor__.getSnapshot();
          return {
            n: snap.doc.elements.length,
            type: snap.doc.elements[0]?.type,
            x: snap.doc.elements[0]?.x,
          };
        }),
      )
      .toEqual({ n: 1, type: "rectangle", x: 50 });
  });

  test("import .excalidraw preserves element opacity (0-100 -> 0-1)", async ({
    page,
  }) => {
    // regression: shapes imported from .excalidraw with opacity < 100 used to
    // arrive with fillOpacity/strokeOpacity hard-coded to 1, so the renderer
    // ignored the original opacity entirely. fillOpacity is kept 15 points
    // below the element opacity (excalidraw's own fill rendering rule).
    const excalidrawFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "exc_rect_half",
          type: "rectangle",
          x: 10,
          y: 10,
          width: 100,
          height: 60,
          strokeColor: "#1e1e1e",
          backgroundColor: "#a5d8ff",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 50,
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
      name: "half-opacity.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawFile),
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const el = window.__editor__.getSnapshot().doc.elements[0];
          return {
            opacity: el?.opacity,
            fillOpacity: el?.fillOpacity,
            strokeOpacity: el?.strokeOpacity,
          };
        }),
      )
      .toEqual({ opacity: 0.5, fillOpacity: 0.35, strokeOpacity: 0.5 });
  });

  test("import .excalidraw keeps transparent background transparent (fill 0%, stroke 100%)", async ({
    page,
  }) => {
    // regression: a rectangle with no background (excalidraw's default: bg
    // "transparent" + fillStyle "hachure") used to import with fillStyle
    // hachure, and the renderer draws hachure lines in the stroke color over
    // transparent backgrounds — the transparency was lost.
    const excalidrawFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "exc_rect_no_bg",
          type: "rectangle",
          x: 10,
          y: 10,
          width: 100,
          height: 60,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "hachure",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 1,
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
      name: "no-bg.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawFile),
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const el = window.__editor__.getSnapshot().doc.elements[0];
          return {
            backgroundColor: el?.backgroundColor,
            fillStyle: el?.fillStyle,
            fillOpacity: el?.fillOpacity,
            strokeOpacity: el?.strokeOpacity,
          };
        }),
      )
      .toEqual({
        backgroundColor: "transparent",
        fillStyle: "solid",
        fillOpacity: 0,
        strokeOpacity: 1,
      });
  });

  test("import .excalidraw preserves text font family (1=sketch, 3=mono, else sans)", async ({
    page,
  }) => {
    // regression: text elements imported from .excalidraw used to drop their
    // font entirely — every element fell back to the default sans font.
    const excalidrawFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "exc_text_sketch",
          type: "text",
          x: 10,
          y: 10,
          width: 200,
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
          text: "handwritten",
          fontSize: 24,
          fontFamily: 1,
          textAlign: "left",
          verticalAlign: "top",
          containerId: null,
          originalText: "handwritten",
        },
        {
          id: "exc_text_mono",
          type: "text",
          x: 10,
          y: 80,
          width: 200,
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
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          groupIds: [],
          text: "mono",
          fontSize: 24,
          fontFamily: 3,
          textAlign: "left",
          verticalAlign: "top",
          containerId: null,
          originalText: "mono",
        },
        {
          id: "exc_text_sans",
          type: "text",
          x: 10,
          y: 150,
          width: 200,
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
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          groupIds: [],
          text: "normal",
          fontSize: 24,
          fontFamily: 2,
          textAlign: "left",
          verticalAlign: "top",
          containerId: null,
          originalText: "normal",
        },
        {
          id: "exc_box_labeled",
          type: "rectangle",
          x: 10,
          y: 220,
          width: 150,
          height: 80,
          strokeColor: "#1e1e1e",
          backgroundColor: "#a5d8ff",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          roundness: { type: 3 },
          seed: 4,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: [{ id: "exc_box_label", type: "text" }],
          updated: 1,
          groupIds: [],
        },
        {
          id: "exc_box_label",
          type: "text",
          x: 30,
          y: 240,
          width: 120,
          height: 30,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          roundness: null,
          seed: 5,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          groupIds: [],
          text: "título",
          fontSize: 20,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
          containerId: "exc_box_labeled",
          originalText: "título",
        },
      ],
      appState: { gridSize: 20, viewBackgroundColor: "" },
      files: {},
    });

    await page.setInputFiles('[data-testid="import-input"]', {
      name: "fonts.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawFile),
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const els = window.__editor__.getSnapshot().doc.elements;
          const byType = (t: string) => els.find((e) => e.type === t);
          const font = (id: string) =>
            els.find((e) => e.id === id)?.fontFamily;
          return {
            sketch: font("exc_text_sketch"),
            mono: font("exc_text_mono"),
            sans: font("exc_text_sans"),
            labeled: byType("rectangle")?.fontFamily,
          };
        }),
      )
      .toEqual({
        sketch: '"Architects Daughter", cursive',
        mono: 'Consolas, "SF Mono", monospace',
        sans: undefined,
        labeled: '"Architects Daughter", cursive',
      });
  });

  test("import .excalidraw auto-fits content into viewport", async ({ page }) => {
    // element is far larger than the viewport: import must zoom out and
    // center it (fit content), not leave the default zoom 1
    const excalidrawFile = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "exc_big_rect",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 2000,
          height: 2000,
          strokeColor: "#1e1e1e",
          backgroundColor: "#a5d8ff",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
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
      name: "big.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(excalidrawFile),
    });

    // zoom must be the fit-to-viewport ratio (pad 40px each side) and the
    // element's center must land at the screen center
    await expect
      .poll(() =>
        page.evaluate(() => {
          const snap = window.__editor__.getSnapshot();
          const el = snap.doc.elements[0];
          const want = Math.min(
            8,
            Math.max(
              0.1,
              Math.min(
                (window.innerWidth - 80) / 2000,
                (window.innerHeight - 80) / 2000,
              ),
            ),
          );
          const cx = snap.camera.scrollX + (el.x + el.width / 2) * snap.camera.zoom;
          const cy = snap.camera.scrollY + (el.y + el.height / 2) * snap.camera.zoom;
          return (
            Math.abs(snap.camera.zoom - want) < 0.001 &&
            Math.abs(cx - window.innerWidth / 2) < 1 &&
            Math.abs(cy - window.innerHeight / 2) < 1
          );
        }),
      )
      .toBe(true);
  });

  test("import .archidraw.json (legacy extension) also works", async ({ page }) => {
    const workspace = JSON.stringify({
      schemaVersion: 2,
      activeTabId: "t",
      tabs: [{
        id: "t",
        name: "Legacy",
        doc: { schemaVersion: 1, elements: [{ id: "l1", type: "ellipse", x: 10, y: 20, width: 30, height: 40, strokeColor: "#000", backgroundColor: "transparent", strokeWidth: 1, opacity: 1, strokeStyle: "solid", roughness: 0, borderRadius: 0 }] },
        camera: { scrollX: 0, scrollY: 0, zoom: 1 },
      }],
    });

    await page.setInputFiles('[data-testid="import-input"]', {
      name: "legacy.archidraw.json",
      mimeType: "application/json",
      buffer: Buffer.from(workspace),
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const snap = window.__editor__.getSnapshot();
          return {
            n: snap.doc.elements.length,
            type: snap.doc.elements[0]?.type,
          };
        }),
      )
      .toEqual({ n: 1, type: "ellipse" });
  });

  test("invalid JSON import is rejected without crashing", async ({ page }) => {
    await page.setInputFiles('[data-testid="import-input"]', {
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{not json!!"),
    });

    const s = await page.evaluate(() => {
      const snap = window.__editor__.getSnapshot();
      return { n: snap.doc.elements.length };
    });
    expect(s.n).toBe(1); // untouched
  });

  test("export PNG downloads a non-empty image", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "PNG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const buf = Buffer.concat(chunks);
    // PNG magic number
    expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(buf.length).toBeGreaterThan(100);
  });

  test("export SVG downloads valid markup containing shapes", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.svg$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");

    expect(svg).toContain("<svg");
    expect(svg).toContain("<rect");
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  test("filename is derived from active tab name", async ({ page }) => {
    await page.dblclick('[data-testid="tab-seg-Diagram 1"]');
    const input = page.locator(".tab-rename");
    await input.fill("My Architecture!");
    await input.press("Enter");

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("my-architecture.svg");
  });

  test("empty canvas exports are no-ops (no crash)", async ({ page }) => {
    await page.evaluate(() => {
      const ed = window.__editor__;
      ed.closeTab(ed.getSnapshot().activeTabId); // fresh empty tab
    });
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "PNG" }).click();
    await page.getByRole("button", { name: "Export" }).click();

    // menu closes, app still alive, nothing downloaded
    await expect(page.locator(".menu-dropdown")).toHaveCount(0);
    const s = await page.evaluate(() => window.__editor__.getSnapshot());
    expect(s.doc.elements).toHaveLength(0);
  });
});
