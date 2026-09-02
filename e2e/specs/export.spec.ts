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
