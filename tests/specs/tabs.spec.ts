import { test, expect, drag, selectTool, open } from "../fixtures";

const ws1 = (page: any) => page.locator('[data-testid="ws-group-Workspace 1"]');

test.describe("tabs", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("starts with a single default tab", async ({ editorState }) => {
    const s = await editorState();
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0].name).toBe("Diagram 1");
    expect(s.activeTabId).toBe(s.tabs[0].id);
  });

  test("addTab creates and activates a new tab", async ({ page, editorState }) => {
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });

    await page.evaluate(() => window.__editor__.addTab());

    const s = await editorState();
    expect(s.tabs).toHaveLength(2);
    expect(s.activeTabId).toBe(s.tabs[1].id);
    expect(s.elementCount).toBe(0); // new tab is empty
    expect(s.tabs[1].name).toBe("Diagram 2");
  });

  test("elements are isolated per tab", async ({ page, editorState }) => {
    // tab 1: one rectangle
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });

    const first = await editorState();
    const firstTabId = first.activeTabId;

    // tab 2: one arrow
    await page.evaluate(() => window.__editor__.addTab());
    await selectTool(page, "6");
    await drag(page, { x: 300, y: 300 }, { x: 450, y: 400 });

    let s = await editorState();
    expect(s.elementCount).toBe(1);

    // back to tab 1: rectangle is still there
    await page.evaluate((id: string) => window.__editor__.switchTab(id), firstTabId);
    s = await editorState();
    expect(s.elementCount).toBe(1);
  });

  test("panel add-canvas creates and activates a new tab", async ({
    page,
    editorState,
  }) => {
    await page.click('[data-testid="panel-toggle"]');
    await ws1(page).locator('[data-testid="ws-add-canvas"]').click();

    const s = await editorState();
    expect(s.tabs).toHaveLength(2);
    expect(s.tabs[1].name).toBe("Diagram 2");
    expect(s.activeTabId).toBe(s.tabs[1].id);
  });

  test("tree shows all canvases and switches on click", async ({
    page,
    editorState,
  }) => {
    await page.click('[data-testid="panel-toggle"]');
    await ws1(page).locator('[data-testid="ws-add-canvas"]').click();
    await ws1(page).locator('[data-testid="ws-add-canvas"]').click(); // Diagram 3 active

    await expect(ws1(page).locator('[data-testid="ws-canvas-Diagram 1"]')).toBeAttached();
    await expect(ws1(page).locator('[data-testid="ws-canvas-Diagram 2"]')).toBeAttached();

    await ws1(page).locator('[data-testid="ws-canvas-Diagram 1"]').click();
    const s = await editorState();
    expect(s.activeTabId).toBe(s.tabs[0].id);
  });

  test("rename via double-click on tree row", async ({ page, editorState }) => {
    await page.click('[data-testid="panel-toggle"]');
    await page.dblclick('[data-testid="ws-canvas-Diagram 1"] .tree-name');

    const input = page.locator('[data-testid="rename-input"]');
    await expect(input).toBeVisible();
    await input.fill("System Design Interview");
    await input.press("Enter");

    const s = await editorState();
    expect(s.tabs[0].name).toBe("System Design Interview");
  });

  test("empty rename keeps previous name", async ({ page, editorState }) => {
    await page.click('[data-testid="panel-toggle"]');
    await page.dblclick('[data-testid="ws-canvas-Diagram 1"] .tree-name');
    const input = page.locator('[data-testid="rename-input"]');
    await input.fill("   ");
    await input.press("Enter");

    const s = await editorState();
    expect(s.tabs[0].name).toBe("Diagram 1");
  });

  test("closing a canvas shows confirmation popup", async ({
    page,
    editorState,
  }) => {
    await page.click('[data-testid="panel-toggle"]');
    await ws1(page).locator('[data-testid="ws-add-canvas"]').click(); // Diagram 2 active

    await ws1(page)
      .locator('[data-testid="ws-canvas-Diagram 2"]')
      .locator('[data-testid="ws-canvas-close"]')
      .click();

    const dialog = page.locator('[data-testid="ws-confirm"]');
    await expect(dialog).toBeVisible();
    let s = await editorState();
    expect(s.tabs).toHaveLength(2);

    // confirm closes it
    await page.click('[data-testid="ws-confirm-btn"]');
    s = await editorState();
    expect(s.tabs).toHaveLength(1);
  });

  test("cancel in the confirmation popup keeps the canvas", async ({
    page,
    editorState,
  }) => {
    await page.click('[data-testid="panel-toggle"]');
    await ws1(page).locator('[data-testid="ws-add-canvas"]').click();
    await ws1(page)
      .locator('[data-testid="ws-canvas-Diagram 2"]')
      .locator('[data-testid="ws-canvas-close"]')
      .click();

    await expect(page.locator('[data-testid="ws-confirm"]')).toBeVisible();
    await page.click('[data-testid="ws-confirm-cancel"]');
    await expect(page.locator('[data-testid="ws-confirm"]')).toHaveCount(0);

    const s = await editorState();
    expect(s.tabs).toHaveLength(2);
  });

  test("switching active canvas moves selection", async ({
    page,
    editorState,
  }) => {
    await page.click('[data-testid="panel-toggle"]');
    await ws1(page).locator('[data-testid="ws-add-canvas"]').click(); // Diagram 2 active

    const s0 = await editorState();
    expect(s0.activeTabId).toBe(s0.tabs[1].id);

    await ws1(page).locator('[data-testid="ws-canvas-Diagram 1"]').click();
    const s = await editorState();
    expect(s.activeTabId).toBe(s.tabs[0].id);
  });

  test("closing the last canvas replaces it with a fresh one", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await page.evaluate(() => {
      const ed = window.__editor__;
      ed.closeTab(ed.getSnapshot().activeTabId);
    });

    const s = await editorState();
    expect(s.tabs).toHaveLength(1);
    expect(s.elementCount).toBe(0);
  });

  test("canvases persist across reload with active canvas restored", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 }); // rect in tab 1
    await page.click('[data-testid="panel-toggle"]');
    await ws1(page).locator('[data-testid="ws-add-canvas"]').click(); // Diagram 2 active

    // rename active canvas (Diagram 2)
    await page.dblclick('[data-testid="ws-canvas-Diagram 2"] .tree-name');
    const input = page.locator('[data-testid="rename-input"]');
    await input.fill("Architecture");
    await input.press("Enter");
    await page.waitForTimeout(700); // autosave flush

    await page.reload();
    await open(page);

    const s = await editorState();
    expect(s.tabs.map((t) => t.name)).toEqual(["Diagram 1", "Architecture"]);
    expect(s.activeTabId).toBe(s.tabs[1].id);
    expect(s.elementCount).toBe(0);

    // tab 1 content intact
    await page.evaluate((id: string) => window.__editor__.switchTab(id), s.tabs[0].id);
    const tab1 = await editorState();
    expect(tab1.elementCount).toBe(1);
  });

  test("dragging a tree row reorders canvases", async ({ page, editorState }) => {
    await page.click('[data-testid="panel-toggle"]');
    await ws1(page).locator('[data-testid="ws-add-canvas"]').click();
    await ws1(page).locator('[data-testid="ws-add-canvas"]').click(); // 3 canvases

    const row2 = ws1(page).locator('[data-testid="ws-canvas-Diagram 2"]');
    const row1 = page.locator('[data-testid="ws-canvas-Diagram 1"]');
    const target = await row1.boundingBox();
    const from = (await row2.boundingBox())!;
    expect(target).not.toBeNull();

    // drag "Diagram 2" above "Diagram 1"
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target!.x + 20, target!.y + target!.height / 2, { steps: 8 });
    await page.mouse.up();

    const s = await editorState();
    expect(s.tabs.map((t) => t.name)).toEqual([
      "Diagram 2",
      "Diagram 1",
      "Diagram 3",
    ]);
  });
});
