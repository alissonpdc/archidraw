import { test as base, expect, type Page } from "@playwright/test";
import { addCoverageReport } from "monocart-reporter";

interface ConsoleIssue {
  kind: "console" | "pageerror";
  text: string;
}

type TestFixtures = {
  page: Page;
  editorState: () => Promise<EditorSnapshotLike>;
};

const collectCoverage = process.env.E2E_COVERAGE === "1";

export interface WorkspaceInfoLike {
  id: string;
  name: string;
  canvases: { id: string; name: string }[];
}

export interface EditorSnapshotLike {
  tool: string;
  selectedIds: string[];
  editingTextId: string | null;
  camera: { scrollX: number; scrollY: number; zoom: number };
  elementCount: number;
  tabs: { id: string; name: string }[];
  activeTabId: string;
  workspaces: WorkspaceInfoLike[];
  activeWorkspaceId: string;
  focusMode: boolean;
  elements: {
    id: string;
    type: string;
    componentId?: string;
    label?: string;
    labelT?: number;
    groupId?: string;
    details?: string;
    angle?: number;
  }[];
}

export const test = base.extend<TestFixtures>({
  autoCoverage: [
    async ({ page }, use) => {
      if (!collectCoverage) {
        await use();
        return;
      }
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      await use();
      const [jsCoverage] = await Promise.all([page.coverage.stopJSCoverage()]);
      if (jsCoverage && jsCoverage.length) {
        await addCoverageReport(jsCoverage, test.info());
      }
    },
    { scope: "test", auto: true },
  ],

  page: async ({ page }, use) => {
    const issues: ConsoleIssue[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        issues.push({ kind: "console", text: msg.text() });
      }
    });
    page.on("pageerror", (err) => {
      issues.push({ kind: "pageerror", text: err.message });
    });

    await use(page);

    if (issues.length > 0) {
      const detail = issues
        .map((i) => `[${i.kind}] ${i.text}`)
        .join("\n");
      throw new Error(
        `Console guard failed: ${issues.length} issue(s):\n${detail}`,
      );
    }
  },

  editorState: async ({ page }, use) => {
    use(async () => {
      return page.evaluate(() => {
        const ed = (window as any).__editor__;
        const s = ed.getSnapshot();
        return {
          tool: s.tool,
          selectedIds: [...s.selectedIds],
          editingTextId: s.editingTextId,
          camera: { ...s.camera },
          elementCount: s.doc.elements.length,
          tabs: s.tabs.map((t: any) => ({ ...t })),
          activeTabId: s.activeTabId,
          workspaces: s.workspaces.map((w: any) => ({
            id: w.id,
            name: w.name,
            canvases: w.canvases.map((c: any) => ({ id: c.id, name: c.name })),
          })),
          activeWorkspaceId: s.activeWorkspaceId,
          focusMode: s.focusMode,
          elements: s.doc.elements.map((el: any) => ({
            id: el.id,
            type: el.type,
            componentId: el.componentId,
            label: el.label,
            labelT: el.labelT,
            groupId: el.groupId,
            details: el.details,
            angle: el.angle,
          })),
        };
      });
    });
  },
});

export { expect };

// ---- helpers ------------------------------------------------------------

/** navigates and waits until the editor is fully hydrated */
export async function open(page: Page) {
  await page.goto("/");
  await page.waitForFunction(
    () =>
      (window as any).__editor__ !== undefined &&
      (window as any).__appReady__ === true,
  );
}

/**
 * Navigates and waits for both the editor and the document-sync boot. Boot
 * reconciles persisted file bindings before the app can safely autosave.
 */
export async function openWithDocuments(page: Page) {
  await open(page);
  await page.waitForFunction(() => (window as any).__documentsReady__ === true);
}

interface DocumentPickerState {
  supported: boolean;
  cancelSave: boolean;
  saveQueue: string[];
  openQueue: string[];
  saveCalls: string[];
  openCalls: (string | null)[];
}

/**
 * Replaces the native pickers with a deterministic OPFS-backed picker and
 * exposes queues in `window.__documentPicker__`:
 *
 *   await queueDocumentSave(page, "plan.archidraw");
 *   await page.getByTestId("ws-save-file").click();
 */
export async function installDocumentPicker(
  page: Page,
  options: { supported?: boolean; cancelSave?: boolean } = {},
) {
  await page.evaluate((opts: { supported: boolean; cancelSave: boolean }) => {
    const state: DocumentPickerState = {
      supported: opts.supported,
      cancelSave: opts.cancelSave,
      saveQueue: [],
      openQueue: [],
      saveCalls: [],
      openCalls: [],
    };
    (window as any).__documentPicker__ = state;
    const handleFor = async (name: string, create: boolean) => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(name, { create });
      if (create) return handle;
      // fails like an external deletion when the queued file does not exist
      await handle.getFile();
      return handle;
    };
    (window as any).__documentsTest__.setPicker({
      isSupported: () => state.supported,
      openArchidraw: async () => {
        const name = state.openQueue.shift() ?? null;
        state.openCalls.push(name);
        if (!name) return null;
        return handleFor(name, false);
      },
      saveArchidraw: async (suggestedName: string) => {
        state.saveCalls.push(suggestedName);
        if (state.cancelSave) return null;
        const name = state.saveQueue.shift() ?? suggestedName;
        return handleFor(name, true);
      },
    });
  }, { supported: options.supported ?? true, cancelSave: options.cancelSave ?? false });
}

