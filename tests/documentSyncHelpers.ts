import type { Page } from "@playwright/test";
import {
  expect,
  drag,
  selectTool,
  queueDocumentSave,
  readOpfs,
  writeOpfs,
  documentSyncSnapshot,
} from "./fixtures";

export async function drawRect(
  page: Page,
  from: { x: number; y: number } = { x: 100, y: 100 },
  to: { x: number; y: number } = { x: 220, y: 180 },
) {
  await selectTool(page, "2");
  await drag(page, from, to);
}

export async function activeWorkspaceId(page: Page): Promise<string> {
  return page.evaluate(
    () => (window as any).__editor__.getSnapshot().activeWorkspaceId,
  );
}

export async function elementCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as any).__editor__.getSnapshot().doc.elements.length,
  );
}

/** saves the active workspace through the injected picker and waits for disk */
export async function saveActiveToFile(page: Page, fileName: string) {
  await queueDocumentSave(page, fileName);
  const saved = await page.evaluate(() => (window as any).__documents__.save());
  expect(saved).toBe(true);
  await expect.poll(() => readOpfs(page, fileName)).not.toBeNull();
  await expect
    .poll(async () => (await documentSyncSnapshot(page)).views[0]?.status)
    .toBe("saved");
}

export async function readWorkspaceJson(page: Page, fileName: string) {
  const text = await readOpfs(page, fileName);
  if (text === null) throw new Error(`OPFS file ${fileName} is missing`);
  return { text, data: JSON.parse(text) };
}

export function patchWorkspace(
  text: string,
  patch: (data: any) => void,
): string {
  const data = JSON.parse(text);
  patch(data);
  return `${JSON.stringify(data, null, 2)}\n`;
}

export async function freezeDiskAutosave(page: Page) {
  await page.evaluate(() => {
    (window as any).__documents__.writeDelayMs = 60_000;
  });
}

/** local edit + external edit on the same base: returns the external text */
export async function createDocumentConflict(page: Page) {
  const fileName = "plan.archidraw";
  await drawRect(page);
  await saveActiveToFile(page, fileName);
  await freezeDiskAutosave(page);

  await drawRect(page, { x: 320, y: 100 }, { x: 420, y: 180 });

  const { text } = await readWorkspaceJson(page, fileName);
  const external = patchWorkspace(text, (data) => {
    data.tabs[0].doc.elements[0].x = 999;
  });
  await writeOpfs(page, fileName, external);

  const saved = await page.evaluate(() => (window as any).__documents__.save());
  expect(saved).toBe(false);
  await expect(page.locator('[data-testid="sync-conflict"]')).toBeVisible();
  return external;
}
