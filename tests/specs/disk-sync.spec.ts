import {
  test,
  expect,
  openWithDocuments,
  installDocumentPicker,
  queueDocumentSave,
  queueDocumentOpen,
  writeOpfs,
  readOpfs,
  removeOpfs,
  listOpfs,
  pollDocuments,
  documentSyncSnapshot,
  documentPickerState,
} from "../fixtures";
import {
  activeWorkspaceId,
  createDocumentConflict,
  drawRect,
  elementCount,
  readWorkspaceJson,
  saveActiveToFile,
  patchWorkspace,
} from "../documentSyncHelpers";

const WORKSPACE_FILE = "plan.archidraw";

test.describe("workspace file sync", () => {
  test.beforeEach(async ({ page }) => {
    await openWithDocuments(page);
    await installDocumentPicker(page);
  });

  test("Ctrl+S saves the workspace to disk and autosaves later edits", async ({
    page,
  }) => {
    await drawRect(page);
    await queueDocumentSave(page, WORKSPACE_FILE);

    await page.keyboard.press("Control+s");

    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("saved");
    const { text, data } = await readWorkspaceJson(page, WORKSPACE_FILE);
    expect(text.endsWith("\n")).toBe(true);
    expect(data.schemaVersion).toBe(2);
    expect(data.name).toBe("plan");
    expect(data.uid).toMatch(/^doc_/);
    expect(data.tabs).toHaveLength(1);
    expect(data.tabs[0].doc.elements).toHaveLength(1);
    expect(data.tabs[0].camera).toEqual({ scrollX: 0, scrollY: 0, zoom: 1 });

    await expect(page.locator('[data-testid="status-file"]')).toHaveAttribute(
      "data-status",
      "saved",
    );
    await expect(page.locator('[data-testid="ws-file-plan"]')).toHaveCount(0);

    // a later edit reaches the file through the 800ms autosave
    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });
    await expect
      .poll(async () => (await readWorkspaceJson(page, WORKSPACE_FILE)).data.tabs[0].doc.elements.length)
      .toBe(2);
  });

  test("drawing continuously while autosave flushes never triggers a conflict modal", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      const originalWrite = access.write;
      access.write = async (...args: any[]) => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return originalWrite.apply(access, args);
      };
    });

    for (let i = 0; i < 4; i++) {
      await drawRect(
        page,
        { x: 260 + i * 30, y: 100 + i * 20 },
        { x: 300 + i * 30, y: 140 + i * 20 },
      );
      await page.waitForTimeout(400);
      await page.evaluate(() => (window as any).__documents__.refreshAll());
    }

    await page.waitForTimeout(1500);

    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);
    expect((await documentSyncSnapshot(page)).conflicts).toHaveLength(0);
  });

  test("polling while a flush is in progress does not cause a conflict", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      const originalWrite = access.write;
      access.write = async (...args: any[]) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return originalWrite.apply(access, args);
      };
    });

    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });

    await page.evaluate(() => {
      const docs = (window as any).__documents__;
      const wsId = docs.editor.getSnapshot().activeWorkspaceId;
      void docs.save(wsId);
      void docs.refreshAll();
    });

    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);
    expect((await documentSyncSnapshot(page)).conflicts).toHaveLength(0);
  });

  test("two flushes in flight do not cause a conflict", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      const originalWrite = access.write;
      access.write = async (...args: any[]) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return originalWrite.apply(access, args);
      };
    });

    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });

    await page.evaluate(() => {
      const docs = (window as any).__documents__;
      const wsId = docs.editor.getSnapshot().activeWorkspaceId;
      void docs.save(wsId);
      void docs.save(wsId);
    });

    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);
  });

  test("pan, zoom and tab switches never rewrite camera or active tab", async ({
    page,
  }) => {
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const wsId = ed.getSnapshot().activeWorkspaceId;
      ed.addCanvasTo(wsId);
      ed.switchTab(ed.getSnapshot().tabs[0].id);
    });
    await saveActiveToFile(page, WORKSPACE_FILE);
    const before = await readOpfs(page, WORKSPACE_FILE);

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.zoomAt({ x: 600, y: 400 }, 2);
      ed.wheel({ x: 600, y: 400 }, { x: -120, y: -60 }, false);
      ed.switchTab(ed.getSnapshot().tabs[1].id);
    });
    await page.waitForTimeout(1200);

    expect(await readOpfs(page, WORKSPACE_FILE)).toBe(before);
    const saved = (await readWorkspaceJson(page, WORKSPACE_FILE)).data;
    expect(saved.tabs).toHaveLength(2);
    expect(saved.activeTabId).toBe(saved.tabs[0].id);
    expect(saved.tabs[0].camera).toEqual({ scrollX: 0, scrollY: 0, zoom: 1 });
  });

  test("reload restores the binding, content and the local camera", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const diskBefore = await readOpfs(page, WORKSPACE_FILE);
    await page.evaluate(() => (window as any).__editor__.zoomAt({ x: 500, y: 400 }, 1.5));
    const camera = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().camera,
    );

    await openWithDocuments(page);

    expect(await elementCount(page)).toBe(1);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("saved");
    const restoredCamera = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().camera,
    );
    expect(restoredCamera.zoom).toBeCloseTo(camera.zoom, 5);
    expect(await readOpfs(page, WORKSPACE_FILE)).toBe(diskBefore);
  });

  test("reload recovers the workspace from disk after localStorage is cleared", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await page.evaluate(() => localStorage.clear());
    await openWithDocuments(page);

    expect(await elementCount(page)).toBe(1);
    const snapshot = await documentSyncSnapshot(page);
    expect(snapshot.bindings).toBe(1);
    expect(snapshot.views[0]?.fileName).toBe(WORKSPACE_FILE);
    expect(await page.evaluate(() => (window as any).__editor__.getSnapshot().workspaces[0].name))
      .toBe("plan");
  });

  test("Open reuses an empty workspace, creates a new one when busy, and focuses already-open files", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const id = await activeWorkspaceId(page);
    await page.evaluate((wsId) => (window as any).__documents__.close(wsId), id);
    await expect.poll(() => listOpfs(page)).toContain(WORKSPACE_FILE);

    const plan = await readWorkspaceJson(page, WORKSPACE_FILE);
    await writeOpfs(
      page,
      "other.archidraw",
      patchWorkspace(plan.text, (data) => {
        data.name = "other";
        data.tabs[0].doc.elements[0].x = 42;
      }),
    );

    await queueDocumentOpen(page, WORKSPACE_FILE);
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(true);
    let state = await page.evaluate(() => (window as any).__editor__.getSnapshot());
    expect(state.workspaces).toHaveLength(1);
    expect(state.workspaces[0].name).toBe("plan");

    await queueDocumentOpen(page, "other.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(true);
    state = await page.evaluate(() => (window as any).__editor__.getSnapshot());
    expect(state.workspaces).toHaveLength(2);
    expect(state.workspaces[1].name).toBe("other");
    expect(state.activeWorkspaceId).toBe(state.workspaces[1].id);
    expect((await documentSyncSnapshot(page)).bindings).toBe(2);

    // opening an already-bound file focuses it instead of duplicating it
    await queueDocumentOpen(page, WORKSPACE_FILE);
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(true);
    state = await page.evaluate(() => (window as any).__editor__.getSnapshot());
    expect(state.workspaces).toHaveLength(2);
    expect(state.activeWorkspaceId).toBe(state.workspaces[0].id);
    expect((await documentSyncSnapshot(page)).bindings).toBe(2);
  });

  test("Open rejects invalid files and cancelled pickers", async ({ page }) => {
    await drawRect(page);
    const before = await page.evaluate(() => (window as any).__editor__.getSnapshot());

    await writeOpfs(page, "broken.archidraw", "{not json");
    await queueDocumentOpen(page, "broken.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(false);
    await expect(page.locator(".toast", { hasText: "not a valid ArchiDraw file" })).toBeVisible();

    await queueDocumentOpen(page);
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(false);

    const after = await page.evaluate(() => (window as any).__editor__.getSnapshot());
    expect(after.workspaces).toHaveLength(before.workspaces.length);
    expect(after.doc.elements).toHaveLength(1);
    expect((await documentSyncSnapshot(page)).bindings).toBe(0);
  });

  test("Open supports .excalidraw files and imports them as a new diagram tab", async ({
    page,
  }) => {
    await drawRect(page);
    const before = await page.evaluate(() => (window as any).__editor__.getSnapshot());

    const excalidraw = JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "rect_exc",
          type: "rectangle",
          x: 200,
          y: 150,
          width: 80,
          height: 60,
          strokeColor: "#ff0000",
          backgroundColor: "#00ff00",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 100,
          isDeleted: false,
        },
      ],
    });

    await writeOpfs(page, "scene.excalidraw", excalidraw);
    await queueDocumentOpen(page, "scene.excalidraw");
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(true);

    await expect(page.locator(".toast", { hasText: '"scene" imported' })).toBeVisible();

    const after = await page.evaluate(() => (window as any).__editor__.getSnapshot());
    expect(after.tabs.length).toBe(before.tabs.length + 1);
    expect(after.doc.elements[0].id).toBe("rect_exc");
    expect((await documentSyncSnapshot(page)).bindings).toBe(0);
  });

  test("Save As keeps the previous file and binds the workspace to the new one", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await queueDocumentSave(page, "copy.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.saveAs())).toBe(true);

    expect(await listOpfs(page)).toEqual(["copy.archidraw", WORKSPACE_FILE]);
    const copy = await readWorkspaceJson(page, "copy.archidraw");
    expect(copy.data.name).toBe("copy");
    expect(copy.data.tabs[0].doc.elements).toHaveLength(1);
    expect(
      await page.evaluate(() => (window as any).__editor__.getSnapshot().workspaces[0].name),
    ).toBe("copy");

    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });
    await expect
      .poll(async () => (await readWorkspaceJson(page, "copy.archidraw")).data.tabs[0].doc.elements.length)
      .toBe(2);
    expect((await readWorkspaceJson(page, WORKSPACE_FILE)).data.tabs[0].doc.elements).toHaveLength(1);
  });

  test("renaming a file-backed workspace moves the file and reverts on cancel", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, "old.archidraw");
    await page.click('[data-testid="panel-toggle"]');
    await expect(page.locator('[data-testid="panel-toggle"]')).toHaveClass(/open/);

    await queueDocumentSave(page, "renamed.archidraw");
    await page.dblclick('[data-testid="ws-group-old"] .work-name');
    const input = page.locator('[data-testid="rename-input"]');
    await input.fill("renamed");
    await input.press("Enter");

    await expect.poll(() => listOpfs(page)).toEqual(["renamed.archidraw"]);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.fileName)
      .toBe("renamed.archidraw");
    expect(
      await page.evaluate(() => (window as any).__editor__.getSnapshot().workspaces[0].name),
    ).toBe("renamed");

    // cancelling the picker leaves both the label and the file untouched
    await page.evaluate(() => {
      (window as any).__documentPicker__.cancelSave = true;
    });
    await page.dblclick('[data-testid="ws-group-renamed"] .work-name');
    const cancelInput = page.locator('[data-testid="rename-input"]');
    await cancelInput.fill("discarded");
    await cancelInput.press("Enter");
    await page.waitForTimeout(150);
    expect(await listOpfs(page)).toEqual(["renamed.archidraw"]);
    expect(
      await page.evaluate(() => (window as any).__editor__.getSnapshot().workspaces[0].name),
    ).toBe("renamed");
  });

  test("renaming to the same file name only changes the label", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const calls = (await documentPickerState(page)).saveCalls.length;

    const renamed = await page.evaluate(() =>
      (window as any).__documents__.rename(
        (window as any).__editor__.getSnapshot().activeWorkspaceId,
        "PLAN",
      ),
    );
    expect(renamed).toBe(true);
    expect(
      await page.evaluate(() => (window as any).__editor__.getSnapshot().workspaces[0].name),
    ).toBe("PLAN");
    expect((await documentPickerState(page)).saveCalls.length).toBe(calls);
    expect(await listOpfs(page)).toEqual([WORKSPACE_FILE]);
  });

  test("closing a file-backed workspace keeps the file; closing local discards it", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const id = await activeWorkspaceId(page);

    expect(await page.evaluate((wsId) => (window as any).__documents__.close(wsId), id)).toBe(true);
    expect(await listOpfs(page)).toEqual([WORKSPACE_FILE]);
    expect((await documentSyncSnapshot(page)).bindings).toBe(0);

    await page.evaluate(() => (window as any).__editor__.newWorkspace());
    await drawRect(page);
    const localId = await activeWorkspaceId(page);
    await page.evaluate((wsId) => (window as any).__documents__.close(wsId), localId);
    expect((await documentSyncSnapshot(page)).bindings).toBe(0);
    expect(await listOpfs(page)).toEqual([WORKSPACE_FILE]);
  });

  test("conflict: Keep my version overwrites the external change", async ({ page }) => {
    await createDocumentConflict(page);

    // save is blocked until the conflict is resolved
    expect(
      await page.evaluate(() => (window as any).__documents__.save()),
    ).toBe(false);
    await expect(page.locator(".toast", { hasText: "Resolve the file conflict" })).toBeVisible();

    await page.click('[data-testid="sync-conflict-mine"]');

    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("saved");
    const kept = await readWorkspaceJson(page, WORKSPACE_FILE);
    expect(kept.data.tabs[0].doc.elements).toHaveLength(2);
    expect(kept.data.tabs[0].doc.elements[0].x).not.toBe(999);
  });

  test("conflict: Use disk version replaces the canvas", async ({ page }) => {
    await createDocumentConflict(page);

    await page.click('[data-testid="sync-conflict-disk"]');

    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);
    expect(await elementCount(page)).toBe(1);
    const elementX = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].x,
    );
    expect(elementX).toBe(999);
    expect((await documentSyncSnapshot(page)).views[0]?.status).toBe("saved");
  });

  test("conflict: Save as copy writes a distinct file and keeps the original", async ({
    page,
  }) => {
    const external = await createDocumentConflict(page);
    const original = await readWorkspaceJson(page, WORKSPACE_FILE);

    await queueDocumentSave(page, "plan-conflict-copy.archidraw");
    await page.click('[data-testid="sync-conflict-copy"]');

    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);
    const copy = await readWorkspaceJson(page, "plan-conflict-copy.archidraw");
    expect(copy.data.tabs[0].doc.elements).toHaveLength(2);
    expect(copy.data.uid).not.toBe(original.data.uid);
    expect(await readOpfs(page, WORKSPACE_FILE)).toBe(external);
    const snapshot = await documentSyncSnapshot(page);
    expect(snapshot.views[0]?.fileName).toBe("plan-conflict-copy.archidraw");
    expect(snapshot.views[0]?.status).toBe("saved");
    const suggested = (await documentPickerState(page)).saveCalls.at(-1);
    expect(suggested).toMatch(/plan-conflict-\d+\.archidraw/);
  });

  test("external disk changes are adopted when the canvas has no local edits", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const { text } = await readWorkspaceJson(page, WORKSPACE_FILE);
    await writeOpfs(
      page,
      WORKSPACE_FILE,
      patchWorkspace(text, (data) => {
        data.tabs[0].doc.elements[0].x = 512;
      }),
    );

    await pollDocuments(page);

    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__editor__.getSnapshot().doc.elements[0]?.x),
      )
      .toBe(512);
    expect((await documentSyncSnapshot(page)).views[0]?.status).toBe("saved");
  });

  test("missing files reconnect through Save As from the panel badge", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    await removeOpfs(page, WORKSPACE_FILE);

    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("missing");

    await page.click('[data-testid="panel-toggle"]');
    await expect(page.locator('[data-testid="status-file"]')).toHaveAttribute("data-status", "missing");
    await expect(page.locator('[data-testid="ws-file-plan"]')).toHaveCount(0);

    await queueDocumentSave(page, "recovered.archidraw");
    await page.click('[data-testid="ws-save-as"]');
    await expect.poll(() => readOpfs(page, "recovered.archidraw")).not.toBeNull();
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("saved");
    expect((await documentSyncSnapshot(page)).views[0]?.fileName).toBe(
      "recovered.archidraw",
    );
  });

  test("invalid files can be recovered through Save As", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    await writeOpfs(page, WORKSPACE_FILE, "{ this is not archidraw");

    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("invalid");

    await page.click('[data-testid="panel-toggle"]');
    await expect(page.locator('[data-testid="status-file"]')).toHaveAttribute("data-status", "invalid");
    await expect(page.locator('[data-testid="ws-file-plan"]')).toHaveCount(0);
    await queueDocumentSave(page, "fixed.archidraw");
    await page.click('[data-testid="ws-save-as"]');
    await expect.poll(() => readOpfs(page, "fixed.archidraw")).not.toBeNull();
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.fileName)
      .toBe("fixed.archidraw");
  });

  test("permission loss shows Reconnect and the status bar re-requests access", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      (window as any).__originalAccess__ = {
        query: access.queryPermission,
        request: access.requestPermission,
      };
      access.queryPermission = async () => false;
      access.requestPermission = async () => false;
    });

    await pollDocuments(page);
    const statusFile = page.locator('[data-testid="status-file"]');
    await expect(statusFile).toHaveAttribute("data-status", "permission");
    await expect(statusFile).toContainText("reconnect to save");

    await statusFile.click();
    await expect(page.locator(".toast", { hasText: "permission was not granted" })).toBeVisible();
    await expect(statusFile).toHaveAttribute("data-status", "permission");

    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      access.queryPermission = async () => true;
      access.requestPermission = async () => true;
    });
    await statusFile.click();
    await expect(page.locator(".toast", { hasText: "Reconnected" })).toBeVisible();
    await expect(statusFile).toHaveAttribute("data-status", "saved");
  });

  test("unsupported browsers keep the download flow and hide file actions", async ({
    page,
  }) => {
    await installDocumentPicker(page, { supported: false });

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("app-menu-button").click();
    await page.locator(".menu-item", { hasText: /^Open/ }).click();
    await chooserPromise;

    await page.keyboard.press("Control+s");
    await expect(page.getByRole("dialog", { name: "Save" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByTestId("app-menu-button").click();
    await expect(page.locator(".menu-item", { hasText: /^Download…/ })).toBeVisible();
    await expect(page.locator(".menu-item", { hasText: /^Save$/ })).toHaveCount(0);
    await expect(page.locator(".menu-item", { hasText: /^Save As…/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.click('[data-testid="panel-toggle"]');
    await expect(page.locator('[data-testid="ws-save-file"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="ws-download"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-canvas-download"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-canvas-save"]')).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as any).__documents__.saveAs()),
    ).toBe(false);
    await expect(page.locator(".toast", { hasText: "requires Chrome or Edge" })).toBeVisible();
  });

  test("supported browsers keep save actions and hide download buttons", async ({
    page,
  }) => {
    await page.getByTestId("app-menu-button").click();
    await expect(
      page.locator(".menu-item", {
        has: page.locator(".menu-item-label", { hasText: /^Save$/ }),
      }),
    ).toBeVisible();
    const saveAsItem = page.locator(".menu-item", {
      has: page.locator(".menu-item-label", { hasText: /^Save As…/ }),
    });
    await expect(saveAsItem).toBeVisible();
    await expect(page.locator(".menu-item", { hasText: /Download/ })).toHaveCount(0);
    await saveAsItem.click();
    await expect(page.getByRole("dialog", { name: "Save" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.click('[data-testid="panel-toggle"]');
    await expect(page.locator('[data-testid="ws-save-file"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-download"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="ws-file-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="ws-canvas-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-canvas-download"]')).toHaveCount(0);

    await queueDocumentSave(page, "diagram-saved.archidraw");
    await page.click('[data-testid="ws-canvas-save"]');
    await expect.poll(() => readOpfs(page, "diagram-saved.archidraw")).not.toBeNull();
  });

  test("native picker wrappers forward options and swallow aborts only", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const picker = (window as any).__documentsTest__.browserPicker;
      const calls: any[] = [];
      const handle = { name: "picked.archidraw", kind: "file" };
      window.showOpenFilePicker = async (options?: any) => {
        calls.push({ kind: "open", options });
        return [handle];
      };
      window.showSaveFilePicker = async (options?: any) => {
        calls.push({ kind: "save", options });
        return handle;
      };
      const opened = await picker.openArchidraw();
      const saved = await picker.saveArchidraw("suggested.archidraw");

      window.showOpenFilePicker = async () => {
        const error = new Error("cancelled");
        error.name = "AbortError";
        throw error;
      };
      const aborted = await picker.openArchidraw();

      window.showSaveFilePicker = async () => {
        const error = new Error("denied");
        error.name = "NotAllowedError";
        throw error;
      };
      let failure = "";
      try {
        await picker.saveArchidraw("x.archidraw");
      } catch (error) {
        failure = (error as Error).name;
      }

      const supported = picker.isSupported();
      window.showOpenFilePicker = undefined;
      window.showSaveFilePicker = undefined;
      return {
        calls,
        opened,
        saved,
        aborted,
        failure,
        supported,
        unsupported: picker.isSupported(),
        openWithoutApi: await picker.openArchidraw(),
        saveWithoutApi: await picker.saveArchidraw("x.archidraw"),
      };
    });

    expect(result.opened).toEqual({ name: "picked.archidraw", kind: "file" });
    expect(result.saved).toEqual({ name: "picked.archidraw", kind: "file" });
    expect(result.calls[0].options).toMatchObject({ multiple: false });
    expect(result.calls[0].options.types[0].accept).toEqual({
      "application/json": [".archidraw", ".excalidraw"],
    });
    expect(result.calls[1].options.suggestedName).toBe("suggested.archidraw");
    expect(result.aborted).toBeNull();
    expect(result.failure).toBe("NotAllowedError");
    expect(result.supported).toBe(true);
    expect(result.unsupported).toBe(false);
    expect(result.openWithoutApi).toBeNull();
    expect(result.saveWithoutApi).toBeNull();
  });

  test("file access helpers tolerate platform handles without optional methods", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const access = (window as any).__documents__.access;
      return {
        query: await access.queryPermission({}),
        request: await access.requestPermission({}),
        same: await access.sameEntry({}, {}),
        removed: await access.remove({}),
      };
    });
    expect(result).toEqual({
      query: true,
      request: true,
      same: false,
      removed: false,
    });
  });

  test("content hashing uses SHA-256 with the expected digest", async ({ page }) => {
    const digest = await page.evaluate(() =>
      (window as any).__documentsTest__.hashText("abc"),
    );
    expect(digest).toBe(
      "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  test("a second tab adopts a file saved by the first tab", async ({
    page,
    context,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    // the workspace registry autosaves after 400ms; the second tab hydrates
    // from it, so wait for that write before opening the tab
    await page.waitForTimeout(600);
    const second = await context.newPage();
    await openWithDocuments(second);
    expect(await elementCount(second)).toBe(1);

    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });
    expect(await page.evaluate(() => (window as any).__documents__.save())).toBe(true);

    await expect.poll(() => elementCount(second), { timeout: 10_000 }).toBe(2);
    await second.close();
  });
});
