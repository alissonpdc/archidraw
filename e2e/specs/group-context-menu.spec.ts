import { test, expect, open, drag, selectTool, type Page } from "../fixtures";

const RECT = { a: { x: 200, y: 150 }, b: { x: 320, y: 220 } };
const RECT2 = { a: { x: 360, y: 150 }, b: { x: 480, y: 220 } };

async function drawRect(
  page: Page,
  from: { x: number; y: number } = RECT.a,
  to: { x: number; y: number } = RECT.b,
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

async function rightClickElement(page: Page, x: number, y: number) {
  await page.mouse.click(x, y, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
}

async function selectBoth(page: Page) {
  await page.keyboard.press("ControlOrMeta+a");
}

test.describe("group / ungroup (context menu)", () => {
  test("right-click on multi-selection shows Group option", async ({ page }) => {
    await open(page);
    await drawRect(page, RECT.a, RECT.b);
    await drawRect(page, RECT2.a, RECT2.b);
    await selectBoth(page);

    await rightClickElement(page, 260, 185);

    await expect(page.getByTestId("context-menu-group")).toBeVisible();
    await expect(page.getByTestId("context-menu-group")).toHaveText(/Group/);
  });

  test("right-click on single element shows Group but disabled", async ({ page }) => {
    await open(page);
    await drawRect(page);

    await rightClickElement(page, 260, 185);

    await expect(page.getByTestId("context-menu-group")).toBeVisible();
    await expect(page.getByTestId("context-menu-group")).toBeDisabled();
  });

  test("Group via context menu assigns same groupId to all selected", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, RECT.a, RECT.b);
    await drawRect(page, RECT2.a, RECT2.b);
    await selectBoth(page);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-group").click();

    const s = await editorState();
    expect(s.selectedIds).toHaveLength(2);
    const gids = s.elements.map((el) => el.groupId);
    expect(gids[0]).toBeTruthy();
    expect(gids[0]).toBe(gids[1]);
  });

  test("Ungroup via context menu removes groupId from group", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, RECT.a, RECT.b);
    await drawRect(page, RECT2.a, RECT2.b);
    await selectBoth(page);

    // group first
    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-group").click();

    // ungroup
    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-ungroup").click();

    const s = await editorState();
    for (const el of s.elements) {
      expect(el.groupId).toBeUndefined();
    }
  });

  test("Ungroup is disabled when no element has a groupId", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, RECT.a, RECT.b);
    await drawRect(page, RECT2.a, RECT2.b);
    await selectBoth(page);

    await rightClickElement(page, 260, 185);

    await expect(page.getByTestId("context-menu-ungroup")).toBeVisible();
    await expect(page.getByTestId("context-menu-ungroup")).toBeDisabled();
  });

  test("context menu closes after Group click", async ({ page }) => {
    await open(page);
    await drawRect(page, RECT.a, RECT.b);
    await drawRect(page, RECT2.a, RECT2.b);
    await selectBoth(page);

    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-group").click();

    await expect(page.getByTestId("context-menu")).toHaveCount(0);
  });

  test("context menu closes after Ungroup click", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page, RECT.a, RECT.b);
    await drawRect(page, RECT2.a, RECT2.b);
    await selectBoth(page);

    // group first
    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-group").click();

    // ungroup
    await rightClickElement(page, 260, 185);
    await page.getByTestId("context-menu-ungroup").click();

    await expect(page.getByTestId("context-menu")).toHaveCount(0);
  });

  test("right-click on empty canvas does not show Group/Ungroup", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(600, 400);
    await expect
      .poll(async () => (await editorState()).selectedIds.length)
      .toBe(0);

    await page.mouse.click(600, 400, { button: "right" });
    await expect(page.getByTestId("context-menu")).toBeVisible();
    await expect(page.getByTestId("context-menu-group")).toHaveCount(0);
    await expect(page.getByTestId("context-menu-ungroup")).toHaveCount(0);
  });
});
