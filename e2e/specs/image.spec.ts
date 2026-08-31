import { test, expect, open } from "../fixtures";

test.describe("image features", () => {
  test("Open Image button is present in the toolbar", async ({ page }) => {
    await open(page);
    const imageBtn = page.locator('[aria-label="Open Image"]');
    await expect(imageBtn).toBeVisible();
  });

  test("insertImage adds an image element to the canvas", async ({
    page,
    editorState,
  }) => {
    await open(page);
    // create a tiny 2x2 red PNG as a data URL and insert via editor API
    const inserted = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      // build a minimal valid PNG (1x1 red pixel)
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
      const byteStr = atob(pngBase64);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/png" });
      const file = new File([blob], "test.png", { type: "image/png" });
      return new Promise<boolean>((resolve) => {
        // insertImage is async (FileReader + Image onload), so we poll
        ed.insertImage(file);
        const check = setInterval(() => {
          const s = ed.getSnapshot();
          if (s.doc.elements.length > 0) {
            clearInterval(check);
            resolve(true);
          }
        }, 50);
        setTimeout(() => {
          clearInterval(check);
          resolve(false);
        }, 3000);
      });
    });
    expect(inserted).toBe(true);
    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].type).toBe("image");
  });

  test("pasting an image from clipboard inserts an image element", async ({
    page,
    editorState,
  }) => {
    await open(page);
    // dispatch a paste event with image data
    const inserted = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      // build a minimal valid PNG (1x1 red pixel)
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
      const byteStr = atob(pngBase64);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/png" });
      const file = new File([blob], "pasted.png", { type: "image/png" });

      // create a DataTransferItem-like object for the clipboard event
      const dt = new DataTransfer();
      dt.items.add(file);
      const event = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
      });
      window.dispatchEvent(event);

      return new Promise<boolean>((resolve) => {
        const check = setInterval(() => {
          const s = ed.getSnapshot();
          if (s.doc.elements.length > 0) {
            clearInterval(check);
            resolve(true);
          }
        }, 50);
        setTimeout(() => {
          clearInterval(check);
          resolve(false);
        }, 3000);
      });
    });
    expect(inserted).toBe(true);
    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].type).toBe("image");
  });

  test("pasting an image with Meta+V from the real clipboard inserts it", async ({
    page,
    context,
    editorState,
  }) => {
    await open(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://localhost:4173",
    });
    // put a tiny 1x1 red PNG into the real OS clipboard
    const wrote = await page.evaluate(async () => {
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
      const byteStr = atob(pngBase64);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++)
        arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/png" });
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        return true;
      } catch (e) {
        return String(e);
      }
    });
    expect(wrote).toBe(true);

    // real keyboard shortcut — dispatches keydown + native paste event
    await page.keyboard.press("Meta+v");

    const inserted = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return new Promise<boolean>((resolve) => {
        const check = setInterval(() => {
          const s = ed.getSnapshot();
          if (s.doc.elements.length > 0) {
            clearInterval(check);
            resolve(true);
          }
        }, 50);
        setTimeout(() => {
          clearInterval(check);
          resolve(false);
        }, 3000);
      });
    });
    expect(inserted).toBe(true);
    const state = await editorState();
    expect(state.elements[0].type).toBe("image");
  });
});
