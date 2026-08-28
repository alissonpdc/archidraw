import { test, expect, drag, selectTool, open, type Page } from "../fixtures";

/** creates two rectangles and switches back to selection tool */
async function createRects(page: Page) {
  await selectTool(page, "r");
  await drag(page, { x: 100, y: 100 }, { x: 180, y: 160 });
  await drag(page, { x: 260, y: 100 }, { x: 340, y: 160 });
  await selectTool(page, "v");
}

/** marquee-selects both rectangles */
async function selectBoth(page: Page) {
  await drag(page, { x: 80, y: 80 }, { x: 360, y: 180 });
}

/** opens the Layers tab of the properties panel */
async function openLayersTab(page: Page) {
  await page.getByRole("button", { name: "Layers" }).click();
}

test.describe("grouping", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await createRects(page);
    await selectBoth(page);
    await openLayersTab(page);
  });

  test("Group button assigns the same groupId to all selected", async ({
    page,
    editorState,
  }) => {
    await page.getByRole("button", { name: "Group", exact: true }).click();

    const s = await editorState();
    expect(s.selectedIds).toHaveLength(2);
    const gids = s.elements.map((el) => el.groupId);
    expect(gids[0]).toBeTruthy();
    expect(gids[0]).toBe(gids[1]);
  });

  test("Ungroup button removes groupId from the group", async ({
    page,
    editorState,
  }) => {
    await page.getByRole("button", { name: "Group", exact: true }).click();
    await page.getByRole("button", { name: "Ungroup" }).click();

    const s = await editorState();
    for (const el of s.elements) {
      expect(el.groupId).toBeUndefined();
    }
  });

  test("Ungroup is disabled without a group", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Ungroup" })).toBeDisabled();
  });

  test("clicking a grouped element selects the whole group", async ({
    page,
    editorState,
  }) => {
    await page.getByRole("button", { name: "Group", exact: true }).click();
    await page.mouse.click(300, 130); // plain click on second rect

    const s = await editorState();
    expect(s.selectedIds).toHaveLength(2);
  });

  test("undo restores ungrouped state", async ({ page, editorState }) => {
    await page.getByRole("button", { name: "Group", exact: true }).click();
    await page.keyboard.press("Control+z");

    const s = await editorState();
    for (const el of s.elements) {
      expect(el.groupId).toBeUndefined();
    }
  });

  test("mod+g groups and mod+shift+g ungroups", async ({
    page,
    editorState,
  }) => {
    await page.keyboard.press("Control+g");

    let s = await editorState();
    const gid = s.elements[0].groupId;
    expect(gid).toBeTruthy();
    expect(s.elements[1].groupId).toBe(gid);

    await page.keyboard.press("Control+Shift+g");

    s = await editorState();
    for (const el of s.elements) {
      expect(el.groupId).toBeUndefined();
    }
  });

  test("duplicating a group creates an independent copy", async ({
    page,
    editorState,
  }) => {
    await page.getByRole("button", { name: "Group", exact: true }).click();
    await page.keyboard.press("Control+d");

    const s = await editorState();
    expect(s.elementCount).toBe(4);
    const originals = s.elements.slice(0, 2).map((el) => el.groupId);
    const clones = s.elements.slice(2).map((el) => el.groupId);
    // each pair shares a group, but the two groups are distinct
    expect(originals[0]).toBeTruthy();
    expect(originals[0]).toBe(originals[1]);
    expect(clones[0]).toBeTruthy();
    expect(clones[0]).toBe(clones[1]);
    expect(clones[0]).not.toBe(originals[0]);
  });
});
