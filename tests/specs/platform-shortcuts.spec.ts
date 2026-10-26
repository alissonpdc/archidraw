import { test, expect, drag, selectTool, open, type Page } from "../fixtures";

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const WIN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function createTwoRectangles(page: Page) {
  await selectTool(page, "2");
  await drag(page, { x: 300, y: 200 }, { x: 380, y: 260 });
  await drag(page, { x: 420, y: 200 }, { x: 500, y: 260 });
  await selectTool(page, "1");
  await drag(page, { x: 280, y: 180 }, { x: 520, y: 280 });
}

const isFirstLocked = (page: Page) =>
  page.evaluate(() => !!(window as any).__editor__.getSnapshot().doc.elements[0]?.locked);

test.describe("platform shortcuts on macOS", () => {
  test.use({ userAgent: MAC_UA });

  test("displays Mac shortcut symbols across tooltips, menus, and modals", async ({
    page,
    editorState,
  }) => {
    await open(page);

    const undoBtn = page.locator(".zoom-btn[aria-label='Undo']");
    const redoBtn = page.locator(".zoom-btn[aria-label='Redo']");
    await expect(undoBtn).toHaveAttribute("data-tip", "Undo (⌘+Z)");
    await expect(redoBtn).toHaveAttribute("data-tip", "Redo (⌘+Shift+Z)");

    await page.getByTestId("app-menu-button").click();
    const openItem = page.locator(".menu-item", { hasText: "Open" });
    const saveItem = page.locator(".menu-item", {
      has: page.locator(".menu-item-label", { hasText: /^Save$/ }),
    });
    const modeShortcut = page.locator(".menu-mode-shortcut");
    await expect(openItem).toContainText("⌘+O");
    await expect(saveItem).toContainText("⌘+S");
    await expect(modeShortcut).toHaveText("Shift+⌥+D");

    await page.keyboard.press("Escape");

    await page.keyboard.press("?");
    const shortcutsModal = page.locator(".shortcuts-modal");
    await expect(shortcutsModal).toBeVisible();
    await expect(shortcutsModal).toContainText("⌘+S");
    await expect(shortcutsModal).toContainText("⌘+Shift+Z");
    await expect(shortcutsModal).toContainText("Shift+⌥+D");
    await page.keyboard.press("Escape");

    await createTwoRectangles(page);
    await page.getByRole("button", { name: "Layers" }).click();

    const groupBtn = page.getByRole("button", { name: "Group", exact: true });
    const ungroupBtn = page.getByRole("button", { name: "Ungroup" });
    const lockBtn = page.locator(".properties-panel .size-btn[aria-label='Lock']");

    await expect(groupBtn).toHaveAttribute("data-tip", "Group (⌘+G)");
    await expect(ungroupBtn).toHaveAttribute("data-tip", "Ungroup (⌘+Shift+G)");
    await expect(lockBtn).toHaveAttribute("data-tip", "Lock (⌘+Shift+L)");

    await page.mouse.click(340, 230, { button: "right" });
    const contextMenu = page.getByTestId("context-menu");
    await expect(contextMenu).toBeVisible();
    await expect(page.getByTestId("context-menu-copy")).toContainText("⌘+C");
    await expect(page.getByTestId("context-menu-cut")).toContainText("⌘+X");
    await expect(page.getByTestId("context-menu-duplicate")).toContainText("⌘+D");
    await expect(page.getByTestId("context-menu-group")).toContainText("⌘+G");
    await expect(page.getByTestId("context-menu-toggle-lock")).toContainText("⌘+Shift+L");
    await page.keyboard.press("Escape");

    await page.keyboard.press("Meta+a");
    await page.keyboard.press("Meta+g");
    let state = await editorState();
    expect(state.elements[0].groupId).toBeTruthy();
    expect(state.elements[0].groupId).toBe(state.elements[1].groupId);

    await page.keyboard.press("Meta+Shift+g");
    state = await editorState();
    expect(state.elements[0].groupId).toBeUndefined();

    await page.keyboard.press("Meta+Shift+l");
    expect(await isFirstLocked(page)).toBe(true);
    await expect(page.locator(".properties-panel .size-btn[aria-label='Unlock']")).toHaveAttribute(
      "data-tip",
      "Unlock (⌘+Shift+L)",
    );

    await page.keyboard.press("Meta+Shift+l");
    expect(await isFirstLocked(page)).toBe(false);

    await page.keyboard.press("Meta+z");
    expect(await isFirstLocked(page)).toBe(true);

    await page.keyboard.press("Meta+Shift+z");
    expect(await isFirstLocked(page)).toBe(false);
  });
});

