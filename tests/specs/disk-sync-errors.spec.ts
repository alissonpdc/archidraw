import type { Page } from "@playwright/test";
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
  setDocumentPickerSupport,
} from "../fixtures";
import {
  activeWorkspaceId,
  createDocumentConflict,
  drawRect,
  elementCount,
  readWorkspaceJson,
  saveActiveToFile,
  patchWorkspace,
  freezeDiskAutosave,
} from "../documentSyncHelpers";

const WORKSPACE_FILE = "plan.archidraw";

function toast(page: Page, text: string) {
  return page.locator(".toast", { hasText: text });
}

async function setPickerThrows(page: Page, method: "open" | "save", message: string) {
  await page.evaluate(
    ({ target, reason }: { target: "open" | "save"; reason: string }) => {
      const failure = async () => Promise.reject(reason);
      (window as any).__documentsTest__.setPicker({
        isSupported: () => true,
        openArchidraw: target === "open" ? failure : async () => null,
        saveArchidraw: target === "save" ? failure : async () => null,
      });
    },
    { target: method, reason: message },
  );
}

test.describe("workspace file sync errors", () => {
  test.beforeEach(async ({ page }) => {
    await openWithDocuments(page);
    await installDocumentPicker(page);
  });

  test("boot reports a failing binding store and dispose stops the service", async ({
    page,
  }) => {
    await page.evaluate(async () => {
      const docs = (window as any).__documents__;
      docs.dispose();
      const original = docs.store.list;
      docs.store.list = async () => {
        throw new Error("idb down");
      };
      await docs.boot();
      docs.store.list = original;
    });

    await expect(toast(page, "Could not load file bindings: idb down")).toBeVisible();
    expect((await documentSyncSnapshot(page)).bindings).toBe(0);

    await page.evaluate(() => (window as any).__documents__.dispose());
  });

  test("boot reconciles bindings and reports permission failures", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    // a pending autosave timer exercises the dispose cleanup path
    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });

    await page.evaluate(async () => {
      const docs = (window as any).__documents__;
      docs.dispose();
      (window as any).__originalQuery__ = docs.access.queryPermission;
      docs.access.queryPermission = async () => {
        throw new Error("query failed");
      };
      await docs.boot();
    });
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0])
      .toMatchObject({ status: "error", message: "query failed" });

    await page.evaluate(async () => {
      const docs = (window as any).__documents__;
      docs.dispose();
      docs.access.queryPermission = async () => false;
      await docs.boot();
    });
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("permission");

    // a second boot is a no-op
    await page.evaluate(() => (window as any).__documents__.boot());
    expect((await documentSyncSnapshot(page)).views[0]?.status).toBe("permission");

    await page.evaluate(async () => {
      const docs = (window as any).__documents__;
      docs.access.queryPermission = (window as any).__originalQuery__;
      docs.dispose();
      await docs.boot();
    });
  });

  test("open surfaces picker failures and unreadable files", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await setPickerThrows(page, "open", "picker offline");
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(false);
    await expect(toast(page, "Could not open file: picker offline")).toBeVisible();

    await installDocumentPicker(page);
    const { text } = await readWorkspaceJson(page, WORKSPACE_FILE);
    await writeOpfs(page, "other.archidraw", text);
    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      access.read = async () => {
        throw new Error("read failed");
      };
    });

    await queueDocumentOpen(page, "other.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(false);
    await expect(
      toast(page, 'Could not read "other.archidraw": read failed'),
    ).toBeVisible();
  });

  test("open requires browser support and granted permission", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await setDocumentPickerSupport(page, false);
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(false);
    await expect(toast(page, "requires Chrome or Edge")).toBeVisible();

    await setDocumentPickerSupport(page, true);
    await page.evaluate(() => {
      (window as any).__documents__.access.requestPermission = async () => false;
    });
    await queueDocumentOpen(page, WORKSPACE_FILE);
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(false);
    await expect(toast(page, "Read/write permission was not granted")).toBeVisible();
  });

  test("save recovers missing and invalid files through Save As", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await removeOpfs(page, WORKSPACE_FILE);
    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("missing");

    await queueDocumentSave(page, "recovered.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.save())).toBe(true);
    expect(await readOpfs(page, "recovered.archidraw")).not.toBeNull();

    await writeOpfs(page, "recovered.archidraw", "not archidraw");
    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("invalid");

    await queueDocumentSave(page, "fixed.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.save())).toBe(true);
    expect(await listOpfs(page)).toEqual(
      expect.arrayContaining(["recovered.archidraw", "fixed.archidraw"]),
    );
  });

  test("permission loss blocks save until the file is reconnected", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      access.queryPermission = async () => false;
      access.requestPermission = async () => false;
    });
    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("permission");

    expect(await page.evaluate(() => (window as any).__documents__.save())).toBe(false);
    await expect(toast(page, "permission was not granted")).toBeVisible();

    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      access.queryPermission = async () => true;
      access.requestPermission = async () => true;
    });
    expect(await page.evaluate(() => (window as any).__documents__.save())).toBe(true);
    await expect(toast(page, "Reconnected")).toBeVisible();
  });

  test("reconnect reports access errors thrown by the browser", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const id = await activeWorkspaceId(page);

    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      access.requestPermission = async () => {
        throw new Error("gesture required");
      };
    });
    expect(
      await page.evaluate((wsId) => (window as any).__documents__.reconnect(wsId), id),
    ).toBe(false);
    await expect(
      toast(page, "Could not reconnect file: gesture required"),
    ).toBeVisible();
  });

  test("Save As rejects unnamed, unsupported, invalid and already-open targets", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const firstId = await activeWorkspaceId(page);

    expect(
      await page.evaluate(() => (window as any).__documents__.saveAs("ws_missing")),
    ).toBe(false);

    await setDocumentPickerSupport(page, false);
    expect(await page.evaluate(() => (window as any).__documents__.saveAs())).toBe(false);
    await expect(toast(page, "requires Chrome or Edge")).toBeVisible();
    await setDocumentPickerSupport(page, true);

    await writeOpfs(page, "bad.archidraw", "not archidraw");
    await queueDocumentSave(page, "bad.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.saveAs())).toBe(false);
    await expect(toast(page, 'is not a valid ArchiDraw file')).toBeVisible();

    await page.evaluate(() => (window as any).__editor__.newWorkspace());
    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });
    await saveActiveToFile(page, "other.archidraw");
    await page.evaluate((wsId) => (window as any).__editor__.openWorkspace(wsId), firstId);

    await queueDocumentSave(page, "other.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.saveAs())).toBe(false);
    await expect(toast(page, "already open in another workspace")).toBeVisible();

    await page.evaluate(() => {
      (window as any).__documents__.access.requestPermission = async () => false;
    });
    await queueDocumentSave(page, "denied.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.saveAs())).toBe(false);
    await expect(toast(page, "Read/write permission was not granted")).toBeVisible();

    await setPickerThrows(page, "save", "denied");
    expect(await page.evaluate(() => (window as any).__documents__.saveAs())).toBe(false);
    await expect(toast(page, "Could not save file: denied")).toBeVisible();

    await installDocumentPicker(page);
    await queueDocumentSave(page, "failing.archidraw");
    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      access.requestPermission = async () => true;
      access.write = async () => {
        throw new Error("read only");
      };
    });
    expect(await page.evaluate(() => (window as any).__documents__.saveAs())).toBe(false);
    await expect(
      toast(page, 'Could not write "failing.archidraw": read only'),
    ).toBeVisible();
  });

  test("rename reports unsupported picks, conflicts and picker failures", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const id = await activeWorkspaceId(page);

    expect(
      await page.evaluate((wsId) => (window as any).__documents__.rename(wsId, "   "), id),
    ).toBe(false);

    await setDocumentPickerSupport(page, false);
    expect(
      await page.evaluate((wsId) => (window as any).__documents__.rename(wsId, "next"), id),
    ).toBe(false);
    await expect(
      toast(page, "Renaming a workspace file requires Chrome or Edge"),
    ).toBeVisible();
    await setDocumentPickerSupport(page, true);

    await setPickerThrows(page, "save", "rename denied");
    expect(
      await page.evaluate((wsId) => (window as any).__documents__.rename(wsId, "next"), id),
    ).toBe(false);
    await expect(toast(page, "Could not rename file: rename denied")).toBeVisible();

    await installDocumentPicker(page);
    await createDocumentConflict(page);
    expect(
      await page.evaluate((wsId) => (window as any).__documents__.rename(wsId, "next"), id),
    ).toBe(false);
    await expect(toast(page, "Resolve the file conflict before renaming")).toBeVisible();
  });

  test("renaming a file reports failures to delete the previous file", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, "old.archidraw");
    const id = await activeWorkspaceId(page);

    await page.evaluate(() => {
      (window as any).__documents__.access.remove = async () => false;
    });
    expect(
      await page.evaluate((wsId) => (window as any).__documents__.rename(wsId, "first"), id),
    ).toBe(true);
    await expect(toast(page, "previous file could not be removed")).toBeVisible();
    expect(await listOpfs(page)).toEqual(
      expect.arrayContaining(["old.archidraw", "first.archidraw"]),
    );

    await page.evaluate(() => {
      (window as any).__documents__.access.remove = async () => {
        throw new DOMException("gone", "NotFoundError");
      };
    });
    expect(
      await page.evaluate((wsId) => (window as any).__documents__.rename(wsId, "second"), id),
    ).toBe(true);
    expect(await readOpfs(page, "second.archidraw")).not.toBeNull();

    await page.evaluate(() => {
      (window as any).__documents__.access.remove = async () =>
        Promise.reject("locked");
    });
    expect(
      await page.evaluate((wsId) => (window as any).__documents__.rename(wsId, "third"), id),
    ).toBe(true);
    await expect(
      toast(page, "previous file could not be removed: locked"),
    ).toBeVisible();
  });

  test("closing refuses conflicts and survives a failing binding store", async ({
    page,
  }) => {
    await createDocumentConflict(page);
    const id = await activeWorkspaceId(page);

    expect(
      await page.evaluate((wsId) => (window as any).__documents__.close(wsId), id),
    ).toBe(false);
    await expect(toast(page, "Resolve the file conflict before closing")).toBeVisible();

    await page.click('[data-testid="sync-conflict-disk"]');
    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);

    await page.evaluate(() => {
      const docs = (window as any).__documents__;
      docs.store.remove = async () => {
        throw new Error("idb remove failed");
      };
    });
    expect(
      await page.evaluate((wsId) => (window as any).__documents__.close(wsId), id),
    ).toBe(true);
    await expect(
      toast(page, "Could not remove file binding: idb remove failed"),
    ).toBeVisible();
    expect((await documentSyncSnapshot(page)).bindings).toBe(0);
  });

  test("an empty file on disk is refilled from the local canvas", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await writeOpfs(page, WORKSPACE_FILE, "");
    await pollDocuments(page);

    await expect
      .poll(async () => (await readWorkspaceJson(page, WORKSPACE_FILE)).data.tabs[0].doc.elements.length)
      .toBe(1);
    expect((await documentSyncSnapshot(page)).views[0]?.status).toBe("saved");
  });

  test("dirty local changes are written when the disk base is unchanged", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    await freezeDiskAutosave(page);

    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });
    await page.waitForTimeout(600);

    await openWithDocuments(page);

    await expect
      .poll(async () => (await readWorkspaceJson(page, WORKSPACE_FILE)).data.tabs[0].doc.elements.length)
      .toBe(2);
  });

  test("polling detects conflicts and reviews disk changes made again", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    await freezeDiskAutosave(page);
    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });

    const { text } = await readWorkspaceJson(page, WORKSPACE_FILE);
    await writeOpfs(
      page,
      WORKSPACE_FILE,
      patchWorkspace(text, (data) => {
        data.tabs[0].doc.elements[0].x = 999;
      }),
    );
    await pollDocuments(page);
    await expect(page.locator('[data-testid="sync-conflict"]')).toBeVisible();

    const current = await readWorkspaceJson(page, WORKSPACE_FILE);
    await writeOpfs(
      page,
      WORKSPACE_FILE,
      patchWorkspace(current.text, (data) => {
        data.tabs[0].doc.elements[0].x = 777;
      }),
    );
    await page.click('[data-testid="sync-conflict-mine"]');
    await expect(toast(page, "The file changed again")).toBeVisible();
    await expect(page.locator('[data-testid="sync-conflict"]')).toBeVisible();

    await page.click('[data-testid="sync-conflict-disk"]');
    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);
    expect(await elementCount(page)).toBe(1);
    expect(
      await page.evaluate(() => (window as any).__editor__.getSnapshot().doc.elements[0].x),
    ).toBe(777);
  });

  test("conflict copy choosing the same file keeps the local version", async ({
    page,
  }) => {
    await createDocumentConflict(page);

    await queueDocumentSave(page, WORKSPACE_FILE);
    expect(
      await page.evaluate(
        () =>
          (window as any).__documents__.resolveConflict(
            (window as any).__editor__.getSnapshot().activeWorkspaceId,
            "copy",
          ),
      ),
    ).toBe(true);

    await expect(toast(page, "Kept the workspace version")).toBeVisible();
    await expect(page.locator('[data-testid="sync-conflict"]')).toHaveCount(0);
    const { data } = await readWorkspaceJson(page, WORKSPACE_FILE);
    expect(data.tabs[0].doc.elements).toHaveLength(2);
    expect(data.tabs[0].doc.elements[0].x).not.toBe(999);
    expect((await documentSyncSnapshot(page)).views[0]?.status).toBe("saved");
  });

  test("conflict copy refuses unsupported browsers and files open elsewhere", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const firstId = await activeWorkspaceId(page);

    await page.evaluate(() => (window as any).__editor__.newWorkspace());
    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });
    await saveActiveToFile(page, "other.archidraw");
    await page.evaluate((wsId) => (window as any).__editor__.openWorkspace(wsId), firstId);

    await freezeDiskAutosave(page);
    await drawRect(page, { x: 320, y: 200 }, { x: 420, y: 280 });
    const { text } = await readWorkspaceJson(page, WORKSPACE_FILE);
    await writeOpfs(
      page,
      WORKSPACE_FILE,
      patchWorkspace(text, (data) => {
        data.tabs[0].doc.elements[0].x = 999;
      }),
    );
    expect(await page.evaluate(() => (window as any).__documents__.save())).toBe(false);
    await expect(page.locator('[data-testid="sync-conflict"]')).toBeVisible();

    await setPickerThrows(page, "save", "copy denied");
    expect(
      await page.evaluate(
        (wsId) => (window as any).__documents__.resolveConflict(wsId, "copy"),
        firstId,
      ),
    ).toBe(false);
    await expect(toast(page, "Could not save copy: copy denied")).toBeVisible();
    await installDocumentPicker(page);

    await queueDocumentSave(page, "other.archidraw");
    expect(
      await page.evaluate(
        (wsId) => (window as any).__documents__.resolveConflict(wsId, "copy"),
        firstId,
      ),
    ).toBe(false);
    await expect(toast(page, "already open in another workspace")).toBeVisible();

    await setDocumentPickerSupport(page, false);
    expect(
      await page.evaluate(
        (wsId) => (window as any).__documents__.resolveConflict(wsId, "copy"),
        firstId,
      ),
    ).toBe(false);
    await expect(toast(page, "Saving a copy requires Chrome or Edge")).toBeVisible();
  });

  test("access failures surface as error, permission and missing states", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);

    await page.evaluate(() => {
      const access = (window as any).__documents__.access;
      (window as any).__originalAccess__ = {
        stat: access.stat,
        read: access.read,
        write: access.write,
        query: access.queryPermission,
      };
      access.stat = async () => ({ mtime: Date.now() + 10_000, size: 12_345 });
      access.read = async () => {
        throw new Error("disk offline");
      };
    });
    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0])
      .toMatchObject({ status: "error", message: "disk offline" });

    await page.evaluate(() => {
      (window as any).__documents__.access.read = async () => {
        throw new DOMException("denied", "NotAllowedError");
      };
    });
    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("permission");

    await page.evaluate(() => {
      (window as any).__documents__.access.read = async () => {
        throw new DOMException("gone", "NotFoundError");
      };
    });
    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("missing");

    await page.evaluate(() => {
      const docs = (window as any).__documents__;
      const original = (window as any).__originalAccess__;
      docs.access.stat = original.stat;
      docs.access.read = original.read;
    });
    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("saved");

    await page.evaluate(() => {
      (window as any).__documents__.access.queryPermission = async () => {
        throw new Error("query failed");
      };
    });
    await pollDocuments(page);
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0])
      .toMatchObject({ status: "error", message: "query failed" });

    await page.evaluate(() => {
      const docs = (window as any).__documents__;
      docs.access.queryPermission = (window as any).__originalAccess__.query;
    });
    await pollDocuments(page);

    await freezeDiskAutosave(page);
    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });
    await page.evaluate(() => {
      (window as any).__documents__.access.write = async () => {
        throw new Error("disk full");
      };
    });
    expect(await page.evaluate(() => (window as any).__documents__.save())).toBe(false);
    await expect(
      toast(page, 'Could not write "plan.archidraw": disk full'),
    ).toBeVisible();
    expect((await documentSyncSnapshot(page)).views[0]?.status).toBe("error");
  });

  test("native picker wrappers handle empty and aborted responses", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const picker = (window as any).__documentsTest__.browserPicker;
      const originalOpen = window.showOpenFilePicker;
      const originalSave = window.showSaveFilePicker;

      window.showOpenFilePicker = async () => [];
      const empty = await picker.openArchidraw();

      const denied = new Error("denied");
      denied.name = "NotAllowedError";
      window.showOpenFilePicker = async () => {
        throw denied;
      };
      let openFailure = "";
      try {
        await picker.openArchidraw();
      } catch (error) {
        openFailure = (error as Error).name;
      }

      const aborted = new Error("cancelled");
      aborted.name = "AbortError";
      window.showSaveFilePicker = async () => {
        throw aborted;
      };
      const saveAborted = await picker.saveArchidraw("x.archidraw");

      window.showOpenFilePicker = originalOpen;
      window.showSaveFilePicker = originalSave;
      return { empty, openFailure, saveAborted };
    });

    expect(result).toEqual({
      empty: null,
      openFailure: "NotAllowedError",
      saveAborted: null,
    });
  });

  test("store failures do not block writes", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    await freezeDiskAutosave(page);

    await page.evaluate(() => {
      const docs = (window as any).__documents__;
      docs.store.put = async () => {
        throw new Error("put failed");
      };
    });
    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });
    expect(await page.evaluate(() => (window as any).__documents__.save())).toBe(true);
    await expect(
      toast(page, "Could not persist file binding: put failed"),
    ).toBeVisible();
    expect(
      (await readWorkspaceJson(page, WORKSPACE_FILE)).data.tabs[0].doc.elements,
    ).toHaveLength(2);
  });

  test("hashing and document ids fall back without WebCrypto", async ({ page }) => {
    const hash = await page.evaluate(async () => {
      const original = Object.getOwnPropertyDescriptor(crypto, "subtle");
      Object.defineProperty(crypto, "subtle", {
        configurable: true,
        value: undefined,
      });
      const digest = await (window as any).__documentsTest__.hashText("abc");
      if (original) Object.defineProperty(crypto, "subtle", original);
      return digest;
    });
    expect(hash).toBe("fnv1a:1a47e90b");

    await page.evaluate(() => {
      const original = crypto.randomUUID;
      (window as any).__originalUuid__ = original;
      Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        value: undefined,
      });
    });
    await queueDocumentSave(page, "fallback.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.saveAs())).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        value: (window as any).__originalUuid__,
      });
    });

    const { data } = await readWorkspaceJson(page, "fallback.archidraw");
    expect(data.uid).toMatch(/^doc_[0-9a-z]+_[0-9a-z]+$/);
  });

  test("opening files without identity creates a uid and names extension-only files", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const { text } = await readWorkspaceJson(page, WORKSPACE_FILE);
    const bare = patchWorkspace(text, (data) => {
      delete data.uid;
      delete data.name;
    });
    await writeOpfs(page, "notes.archidraw", bare);
    await writeOpfs(page, ".archidraw", bare);

    await queueDocumentOpen(page, "notes.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(true);
    await queueDocumentOpen(page, ".archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(true);

    const names = await page.evaluate(() =>
      (window as any).__editor__
        .getSnapshot()
        .workspaces.map((workspace: { name: string }) => workspace.name),
    );
    expect(names).toEqual(expect.arrayContaining(["notes", "Workspace"]));

    const notesId = await page.evaluate(
      () =>
        (window as any).__editor__
          .getSnapshot()
          .workspaces.find((workspace: { name: string }) => workspace.name === "notes").id,
    );
    await page.evaluate((wsId) => (window as any).__editor__.openWorkspace(wsId), notesId);
    expect(await page.evaluate(() => (window as any).__documents__.save())).toBe(true);

    const saved = await readWorkspaceJson(page, "notes.archidraw");
    expect(saved.data.uid).toMatch(/^doc_/);
    expect(saved.data.name).toBe("notes");
  });

  test("channel messages and visibility changes reconcile files", async ({ page }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const id = await activeWorkspaceId(page);

    const { text } = await readWorkspaceJson(page, WORKSPACE_FILE);
    await writeOpfs(
      page,
      WORKSPACE_FILE,
      patchWorkspace(text, (data) => {
        data.tabs[0].doc.elements[0].x = 321;
      }),
    );
    await page.evaluate((wsId: string) => {
      const channel = new BroadcastChannel("archidraw:documents");
      channel.postMessage({ workspaceId: wsId });
      channel.postMessage({});
      channel.postMessage("bad");
      setTimeout(() => channel.close(), 200);
    }, id);
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__editor__.getSnapshot().doc.elements[0]?.x),
      )
      .toBe(321);

    const current = await readWorkspaceJson(page, WORKSPACE_FILE);
    await writeOpfs(
      page,
      WORKSPACE_FILE,
      patchWorkspace(current.text, (data) => {
        data.tabs[0].doc.elements[0].x = 654;
      }),
    );
    await page.evaluate(() => {
      const docs = (window as any).__documents__;
      docs.pollHiddenMs = 20;
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__editor__.getSnapshot().doc.elements[0]?.x),
      )
      .toBe(654);

    await page.evaluate(() => {
      delete (document as any).visibilityState;
      document.dispatchEvent(new Event("visibilitychange"));
    });
  });

  test("reopening a file detaches the previous binding of a reused workspace", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const id = await activeWorkspaceId(page);
    const { text } = await readWorkspaceJson(page, WORKSPACE_FILE);
    await writeOpfs(page, "other.archidraw", text);

    await page.evaluate(() => {
      const editor = (window as any).__editor__;
      editor.selectAll();
      editor.deleteSelected();
    });
    await queueDocumentOpen(page, "other.archidraw");
    expect(await page.evaluate(() => (window as any).__documents__.open())).toBe(true);

    expect((await documentSyncSnapshot(page)).bindings).toBe(1);
    const binding = await page.evaluate(
      (wsId: string) => (window as any).__documents__.bindingFor(wsId)?.fileName,
      id,
    );
    expect(binding).toBe("other.archidraw");
    expect(
      await page.evaluate(() => (window as any).__documents__.bindingFor("ws_missing")),
    ).toBeNull();
    expect(await listOpfs(page)).toContain(WORKSPACE_FILE);
  });

  test("resolving without a conflict is a no-op", async ({ page }) => {
    expect(
      await page.evaluate(() => (window as any).__documents__.resolveConflict("ws_missing", "disk")),
    ).toBe(false);

    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const id = await activeWorkspaceId(page);
    expect(
      await page.evaluate(
        (wsId) => (window as any).__documents__.resolveConflict(wsId, "mine"),
        id,
      ),
    ).toBe(false);
  });

  test("reset hooks clear the picker, bindings and observable state", async ({
    page,
  }) => {
    await drawRect(page);
    await saveActiveToFile(page, WORKSPACE_FILE);
    const id = await activeWorkspaceId(page);

    const probe = await page.evaluate(async (wsId: string) => {
      const docs = (window as any).__documents__;
      const fileName = docs.bindingFor(wsId)?.fileName;
      await (window as any).__documentsTest__.clearBindings();
      (window as any).__documentsTest__.resetState();
      (window as any).__documentsTest__.resetPicker();
      return {
        fileName,
        snapshot: (window as any).__documentsTest__.syncSnapshot(),
      };
    }, id);

    expect(probe.fileName).toBe(WORKSPACE_FILE);
    expect(probe.snapshot.views).toEqual([]);
    expect(probe.snapshot.conflicts).toEqual([]);
  });

  test("workspace row actions save, save as and close keep the file", async ({
    page,
  }) => {
    await drawRect(page);
    await page.click('[data-testid="panel-toggle"]');

    await queueDocumentSave(page, WORKSPACE_FILE);
    await page.click('[data-testid="ws-save-file"]');
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
      .toBe("saved");

    // the menu Save flushes the dirty canvas to the bound file
    await freezeDiskAutosave(page);
    await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });
    await page.click('[data-testid="app-menu-button"]');
    await page
      .locator(".menu-item", {
        has: page.locator(".menu-item-label", { hasText: /^Save$/ }),
      })
      .click();
    await expect
      .poll(async () => (await readWorkspaceJson(page, WORKSPACE_FILE)).data.tabs[0].doc.elements.length)
      .toBe(2);

    // the menu Save As presents the modal to download the canvas or workspace
    await page.click('[data-testid="app-menu-button"]');
    await page
      .locator(".menu-item", {
        has: page.locator(".menu-item-label", { hasText: /^Save As/ }),
      })
      .click();
    await expect(page.getByRole("dialog", { name: "Save" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // drawing selects the new element, which closes the panel by design
    await page.click('[data-testid="panel-toggle"]');
    // the row action always save-as, even when a file is already bound
    await queueDocumentSave(page, "third.archidraw");
    await page.click('[data-testid="ws-save-as"]');
    await expect.poll(() => readOpfs(page, "third.archidraw")).not.toBeNull();

    await page.click('[data-testid="ws-delete"]');
    await expect(page.locator('[data-testid="ws-confirm"]')).toContainText(
      "will stay on disk",
    );
    await page.click('[data-testid="ws-confirm-btn"]');
    await expect
      .poll(async () => (await documentSyncSnapshot(page)).bindings)
      .toBe(0);
    expect(await readOpfs(page, "third.archidraw")).not.toBeNull();
  });
});
