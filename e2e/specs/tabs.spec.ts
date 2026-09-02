import { test, expect, drag, selectTool, open } from "../fixtures";

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
    await page.evaluate((id) => window.__editor__.switchTab(id), firstTabId);
    s = await editorState();
    expect(s.elementCount).toBe(1);
  });

  test("switchTab via UI click works", async ({ page, editorState }) => {
    await page.click('[data-testid="tab-add"]');
    const s = await editorState();
    expect(s.tabs).toHaveLength(2);
    expect(s.tabs[1].name).toBe("Diagram 2");
  });

  test("segmented bar shows all tabs and switches on click", async ({
    page,
    editorState,
  }) => {
    await page.click('[data-testid="tab-add"]'); // Diagram 2 active

    const segs = page.locator(".tabbar-seg");
    await expect(segs).toHaveCount(2);
    await expect(segs.first()).toHaveText("Diagram 1");
    // sem separador junto à aba ativa (a cor já separa)
    await expect(page.locator(".tabbar-dot")).toHaveCount(0);

    await segs.first().click();
    const s = await editorState();
    expect(s.activeTabId).toBe(s.tabs[0].id);

    // com a 1ª aba ativa, o dot entre as duas inativas seguintes aparece
    await page.click('[data-testid="tab-add"]'); // Diagram 3 active
    await expect(page.locator(".tabbar-dot")).toHaveCount(1);
  });

  test("rename via double-click on segment", async ({ page, editorState }) => {
    await page.dblclick('[data-testid="tab-seg-Diagram 1"]');

    const input = page.locator(".tab-rename");
    await expect(input).toBeVisible();
    await input.fill("System Design Interview");
    await input.press("Enter");

    const s = await editorState();
    expect(s.tabs[0].name).toBe("System Design Interview");
  });

  test("empty rename keeps previous name", async ({ page, editorState }) => {
    await page.dblclick('[data-testid="tab-seg-Diagram 1"]');
    const input = page.locator(".tab-rename");
    await input.fill("   ");
    await input.press("Enter");

    const s = await editorState();
    expect(s.tabs[0].name).toBe("Diagram 1");
  });

  test("close button only on active tab, always visible", async ({
    page,
    editorState,
  }) => {
    await page.click('[data-testid="tab-add"]'); // Diagram 2 active

    // active tab: × visible
    const activeClose = page.locator('[data-testid="tab-close-Diagram 2"]');
    await expect(activeClose).toBeVisible();

    // inactive tab: no × at all
    const inactiveClose = page.locator('[data-testid="tab-close-Diagram 1"]');
    await expect(inactiveClose).toHaveCount(0);

    // switching moves the × to the newly active tab
    await page.click('[data-testid="tab-seg-Diagram 1"]');
    await expect(page.locator('[data-testid="tab-close-Diagram 1"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-close-Diagram 2"]')).toHaveCount(0);

    const s = await editorState();
    expect(s.activeTabId).toBe(s.tabs[0].id);
  });

  test("closing any tab shows confirmation popup", async ({
    page,
    editorState,
  }) => {
    await page.click('[data-testid="tab-add"]'); // empty Diagram 2 active
    await page.click('[data-testid="tab-close-Diagram 2"]');

    // even an empty tab asks for confirmation
    const dialog = page.locator('[data-testid="tab-close-confirm"]');
    await expect(dialog).toBeVisible();
    let s = await editorState();
    expect(s.tabs).toHaveLength(2);

    // confirm closes it
    await page.click('[data-testid="tab-close-confirm-btn"]');
    s = await editorState();
    expect(s.tabs).toHaveLength(1);
  });

  test("closing tab with elements shows confirmation popup", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await page.click('[data-testid="tab-close-Diagram 1"]');

    // popup appears, tab not closed yet
    const dialog = page.locator('[data-testid="tab-close-confirm"]');
    await expect(dialog).toBeVisible();
    let s = await editorState();
    expect(s.tabs).toHaveLength(1);

    // cancel keeps the tab
    await page.click('[data-testid="tab-close-cancel"]');
    await expect(dialog).toHaveCount(0);
    s = await editorState();
    expect(s.tabs).toHaveLength(1);

    // confirm closes it (replaced by fresh empty tab)
    await page.click('[data-testid="tab-close-Diagram 1"]');
    await page.click('[data-testid="tab-close-confirm-btn"]');
    s = await editorState();
    expect(s.tabs).toHaveLength(1);
    expect(s.elementCount).toBe(0);
  });

  test("closing the last tab replaces it with a fresh one", async ({
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

  test("tabs persist across reload with active tab restored", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 }); // rect in tab 1
    await page.click('[data-testid="tab-add"]'); // Diagram 2 active

    // rename active tab (Diagram 2) via double-click on its segment
    await page.dblclick('[data-testid="tab-seg-Diagram 2"]');
    const input = page.locator(".tab-rename");
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
    await page.evaluate((id) => window.__editor__.switchTab(id), s.tabs[0].id);
    const tab1 = await editorState();
    expect(tab1.elementCount).toBe(1);
  });

  test("dragging a segment reorders tabs", async ({ page, editorState }) => {
    await page.click('[data-testid="tab-add"]');
    await page.click('[data-testid="tab-add"]'); // 3 tabs

    const seg2 = page.locator('[data-testid="tab-seg-Diagram 2"]');
    const seg1 = page.locator('[data-testid="tab-seg-Diagram 1"]');
    const target = await seg1.boundingBox();
    const from = (await seg2.boundingBox())!;
    expect(target).not.toBeNull();

    // drag "Diagram 2" before "Diagram 1"
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target!.x + 5, target!.y + target!.height / 2, { steps: 8 });
    await page.mouse.up();

    const s = await editorState();
    expect(s.tabs.map((t) => t.name)).toEqual([
      "Diagram 2",
      "Diagram 1",
      "Diagram 3",
    ]);
  });
});
