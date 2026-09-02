import { test as base, expect, type Page } from "@playwright/test";

interface ConsoleIssue {
  kind: "console" | "pageerror";
  text: string;
}

type TestFixtures = {
  page: Page;
  editorState: () => Promise<EditorSnapshotLike>;
};

export interface EditorSnapshotLike {
  tool: string;
  selectedIds: string[];
  editingTextId: string | null;
  camera: { scrollX: number; scrollY: number; zoom: number };
  elementCount: number;
  tabs: { id: string; name: string }[];
  activeTabId: string;
  focusMode: boolean;
  elements: {
    id: string;
    type: string;
    componentId?: string;
    label?: string;
    labelT?: number;
    groupId?: string;
    details?: string;
  }[];
}

export const test = base.extend<TestFixtures>({
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
          tabs: s.tabs.map((t) => ({ ...t })),
          activeTabId: s.activeTabId,
          focusMode: s.focusMode,
          elements: s.doc.elements.map((el: any) => ({
            id: el.id,
            type: el.type,
            componentId: el.componentId,
            label: el.label,
            labelT: el.labelT,
            groupId: el.groupId,
            details: el.details,
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
  key: "v" | "h" | "r" | "d" | "e" | "l" | "a" | "t",
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
