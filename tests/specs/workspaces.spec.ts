import { test, expect, drag, selectTool, open } from "../fixtures";

const panel = (page: any) => page.locator('[data-testid="workspace-panel"]');

const openPanel = async (page: any) => {
  await page.click('[data-testid="panel-toggle"]');
  await expect(page.locator('[data-testid="panel-toggle"]')).toHaveClass(/open/);
};

const groupFor = (page: any, wsName: string) =>
  page.locator(`[data-testid="ws-group-${wsName}"]`);

test.describe("workspaces panel", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("toggle button opens and closes the panel", async ({ page }) => {
    const toggle = page.locator('[data-testid="panel-toggle"]');
    await expect(panel(page)).toHaveAttribute("data-open", "false");
    await toggle.click();
    await expect(panel(page)).toHaveAttribute("data-open", "true");
    await toggle.click();
    await expect(panel(page)).toHaveAttribute("data-open", "false");
  });

  test("letter W toggles the panel", async ({ page }) => {
    await page.keyboard.press("w");
    await expect(panel(page)).toHaveAttribute("data-open", "true");
    await page.keyboard.press("w");
    await expect(panel(page)).toHaveAttribute("data-open", "false");
  });

  test("opening the panel clears the selection", async ({ page }) => {
    await selectTool(page, "2");
    await drag(page, { x: 400, y: 300 }, { x: 520, y: 380 });
    await selectTool(page, "1");
    await page.mouse.click(460, 340); // select the rectangle
    // properties panel visible while selection exists
    await expect(page.locator(".properties-panel")).toBeVisible();
    // opening the panel drops the selection: the properties panel sits at
    // the left edge and would overlap the popup
    await page.keyboard.press("w");
    await expect(page.locator('[data-testid="panel-toggle"]')).toHaveClass(/open/);
    await expect(page.locator(".properties-panel")).toHaveCount(0);
  });

  test("workspaces heading puts the add button on the right", async ({ page }) => {
    await openPanel(page);
    const title = await page.locator(".wp-title").boundingBox();
    const add = await page.locator('[data-testid="ws-add"]').boundingBox();
    expect(add!.x).toBeGreaterThan(title!.x + title!.width - 4);
  });

  test("toggle button stays in place; the panel overlays the canvas", async ({
    page,
  }) => {    const toggle = page.locator('[data-testid="panel-toggle"]');
    const closed = (await toggle.boundingBox())!;
    const canvas = await page.locator("canvas").boundingBox();
    await openPanel(page);
    const openBox = (await toggle.boundingBox())!;
    await expect
      .poll(async () => (await panel(page).boundingBox())?.x ?? -999)
      .toBeGreaterThan(-50);
    const panelBox = (await panel(page).boundingBox())!;
    expect(openBox.x).toBeCloseTo(closed.x, 0);
    expect(panelBox.x + panelBox.width).toBeGreaterThan(
      (canvas?.x ?? 0) + (canvas?.width ?? 0) / 6,
    );
    // 50% of the viewport height, vertically centered
    expect(panelBox.height).toBeCloseTo(400, 0);
    expect(panelBox.y + panelBox.height / 2).toBeCloseTo(400, 0);
  });

  test("panel opens remembered across reloads", async ({ page }) => {
    await openPanel(page);
    await page.reload();
    await open(page);
    await expect(panel(page)).toHaveAttribute("data-open", "true");
  });

  test("default workspace and canvas are present", async ({ editorState }) => {
    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].name).toBe("Workspace 1");
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
    expect(s.workspaces[0].canvases.map((c) => c.name)).toEqual(["Diagram 1"]);
  });

  test("new workspace is created, activated and renamable", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');

    let s = await editorState();
    expect(s.workspaces).toHaveLength(2);
    expect(s.workspaces[1].name).toBe("Workspace 2");
    expect(s.activeWorkspaceId).toBe(s.workspaces[1].id);

    await page.dblclick('[data-testid="ws-row-Workspace 2"] .work-name');
    const input = page.locator('[data-testid="rename-input"]');
    await input.fill("Cluster Design");
    await input.press("Enter");

    s = await editorState();
    expect(s.workspaces[1].name).toBe("Cluster Design");
  });

  test("empty workspace rename keeps previous name", async ({ page, editorState }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await page.dblclick('[data-testid="ws-row-Workspace 2"] .work-name');
    const input = page.locator('[data-testid="rename-input"]');
    await input.fill("   ");
    await input.press("Enter");

    const s = await editorState();
    expect(s.workspaces[1].name).toBe("Workspace 2");
  });

  test("elements are isolated across workspaces", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 400, y: 300 }, { x: 520, y: 380 }); // rect in ws1

    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    let s = await editorState();
    expect(s.activeWorkspaceId).toBe(s.workspaces[1].id);
    expect(s.elementCount).toBe(0);

    await selectTool(page, "6");
    await drag(page, { x: 500, y: 400 }, { x: 650, y: 500 }); // arrow in ws2
    s = await editorState();
    expect(s.elementCount).toBe(1);

    await groupFor(page, "Workspace 1").locator('[data-testid="ws-canvas-Diagram 1"]').click();
    s = await editorState();
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
    expect(s.elementCount).toBe(1);
  });

  test("canvas row of a non-active workspace activates it", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');

    const s0 = await editorState();
    expect(s0.activeWorkspaceId).toBe(s0.workspaces[1].id);

    await groupFor(page, "Workspace 1").locator('[data-testid="ws-canvas-Diagram 1"]').click();
    const s = await editorState();
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
  });

  test("caret collapses and expands the canvas list", async ({ page }) => {
    await openPanel(page);
    const caret = page.locator('[data-testid="ws-caret-Workspace 1"]');
    const row = page.locator('[data-testid="ws-canvas-Diagram 1"]');
    await expect(row).toBeVisible();

    await caret.click();
    await expect(row).toHaveCount(0);
    await caret.click();
    await expect(row).toBeVisible();
  });

  test("clicking a workspace row toggles its canvases without opening it", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]'); // Workspace 2 active, both expanded
    const ws1Canvas = groupFor(page, "Workspace 1").locator('[data-testid="ws-canvas-Diagram 1"]');
    await expect(ws1Canvas).toBeVisible();

    await page.locator('[data-testid="ws-row-Workspace 1"]').click();
    await expect(ws1Canvas).toHaveCount(0);
    let s = await editorState();
    expect(s.activeWorkspaceId).toBe(s.workspaces[1].id);

    await page.locator('[data-testid="ws-row-Workspace 1"]').click();
    await expect(ws1Canvas).toBeVisible();
    s = await editorState();
    expect(s.activeWorkspaceId).toBe(s.workspaces[1].id);
  });

  test("empty workspace offers a New canvas shortcut", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await expect(groupFor(page, "Workspace 2").locator('[data-testid="ws-empty-row"]')).toBeVisible();

    await groupFor(page, "Workspace 2").locator('[data-testid="ws-empty-row"]').click();
    const s = await editorState();
    expect(s.workspaces[1].canvases.map((c) => c.name)).toEqual(["Diagram 1"]);
  });

  test("Escape cancels the delete confirmation", async ({ page, editorState }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await page.click('[data-testid="ws-delete"]');
    await expect(page.locator('[data-testid="ws-confirm"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="ws-confirm"]')).toHaveCount(0);
    const s = await editorState();
    expect(s.workspaces).toHaveLength(2);
  });

  test("Escape in a rename field keeps the previous name", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.dblclick('[data-testid="ws-row-Workspace 1"] .work-name');
    const input = page.locator('[data-testid="rename-input"]');
    await input.fill("Renamed!");
    await input.press("Escape");
    await expect(input).toHaveCount(0);
    const s = await editorState();
    expect(s.workspaces[0].name).toBe("Workspace 1");
  });

  test("typing W inside a rename field does not toggle the panel", async ({
    page,
  }) => {
    await openPanel(page);
    await page.dblclick('[data-testid="ws-row-Workspace 1"] .work-name');
    const input = page.locator('[data-testid="rename-input"]');
    await input.press("w");
    await expect(input).toHaveValue("w");
    await expect(page.locator('[data-testid="workspace-panel"]')).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  test("renaming a canvas of a non-active workspace", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await groupFor(page, "Workspace 2").locator('[data-testid="ws-add-canvas"]').click();
    expect(await editorState()).toMatchObject({ workspaces: [{ name: "Workspace 1" }, { name: "Workspace 2" }] });

    // go back to Workspace 1 — the renamed canvas belongs to the non-active ws
    await groupFor(page, "Workspace 1").locator('[data-testid="ws-canvas-Diagram 1"]').click();
    const s0 = await editorState();
    expect(s0.activeWorkspaceId).toBe(s0.workspaces[0].id);

    await groupFor(page, "Workspace 2")
      .locator('[data-testid="ws-canvas-Diagram 1"]')
      .locator(".tree-name")
      .dblclick();
    const input = page.locator('[data-testid="rename-input"]');
    await input.fill("Renamed Canvas");
    await input.press("Enter");

    const s = await editorState();
    expect(s.workspaces[1].canvases.map((c) => c.name)).toEqual(["Renamed Canvas"]);
    // empty rename is ignored (via the editor API of the non-active workspace)
    await page.evaluate(
      ([wsId, canvasId]) => (window as any).__editor__.renameCanvasOf(wsId, canvasId, "   "),
      [s.workspaces[1].id, s.workspaces[1].canvases[0].id],
    );
    const after = await editorState();
    expect(after.workspaces[1].canvases[0].name).toBe("Renamed Canvas");
  });

  test("closing the last canvas of a non-active workspace spawns a fresh one", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await groupFor(page, "Workspace 2").locator('[data-testid="ws-add-canvas"]').click();
    await groupFor(page, "Workspace 1").locator('[data-testid="ws-canvas-Diagram 1"]').click();

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ws2 = ed.getSnapshot().workspaces[1];
      ed.closeCanvasOf(ws2.id, ws2.canvases[0].id);
    });

    const s = await editorState();
    expect(s.workspaces[1].canvases).toHaveLength(1);
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
  });

  test("deleting a non-active workspace does not change the active one", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await groupFor(page, "Workspace 1").locator('[data-testid="ws-canvas-Diagram 1"]').click();
    expect(await editorState()).toMatchObject({ workspaces: [{ name: "Workspace 1" }, { name: "Workspace 2" }] });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.deleteWorkspace(ed.getSnapshot().workspaces[1].id);
    });

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
  });

  test("deleting every workspace recreates a fresh default", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      // ws-add made Workspace 2 the active one
      ed.deleteWorkspace(ed.getSnapshot().workspaces[1].id);
      // deleting the remaining (active) workspace spawns a fresh default
      ed.deleteWorkspace(ed.getSnapshot().workspaces[0].id);
    });

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].name).toBe("Workspace 1");
    expect(s.workspaces[0].canvases.map((c) => c.name)).toEqual(["Diagram 1"]);
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
  });

  test("editing APIs work on multi-canvas non-active workspaces", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await groupFor(page, "Workspace 2").locator('[data-testid="ws-add-canvas"]').click();
    await groupFor(page, "Workspace 2").locator('[data-testid="ws-add-canvas"]').click();
    // leave Workspace 1 active
    await groupFor(page, "Workspace 1").locator('[data-testid="ws-canvas-Diagram 1"]').click();

    const result = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ws2 = ed.getSnapshot().workspaces[1];
      const first = ws2.canvases[0];
      ed.renameCanvasOf(ws2.id, first.id, "Renamed!");
      // active workspace routed through renameTab via the same API
      const snap = ed.getSnapshot();
      ed.renameCanvasOf(snap.activeWorkspaceId, snap.activeTabId, "Active Renamed");
      ed.closeCanvasOf(ws2.id, first.id);
      // now close the CURRENTLY-ACTIVE canvas of ws2 → neighbor becomes active
      ed.closeCanvasOf(
        (window as any).__editor__.getSnapshot().workspaces[1].id,
        (window as any).__editor__.getSnapshot().workspaces[1].canvases[0].id,
      );
      const after = ed.getSnapshot();
      return {
        ws2: after.workspaces[1].canvases.map((c: any) => c.name),
        tabNames: after.doc.elements.length,
      };
    });

    expect(result.ws2).toEqual(["Diagram 3"]);
    const s = await editorState();
    expect(s.tabs[0].name).toBe("Active Renamed");
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
    expect(s.workspaces[1].canvases.map((c) => c.name)).toEqual(["Diagram 3"]);
  });

  test("importing a document into a workspace without canvases seeds one", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]'); // empty Workspace 2 active

    await page.evaluate(() => {
      (window as any).__editor__.importDocument({ schemaVersion: 1, elements: [] });
    });

    const s = await editorState();
    expect(s.workspaces[1].canvases.map((c) => c.name)).toEqual(["Imported"]);
    expect(s.activeWorkspaceId).toBe(s.workspaces[1].id);
  });

  test("index with an unknown activeId falls back to the first workspace", async ({
    page,
    editorState,
  }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem(
        "archidraw:workspaces",
        JSON.stringify({
          metas: [{ id: "ws_only", name: "Only WS", updatedAt: 1 }],
          activeId: "ws_missing",
        }),
      );
      localStorage.setItem(
        "archidraw:workspaces:ws_only",
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "tab_t1",
          tabs: [
            {
              id: "tab_t1",
              name: "Tab One",
              doc: { schemaVersion: 1, elements: [] },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
    });
    await open(page);

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
  });

  test("blob with an unknown activeTabId falls back to the first canvas", async ({
    page,
    editorState,
  }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem(
        "archidraw:workspaces",
        JSON.stringify({
          metas: [{ id: "ws_only", name: "Only WS", updatedAt: 1 }],
          activeId: "ws_only",
        }),
      );
      localStorage.setItem(
        "archidraw:workspaces:ws_only",
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "tab_missing",
          tabs: [
            {
              id: "tab_t1",
              name: "Tab One",
              doc: { schemaVersion: 1, elements: [] },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
    });
    await open(page);

    const s = await editorState();
    expect(s.workspaces[0].canvases.map((c) => c.name)).toEqual(["Tab One"]);
    expect(s.tabs[0].name).toBe("Tab One");
    expect(s.activeTabId).toBe(s.tabs[0].id);
  });

  test("editing APIs ignore unknown workspace/canvas ids", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    const s0 = await editorState();

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.openWorkspace("ws_nope");
      ed.renameWorkspace("ws_nope", "X");
      ed.deleteWorkspace("ws_nope");
      ed.reorderWorkspaces("ws_nope", 0);
      ed.addCanvasTo("ws_nope");
      ed.renameCanvasOf("ws_nope", "tab_nope", "X");
      ed.reorderCanvasOf("ws_nope", "tab_nope", 0);
      ed.closeCanvasOf("ws_nope", "tab_nope");
      // existing workspace + unknown canvas id
      const ws1 = ed.getSnapshot().workspaces[0];
      ed.closeCanvasOf(ws1.id, "tab_nope");
      ed.reorderCanvasOf(ws1.id, "tab_nope", 0);
    });

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].id).toBe(s0.workspaces[0].id);
    expect(s.workspaces[0].canvases).toHaveLength(1);
  });

  test("malformed index shapes boot clean", async ({ page, editorState }) => {
    const bads = ["5", "[1, 2]", '{"metas": {}}', '{"metas": [["x"]], "activeId": 3}'];
    for (const bad of bads) {
      await page.addInitScript((payload: string) => {
        localStorage.clear();
        localStorage.setItem("archidraw:workspaces", payload);
      }, bad);
      await open(page);
      const s = await editorState();
      expect(s.workspaces.map((w) => w.name)).toEqual(["Workspace 1"]);
      // the hydrate fallback rewrites a valid index (bogus activeId tolerated)
      const index = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("archidraw:workspaces") || "null"),
      );
      expect(index.metas).toHaveLength(1);
      expect(typeof index.activeId).toBe("string");
    }
  });

  test("corrupted workspace index does not crash the app", async ({
    page,
    editorState,
  }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("archidraw:workspaces", "{invalid json!!");
    });
    await open(page);

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].name).toBe("Workspace 1");
    expect(s.workspaces[0].canvases.map((c) => c.name)).toEqual(["Diagram 1"]);
  });

  test("registry entry with corrupted blob data is skipped", async ({
    page,
    editorState,
  }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem(
        "archidraw:workspaces",
        JSON.stringify({
          metas: [
            { id: "ws_kept", name: "Good WS", updatedAt: 1 },
            "not-a-meta",
            { id: "ws_broken", name: "Broken WS", updatedAt: 1 },
          ],
          activeId: "ws_kept",
        }),
      );
      localStorage.setItem(
        "archidraw:workspaces:ws_kept",
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "tab_g1",
          tabs: [
            {
              id: "tab_g1",
              name: "Good Diagram",
              doc: { schemaVersion: 1, elements: [] },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
      localStorage.setItem("archidraw:workspaces:ws_broken", "{broken{");
    });
    await open(page);

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].name).toBe("Good WS");
    expect(s.workspaces[0].canvases.map((c) => c.name)).toEqual(["Good Diagram"]);
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
  });

  test("deleting a workspace asks for confirmation and removes it", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');

    await groupFor(page, "Workspace 2").locator('[data-testid="ws-delete"]').click();
    const dialog = page.locator('[data-testid="ws-confirm"]');
    await expect(dialog).toBeVisible();

    await page.click('[data-testid="ws-confirm-btn"]');

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].name).toBe("Workspace 1");
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
  });

  test("cancel in the workspace confirmation keeps it", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');

    await groupFor(page, "Workspace 2").locator('[data-testid="ws-delete"]').click();
    await page.click('[data-testid="ws-confirm-cancel"]');

    const s = await editorState();
    expect(s.workspaces).toHaveLength(2);
  });

  test("deleting the active workspace falls back to a neighbor", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');

    await groupFor(page, "Workspace 2").locator('[data-testid="ws-delete"]').click();
    await page.click('[data-testid="ws-confirm-btn"]');

    const s = await editorState();
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
    expect(s.workspaces).toHaveLength(1);
  });

  test("dragging a workspace reorders the tree", async ({ page, editorState }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');

    const row2 = page.locator('[data-testid="ws-row-Workspace 2"]');
    const row1 = page.locator('[data-testid="ws-row-Workspace 1"]');
    const from = (await row2.boundingBox())!;
    const target = (await row1.boundingBox())!;

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 20, target.y + target.height / 2, { steps: 8 });
    await page.mouse.up();

    const s = await editorState();
    expect(s.workspaces.map((w) => w.name)).toEqual(["Workspace 2", "Workspace 1"]);
  });

  test("quick pointer drag without repositioning keeps the order", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');

    const row2 = page.locator('[data-testid="ws-row-Workspace 2"]');
    const row1 = page.locator('[data-testid="ws-row-Workspace 1"]');
    const from = (await row2.boundingBox())!;
    const target = (await row1.boundingBox())!;

    // single long move + immediate release: the drop preview never settles
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    // sub-threshold jiggle (2px) must NOT start a drag
    await page.mouse.move(from.x + from.width / 2 + 2, from.y + from.height / 2);
    await page.mouse.move(target.x, target.y - 20, { steps: 1 });
    await page.mouse.up();
    await page.waitForTimeout(60); // lets the post-drag cleanup timer run

    // the fallback path keeps the base order (drag had no settled position)
    const s = await editorState();
    expect(s.workspaces.map((w) => w.name)).toEqual(["Workspace 1", "Workspace 2"]);
  });

  test("dragging a canvas inside a non-active workspace reorders it", async ({
    page,
    editorState,
  }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await groupFor(page, "Workspace 2").locator('[data-testid="ws-add-canvas"]').click();
    await groupFor(page, "Workspace 2").locator('[data-testid="ws-add-canvas"]').click();

    // go back to Workspace 1 so the dragged rows belong to a non-active ws
    await groupFor(page, "Workspace 1").locator('[data-testid="ws-canvas-Diagram 1"]').click();
    const s0 = await editorState();
    expect(s0.activeWorkspaceId).toBe(s0.workspaces[0].id);

    const row2 = groupFor(page, "Workspace 2").locator('[data-testid="ws-canvas-Diagram 2"]');
    const row1 = groupFor(page, "Workspace 2").locator('[data-testid="ws-canvas-Diagram 1"]');
    const from = (await row2.boundingBox())!;
    const target = (await row1.boundingBox())!;

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 20, target.y + target.height / 2, { steps: 8 });
    await page.mouse.up();

    const s = await editorState();
    const ws2 = s.workspaces[1];
    expect(ws2.canvases.map((c) => c.name)).toEqual(["Diagram 2", "Diagram 1"]);
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
    await page.waitForTimeout(60); // post-drag cleanup timer (movedRef reset)
  });

  test("workspaces persist across reloads", async ({ page, editorState }) => {
    await selectTool(page, "2");
    await drag(page, { x: 400, y: 300 }, { x: 520, y: 380 });

    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await groupFor(page, "Workspace 2").locator('[data-testid="ws-add-canvas"]').click();
    await groupFor(page, "Workspace 2")
      .locator('[data-testid="ws-canvas-Diagram 1"]')
      .locator(".tree-name")
      .dblclick();
    const input = page.locator('[data-testid="rename-input"]');
    await input.fill("Migration Plan");
    await input.press("Enter");
    await page.waitForTimeout(700);

    await page.reload();
    await open(page);

    const s = await editorState();
    expect(s.workspaces).toHaveLength(2);
    expect(s.workspaces[1].name).toBe("Workspace 2");
    expect(s.workspaces[1].canvases.map((c) => c.name)).toEqual(["Migration Plan"]);
    expect(s.activeWorkspaceId).toBe(s.workspaces[1].id);
    expect(s.elementCount).toBe(0); // empty canvas of ws2
  });

  test("empty workspace survives a reload", async ({ page, editorState }) => {
    await openPanel(page);
    await page.click('[data-testid="ws-add"]');
    await page.waitForTimeout(700); // autosave flush of the empty workspace

    await page.reload();
    await open(page);

    const s = await editorState();
    expect(s.workspaces).toHaveLength(2);
    expect(s.workspaces[1].canvases).toHaveLength(0);
    expect(s.activeWorkspaceId).toBe(s.workspaces[1].id);
  });

  test("selected canvas uses the active-control color, without a marker", async ({
    page,
  }) => {
    await openPanel(page);
    const canvasRow = page.locator('[data-testid="ws-canvas-Diagram 1"]');
    const wsRow = page.locator('[data-testid="ws-row-Workspace 1"]');

    const readRow = (locator: typeof canvasRow) =>
      locator.evaluate((el) => {
        const marker = getComputedStyle(el, "::before");
        const name = el.querySelector(".tree-name");
        return {
          background: getComputedStyle(el).backgroundColor,
          boxShadow: getComputedStyle(el).boxShadow,
          markerContent: marker.content,
          markerWidth: marker.width,
          markerBackground: marker.backgroundColor,
          nameColor: name ? getComputedStyle(name).color : "",
        };
      });

    const canvas = await readRow(canvasRow);
    const ws = await readRow(wsRow);
    const activeCtrl = await page
      .locator(".tool-btn.active")
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, color: s.color };
      });

    // the open canvas is a plain solid fill in the same accent as any other
    // active control — no left bar, no outline
    expect(canvas.background).toBe(activeCtrl.background);
    expect(canvas.nameColor).toBe(activeCtrl.color);
    expect(canvas.markerContent).toBe("none");
    expect(canvas.boxShadow).toBe("none");
    // parent workspace: context only, marker bar without a fill
    expect(ws.background).toBe("rgba(0, 0, 0, 0)");
    expect(ws.markerContent).not.toBe("none");
    expect(ws.markerBackground).not.toBe("rgba(0, 0, 0, 0)");
    await expect(canvasRow).toHaveAttribute("aria-selected", "true");
  });

  test("legacy autosave migrates into the registry", async ({ page, editorState }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem(
        "archidraw:workspace",
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "tab_legacy",
          tabs: [
            {
              id: "tab_legacy",
              name: "Legacy Diagram",
              doc: { schemaVersion: 1, elements: [] },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
    });
    await open(page);

    const s = await editorState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].canvases.map((c) => c.name)).toEqual(["Legacy Diagram"]);

    // autosave moved the data into the registry and dropped the legacy key
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain("archidraw:workspaces");
    expect(keys.some((k) => k.startsWith("archidraw:workspaces:"))).toBe(true);
    expect(keys).not.toContain("archidraw:workspace");
  });
});
