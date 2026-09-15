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

test.describe("archidraw workspace import", () => {
  test("importing a multi-tab .archidraw file adds new diagrams", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const workspace = JSON.stringify({
      schemaVersion: 2,
      activeTabId: "a",
      tabs: [
        {
          id: "a",
          name: "Imported A",
          doc: { schemaVersion: 1, elements: [] },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        },
        {
          id: "b",
          name: "Imported B",
          doc: { schemaVersion: 1, elements: [] },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        },
      ],
    });
    await page.setInputFiles("[data-testid=\"import-input\"]", {
      name: "pack.archidraw.json",
      mimeType: "application/json",
      buffer: Buffer.from(workspace, "utf-8"),
    });

    const s = await editorState();
    expect(s.tabs.map((t) => t.name)).toContain("Imported A");
    expect(s.tabs.map((t) => t.name)).toContain("Imported B");
    expect(s.tabs.length).toBeGreaterThanOrEqual(3);
  });
});