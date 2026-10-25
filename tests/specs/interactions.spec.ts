import {
  test,
  expect,
  open,
  drag,
  selectTool,
  importFile,
} from "../fixtures";
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

function shape(page: Page) {
  return page.evaluate(() => {
    const ed = (window as any).__editor__;
    const el = ed.getSnapshot().doc.elements[0];
    return { x: el.x, y: el.y, width: el.width, height: el.height, fontSize: el.fontSize };
  });
}

test.describe("resize", () => {
  test("dragging the SE corner resizes a rectangle", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(260, 185); // select

    const before = await shape(page);
    await page.mouse.move(320, 220);
    await page.mouse.down();
    await page.mouse.move(400, 300, { steps: 6 });
    await page.mouse.up();

    const s = await shape(page);
    expect(s.width).toBeGreaterThan(before.width);
    expect(s.height).toBeGreaterThan(before.height);
  });

  test("dragging the east edge resizes width only", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(260, 185);

    const before = await shape(page);
    await page.mouse.move(320, 185);
    await page.mouse.down();
    await page.mouse.move(380, 185, { steps: 4 });
    await page.mouse.up();

    const s = await shape(page);
    expect(s.width).toBeGreaterThan(before.width);
    expect(Math.abs(s.height - before.height)).toBeLessThanOrEqual(1);
  });

  test("resizing a text element recomputes its font size", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(200, 200);
    await page.keyboard.type("Resize me");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(230, 210);

    const before = await shape(page);
    await page.mouse.move(
      before.x + before.width,
      before.y + before.height,
    );
    await page.mouse.down();
    await page.mouse.move(
      before.x + before.width + 200,
      before.y + before.height + 60,
      { steps: 5 },
    );
    await page.mouse.up();

    const after = await shape(page);
    expect(after.fontSize).toBeGreaterThan(before.fontSize ?? 0);
  });
});

test.describe("smart guides", () => {
  test("dragging an element toward another snaps to its edge", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 200, y: 300 }, { x: 320, y: 370 });
    await page.mouse.click(260, 335); // select the lower rect

    await page.mouse.move(260, 335);
    await page.mouse.down();
    await page.mouse.move(260, 183, { steps: 120 });
    await page.mouse.up();

    const s = (await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[1];
      return { y: el.y };
    })) as { y: number };
    expect(Math.abs(s.y - 150)).toBeLessThanOrEqual(2);
  });
});

test.describe("locked elements", () => {
  test("double-clicking a locked element does not enter edit mode", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { locked: true } as any);
    });

    await page.mouse.dblclick(280, 185);
    const s = await editorState();
    expect(s.editingTextId).toBeNull();
  });
});

test.describe("empty clipboard", () => {
  test("paste-here with no internal clipboard is a safe no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.mouse.click(400, 300, { button: "right" });
    await page.getByTestId("context-menu-paste-here").click();

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });
});

const tab = (id: string, name: string) => ({
  id,
  name,
  doc: { schemaVersion: 1, elements: [] },
  camera: { scrollX: 0, scrollY: 0, zoom: 1 },
});

test.describe("archidraw workspace import", () => {
  test("importing a multi-tab .archidraw file creates a workspace named after the file", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const workspace = JSON.stringify({
      schemaVersion: 2,
      activeTabId: "a",
      tabs: [tab("a", "Imported A"), tab("b", "Imported B")],
    });
    await importFile(page, {
      name: "pack.archidraw.json",
      mimeType: "application/json",
      buffer: Buffer.from(workspace, "utf-8"),
    });

    const s = await editorState();
    expect(s.workspaces.map((w) => w.name)).toEqual(["Workspace 1", "pack"]);
    expect(s.workspaces[0].canvases.map((c) => c.name)).toEqual(["Diagram 1"]);
    expect(s.workspaces[1].canvases.map((c) => c.name)).toEqual([
      "Imported A",
      "Imported B",
    ]);
    expect(s.activeWorkspaceId).toBe(s.workspaces[1].id);
    expect(s.tabs.map((t) => t.name)).toEqual(["Imported A", "Imported B"]);
    expect(s.activeTabId).toBe(s.tabs[0].id);
  });

  test("importing a multi-tab file keeps the selected workspace untouched", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.newWorkspace());
    const workspace = JSON.stringify({
      schemaVersion: 2,
      activeTabId: "a",
      tabs: [tab("a", "Imported A"), tab("b", "Imported B")],
    });
    await importFile(page, {
      name: "design-system.archidraw",
      mimeType: "application/json",
      buffer: Buffer.from(workspace, "utf-8"),
    });

    const s = await editorState();
    expect(s.workspaces.map((w) => w.name)).toEqual([
      "Workspace 1",
      "Workspace 2",
      "design-system",
    ]);
    expect(s.workspaces[1].canvases).toHaveLength(0);
    expect(s.activeWorkspaceId).toBe(s.workspaces[2].id);
  });

  test("importing a single-tab .archidraw file adds a canvas to the selected workspace", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const workspace = JSON.stringify({
      schemaVersion: 2,
      activeTabId: "a",
      tabs: [tab("a", "Imported A")],
    });
    await importFile(page, {
      name: "single.archidraw",
      mimeType: "application/json",
      buffer: Buffer.from(workspace, "utf-8"),
    });

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].canvases.map((c) => c.name)).toEqual([
      "Diagram 1",
      "Imported A",
    ]);
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
    expect(s.tabs.map((t) => t.name)).toEqual(["Diagram 1", "Imported A"]);
    expect(s.activeTabId).toBe(s.tabs[1].id);
  });

  test("importing a single-tab file without a name renames the canvas to the file name", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const workspace = JSON.stringify({
      schemaVersion: 2,
      activeTabId: "a",
      tabs: [tab("a", "Diagram 1")],
    });
    await importFile(page, {
      name: "landing-page.archidraw",
      mimeType: "application/json",
      buffer: Buffer.from(workspace, "utf-8"),
    });

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].canvases.map((c) => c.name)).toEqual([
      "Diagram 1",
      "landing-page",
    ]);
  });
});