export async function documentPickerState(page: Page) {
  return page.evaluate(() => {
    const state = (window as any).__documentPicker__ as DocumentPickerState;
    return {
      supported: state.supported,
      saveQueue: [...state.saveQueue],
      openQueue: [...state.openQueue],
      saveCalls: [...state.saveCalls],
      openCalls: [...state.openCalls],
    };
  });
}

export async function queueDocumentSave(page: Page, ...names: string[]) {
  await page.evaluate((queued: string[]) => {
    (window as any).__documentPicker__.saveQueue.push(...queued);
  }, names);
}

export async function queueDocumentOpen(page: Page, ...names: string[]) {
  await page.evaluate((queued: string[]) => {
    (window as any).__documentPicker__.openQueue.push(...queued);
  }, names);
}

export async function setDocumentPickerSupport(page: Page, supported: boolean) {
  await page.evaluate((value: boolean) => {
    (window as any).__documentPicker__.supported = value;
  }, supported);
}

/** writes a file into the origin-private file system used by the picker stub */
export async function writeOpfs(page: Page, name: string, text: string) {
  await page.evaluate(
    async ({ fileName, content }: { fileName: string; content: string }) => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
    },
    { fileName: name, content: text },
  );
}

/** reads an OPFS file, or null when it does not exist */
export async function readOpfs(page: Page, name: string): Promise<string | null> {
  return page.evaluate(async (fileName: string) => {
    const root = await navigator.storage.getDirectory();
    try {
      const handle = await root.getFileHandle(fileName);
      return await (await handle.getFile()).text();
    } catch {
      return null;
    }
  }, name);
}

export async function removeOpfs(page: Page, name: string) {
  await page.evaluate(async (fileName: string) => {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(fileName).catch(() => {});
  }, name);
}

export async function listOpfs(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const names: string[] = [];
    for await (const [name] of (root as any).entries()) names.push(name);
    return names.sort();
  });
}

/** runs the document service reconciliation immediately (instead of waiting) */
export async function pollDocuments(page: Page) {
  await page.evaluate(() => (window as any).__documentsTest__.poll());
}

export async function documentSyncSnapshot(page: Page) {
  return page.evaluate(() => {
    const docs = (window as any).__documents__;
    const snapshot = (window as any).__documentsTest__.syncSnapshot();
    return {
      bindings: docs.getBindingCount(),
      views: snapshot.views,
      conflicts: snapshot.conflicts,
    };
  });
}

/** drag on canvas from scene-independent screen coords */
export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

export async function selectTool(
  page: Page,
  key: "1" | "h" | "2" | "3" | "4" | "5" | "6" | "7" | "8",
) {
  await page.keyboard.press(key);
}

/**
 * Dispatch a synthetic paste event — cross-platform, works in headless CI
 * where Meta+v does not fire the native paste event (Linux).
 */
export async function pressPaste(page: Page) {
  await page.evaluate(() => {
    document.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      }),
    );
  });
}

/**
 * Dispatch a synthetic paste event carrying text content — simulates pasting
 * JSON copied from an external text editor into the canvas.
 */
export async function pressPasteText(page: Page, text: string) {
  await page.evaluate((value: string) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    document.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  }, text);
}

export type FilePayload =
  | string
  | {
      name: string;
      mimeType?: string;
      buffer: Buffer;
    };

/**
 * Drives the hidden `[data-testid="import-input"]` picker and resolves only
 * after the app's async `change` handler has fully run (file read → parse →
 * editor mutation → toast).
 *
 * `setInputFiles` returns as soon as the `change` event has been *dispatched*;
 * the app handler is `async` and starts with `await file.text()`, so reading
 * the editor right after it races the import and observes the pre-import
 * state. Every branch of `AppMenu.onImportFile` ends in a `toast(...)`, so we
 * arm a MutationObserver *before* the file is attached and resolve the moment
 * a brand-new toast node lands. See `.agents/knowledges/file-import-race.md`.
 */
export async function importFile(page: Page, file: FilePayload) {
  await page.evaluate(() => {
    const w = window as any;
    const alreadyShown = new Set<Element>(
      Array.from(document.querySelectorAll(".toast-stack .toast")),
    );
    w.__archidrawImportSettled = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        for (const node of document.querySelectorAll(".toast-stack .toast")) {
          if (!alreadyShown.has(node)) {
            observer.disconnect();
            resolve();
            return;
          }
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  });

  await page.setInputFiles('[data-testid="import-input"]', file as string);

  await page.evaluate(() => {
    const w = window as any;
    return Promise.race([
      w.__archidrawImportSettled,
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "importFile: the import change handler never settled within 20s",
              ),
            ),
          20_000,
        ),
      ),
    ]);
  });
}

/**
 * Presses a single-key shortcut and returns the file chooser it opened.
 *
 * `page.keyboard.press` injects a CDP key event; Chromium then drops the
 * *programmatic* `input.click()` the app performs in the keydown handler
 * roughly half the time when the renderer is contended (15 parallel workers),
 * so the picker never opens and the test hangs on `waitForEvent`. Dispatching
 * the same `keydown` from inside the page is deterministic — the very same
 * trick `pressPaste` uses for the native paste event.
 */
export async function openFileChooserViaShortcut(page: Page, key: string) {
  const chooser = page.waitForEvent("filechooser");
  await page.evaluate((k: string) => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: k,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, key);
  return chooser;
}

export async function cleanDefaults(page: Page) {
  await page.evaluate(() => {
    (window as any).__editor__.updateElements([], { roughness: 0 });
  });
}