test.describe("platform shortcuts on Windows", () => {
  test.use({ userAgent: WIN_UA });

  test("displays Windows shortcut symbols across tooltips, menus, and modals", async ({
    page,
    editorState,
  }) => {
    await open(page);

    const undoBtn = page.locator(".zoom-btn[aria-label='Undo']");
    const redoBtn = page.locator(".zoom-btn[aria-label='Redo']");
    await expect(undoBtn).toHaveAttribute("data-tip", "Undo (Ctrl+Z)");
    await expect(redoBtn).toHaveAttribute("data-tip", "Redo (Ctrl+Y)");

    await page.getByTestId("app-menu-button").click();
    const openItem = page.locator(".menu-item", { hasText: "Open" });
    const saveItem = page.locator(".menu-item", {
      has: page.locator(".menu-item-label", { hasText: /^Save$/ }),
    });
    const modeShortcut = page.locator(".menu-mode-shortcut");
    await expect(openItem).toContainText("Ctrl+O");
    await expect(saveItem).toContainText("Ctrl+S");
    await expect(modeShortcut).toHaveText("Shift+Alt+D");

    await page.keyboard.press("Escape");

    await page.keyboard.press("?");
    const shortcutsModal = page.locator(".shortcuts-modal");
    await expect(shortcutsModal).toBeVisible();
    await expect(shortcutsModal).toContainText("Ctrl+S");
    await expect(shortcutsModal).toContainText("Ctrl+Y");
    await expect(shortcutsModal).toContainText("Shift+Alt+D");
    await page.keyboard.press("Escape");

    await createTwoRectangles(page);
    await page.getByRole("button", { name: "Layers" }).click();

    const groupBtn = page.getByRole("button", { name: "Group", exact: true });
    const ungroupBtn = page.getByRole("button", { name: "Ungroup" });
    const lockBtn = page.locator(".properties-panel .size-btn[aria-label='Lock']");

    await expect(groupBtn).toHaveAttribute("data-tip", "Group (Ctrl+G)");
    await expect(ungroupBtn).toHaveAttribute("data-tip", "Ungroup (Ctrl+Shift+G)");
    await expect(lockBtn).toHaveAttribute("data-tip", "Lock (Ctrl+Shift+L)");

    await page.mouse.click(340, 230, { button: "right" });
    const contextMenu = page.getByTestId("context-menu");
    await expect(contextMenu).toBeVisible();
    await expect(page.getByTestId("context-menu-copy")).toContainText("Ctrl+C");
    await expect(page.getByTestId("context-menu-cut")).toContainText("Ctrl+X");
    await expect(page.getByTestId("context-menu-duplicate")).toContainText("Ctrl+D");
    await expect(page.getByTestId("context-menu-group")).toContainText("Ctrl+G");
    await expect(page.getByTestId("context-menu-toggle-lock")).toContainText("Ctrl+Shift+L");
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+g");
    let state = await editorState();
    expect(state.elements[0].groupId).toBeTruthy();
    expect(state.elements[0].groupId).toBe(state.elements[1].groupId);

    await page.keyboard.press("Control+Shift+g");
    state = await editorState();
    expect(state.elements[0].groupId).toBeUndefined();

    await page.keyboard.press("Control+Shift+l");
    expect(await isFirstLocked(page)).toBe(true);
    await expect(page.locator(".properties-panel .size-btn[aria-label='Unlock']")).toHaveAttribute(
      "data-tip",
      "Unlock (Ctrl+Shift+L)",
    );

    await page.keyboard.press("Control+Shift+l");
    expect(await isFirstLocked(page)).toBe(false);

    await page.keyboard.press("Control+z");
    expect(await isFirstLocked(page)).toBe(true);

    await page.keyboard.press("Control+y");
    expect(await isFirstLocked(page)).toBe(false);
  });
});
